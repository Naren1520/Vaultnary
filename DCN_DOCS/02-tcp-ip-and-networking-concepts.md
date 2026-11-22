# 2. TCP/IP and Networking Concepts

This section maps common networking-course concepts to Vaultnary. The application uses ordinary web and database protocols; it does not implement its own IP, TCP, DNS, Ethernet, or routing stack.

## 2.1 TCP/IP model and OSI correspondence

| TCP/IP layer | Approximate OSI layers | Vaultnary example | Where the responsibility lives |
|---|---|---|---|
| Application | Application, presentation, session | HTTP API, JSON, cookies, PostgreSQL wire protocol, Resend API | Browser, Axum API, PostgreSQL driver, and Resend client |
| Transport | Transport | TCP connections to the API and PostgreSQL; HTTPS requests use TCP in the configured web/API paths | Tokio, the operating system, libraries, and hosting |
| Internet | Network | IPv4/IPv6 addressing and packet routing; the API binds to `0.0.0.0` | Operating system, container network, router, and hosting platform |
| Link | Data link, physical | Ethernet, Wi-Fi, virtual container links | Network interface, operating system, and infrastructure |

The OSI model is useful for explaining where a responsibility belongs; it does not mean the application implements each layer itself.

## 2.2 Protocols and concepts

| Concept | How it relates to Vaultnary | Status |
|---|---|---|
| HTTP | The browser uses `fetch` for API calls. The API is an Axum HTTP service. Nginx forwards API traffic using HTTP/1.1 internally. | Implemented |
| HTTPS | Browser-facing hosted traffic should use HTTPS. The repository's reverse-proxy guide places TLS termination in front of the Nginx container. The API also calls Resend using an `https://` URL. | Proxy/provider-managed inbound; used for outbound Resend |
| TLS certificates | The API's `TcpListener` is not configured as an HTTPS listener. The included proxy example configures TLS 1.2 and 1.3; hosted certificate management is outside the API code. | Managed/configured at the edge |
| TCP | Tokio accepts API connections with `TcpListener`; SQLx and HTTP clients open network connections through their libraries. Handshakes, retransmission, flow control, and congestion control are handled by the OS/network stack. | Platform/library-managed |
| IP addressing | The API binds to `0.0.0.0:PORT`. The rate limiter selects an IP from `X-Forwarded-For`, or falls back to the socket peer when available. | Application consumes addresses; OS/platform routes packets |
| DNS | Hostnames such as `api.resend.com`, Compose service names such as `api` and `postgres`, and configured public URLs are resolved by the environment. No custom DNS resolver is defined by the app. | Platform-managed |
| Ports | Ports identify services at the transport layer. Compose publishes selected container ports on the host; the API port is supplied through `PORT`. | Configured in app/deployment |
| Container networking | Compose services reach each other using service DNS names on the Compose network. Published ports make selected services reachable through the Docker host. | Docker-managed |
| NAT and port mapping | Docker port publishing (for example, host port to container port) provides the deployment mapping. The application does not implement NAT. | Docker/host-managed |
| Routing and subnets | No custom routes or subnet configuration are defined in the application. Cloud routing and the host network carry packets between endpoints. | Platform-managed |
| Ethernet, Wi-Fi, ARP/NDP | These are below the application boundary and are not configured in the codebase. | OS/network-managed |
| UDP | No application UDP socket or UDP protocol endpoint is configured. DNS or other infrastructure can still use UDP below the application. | Not implemented by the app |
| WebSockets | No WebSocket route or client flow is configured in the reviewed API/frontend paths. | Not configured here |
| SMTP | `.env.example` and Compose contain SMTP variables, but current email sending uses Resend's HTTPS API. | Variables are present; SMTP transport is not implemented |

Sources include [bootstrap.rs](../apps/api/src/bootstrap.rs), [email.rs](../apps/api/src/email.rs), [compose.yaml](../deploy/compose.yaml), and [reverse-proxy/README.md](../deploy/reverse-proxy/README.md).

## 2.3 Addressing, ports, and hostnames

An IP address identifies a network endpoint; a port identifies a service endpoint on that host. A hostname is a human-readable name resolved to an address by DNS. These are separate concepts:

- `api`, `postgres`, and `redis` are service names inside the Compose network.
- `PORT` tells the API which TCP port to bind to.
- `0.0.0.0` means bind on all local interfaces, not a particular public IP.
- `ports:` in Compose publishes container ports through the Docker host.
- `CORS_ORIGIN`, `FRONTEND_URL`, and `VITE_API_BASE_URL` are application URLs/origins, not listening ports.

### Ports shown in repository configuration

| Port | Service/use | Scope and evidence |
|---:|---|---|
| 5173 | Vite development frontend and default development CORS origin | Local development; [vite.config.ts](../apps/web/vite.config.ts), [bootstrap.rs](../apps/api/src/bootstrap.rs) |
| 8080 | API in Compose and default local API target | Published by Compose as `8080:8080`; API port is configurable. |
| 80 | Nginx frontend and `/api/v1` reverse proxy in Compose | Published by Compose as `80:80`; cleartext inside the container unless an outer TLS proxy is used. |
| 443 | HTTPS reverse-proxy example | The example is configuration guidance, not a listener in the API container. |
| 5432 | PostgreSQL in Compose | Published by Compose as `5432:5432`. |
| 6379 | Redis container in Compose | Published by Compose as `6379:6379`; current API code does not connect to Redis. |
| 10000 | API port configured by `render.yaml` | Hosted port value in the manifest; actual reachability is controlled by Render. |

## 2.4 TCP connection lifecycle in this application

At a high level, a TCP client opens a connection to a server IP and port, the operating system performs the TCP handshake, and the HTTP or database protocol exchanges data over that connection. The application creates a listening socket for the API, while the libraries manage client connections to PostgreSQL and Resend.

The code does not manually construct TCP packets or tune TCP congestion control. Timeouts, retransmission, connection routing, and the physical network are handled by libraries, the operating system, containers, and hosting infrastructure.

## 2.5 DNS and service discovery

In Compose, service names such as `api`, `postgres`, and `redis` are resolved inside the Docker network. Public hostnames and external service names are resolved by the machine or hosting provider's DNS configuration. The repository does not define DNS records, a custom resolver, or DNS failover behavior.

## 2.6 TLS and encrypted transport

- The API starts a TCP listener and does not configure TLS directly.
- The [reverse-proxy guide](../deploy/reverse-proxy/README.md) expects an HTTPS-terminating reverse proxy in front of the Nginx container and gives an example for TLS 1.2 and TLS 1.3.
- The API makes Resend calls to `https://api.resend.com`.
- PostgreSQL transport encryption depends on the database provider and `DATABASE_URL`; the application code does not add a separate TLS policy in `bootstrap.rs`.
- The Nginx container listens on port 80. Do not treat this internal listener as proof that user traffic is encrypted; verify the public TLS endpoint and proxy configuration.
