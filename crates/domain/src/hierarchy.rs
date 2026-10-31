/* Credential tree / hierarchy domain logic */

use uuid::Uuid;

/* Check if setting parent_item_id=proposed_parent on item_id would create a cycle.
   Uses recursive CTE to walk the ancestor chain. Returns Err if a cycle is detected. */
pub async fn check_cycle(
    db: &sqlx::PgPool,
    item_id: Uuid,
    proposed_parent: Uuid,
) -> Result<(), shared::AppError> {
    /* Immediate self-reference is always a cycle */
    if proposed_parent == item_id {
        return Err(shared::AppError::UnprocessableEntity("circular relationship detected".into()));
    }
    /* Walk ancestors of proposed_parent; if item_id appears it would be a cycle */
    let row: Option<(bool,)> = sqlx::query_as(
        "WITH RECURSIVE ancestors AS (
           SELECT parent_item_id FROM vault_items WHERE id = $1
           UNION ALL
           SELECT vi.parent_item_id FROM vault_items vi
           JOIN ancestors a ON vi.id = a.parent_item_id
           WHERE a.parent_item_id IS NOT NULL
         )
         SELECT true FROM ancestors WHERE parent_item_id = $2 LIMIT 1",
    )
    .bind(proposed_parent)
    .bind(item_id)
    .fetch_optional(db)
    .await
    .map_err(|e| shared::AppError::Internal(e.into()))?;

    if row.is_some() {
        return Err(shared::AppError::UnprocessableEntity("circular relationship detected".into()));
    }
    Ok(())
}
