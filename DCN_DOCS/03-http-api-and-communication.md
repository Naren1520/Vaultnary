# 3. HTTP API and Communication

## 3.1 Browser request behavior

The frontend uses the browser's `fetch` API and sends JSON requests to `/api/v1/...`. It includes cookies and adds a CSRF header to mutating methods. In development, Vite proxies `/api/v1` to the configured API target, defaulting to `http://127.0.0.1:8080`. In a hosted build, `VITE_API_BASE_URL` can point to the API origin.

See [http-client.ts](../apps/web/src/services/http-client.ts) and [vite.config.ts](../apps/web/vite.config.ts).

## 3.2 CORS

Cross-Origin Resource Sharing (CORS) is a browser policy that controls whether frontend JavaScript at one origin may read responses from another origin. It is not a firewall and does not replace authentication or CSRF validation.

The API reads one `CORS_ORIGIN` value, defaulting to `http://localhost:5173`, and configures:

- Credentials: allowed, so browser requests can include cookies.
- Methods: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`, and `OPTIONS`.
- Request headers: `Content-Type`, `Authorization`, and `X-CSRF-Token`.

For a separate frontend/API origin in production, `CORS_ORIGIN` must exactly match the frontend origin. The frontend's `credentials: 'include'` option and the API's credential-enabled CORS policy work together. See [bootstrap.rs](../apps/api/src/bootstrap.rs).

## 3.3 Session cookies

The browser sends the `vault_session` cookie with API requests. The cookie is `HttpOnly`, has `Path=/`, and lasts 30 days. The application varies its cross-site settings by environment:

| Environment | Cookie attributes |
|---|---|
| Development | `SameSite=Strict`; no `Secure` attribute, to support local HTTP development |
| Production | `SameSite=None; Secure`, to permit cross-site HTTPS frontend/API requests |

`HttpOnly` prevents browser JavaScript from reading the session cookie. `Secure` means the browser sends it only over HTTPS. `SameSite=None` requires `Secure` in modern browsers. The application does not set a `Domain` attribute, so the cookie is host-scoped. See [auth.rs](../apps/api/src/routes/auth.rs) and [middleware/auth.rs](../apps/api/src/middleware/auth.rs).

## 3.4 CSRF validation

Cross-Site Request Forgery (CSRF) is relevant because browsers attach session cookies automatically. For authenticated, non-public requests, the API checks `X-CSRF-Token` on `POST`, `PUT`, `PATCH`, and `DELETE`. It hashes the supplied value and compares it with the authenticated session's stored token hash. Public auth endpoints are exempt; unauthenticated requests are left for session authentication to reject.

The frontend reads the CSRF token from its in-memory auth store and sends it as a request header for mutating API calls. This custom header also causes browsers to preflight cross-origin requests. See [csrf.rs](../apps/api/src/middleware/csrf.rs) and [http-client.ts](../apps/web/src/services/http-client.ts).

## 3.5 Rate limiting and client IPs

The API configures a limit of 200 requests per 60-second window per selected IP. The store is an in-memory map shared within one API process. It is not a Redis-backed or cross-instance limit. Requests exceeding the limit receive HTTP `429 Too Many Requests`.

The key is selected from the first value in `X-Forwarded-For`, if present; otherwise the middleware tries the socket peer address. This is only reliable when a trusted proxy overwrites or sanitizes forwarded headers and direct access to the API is controlled. A client-supplied forwarded header must not be treated as verified identity. See [rate_limit.rs](../apps/api/src/middleware/rate_limit.rs) and [bootstrap.rs](../apps/api/src/bootstrap.rs).

## 3.6 Forwarded headers and proxy trust

The Compose Nginx configuration forwards `Host`, `X-Real-IP`, `X-Forwarded-For`, and `X-Forwarded-Proto` to the API. The optional outer Nginx TLS example forwards similar headers.

`X-Forwarded-For` is a proxy convention, not a cryptographic proof of the client's IP. Because the rate limiter selects its first entry, the edge must ensure untrusted client-supplied values cannot control that first entry. The Compose file also publishes the API port directly, so the API can be reached without passing through the frontend Nginx when that host port is reachable.

## 3.7 Request IDs and HTTP tracing

The API generates a UUID `X-Request-Id` when the request does not have one and echoes the selected value in the response. A supplied valid header value is preserved. `TraceLayer::new_for_http()` adds HTTP request tracing. These mechanisms help correlate a client report with server logs; they do not authenticate the request. See [request_id.rs](../apps/api/src/middleware/request_id.rs) and [bootstrap.rs](../apps/api/src/bootstrap.rs).

## 3.8 Security-related response headers

The Docker Nginx configuration adds Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy. The Vercel configuration includes several headers, but does not define CSP or HSTS.

The Docker CSP currently sets `script-src 'self'` and `connect-src 'self'`. The landing page loads p5.js and Vanta from `cdnjs.cloudflare.com` and `cdn.jsdelivr.net`, so the Docker CSP blocks those external scripts. Also, if the frontend calls a separate API origin directly, `connect-src 'self'` blocks that browser connection even if API CORS allows it. The same-origin Nginx `/api/v1` proxy avoids the latter restriction. Review the deployed CSP against the chosen frontend/API arrangement. See [nginx.conf](../deploy/nginx.conf), [vercel.json](../apps/web/vercel.json), and [VantaTopology.tsx](../apps/web/src/features/landing/components/VantaTopology.tsx).

HSTS is meaningful only when the browser receives it over HTTPS. The checked-in Nginx container listens on port 80; the outer TLS proxy or hosting edge must provide the public HTTPS connection.

## 3.9 Third-party network calls

The API posts email data to `https://api.resend.com/emails` using a bearer API key. Verification, password reset, contact messages, and queued email delivery use this HTTPS service. The landing page downloads two animation scripts from external CDNs when that component is mounted. These external dependencies require outbound network access from the relevant runtime/browser.

The `.env.example` and Compose file include SMTP variables, but the current email implementation does not read them. It uses Resend instead. The hosted manifest declares `RESEND_API_KEY`; the Compose API environment does not. Configure the required provider key outside source control for deployments that need email delivery.
