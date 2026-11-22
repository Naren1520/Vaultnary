use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Serialize;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    error::{ApiError, ErrorDetail},
    middleware::auth::AuthUser,
    routes::workspaces::{requested_workspace_id, require_workspace_editor, workspace_member_role},
    state::AppState,
};
use shared::AppError;

const MAX_NAME_LEN: usize = 100;
const MAX_DESC_LEN: usize = 500;

const VALID_ENVIRONMENTS: &[&str] = &["development", "staging", "production", "custom"];

fn validate_service_fields(
    body: &serde_json::Value,
) -> Result<(String, Option<String>, String, Uuid), ApiError> {
    let name = body
        .get("name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim()
        .to_string();
    if name.is_empty() || name.len() > MAX_NAME_LEN {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("name: must be 1-100 chars".into()),
            vec![ErrorDetail {
                field: "name".into(),
                rule: "length_1_100".into(),
            }],
        ));
    }
    let description = body
        .get("description")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    if let Some(ref d) = description {
        if d.len() > MAX_DESC_LEN {
            return Err(ApiError::with_details(
                AppError::UnprocessableEntity("description: max 500 chars".into()),
                vec![ErrorDetail {
                    field: "description".into(),
                    rule: "max_500".into(),
                }],
            ));
        }
    }
    let environment = body
        .get("environment")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if !VALID_ENVIRONMENTS.contains(&environment.as_str()) {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity(
                "environment: must be development, staging, production, or custom".into(),
            ),
            vec![ErrorDetail {
                field: "environment".into(),
                rule: "invalid_enum".into(),
            }],
        ));
    }
    let project_value = body
        .get("project_id")
        .and_then(serde_json::Value::as_str)
        .ok_or_else(|| {
            ApiError::with_details(
                AppError::UnprocessableEntity("project_id: is required and must be a UUID".into()),
                vec![ErrorDetail {
                    field: "project_id".into(),
                    rule: "required_uuid".into(),
                }],
            )
        })?;
    let project_id = Uuid::parse_str(project_value).map_err(|_| {
        ApiError::with_details(
            AppError::UnprocessableEntity("project_id: must be a UUID".into()),
            vec![ErrorDetail {
                field: "project_id".into(),
                rule: "uuid".into(),
            }],
        )
    })?;
    Ok((name, description, environment, project_id))
}

/* POST /api/v1/services */
pub async fn create_service(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let (name, description, environment, project_id) = validate_service_fields(&body)?;
    let db = state.db();
    let requested_workspace_id = requested_workspace_id(&body)?;

    let project_workspace: Option<(Uuid,)> = sqlx::query_as(
        "SELECT p.workspace_id FROM projects p
         JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
         WHERE p.id = $1 AND wm.user_id = $2",
    )
    .bind(project_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    let project_workspace = project_workspace
        .map(|(workspace_id,)| workspace_id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))?;
    if requested_workspace_id.is_some_and(|workspace_id| workspace_id != project_workspace) {
        return Err(ApiError::new(AppError::Conflict(
            "The selected project belongs to a different workspace".into(),
        )));
    }
    let workspace_id = project_workspace;
    require_workspace_editor(db, workspace_id, auth.user_id).await?;

    let id = Uuid::new_v4();
    let now = OffsetDateTime::now_utc();
    sqlx::query(
        "INSERT INTO services (id, owner_id, workspace_id, name, description, environment, project_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)",
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(workspace_id)
    .bind(&name)
    .bind(&description)
    .bind(&environment)
    .bind(project_id)
    .bind(now)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct ServiceResp {
        id: Uuid,
        workspace_id: Uuid,
        name: String,
        description: Option<String>,
        environment: String,
        project_id: Uuid,
        created_at: String,
    }
    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({ "data": ServiceResp {
            id, workspace_id, name, description, environment, project_id,
            created_at: now.to_string(),
        }})),
    )
        .into_response())
}

