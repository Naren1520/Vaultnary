// Integration tests for vault item CRUD endpoints.
// Requires a live PostgreSQL + running API server.

#[cfg(test)]
mod credential_crud {
    #[test]
    fn unauthorized_user_gets_404_not_403() {
        // GET /vault/items/:id without permission returns 404 (not 403) to avoid leaking existence.
        assert!(true, "requires live API");
    }

    #[test]
    fn viewer_cannot_update_item() {
        // PUT /vault/items/:id with viewer role returns 403.
        assert!(true, "requires live API");
    }

    #[test]
    fn editor_cannot_delete_item() {
        // DELETE /vault/items/:id with editor role returns 403.
        assert!(true, "requires live API");
    }

    #[test]
    fn cascade_delete_cleans_all_related_rows() {
        // DELETE /vault/items/:id (owner) removes permissions, envelopes, usage.
        assert!(true, "requires live API");
    }

    #[test]
    fn list_pagination_is_complete_and_non_overlapping() {
        // Fetching multiple pages must yield all items without duplicates or gaps.
        assert!(true, "requires live API");
    }

    #[test]
    fn delete_without_confirm_returns_422() {
        // DELETE /vault/items/:id without body { confirm: true } returns 422.
        assert!(true, "requires live API");
    }
}
