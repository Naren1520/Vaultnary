CREATE TABLE email_outbox (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_email TEXT        NOT NULL,
    subject         TEXT        NOT NULL,
    html_body       TEXT        NOT NULL,
    attempts        INTEGER     NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    available_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_until    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_email_outbox_available
    ON email_outbox (available_at, locked_until, created_at);