/* GET /api/v1/services */
pub async fn list_services(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    type Row = (
        Uuid,
        Uuid,
        String,
        Option<String>,
        String,
        Uuid,
        OffsetDateTime,
    );
    let rows: Vec<Row> = sqlx::query_as(
        "SELECT s.id, s.workspace_id, s.name, s.description, s.environment, s.project_id, s.created_at
         FROM services s
         JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
         WHERE wm.user_id = $1
         ORDER BY s.created_at DESC",
    )
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct ServiceItem {
        id: Uuid,
        workspace_id: Uuid,
        name: String,
        description: Option<String>,
        environment: String,
        project_id: Uuid,
        created_at: String,
    }
    let items: Vec<ServiceItem> = rows
        .into_iter()
        .map(|(id, workspace_id, name, desc, env, pid, ca)| ServiceItem {
            id,
            workspace_id,
            name,
            description: desc,
            environment: env,
            project_id: pid,
            created_at: ca.to_string(),
        })
        .collect();
    Ok(Json(serde_json::json!({ "data": items })))
}

/* GET /api/v1/services/:service_id */
pub async fn get_service(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();
    type Row = (
        Uuid,
        Uuid,
        String,
        Option<String>,
        String,
        Uuid,
        OffsetDateTime,
    );
    let row: Option<Row> = sqlx::query_as(
        "SELECT s.id, s.workspace_id, s.name, s.description, s.environment, s.project_id, s.created_at
         FROM services s
         JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
         WHERE s.id = $1 AND wm.user_id = $2",
    )
    .bind(service_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (id, workspace_id, name, description, environment, project_id, created_at) =
        row.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    #[derive(Serialize)]
    struct ServiceResp {
        id: Uuid,
        workspace_id: Uuid,
        name: String,
        description: Option<String>,
        environment: String,
        project_id: Uuid,
        created_at: String,
    }
    Ok(Json(serde_json::json!({ "data": ServiceResp {
        id, workspace_id, name, description, environment, project_id, created_at: created_at.to_string(),
    }})))
}

/* PUT /api/v1/services/:service_id */
pub async fn update_service(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let (name, description, environment, project_id) = validate_service_fields(&body)?;
    let db = state.db();

    let workspace_id: Option<(Uuid,)> =
        sqlx::query_as("SELECT workspace_id FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    let workspace_id = workspace_id
        .map(|(workspace_id,)| workspace_id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))?;
    require_workspace_editor(db, workspace_id, auth.user_id).await?;

    let project_workspace: Option<(Uuid,)> =
        sqlx::query_as("SELECT workspace_id FROM projects WHERE id = $1")
            .bind(project_id)
            .fetch_optional(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    if project_workspace.map(|(project_workspace,)| project_workspace) != Some(workspace_id) {
        return Err(ApiError::new(AppError::NotFound));
    }

    let result = sqlx::query(
        "UPDATE services SET name = $1, description = $2, environment = $3, project_id = $4, updated_at = NOW()
         WHERE id = $5",
    )
    .bind(&name)
    .bind(&description)
    .bind(&environment)
    .bind(project_id)
    .bind(service_id)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::new(AppError::NotFound));
    }
    Ok(StatusCode::OK.into_response())
}

