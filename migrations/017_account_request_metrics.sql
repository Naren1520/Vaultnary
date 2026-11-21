CREATE TABLE IF NOT EXISTS account_request_metrics (
    user_id          UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    bucket_start     TIMESTAMPTZ NOT NULL,
    read_requests    BIGINT      NOT NULL DEFAULT 0,
    write_requests   BIGINT      NOT NULL DEFAULT 0,
    error_requests   BIGINT      NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, bucket_start)
);
