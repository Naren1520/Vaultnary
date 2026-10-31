use serde::{Deserialize, Serialize};

/// Lifecycle state of a share invitation. Exactly 5 variants per design spec.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvitationState {
    Pending,
    Accepted,
    Declined,
    Expired,
    Revoked,
}
