# Stage 1: Build the Rust binary
FROM rust:1.82-slim-bookworm AS builder

WORKDIR /build

RUN apt-get update && apt-get install -y --no-install-recommends \
    pkg-config \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

COPY Cargo.toml Cargo.lock rust-toolchain.toml ./
COPY crates/shared/Cargo.toml       crates/shared/Cargo.toml
COPY crates/domain/Cargo.toml       crates/domain/Cargo.toml
COPY crates/application/Cargo.toml  crates/application/Cargo.toml
COPY crates/persistence/Cargo.toml  crates/persistence/Cargo.toml
COPY crates/security/Cargo.toml     crates/security/Cargo.toml
COPY apps/api/Cargo.toml            apps/api/Cargo.toml

RUN mkdir -p crates/shared/src crates/domain/src crates/application/src \
             crates/persistence/src crates/security/src apps/api/src && \
    echo "fn main() {}" > apps/api/src/main.rs && \
    for crate in shared domain application persistence security; do \
      echo "" > crates/$crate/src/lib.rs; \
    done

RUN cargo build --release 2>/dev/null || true

COPY crates/ crates/
COPY apps/api/ apps/api/

RUN cargo build --release --bin api

# Stage 2: Minimal runtime image
FROM debian:bookworm-slim AS runtime

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libssl3 \
    && rm -rf /var/lib/apt/lists/*

RUN useradd --system --no-create-home --shell /sbin/nologin vaultnary

COPY --from=builder /build/target/release/api /usr/local/bin/vaultnary-api

USER vaultnary

EXPOSE 8080

CMD ["/usr/local/bin/vaultnary-api"]
