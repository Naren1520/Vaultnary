use sqlx::PgPool;
use time::OffsetDateTime;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::email::send_email;

const BATCH_SIZE: i64 = 10;

pub async fn run(db: PgPool) {
    loop {
        if let Err(cause) = process_batch(&db).await {
            error!(error = %cause, "Email outbox batch failed");
        }
        tokio::time::sleep(std::time::Duration::from_secs(10)).await;
    }
}

async fn process_batch(db: &PgPool) -> anyhow::Result<()> {
    let mut tx = db.begin().await?;
    let now = OffsetDateTime::now_utc();
    let rows: Vec<(Uuid, String, String, String, i32)> = sqlx::query_as(
        "SELECT id, recipient_email, subject, html_body, attempts
         FROM email_outbox
         WHERE available_at <= $1
           AND (locked_until IS NULL OR locked_until <= $1)
         ORDER BY created_at, id
         LIMIT $2
         FOR UPDATE SKIP LOCKED",
    )
    .bind(now)
    .bind(BATCH_SIZE)
    .fetch_all(&mut *tx)
    .await?;

    for (id, _, _, _, _) in &rows {
        sqlx::query("UPDATE email_outbox SET locked_until = $1 WHERE id = $2")
            .bind(now + time::Duration::minutes(2))
            .bind(id)
            .execute(&mut *tx)
            .await?;
    }
    tx.commit().await?;

    for (id, recipient, subject, html, attempts) in rows {
        match send_email(&recipient, &subject, &html).await {
            Ok(()) => {
                sqlx::query("DELETE FROM email_outbox WHERE id = $1")
                    .bind(id)
                    .execute(db)
                    .await?;
                info!(outbox_id = %id, "Queued email delivered");
            }
            Err(cause) => {
                let retry_delay = 30_i64 * 2_i64.pow(attempts.min(7) as u32);
                let retry_delay = retry_delay.min(3_600);
                let result = sqlx::query(
                    "UPDATE email_outbox
                     SET attempts = attempts + 1,
                         available_at = NOW() + ($1 * INTERVAL '1 second'),
                         locked_until = NULL
                     WHERE id = $2",
                )
                .bind(retry_delay)
                .bind(id)
                .execute(db)
                .await;
                if let Err(db_cause) = result {
                    error!(outbox_id = %id, error = %db_cause, "Could not reschedule failed email");
                    return Err(db_cause.into());
                }
                warn!(
                    outbox_id = %id,
                    attempt = attempts + 1,
                    error = %cause,
                    "Queued email delivery failed; retry scheduled"
                );
            }
        }
    }

    Ok(())
}
