# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability in Vaultnary, please report it responsibly.
**Do not open a public GitHub issue for security vulnerabilities.**

### How to Report

Send an email to: **narensonu1520@gmail.com**

Include the following in your report:
- A clear description of the vulnerability
- Steps to reproduce the issue
- The potential impact (what an attacker could achieve)
- Any proof-of-concept code or screenshots (if applicable)
- Your name / handle if you would like to be credited

### What to Expect

- Acknowledgement of your report within 48 hours
- An initial assessment within 5 business days
- Regular updates on the fix progress
- Credit in the release notes if you wish (unless you prefer to remain anonymous)

### Scope

The following are in scope for security reports:

- Authentication and session management flaws
- Authorization bypass (accessing credentials without permission)
- Cryptographic weaknesses in the key management or encryption flow
- SQL injection or database access vulnerabilities
- Cross-site scripting (XSS) that could expose vault keys or CSRF tokens
- CSRF protection bypass
- Rate limiting bypass
- Information disclosure (leaking user data, credentials, or session tokens)
- Server-side request forgery (SSRF)

The following are **out of scope**:

- Denial of service attacks
- Issues requiring physical access to a device
- Social engineering attacks
- Vulnerabilities in third-party dependencies (report directly to those projects)
- Issues already known and tracked

### Disclosure Policy

This project follows a **coordinated disclosure** policy. Please allow reasonable
time for a fix to be developed and deployed before publicly disclosing the vulnerability.
Typically this is 90 days from the initial report.

## Supported Versions

| Version | Supported |
|---------|-----------|
| Latest (main branch) | Yes |
| Older versions | No |

## Security Design

For a full description of the security architecture, threat model, and cryptographic
design decisions, see:

- [docs/cryptographic-design.md](docs/cryptographic-design.md)
- [docs/threat-model.md](docs/threat-model.md)
- [docs/permission-model.md](docs/permission-model.md)
