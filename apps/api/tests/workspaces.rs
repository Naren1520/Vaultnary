use sqlx::{postgres::PgPoolOptions, PgPool};
use uuid::Uuid;

async fn test_pool() -> PgPool {
    let env_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../../.env");
    let _ = dotenvy::from_path(env_path);
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL must be set to run workspace database tests");
    PgPoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("workspace tests require a reachable PostgreSQL database with migrations applied")
}

#[tokio::test]
async fn workspace_records_and_membership_roles_are_persisted_consistently() {
    let pool = test_pool().await;
    let mut tx = pool.begin().await.expect("begin test transaction");

    let owner_id = Uuid::new_v4();
    let member_id = Uuid::new_v4();
    let invalid_role_user_id = Uuid::new_v4();
    let workspace_id = Uuid::new_v4();
    let vault_id = Uuid::new_v4();
    let project_id = Uuid::new_v4();
    let service_id = Uuid::new_v4();

    for (user_id, email) in [
        (owner_id, "owner"),
        (member_id, "member"),
        (invalid_role_user_id, "invalid-role"),
    ] {
        sqlx::query("INSERT INTO users (id, email, password_hash) VALUES ($1, $2, 'test-hash')")
            .bind(user_id)
            .bind(format!("{email}-{}@workspace-test.invalid", Uuid::new_v4()))
            .execute(&mut *tx)
            .await
            .expect("insert test user");
    }

    sqlx::query("INSERT INTO workspaces (id, name, owner_id) VALUES ($1, 'Test workspace', $2)")
        .bind(workspace_id)
        .bind(owner_id)
        .execute(&mut *tx)
        .await
        .expect("insert workspace");

    sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, 'owner'), ($1, $3, 'editor')",
    )
    .bind(workspace_id)
    .bind(owner_id)
    .bind(member_id)
    .execute(&mut *tx)
    .await
    .expect("insert workspace memberships");

    sqlx::query("INSERT INTO vaults (id, owner_id, workspace_id) VALUES ($1, $2, $3)")
        .bind(vault_id)
        .bind(owner_id)
        .bind(workspace_id)
        .execute(&mut *tx)
        .await
        .expect("insert workspace vault");

    sqlx::query(
        "INSERT INTO projects (id, owner_id, workspace_id, name) VALUES ($1, $2, $3, 'Project')",
    )
    .bind(project_id)
    .bind(owner_id)
    .bind(workspace_id)
    .execute(&mut *tx)
    .await
    .expect("insert workspace project");

    sqlx::query(
        "INSERT INTO services (id, owner_id, workspace_id, project_id, name, environment)
         VALUES ($1, $2, $3, $4, 'Service', 'development')",
    )
    .bind(service_id)
    .bind(owner_id)
    .bind(workspace_id)
    .bind(project_id)
    .execute(&mut *tx)
    .await
    .expect("insert workspace service");

    let role: String = sqlx::query_scalar(
        "SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2",
    )
    .bind(workspace_id)
    .bind(member_id)
    .fetch_one(&mut *tx)
    .await
    .expect("read member role");
    assert_eq!(role, "editor");

    let linked_resources: i64 = sqlx::query_scalar(
        "SELECT
            (SELECT COUNT(*) FROM vaults WHERE workspace_id = $1) +
            (SELECT COUNT(*) FROM projects WHERE workspace_id = $1) +
            (SELECT COUNT(*) FROM services WHERE workspace_id = $1)",
    )
    .bind(workspace_id)
    .fetch_one(&mut *tx)
    .await
    .expect("count workspace resources");
    assert_eq!(linked_resources, 3);

    let invalid_role = sqlx::query(
        "INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'invalid')",
    )
    .bind(workspace_id)
    .bind(invalid_role_user_id)
    .execute(&mut *tx)
    .await
    .expect_err("database must reject unknown workspace roles");
    assert_eq!(
        invalid_role.as_database_error().and_then(|error| error.code()),
        Some("23514")
    );

    tx.rollback().await.expect("rollback test data");
}
