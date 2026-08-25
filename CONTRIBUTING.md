# Contributing

Thank you for improving `dsh-wx-clawbot`.

## Before you open a PR

1. Run `npm run check && npm test` on Node.js 22.19+.
2. Keep changes scoped to the Weixin bridge; do not modify DSH core in this repo.
3. Never commit tokens, QR payloads, credential files, or real user identifiers.

## Pull request checklist

- [ ] Behavior change includes or updates tests under `test/`.
- [ ] User-visible strings stay concise; update `README.md` when install or tool
      flows change.
- [ ] Security-sensitive paths follow [SECURITY.md](./SECURITY.md).

## Reporting issues

Use GitHub Issues for bugs and feature requests. Use private vulnerability
reporting for credential or authorization defects.
