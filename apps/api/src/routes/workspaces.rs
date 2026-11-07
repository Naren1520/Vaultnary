use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::Serialize;
use sqlx::PgPool;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::{
    error::{ApiError, ErrorDetail},
    middleware::auth::AuthUser,
    state::AppState,
};
use shared::AppError;

const MAX_WORKSPACE_NAME_LEN: usize = 100;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum WorkspaceRole {
    Owner,
    Admin,
    Editor,
    Viewer,
}

impl TryFrom<&str> for WorkspaceRole {
    type Error = ();

    fn try_from(role: &str) -> Result<Self, Self::Error> {
        match role {
            "owner" => Ok(Self::Owner),
            "admin" => Ok(Self::Admin),
            "editor" => Ok(Self::Editor),
            "viewer" => Ok(Self::Viewer),
            _ => Err(()),
        }
    }
}

impl WorkspaceRole {
    pub(crate) fn can_manage(self) -> bool {
        matches!(self, Self::Owner | Self::Admin)
    }

    pub(crate) fn can_edit(self) -> bool {
        matches!(self, Self::Owner | Self::Admin | Self::Editor)
    }
}

pub(crate) async fn default_workspace_id(db: &PgPool, user_id: Uuid) -> Result<Uuid, ApiError> {
    let workspace_id: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM workspaces WHERE owner_id = $1 ORDER BY created_at, id LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    workspace_id
        .map(|(id,)| id)
        .ok_or_else(|| ApiError::new(AppError::NotFound))
}

pub(crate) async fn require_workspace_editor(
    db: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<(), ApiError> {
    let role = workspace_member_role(db, workspace_id, user_id).await?;
    if !role.can_edit() {
        return Err(ApiError::new(AppError::Forbidden));
    }
    Ok(())
}

pub(crate) async fn workspace_member_role(
    db: &PgPool,
    workspace_id: Uuid,
    user_id: Uuid,
) -> Result<WorkspaceRole, ApiError> {
    let role: Option<(String,)> = sqlx::query_as(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    )
    .bind(workspace_id)
    .bind(user_id)
    .fetch_optional(db)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let (role,) = role.ok_or_else(|| ApiError::new(AppError::NotFound))?;
    WorkspaceRole::try_from(role.as_str()).map_err(|_| {
        ApiError::new(AppError::Internal(anyhow::anyhow!(
            "invalid workspace role"
        )))
    })
}

fn validate_workspace_name(body: &serde_json::Value) -> Result<String, ApiError> {
    let name = body
        .get("name")
        .and_then(serde_json::Value::as_str)
        .unwrap_or("")
        .trim();

    if name.is_empty() || name.chars().count() > MAX_WORKSPACE_NAME_LEN {
        return Err(ApiError::with_details(
            AppError::UnprocessableEntity("name: must be 1-100 characters".into()),
            vec![ErrorDetail {
                field: "name".into(),
                rule: "length_1_100".into(),
            }],
        ));
    }

    Ok(name.to_owned())
}

pub(crate) fn requested_workspace_id(body: &serde_json::Value) -> Result<Option<Uuid>, ApiError> {
    let Some(value) = body.get("workspace_id") else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }

    let id = value.as_str().and_then(|value| Uuid::parse_str(value).ok());
    id.map(Some).ok_or_else(|| {
        ApiError::with_details(
            AppError::UnprocessableEntity("workspace_id: must be a UUID".into()),
            vec![ErrorDetail {
                field: "workspace_id".into(),
                rule: "uuid".into(),
            }],
        )
    })
}

#[derive(Serialize)]
struct WorkspaceSummary {
    id: Uuid,
    name: String,
    role: WorkspaceRole,
    created_at: String,
}

/// GET /api/v1/workspaces
pub async fn list_workspaces(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
) -> Result<impl IntoResponse, ApiError> {
    let rows: Vec<(Uuid, String, String, OffsetDateTime)> = sqlx::query_as(
        "SELECT w.id, w.name, wm.role, w.created_at
         FROM workspaces w
         JOIN workspace_members wm ON wm.workspace_id = w.id
         WHERE wm.user_id = $1
         ORDER BY w.created_at, w.id",
    )
    .bind(auth.user_id)
    .fetch_all(state.db())
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let workspaces = rows
        .into_iter()
        .map(|(id, name, role, created_at)| {
            let role = WorkspaceRole::try_from(role.as_str()).map_err(|_| {
                ApiError::new(AppError::Internal(anyhow::anyhow!(
                    "invalid workspace role"
                )))
            })?;
            Ok(WorkspaceSummary {
                id,
                name,
                role,
                created_at: created_at.to_string(),
            })
        })
        .collect::<Result<Vec<_>, ApiError>>()?;

    Ok(Json(serde_json::json!({ "data": workspaces })))
}

/// POST /api/v1/workspaces
pub async fn create_workspace(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let name = validate_workspace_name(&body)?;
    let workspace_id = Uuid::new_v4();
    let now = OffsetDateTime::now_utc();
    let mut tx = state
        .db()
        .begin()
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "INSERT INTO workspaces (id, name, owner_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $4)",
    )
    .bind(workspace_id)
    .bind(&name)
    .bind(auth.user_id)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
         VALUES ($1, $2, 'owner', $3)",
    )
    .bind(workspace_id)
    .bind(auth.user_id)
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    tx.commit()
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    Ok((
        StatusCode::CREATED,
        Json(serde_json::json!({
            "data": {
                "id": workspace_id,
                "name": name,
                "role": WorkspaceRole::Owner,
                "created_at": now.to_string(),
            }
        })),
    ))
}