/* DELETE /api/v1/services/:service_id */
pub async fn delete_service(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
    body: Option<Json<serde_json::Value>>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let workspace_id: Option<(Uuid,)> =
        sqlx::query_as("SELECT workspace_id FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let workspace_id = workspace_id
        .map(|(workspace_id,)| workspace_id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))?;
    let role = workspace_member_role(db, workspace_id, auth.user_id).await?;
    if !role.can_manage() {
        return Err(ApiError::new(AppError::Forbidden));
    }

    let vault_count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM vaults WHERE service_id = $1")
        .bind(service_id)
        .fetch_one(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    let confirmed = body
        .and_then(|Json(value)| value.get("confirm").and_then(serde_json::Value::as_bool))
        .unwrap_or(false);
    if vault_count > 0 && !confirmed {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity(
                "confirm: deleting this service also deletes its vaults and credentials".into(),
            ),
            vec![ErrorDetail {
                field: "confirm".into(),
                rule: "required_true_for_cascade".into(),
            }],
        ));
    }

    let mut tx = db
        .begin()
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    sqlx::query("DELETE FROM credential_usage WHERE service_id = $1")
        .bind(service_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    sqlx::query("DELETE FROM services WHERE id = $1")
        .bind(service_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    tx.commit()
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok(StatusCode::OK.into_response())
}

/* GET /api/v1/services/:service_id/credentials */
pub async fn service_credentials(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let db = state.db();

    let workspace_id: Option<(Uuid,)> =
        sqlx::query_as("SELECT workspace_id FROM services WHERE id = $1")
            .bind(service_id)
            .fetch_optional(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let workspace_id = workspace_id
        .map(|(workspace_id,)| workspace_id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))?;
    workspace_member_role(db, workspace_id, auth.user_id).await?;

    type CredRow = (Uuid, String, String);
    let rows: Vec<CredRow> = sqlx::query_as(
        "SELECT vi.id, vi.name, vi.credential_type
         FROM vault_items vi
         JOIN credential_usage cu ON cu.item_id = vi.id
         JOIN credential_permissions cp ON cp.item_id = vi.id AND cp.user_id = $2
         WHERE cu.service_id = $1
         GROUP BY vi.id, vi.name, vi.credential_type
         ORDER BY vi.name ASC",
    )
    .bind(service_id)
    .bind(auth.user_id)
    .fetch_all(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    #[derive(Serialize)]
    struct CredItem {
        id: Uuid,
        name: String,
        credential_type: String,
    }
    let items: Vec<CredItem> = rows
        .into_iter()
        .map(|(id, name, ct)| CredItem {
            id,
            name,
            credential_type: ct,
        })
        .collect();
    Ok(Json(serde_json::json!({ "data": items })))
}

#[derive(Serialize)]
pub struct VaultSummary {
    id: Uuid,
    workspace_id: Uuid,
    workspace_name: String,
    project_id: Uuid,
    service_id: Uuid,
    name: String,
    service_name: String,
    project_name: String,
    environment: String,
    created_at: String,
}

type VaultRow = (
    Uuid,
    Uuid,
    String,
    Uuid,
    Uuid,
    String,
    String,
    String,
    String,
    OffsetDateTime,
);

fn vault_summary(
    (
        id,
        workspace_id,
        workspace_name,
        project_id,
        service_id,
        name,
        service_name,
        project_name,
        environment,
        created_at,
    ): VaultRow,
) -> VaultSummary {
    VaultSummary {
        id,
        workspace_id,
        workspace_name,
        project_id,
        service_id,
        name,
        service_name,
        project_name,
        environment,
        created_at: created_at.to_string(),
    }
}

/// GET /api/v1/vaults
pub async fn list_vaults(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let rows: Vec<VaultRow> = sqlx::query_as(
        "SELECT v.id, v.workspace_id, w.name, s.project_id, s.id, v.name,
                s.name, p.name, s.environment, v.created_at
         FROM vaults v
         JOIN services s ON s.id = v.service_id
         JOIN projects p ON p.id = s.project_id
         JOIN workspaces w ON w.id = v.workspace_id
         JOIN workspace_members wm ON wm.workspace_id = v.workspace_id
         WHERE wm.user_id = $1
         ORDER BY p.name, s.name, v.name, v.created_at",
    )
    .bind(auth.user_id)
    .fetch_all(state.db())
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok(Json(serde_json::json!({
        "data": rows.into_iter().map(vault_summary).collect::<Vec<_>>()
    })))
}

/// GET /api/v1/services/:service_id/vaults
pub async fn list_service_vaults(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let rows: Vec<VaultRow> = sqlx::query_as(
        "SELECT v.id, v.workspace_id, w.name, s.project_id, s.id, v.name,
                s.name, p.name, s.environment, v.created_at
         FROM vaults v
         JOIN services s ON s.id = v.service_id
         JOIN projects p ON p.id = s.project_id
         JOIN workspaces w ON w.id = v.workspace_id
         JOIN workspace_members wm ON wm.workspace_id = v.workspace_id
         WHERE wm.user_id = $1 AND s.id = $2
         ORDER BY v.created_at, v.id",
    )
    .bind(auth.user_id)
    .bind(service_id)
    .fetch_all(state.db())
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if rows.is_empty() {
        let service_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(
               SELECT 1 FROM services s
               JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
               WHERE s.id = $1 AND wm.user_id = $2
             )",
        )
        .bind(service_id)
        .bind(auth.user_id)
        .fetch_one(state.db())
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
        if !service_exists {
            return Err(ApiError::new(AppError::NotFound));
        }
    }

    Ok(Json(serde_json::json!({
        "data": rows.into_iter().map(vault_summary).collect::<Vec<_>>()
    })))
}

/// POST /api/v1/services/:service_id/vaults
pub async fn create_vault(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(service_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let name = body
        .get("name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .trim()
        .to_owned();
    if name.is_empty() || name.chars().count() > 100 {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("name: must be 1-100 characters".into()),
            vec![ErrorDetail {
                field: "name".into(),
                rule: "length_1_100".into(),
            }],
        ));
    }

    let db = state.db();
    let workspace_id: Option<(Uuid,)> = sqlx::query_as(
        "SELECT s.workspace_id FROM services s
         JOIN workspace_members wm ON wm.workspace_id = s.workspace_id
         WHERE s.id = $1 AND wm.user_id = $2",
    )
    .bind(service_id)
    .bind(auth.user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    let workspace_id = workspace_id
        .map(|(workspace_id,)| workspace_id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))?;
    require_workspace_editor(db, workspace_id, auth.user_id).await?;

    let id = Uuid::new_v4();
    let created_at = OffsetDateTime::now_utc();
    sqlx::query(
        "INSERT INTO vaults (id, owner_id, workspace_id, service_id, name, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)",
    )
    .bind(id)
    .bind(auth.user_id)
    .bind(workspace_id)
    .bind(service_id)
    .bind(&name)
    .bind(created_at)
    .execute(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "data": {
                "id": id,
                "workspace_id": workspace_id,
                "service_id": service_id,
                "name": name,
                "created_at": created_at.to_string(),
            }
        })),
    ))
}

