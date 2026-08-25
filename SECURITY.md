# Security Policy

[中文](SECURITY.zh.md) | [English README](docs/README.en.md)

## Supported versions

Security fixes are applied to the latest release on the default branch.

## Reporting a vulnerability

Use GitHub private vulnerability reporting. Do not put bot tokens, credential
documents, iLink cursors, user identifiers, local paths, or unredacted logs in
a public issue.

## Remote-control boundary

- The locally QR-paired account becomes the owner. Only it can generate a
  ten-minute, one-use invitation, list users, revoke a non-owner, or read audit
  events.
- Unknown senders are dropped before Agent resolution. Invalid invitation
  attempts receive no reply, avoiding an authentication oracle.
- Bot tokens remain in DSH credentials and are never written to plugin state.
- New Sessions default to `workspace-write`. Wider operations generate a
  user-bound, one-use approval code that expires after five minutes.
- Approval timeout, task cancellation, bridge shutdown, delivery failure, or
  an invalid decision fails closed. `allowed-once` never changes the Session's
  permission preset.
- `danger-full-access` requires the exact command
  `/permission danger-full-access confirm` and is recorded in the audit log.
- The approval listener owns only phone-created/resumed Agents. It delegates a
  borrowed Web/desktop Agent to the next DSH answerer.
- User Session indexes and approval codes are isolated. A user cannot select,
  approve, or revoke another user's resources.
- Persistent state and its parent directory must remain private. Outbox data
  can contain user and model text even though it contains no bot token.

Before sharing diagnostics, redact `$DSH_HOME/.credentials.yaml`,
`$DSH_HOME/wx-clawbot/state.json`, pairing QR images, authorization headers,
local paths, and personal content from Session logs.

This project does not install Windows startup entries, scheduled tasks, or a
system service. Securing and starting the persistent DSH Host remains the
operator's responsibility.
