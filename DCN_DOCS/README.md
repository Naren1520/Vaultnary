# Vaultnary Networking and DCN Documentation

This folder explains how Vaultnary communicates over a network, which networking concepts are involved, and which behaviors are provided by the application versus its hosting environment. It is based on the repository configuration and source code; it is not a packet capture or a report from a live deployment.

## Documents

1. [01-network-architecture.md](./01-network-architecture.md) - Components, request paths, data flows, and network boundaries.
2. [02-tcp-ip-and-networking-concepts.md](./02-tcp-ip-and-networking-concepts.md) - TCP/IP and OSI concepts mapped to the application, including ports and protocols.
3. [03-http-api-and-communication.md](./03-http-api-and-communication.md) - Browser/API communication, CORS, cookies, CSRF, rate limiting, and HTTP headers.
4. [04-deployment-and-ports.md](./04-deployment-and-ports.md) - Local, Docker, and hosted deployment paths, ports, configuration, and observed gaps.

## How to read the status labels

- **Implemented** means the behavior is visible in the application code or checked-in deployment configuration.
- **Platform-managed** means the operating system, container runtime, DNS provider, reverse proxy, or hosting provider handles it; the application does not implement the underlying protocol.
- **Not configured here** means the repository does not show the feature being enabled. A cloud provider may add behavior outside the repository, so verify its dashboard and runtime settings before relying on it.

Network variables and service names are documented, but secret values are intentionally excluded. Do not put credentials, session secrets, or private connection strings in these documents.

## Source of truth

The main evidence is in `apps/api/src`, `apps/web/src`, `apps/web/vite.config.ts`, `apps/web/vercel.json`, `deploy/`, and `render.yaml`. The documents link to these files at the relevant points. When a deployment setting differs from the code, the discrepancy is called out rather than treated as if it were already resolved.
