use sqlx::PgPool;
use time::OffsetDateTime;
use tracing::{error, info};
use uuid::Uuid;

const BATCH_SIZE: i64 = 25;

pub async fn run(db: PgPool) {
    loop {
        if let Err(cause) = process_batch(&db).await {
            error!(error = %cause, "Scheduled vault destruction batch failed");
        }
        tokio::time::sleep(std::time::Duration::from_secs(30)).await;
    }
}

async fn process_batch(db: &PgPool) -> anyhow::Result<()> {
    let now = OffsetDateTime::now_utc();
    let rows: Vec<(Uuid, Uuid, Uuid, String)> = sqlx::query_as(
        "SELECT v.id, v.owner_id, v.workspace_id, v.name
         FROM vaults v
         WHERE v.destroy_at IS NOT NULL AND v.destroy_at <= $1
         ORDER BY v.destroy_at, v.id
         LIMIT $2
         FOR UPDATE SKIP LOCKED",
    )
    .bind(now)
    .bind(BATCH_SIZE)
    .fetch_all(db)
    .await?;

    for (vault_id, owner_id, workspace_id, vault_name) in rows {
        let mut tx = db.begin().await?;
        let vault: Option<(Uuid, OffsetDateTime, Option<Uuid>)> = sqlx::query_as(
            "SELECT id, created_at, service_id
             FROM vaults
             WHERE id = $1
               AND owner_id = $2
               AND workspace_id = $3
               AND destroy_at IS NOT NULL
               AND destroy_at <= $4
             FOR UPDATE",
        )
        .bind(vault_id)
        .bind(owner_id)
        .bind(workspace_id)
        .bind(now)
        .fetch_optional(&mut *tx)
        .await?;

        let Some((vault_id, created_at, service_id)) = vault else {
            tx.commit().await?;
            continue;
        };
        let destroyed_at = OffsetDateTime::now_utc();

        sqlx::query(
            "INSERT INTO deleted_vaults
             (id, owner_id, workspace_id, service_id, name, original_created_at,
              destroyed_at, deleted_by, reason)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'scheduled')",
        )
        .bind(vault_id)
        .bind(owner_id)
        .bind(workspace_id)
        .bind(service_id)
        .bind(&vault_name)
        .bind(created_at)
        .bind(destroyed_at)
        .execute(&mut *tx)
        .await?;

        sqlx::query("DELETE FROM vaults WHERE id = $1")
            .bind(vault_id)
            .execute(&mut *tx)
            .await?;

        sqlx::query(
            "INSERT INTO audit_events (actor_id, action_type, resource_id, resource_type)
             VALUES ($1, 'vault.deleted', $2, 'vault')",
        )
        .bind(owner_id)
        .bind(vault_id)
        .execute(&mut *tx)
        .await?;

        let recipient: Option<(String,)> =
            sqlx::query_as("SELECT email FROM users WHERE id = $1")
                .bind(owner_id)
                .fetch_optional(&mut *tx)
                .await?;
        if let Some((recipient_email,)) = recipient {
            let safe_name = escape_html(&vault_name);
            let safe_id = escape_html(&vault_id.to_string());
            sqlx::query(
                "INSERT INTO email_outbox (recipient_email, subject, html_body)
                 VALUES ($1, $2, $3)",
            )
            .bind(&recipient_email)
            .bind(format!("Vault deleted: {vault_name}"))
            .bind(format!(
                "<p>The vault <strong>{safe_name}</strong> was automatically deleted.</p>\
                 <p>Vault ID: <code>{safe_id}</code></p>\
                 <p>Deleted at: {destroyed_at}</p>"
            ))
            .execute(&mut *tx)
            .await?;
        }
        tx.commit().await?;
        info!(vault_id = %vault_id, "Scheduled vault destruction completed");
    }

    Ok(())
}

fn escape_html(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}