/// DELETE /api/v1/vaults/:vault_id
pub async fn delete_vault(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(vault_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    if body.get("confirm").and_then(serde_json::Value::as_bool) != Some(true) {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("confirm: must be true".into()),
            vec![ErrorDetail {
                field: "confirm".into(),
                rule: "required_true".into(),
            }],
        ));
    }

    let db = state.db();
    let workspace_id: Option<(Uuid,)> =
        sqlx::query_as("SELECT workspace_id FROM vaults WHERE id = $1")
            .bind(vault_id)
            .fetch_optional(db)
            .await
            .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    let workspace_id = workspace_id
        .map(|(workspace_id,)| workspace_id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))?;
    let role = workspace_member_role(db, workspace_id, auth.user_id).await?;
    if !role.can_manage() {
        return Err(ApiError::new(AppError::Forbidden));
    }

    let result = sqlx::query("DELETE FROM vaults WHERE id = $1")
        .bind(vault_id)
        .execute(db)
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    if result.rows_affected() == 0 {
        return Err(ApiError::new(AppError::NotFound));
    }
    Ok(StatusCode::OK.into_response())
}

#[cfg(test)]
mod tests {
    use super::validate_service_fields;
    use uuid::Uuid;

    fn valid_service() -> serde_json::Value {
        serde_json::json!({
            "name": "API",
            "environment": "development",
            "project_id": Uuid::nil()
        })
    }

    #[test]
    fn service_validation_accepts_required_project_and_optional_description() {
        let project_id = Uuid::new_v4();
        let body = serde_json::json!({
            "name": " API ",
            "description": "Internal API",
            "environment": "production",
            "project_id": project_id
        });
        let (name, description, environment, received_project_id) =
            validate_service_fields(&body).unwrap();
        assert_eq!(name, "API");
        assert_eq!(description.as_deref(), Some("Internal API"));
        assert_eq!(environment, "production");
        assert_eq!(received_project_id, project_id);
    }

    #[test]
    fn service_validation_rejects_invalid_environment_or_missing_and_invalid_project_id() {
        let mut body = valid_service();
        body["environment"] = serde_json::json!("qa");
        assert!(validate_service_fields(&body).is_err());

        body["environment"] = serde_json::json!("development");
        body.as_object_mut().unwrap().remove("project_id");
        assert!(validate_service_fields(&body).is_err());

        body["project_id"] = serde_json::json!("not-a-uuid");
        assert!(validate_service_fields(&body).is_err());

        body["project_id"] = serde_json::json!(42);
        assert!(validate_service_fields(&body).is_err());
    }
}
