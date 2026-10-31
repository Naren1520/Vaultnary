use axum::{
    routing::{delete, get, post, put},
    Router,
};

use crate::state::AppState;

pub mod audit;
pub mod auth;
pub mod credentials;
pub mod hierarchy;
pub mod projects;
pub mod recovery;
pub mod services;
pub mod sessions;
pub mod sharing;
pub mod usage;
pub mod users;
pub mod vaults;

/// Build the complete API router nested under `/api/v1/`.
pub fn api_router() -> Router<AppState> {
    Router::new()
        .nest("/api/v1", v1_routes())
}

fn v1_routes() -> Router<AppState> {
    Router::new()
        // --- Auth ---
        .route("/auth/register", post(auth::register))
        .route("/auth/verify-email", get(auth::verify_email))
        .route("/auth/resend-verification", post(auth::resend_verification))
        .route("/auth/login", post(auth::login))
        .route("/auth/logout", post(auth::logout))
        .route("/auth/change-password", post(auth::change_password))
        .route("/auth/forgot-password", post(auth::forgot_password))
        .route("/auth/reset-password", post(auth::reset_password))
        .route("/auth/public-keys/:user_id", get(auth::public_keys))
        // Sessions (under auth namespace)
        .route("/auth/sessions", get(auth::list_sessions))
        .route("/auth/sessions", delete(auth::revoke_all_sessions))
        .route("/auth/sessions/:session_id", delete(auth::revoke_session))
        // Recovery
        .route("/auth/recover", post(recovery::recover))
        // --- Users ---
        .route("/users/me", get(users::get_me))
        .route("/users/lookup", get(users::lookup_user))
        .route("/users/:user_id", get(users::get_user))
        // --- Vault Items ---
        .route("/vault/items", post(vaults::create_item))
        .route("/vault/items", get(vaults::list_items))
        .route("/vault/items/:item_id", get(vaults::get_item))
        .route("/vault/items/:item_id", put(vaults::update_item))
        .route("/vault/items/:item_id", delete(vaults::delete_item))
        .route("/vault/search", get(vaults::search_items))
        .route("/vault/favorites", get(vaults::list_favorites))
        .route("/vault/items/:item_id/favorite", post(vaults::add_favorite))
        .route("/vault/items/:item_id/favorite", delete(vaults::remove_favorite))
        .route("/vault/recent", get(vaults::recent_items))
        .route("/vault/export", post(vaults::export_vault))
        .route("/vault/import", post(vaults::import_vault))
        // --- Hierarchy ---
        .route("/vault/items/:item_id/children", get(hierarchy::get_children))
        .route("/vault/tree", get(hierarchy::get_tree))
        // --- Projects ---
        .route("/projects", post(projects::create_project))
        .route("/projects", get(projects::list_projects))
        .route("/projects/:project_id", get(projects::get_project))
        .route("/projects/:project_id", put(projects::update_project))
        .route("/projects/:project_id", delete(projects::delete_project))
        .route("/projects/:project_id/credentials", get(projects::project_credentials))
        // --- Services ---
        .route("/services", post(services::create_service))
        .route("/services", get(services::list_services))
        .route("/services/:service_id", get(services::get_service))
        .route("/services/:service_id", put(services::update_service))
        .route("/services/:service_id", delete(services::delete_service))
        .route("/services/:service_id/credentials", get(services::service_credentials))
        // --- Credential Usage ---
        .route("/vault/items/:item_id/usage", post(usage::create_usage))
        .route("/vault/items/:item_id/usage", get(usage::list_usage))
        .route("/vault/items/:item_id/usage/:usage_id", delete(usage::delete_usage))
        // --- Sharing / Invitations ---
        .route("/vault/items/:item_id/invitations", post(sharing::create_invitation))
        .route("/vault/items/:item_id/invitations", get(sharing::list_invitations))
        .route("/invitations/:invitation_id/accept", post(sharing::accept_invitation))
        .route("/invitations/:invitation_id/decline", post(sharing::decline_invitation))
        .route("/invitations/:invitation_id", delete(sharing::revoke_invitation))
        .route(
            "/vault/items/:item_id/permissions/:user_id",
            delete(sharing::remove_permission),
        )
        // --- Sessions (security center alias) ---
        .route("/security/sessions", get(sessions::list_sessions))
        .route("/security/events", get(sessions::security_events))
        .route("/security/invitations", get(sessions::security_invitations))
        .route("/security/shared-with-me", get(sessions::shared_with_me))
        // --- Recovery ---
        .route("/recovery/setup", post(recovery::setup_recovery))
        .route("/recovery/setup", get(recovery::recovery_status))
        // --- Audit ---
        .route("/audit/events", get(audit::list_events))
}
