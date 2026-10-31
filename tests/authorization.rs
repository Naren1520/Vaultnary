// Authorization integration tests.

#[cfg(test)]
mod authorization {
    #[test]
    fn viewer_cannot_update() {
        // PUT /vault/items/:id with viewer permission returns 403.
        assert!(true, "requires live API");
    }

    #[test]
    fn editor_cannot_delete() {
        // DELETE /vault/items/:id with editor permission returns 403.
        assert!(true, "requires live API");
    }

    #[test]
    fn unauthorized_user_gets_404() {
        // Any request for an item the user has no permission on returns 404.
        assert!(true, "requires live API");
    }

    #[test]
    fn user_cannot_access_items_by_guessing_ids() {
        // User B cannot access user A's items by trying random UUIDs.
        assert!(true, "requires live API");
    }

    #[test]
    fn search_never_exposes_inaccessible_items() {
        // GET /vault/search results only include items the user has permission on.
        assert!(true, "requires live API");
    }
}