/// GET /api/v1/workspaces/:workspace_id
pub async fn get_workspace(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    let role = workspace_member_role(state.db(), workspace_id, auth.user_id).await?;
    let row: Option<(String, Uuid, OffsetDateTime, OffsetDateTime)> = sqlx::query_as(
        "SELECT name, owner_id, created_at, updated_at FROM workspaces WHERE id = $1",
    )
    .bind(workspace_id)
    .fetch_optional(state.db())
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;
    let (name, owner_id, created_at, updated_at) =
        row.ok_or_else(|| ApiError::new(AppError::NotFound))?;

    Ok(Json(serde_json::json!({
        "data": {
            "id": workspace_id,
            "name": name,
            "owner_id": owner_id,
            "role": role,
            "created_at": created_at.to_string(),
            "updated_at": updated_at.to_string(),
        }
    })))
}

/// PUT /api/v1/workspaces/:workspace_id
pub async fn update_workspace(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ApiError> {
    let role = workspace_member_role(state.db(), workspace_id, auth.user_id).await?;
    if !role.can_manage() {
        return Err(ApiError::new(AppError::Forbidden));
    }

    let name = validate_workspace_name(&body)?;
    let result = sqlx::query("UPDATE workspaces SET name = $1, updated_at = NOW() WHERE id = $2")
        .bind(name)
        .bind(workspace_id)
        .execute(state.db())
        .await
        .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    if result.rows_affected() == 0 {
        return Err(ApiError::new(AppError::NotFound));
    }
    Ok(StatusCode::OK)
}

#[derive(Serialize)]
struct WorkspaceMember {
    user_id: Uuid,
    email: String,
    role: WorkspaceRole,
    created_at: String,
}

/// GET /api/v1/workspaces/:workspace_id/members
pub async fn list_members(
    State(state): State<AppState>,
    Extension(auth): Extension<AuthUser>,
    Path(workspace_id): Path<Uuid>,
) -> Result<impl IntoResponse, ApiError> {
    workspace_member_role(state.db(), workspace_id, auth.user_id).await?;
    let rows: Vec<(Uuid, String, String, OffsetDateTime)> = sqlx::query_as(
        "SELECT u.id, u.email, wm.role, wm.created_at
         FROM workspace_members wm
         JOIN users u ON u.id = wm.user_id
         WHERE wm.workspace_id = $1
         ORDER BY wm.created_at, u.email",
    )
    .bind(workspace_id)
    .fetch_all(state.db())
    .await
    .map_err(|e| ApiError::new(AppError::Internal(e.into())))?;

    let members = rows
        .into_iter()
        .map(|(user_id, email, role, created_at)| {
            let role = WorkspaceRole::try_from(role.as_str()).map_err(|_| {
                ApiError::new(AppError::Internal(anyhow::anyhow!(
                    "invalid workspace role"
                )))
            })?;
            Ok(WorkspaceMember {
                user_id,
                email,
                role,
                created_at: created_at.to_string(),
            })
        })
        .collect::<Result<Vec<_>, ApiError>>()?;

    Ok(Json(serde_json::json!({ "data": members })))
}

#[cfg(test)]
mod tests {
    use super::{requested_workspace_id, validate_workspace_name, WorkspaceRole};
    use uuid::Uuid;

    #[test]
    fn workspace_roles_only_allow_owner_and_admin_to_manage() {
        assert!(WorkspaceRole::Owner.can_manage());
        assert!(WorkspaceRole::Admin.can_manage());
        assert!(!WorkspaceRole::Editor.can_manage());
        assert!(!WorkspaceRole::Viewer.can_manage());
        assert!(WorkspaceRole::Editor.can_edit());
        assert!(!WorkspaceRole::Viewer.can_edit());
    }

    #[test]
    fn workspace_name_is_trimmed_and_bounded() {
        assert_eq!(
            validate_workspace_name(&serde_json::json!({ "name": "  Team  " })).unwrap(),
            "Team"
        );
        assert!(validate_workspace_name(&serde_json::json!({ "name": "  " })).is_err());
        assert!(validate_workspace_name(&serde_json::json!({ "name": "x".repeat(101) })).is_err());
    }

    #[test]
    fn requested_workspace_id_accepts_only_uuid_values() {
        let id = Uuid::new_v4();
        assert_eq!(
            requested_workspace_id(&serde_json::json!({ "workspace_id": id.to_string() })).unwrap(),
            Some(id)
        );
        assert_eq!(
            requested_workspace_id(&serde_json::json!({})).unwrap(),
            None
        );
        assert!(requested_workspace_id(&serde_json::json!({
            "workspace_id": "not-a-uuid"
        }))
        .is_err());
        assert!(requested_workspace_id(&serde_json::json!({
            "workspace_id": 42
        }))
        .is_err());
    }
}
