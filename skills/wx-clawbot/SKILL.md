---
name: wx-clawbot
description: Install, configure, validate, or troubleshoot the community DSH Weixin ClawBot bridge that connects Tencent's official iLink channel to DeepSeek Harness. Use for phone-to-computer DSH setup, pairing, profile installation, session commands, updates, or compatibility checks; not for OpenClaw's own Weixin plugin or desktop-Weixin injection.
metadata:
  openclaw:
    requires:
      bins:
        - node
        - npm
        - git
    homepage: https://github.com/guoyihub/dsh-wx-clawbot
---

# DSH Weixin ClawBot

Help the user connect a persistent DeepSeek Harness host to Tencent's official
Weixin ClawBot/iLink transport. Keep the existing DSH core and desktop app
unchanged; this integration is a host-only DSH Bundle.

Match the user's language. Distinguish this project from Tencent's
`@tencent-weixin/openclaw-weixin-cli`, which targets OpenClaw rather than DSH.
Do not substitute WxHook or desktop-Weixin injection.

## Route the task

- For installation, upgrades, profile selection, pairing, or validation, read
  [references/setup.md](references/setup.md).
- For phone commands and session behavior, read
  [references/commands.md](references/commands.md).
- For a narrow status question, inspect the existing installation and run the
  least invasive relevant check instead of reinstalling.

## Preserve these invariants

- Treat the repository release and its checked-in documentation as the source
  of truth. Inspect the installed DSH and plugin versions before changing them.
- Preserve user-edited DSH profiles and `cordis.patch.yml` values. DSH patch
  configuration uses whole-value replacement, so merge a complete service
  block rather than writing a partial override.
- Run setup from the workspace the user wants phone tasks to control, and pass
  an absolute `--agent-cwd`.
- Use the actual profile launched by the persistent Web or desktop host. A
  one-shot headless process cannot maintain the iLink long poll.
- Validate with the package checks, a successful DSH profile install,
  `wx-clawbot status`, `/doctor`, and `/status` from the paired phone when
  available.
- Allow runtime capability detection to handle DSH version differences. Do not
  patch DSH core merely because an optional desktop service is absent.

## Security boundaries

- Never print, copy into chat, commit, or upload the bot token, pairing QR,
  Weixin user IDs, iLink cursor, `.credentials.yaml`, or `state.json`.
- Pairing is an interactive local action. Tell the user where the local QR is
  displayed, but do not relay the QR or credential through another service.
- Keep the default permission at `workspace-write`. Enable
  `danger-full-access` only after the user explicitly requests it and confirms
  the exact phone command.
- Treat `/approve <code>` as a grant for one pending operation only. Never
  convert an approval request into a persistent permission escalation.
- User invitations are owner-only, single-use, and expire after ten minutes.
  Do not disclose whether an invalid invitation ever existed.
- Do not add Windows startup entries, scheduled tasks, or system services. The
  user starts the persistent DSH Host through their existing workflow.
- Do not delete or replace an existing credential or state directory during an
  update. Use `wx-clawbot disconnect` only when the user asks to unpair.
- Before any install, update, restart, publish, or remote mutation, stay within
  the authorization already given by the user.
