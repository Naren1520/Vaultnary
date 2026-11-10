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
    routes::workspaces::{
        default_workspace_id, requested_workspace_id, require_workspace_editor,
        workspace_member_role,
    },
    state::AppState,
};
use shared::AppError;

const MAX_NAME_LEN: usize = 100;
const MAX_DESC_LEN: usize = 500;

const VALID_ENVIRONMENTS: &[&str] = &["development", "staging", "production", "custom"];

fn validate_service_fields(
    body: &serde_json::Value,
) -> Result<(String, Option<String>, String, Option<Uuid>), ApiError> {
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
    let project_id = match body.get("project_id") {
        None | Some(serde_json::Value::Null) => None,
        Some(serde_json::Value::String(value)) => {
            let project_id = Uuid::parse_str(value).map_err(|_| {
                ApiError::with_details(
                    AppError::UnprocessableEntity("project_id: must be a UUID".into()),
                    vec![ErrorDetail {
                        field: "project_id".into(),
                        rule: "uuid".into(),
                    }],
                )
            })?;
            Some(project_id)
        }
        Some(_) => {
            return Err(ApiError::with_details(
                AppError::UnprocessableEntity("project_id: must be a UUID".into()),
                vec![ErrorDetail {
                    field: "project_id".into(),
                    rule: "uuid".into(),
                }],
            ));
        }
    };
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

    let workspace_id = if let Some(pid) = project_id {
        let project_workspace: Option<(Uuid,)> = sqlx::query_as(
            "SELECT p.workspace_id FROM projects p
             JOIN workspace_members wm ON wm.workspace_id = p.workspace_id
             WHERE p.id = $1 AND wm.user_id = $2",
        )
        .bind(pid)
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
        project_workspace
    } else {
        match requested_workspace_id {
            Some(workspace_id) => workspace_id,
            None => default_workspace_id(db, auth.user_id).await?,
        }
    };
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
        project_id: Option<Uuid>,
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
        Option<Uuid>,
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
        project_id: Option<Uuid>,
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
        Option<Uuid>,
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
        project_id: Option<Uuid>,
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

    if let Some(pid) = project_id {
        let project_workspace: Option<(Uuid,)> =
            sqlx::query_as("SELECT workspace_id FROM projects WHERE id = $1")
                .bind(pid)
                .fetch_optional(db)
                .await
                .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
        if project_workspace.map(|(project_workspace,)| project_workspace) != Some(workspace_id) {
            return Err(ApiError::new(AppError::NotFound));
        }
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

#[cfg(test)]
mod tests {
    use super::validate_service_fields;

    fn valid_service() -> serde_json::Value {
        serde_json::json!({
            "name": "API",
            "environment": "development"
        })
    }

    #[test]
    fn service_validation_accepts_optional_project_and_description() {
        let body = serde_json::json!({
            "name": " API ",
            "description": "Internal API",
            "environment": "production",
            "project_id": null
        });
        let (name, description, environment, project_id) = validate_service_fields(&body).unwrap();
        assert_eq!(name, "API");
        assert_eq!(description.as_deref(), Some("Internal API"));
        assert_eq!(environment, "production");
        assert_eq!(project_id, None);
    }

    #[test]
    fn service_validation_rejects_invalid_environment_and_project_id() {
        let mut body = valid_service();
        body["environment"] = serde_json::json!("qa");
        assert!(validate_service_fields(&body).is_err());

        body["environment"] = serde_json::json!("development");
        body["project_id"] = serde_json::json!("not-a-uuid");
        assert!(validate_service_fields(&body).is_err());

        body["project_id"] = serde_json::json!(42);
        assert!(validate_service_fields(&body).is_err());
    }
}
