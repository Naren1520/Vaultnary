# Contributing

Thank you for your interest in Vaultnary.

## Important Notice

This is a **proprietary project**. The source code is made available for viewing
and evaluation only. Contributions are accepted by invitation only.

If you would like to contribute, please reach out first:

- Email: narensonu1520@gmail.com
- GitHub: [Naren1520](https://github.com/Naren1520)

## Before Contributing

1. You must receive explicit written permission from the owner before submitting
   any pull request or contribution.
2. All contributions will be subject to the project's proprietary license.
   By contributing, you assign all rights in your contribution to the project owner.

## Bug Reports

Bug reports are welcome via GitHub Issues. Please use the provided issue templates.
Security vulnerabilities must be reported privately — see [SECURITY.md](SECURITY.md).

## Code Standards

If you are an invited contributor, please follow these standards:

### Rust (backend)
- Run `cargo fmt` before committing
- Run `cargo clippy -- -D warnings` and fix all warnings
- Run `cargo test` and ensure all tests pass
- No long unicode dash separators in comments — use plain `//` or `/* */`
- All new endpoints must insert an audit event on success

### TypeScript (frontend)
- Run `npm run typecheck` with zero errors
- Run `npm run build` and confirm clean build
- No `React` import unless used as a value (React 19 JSX transform)
- Keep all key state in Zustand stores — never localStorage or sessionStorage
- No inline `style` tags with long dash separators in comments

## Commit Messages

Use clear, concise commit messages in the imperative mood:

```
Add password reset rate limiting
Fix session cookie not clearing on 401
Update vault item list to use cursor pagination
```
