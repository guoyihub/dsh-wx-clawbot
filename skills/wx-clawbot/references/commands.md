# Phone command reference

Natural-language messages run DSH tasks in the current phone Session. Commands
manage the channel and its DSH Session state.

| Command | Behavior |
| --- | --- |
| `/status` | Show Session, task, workspace, Preset, permission, and model. |
| `/sessions` | List the authorized user's unarchived Sessions. |
| `/use <number-or-short-id>` | Switch to an existing Session. |
| `/new [title]` | Keep the old Session and create a new one. |
| `/rename <title>` | Rename the current Session. |
| `/archive [number-or-short-id]` | Archive a selected or current Session. |
| `/archive-all confirm` | Archive every active Session owned by this user. |
| `/search <query>` | Search active Sessions by title, ID, or workspace. |
| `/cancel` | Immediately request cancellation of the running task. |
| `/steer <instruction>` | Add a correction at the next DSH step boundary. |
| `/task` | Show current task state and elapsed time. |
| `/queue` | Show queued message count. |
| `/doctor` | Show sanitized channel and capability health. |
| `/model [provider/model]` | Show or change the current Session model. |
| `/preset [id]` | Show or select the Preset for the next new Session. |
| `/permission workspace-write` | Use the normal workspace write sandbox. |
| `/permission danger-full-access confirm` | Explicitly grant the current Session full machine access. |
| `/approve <code>` | Allow exactly one pending operation. |
| `/reject <code>` | Reject exactly one pending operation. |
| `/users` | List masked authorized users as owner. |
| `/invite` | Create a ten-minute one-use invitation as owner. |
| `/pair <code>` | Join with a valid invitation. |
| `/revoke <user> confirm` | Revoke a non-owner user as owner. |
| `/audit [1-20]` | Show recent security events as owner. |
| `/cwd [absolute-path]` | Show or set the workspace for the next new Session. |
| `/help` | Show the phone command summary. |

Unknown slash commands such as `/plan`, `/goal`, and `/compact` are forwarded
to DSH's native command system when that capability is present.

Task fast paths and approval decisions bypass the normal message queue so they
can affect a running turn. Workspace and Preset changes apply to a new Session;
permission changes apply to the current Session.

The first paired account becomes the owner. Session indexes, invitations, and
approval codes are isolated per Weixin user; never use a short ID or code to
bypass that isolation.
