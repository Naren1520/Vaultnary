ALTER TABLE audit_events
    DROP CONSTRAINT IF EXISTS audit_events_action_type_check;

ALTER TABLE audit_events
    ADD CONSTRAINT audit_events_action_type_check
    CHECK (action_type IN (
        'user.registered',
        'user.login',
        'user.logout',
        'user.password_changed',
        'user.recovery_used',
        'session.revoked',
        'item.created',
        'item.accessed',
        'item.updated',
        'item.deleted',
        'item.exported',
        'item.imported',
        'invitation.created',
        'invitation.accepted',
        'invitation.declined',
        'invitation.revoked',
        'permission.changed',
        'export.initiated',
        'import.initiated'
    ));
