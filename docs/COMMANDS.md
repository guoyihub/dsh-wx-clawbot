# Weixin command reference

[中文](COMMANDS.zh.md) | [English README](README.en.md)

Commands are plain text messages sent to the paired Weixin ClawBot. Connector
commands run locally; other slash commands are offered to DSH's native command
registry.

## Tasks and health

| Command | Description |
| --- | --- |
| `/task` | Show the current task state and elapsed time. |
| `/queue` | Show this user's queued messages and whether a task is running. |
| `/cancel` | Immediately request cancellation of the running Agent. |
| `/steer <text>` | Insert a correction at the next DSH step boundary. |
| `/doctor` | Show sanitized iLink polling, outbox, and optional DSH capability health. |
| `/status` | Show task, Session, cwd, Preset, permission, and model state. |

Ordinary tasks receive an immediate acknowledgement by default. During a long
turn, the bridge sends periodic progress without waiting for the final reply.
`/cancel`, `/steer`, `/task`, `/queue`, `/doctor`, `/approve`, and `/reject`
bypass the per-user queue.

## Sessions

| Command | Description |
| --- | --- |
| `/sessions` | List this user's active Sessions. The current Session is marked `*`. |
| `/search <query>` | Search active Sessions by title, full/short ID, or workspace. |
| `/use <number-or-short-id>` | Select a listed Session. |
| `/new [title]` | Keep the old Session and create a new one. |
| `/rename <title>` | Rename the current Session. |
| `/archive [number-or-short-id]` | Archive a selected or current Session. |
| `/archive-all confirm` | Archive all active Sessions owned by this user. |

The connector indexes at most 50 Sessions per authorized user and never lists
another user's Sessions.

## Runtime selection

| Command | Description |
| --- | --- |
| `/model` | Show the current model and registered providers. |
| `/model provider/model` | Select the model for this Session's next request. |
| `/preset [id]` | Show or set the Preset for the next new Session. |
| `/cwd [absolute-path]` | Show or set the workspace for the next new Session. |
| `/permission` | Show the current Session permission preset. |
| `/permission workspace-write` | Use the workspace write sandbox with mobile approval. |
| `/permission danger-full-access confirm` | Explicitly grant full machine access without per-operation approval. |

Preset and cwd are creation-header facts, so their changes apply to the next
new Session. Permission changes apply to the current Session.

## Mobile approval

| Command | Description |
| --- | --- |
| `/approve <code>` | Allow exactly one pending operation. |
| `/reject <code>` | Reject exactly one pending operation. |

An approval code is bound to one authorized user, expires after five minutes,
and is consumed once. Timeout, task cancellation, bridge shutdown, or an
unavailable reply channel fails closed. The bridge handles only Agents it owns;
approval for an Agent borrowed from Web or desktop remains with that surface.

## Authorized users

| Command | Description |
| --- | --- |
| `/users` | List masked authorized-user IDs. Owner only. |
| `/invite` | Create a one-use pairing code valid for ten minutes. Owner only. |
| `/pair <code>` | Authorize the sender with a valid pairing code. |
| `/revoke <number-or-user-id> confirm` | Revoke a non-owner user. Owner only. |
| `/audit [1-20]` | Show recent bounded security events. Owner only. |

The first locally paired account is the owner. Invalid `/pair` attempts do not
receive a reply, avoiding an authorization oracle.

## Native DSH commands

An unrecognized connector command is passed to `ctx.commands.execute()`. This
allows Preset-provided commands such as `/plan`, `/goal`, or `/compact`. If DSH
also does not recognize it, the command is rejected instead of being sent to
the model as prompt text.
