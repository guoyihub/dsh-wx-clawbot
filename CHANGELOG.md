# Changelog

All notable changes to this project are documented here.

## 0.5.8 - 2026-08-25

- Fix `wx_configure` invalid output by omitting `undefined` fields (for example
  `ownerUserId`) so tool results pass DSH lossless JSON validation.
- Fix CLI `wx-clawbot status` / `disconnect` dropping the subcommand in
  `parseArgs`.

## 0.5.7 - 2026-08-25

- Sync paired bot tokens into `ctx.credentials` after `wx_configure` pairing so
  `pair_step` no longer fails with “credential … not configured”.
- Recover `pair_step` when pairing already completed but the in-memory session
  was lost.
- Default `wx_send` to the sole authorized user from Web/Host sessions; accept
  `to: "0"` when only one user exists.
- Expose `authorizedUsers` in `wx_configure status` for outbound messaging.

## 0.5.6 - 2026-08-25

- Host pairing emits ready-to-open absolute URLs with `pairingPageUrlLocal` and
  `pairingPageUrlMobile` labels so users never splice a host with a path.
- Tool card shows `本机打开：` / `手机打开：` lines; `wx_configure` instructs the
  agent to quote those URLs verbatim.

## 0.5.5 - 2026-08-25

- Host `wx_configure` pairing returns relative paths (`/api/wx-clawbot/pairing`) so
  PC and Mobile resolve against the current site origin; CLI `wx-clawbot setup`
  still emits absolute LAN URLs on `:3081`.

## 0.5.4 - 2026-08-25

- Build pairing page URLs from the live DSH `webServer` listen port instead of
  assuming `:3080`.
- When DSH Mobile pairing settings define `mobilePublicBaseUrl` (tunnel / public
  origin), prefer `https://…/api/wx-clawbot/pairing` for phone access.

## 0.5.3 - 2026-08-25

- Serve pairing routes under `/api/wx-clawbot/*` so DSH Mobile PWA's existing
  `/api` proxy reaches the QR page without any mobile-repo change.
- Prefer `:8030` LAN URLs when pairing through Host `webServer`.

## 0.5.2 - 2026-08-25

- Serve Weixin QR pairing through the DSH Host `webServer` (default `:3080`) when
  available, so `wx_configure start_pairing` no longer binds a separate port.
- Keep standalone QR HTTP on `:3081` for CLI `wx-clawbot setup` only.
- Omit null `accountId` from `wx_configure` tool output to satisfy the value schema.

## 0.5.1 - 2026-08-25

- Fix tool output schemas for DSH value schema DSL (use per-property `required:
  true` instead of object-level `required` arrays).

## 0.5.0 - 2026-08-25

- Add `wx_configure` DSH tool for conversational Weixin bridge setup.
- Extract shared pairing logic into `pairing-service.js`.
- Publish as open-source `dsh-wx-clawbot` with enterprise README and MIT license.

## 0.4.2 - 2026-08-25

- Serve Weixin QR pairing HTTP on port **3081** by default so `wx-clawbot setup` no
  longer conflicts with DSH Mobile PWA on **8030**.

## 0.4.1 - 2026-08-25

- Rename the Cordis plugin, npm package, CLI, state directory, credential ref, and
  HTTP pairing routes to `wx-clawbot`.

## 0.4.0 - 2026-08-25

- Rename the Cordis plugin, npm package, CLI, state directory, credential ref, and
  HTTP pairing routes from `dsh-weixin` to `dsh-wx-clawbot`.
- Rename the outbound DSH tool from `weixin_send` to `wx_send`.

## 0.3.2 - 2026-08-25

- Add the `wx_send` DSH tool so agents can proactively deliver text to authorized
  Weixin users through the paired ClawBot outbox.

## 0.3.1 - 2026-08-25

- Serve Weixin pairing QR over HTTP on port 8030 by default (`/wx-clawbot/pairing` and `/wx-clawbot/pairing-qr.png`) so phones on the LAN or tunnel can open the image URL instead of a local file path.
- Write `WX_CLAWBOT_BOT_TOKEN` under `version: 1` / `refs:` in `.credentials.yaml`, matching current DSH `credentials-local` layout and migrating stale top-level keys.

## 0.3.0 - 2026-08-22

- Add immediate task acknowledgements, periodic progress, `/task`, `/queue`,
  `/doctor`, `/search`, and `/archive-all confirm`.
- Persist outbound replies before sending and retry failures with bounded
  exponential backoff across Host restarts.
- Add owner-controlled `/users`, `/invite`, `/pair`, `/revoke`, and `/audit`
  authorization management with bounded persistent audit history.
- Integrate the DSH `0.1.1-rc.2` `approval/request` waterfall for phone-owned
  Agents through one-time `/approve` and `/reject` codes while delegating
  borrowed Web/desktop Agents to their original surface.
- Add separate Chinese and English command, architecture, and security docs.
- Explicitly exclude Windows startup entries and system-service installation.

## 0.2.2 - 2026-08-22

- Add the official `dsh-plugin` ecosystem keyword and repository-facing badge.
- Document direct GitHub installation and explicit profile removal.
- Replace wildcard DSH peer declarations with ranges that include the verified
  `0.1.0-rc.8` and `0.1.1-rc.2` prerelease lines.
- Add tests for the discoverable, installable DSH Bundle package contract.

## 0.2.1 - 2026-08-22

- Add a portable `dsh-wx-clawbot` Agent Skill for skills.sh, ClawHub,
  OpenClaw, Codex, Claude Code, Cursor, and other Agent Skills clients.
- Add strict Skill metadata, security, reference, and marketplace dry-run
  validation without changing the DSH Bundle runtime.
- Add a tag-driven GitHub Release workflow that verifies and attaches the
  installable `.tgz` Bundle.
- Expand the English documentation to match the complete Chinese guide.
- Update `yaml` to 2.9.0 to address `GHSA-48c2-rrv3-qjmp`.

## 0.2.0 - 2026-08-21

- Add per-Weixin-user persistent multi-session management.
- Add `/sessions`, `/use`, `/new`, `/rename`, and `/archive`.
- Add immediate `/cancel` and `/steer` fast paths that bypass the normal turn queue.
- Add model, Preset, permission, workspace, status, and help commands.
- Forward unknown slash commands to the native DSH command registry.
- Reuse a live Agent when Web or desktop DSH already owns the Session.
- Migrate the original version-1 single-session state in place.
- Verify loading on DSH `0.1.1-rc.2` while retaining `0.1.0-rc.8` compatibility.

## 0.1.0 - 2026-08-21

- Initial Tencent iLink polling and text reply bridge.
- Persistent DSH Session per authorized Weixin user.
- QR pairing CLI and DSH credential-store integration.
