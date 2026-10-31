use serde::{Deserialize, Serialize};

/// Permission role levels for a vault item. Exactly 4 variants per design spec.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PermissionRole {
    /// Can view the item only.
    Viewer,
    /// Can edit the item.
    Editor,
    /// Co-owns the item; can share it.
    CoOwner,
    /// Full ownership including deletion and permission management.
    Owner,
}
