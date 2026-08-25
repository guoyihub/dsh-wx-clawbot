# Setup and validation

## Identify the environment

1. Check `node --version`; the bridge requires Node.js 22.19.0 or newer.
2. Locate the DSH installation, `DSH_HOME`, and the persistent host profile.
3. Check whether the bridge is already installed and preserve any local
   `wx-clawbot` configuration.
4. Prefer a tagged release. If using a source checkout, do not overwrite local
   changes; update only a clean checkout or clone a separate directory.

The bridge supports the original DSH Web host and DSH Desktop. It must be
installed in the profile that the persistent host actually starts. `web` is the
usual original-DSH profile; desktop builds may use another profile name.

## Build a verified package

From a clean checkout of
`https://github.com/zp-home/wx-clawbot`:

```powershell
npm ci --legacy-peer-deps
npm run check
npm test
npm pack
```

Use the `.tgz` filename printed by `npm pack`. On Windows, install the archive
instead of an absolute `link:` path because some DSH/pnpm combinations resolve
drive-letter links incorrectly.

## Install into a DSH profile

With a global DSH CLI:

```powershell
dsh plugin --profile web add --force .\local-wx-clawbot-<version>.tgz
```

When running the DSH source repository directly:

```powershell
node --import tsx/esm apps/cli/src/bin.ts plugin --profile web add --force D:\path\to\local-wx-clawbot-<version>.tgz
```

Replace `web` with the exact persistent desktop profile when applicable. Do not
modify desktop source code to install the host-only Bundle.

## Pair locally

Run setup from the workspace the phone should control:

```powershell
cd D:\absolute\workspace
D:\path\to\wx-clawbot\node_modules\.bin\wx-clawbot.cmd setup --agent-cwd D:\absolute\workspace
```

On macOS or Linux, use the equivalent `node_modules/.bin/wx-clawbot` path. The
command displays the QR in the terminal and serves HTTP pairing URLs on port
3081 by default (`/api/wx-clawbot/pairing` and `/api/wx-clawbot/pairing-qr.png`) so a
phone on the LAN can open `http://<host>:8030/api/wx-clawbot/pairing` through
Mobile PWA's built-in `/api` proxy, or hit Host `:3080` directly.
phone on the LAN or tunnel can open the image link instead of a local file path.
Use `--qr-base-url` when the public host differs from the detected LAN address.
The returned token is stored under `refs:` in `$DSH_HOME/.credentials.yaml`. Do
not expose the QR or token in logs or chat.

Restart the persistent host after a new install or profile change.

## Validate

Run the local status command without reading credential files directly:

```powershell
D:\path\to\wx-clawbot\node_modules\.bin\wx-clawbot.cmd status
```

Then ask the user to send `/status` in Weixin. A complete validation checks:

- the intended profile loads the `wx-clawbot` service;
- local status reports a configured workspace and paired state;
- the phone receives a reply from the same persistent DSH host;
- `/doctor` reports a healthy poll and the expected optional capabilities;
- Web or desktop DSH can continue the same Session;
- default permission remains `workspace-write`.

## Troubleshoot conservatively

- No phone replies: confirm the persistent host is running and that the Bundle
  is installed in its actual profile.
- Replies arrive late after a transient outage: inspect `/doctor`; the durable
  Outbox retries automatically, so do not clear state to force a resend.
- Pairing works but tasks use the wrong directory: inspect `agentCwd`; use an
  absolute path and create a new phone Session after changing it.
- Optional model, title, or workspace feature is unavailable: verify the DSH
  version and capability detection before assuming the core must be changed.
- Credentials appear missing: run `wx-clawbot status`; do not display or parse
  `.credentials.yaml` unless the user explicitly requests a local credential
  repair and the output can remain secret.
- Re-pair only after the user requests it. `wx-clawbot disconnect` removes the
  locally stored pairing credential.

The bridge intentionally does not install a Windows startup entry, scheduled
task, or system service.
