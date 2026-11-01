# T3 Code — Personal Edition by Xab3r

This is [Xab3r's personal fork](https://github.com/iXab3r/t3code) of
[T3 Code by pingdotgg](https://github.com/pingdotgg/t3code). It keeps the upstream
coding-agent workspace and adds the personal changes listed below. This is an
independent distribution with its own releases and update feed.

T3 Code runs agents on your machine and lets you control them from a desktop,
web, or mobile client. It works with your subscriptions and authenticated
Codex, Claude Code, Cursor, Grok Build, OpenCode, and Antigravity providers.

## What this fork changes

- **Unread completion badges persist.** Background thread completions stay marked
  until you view the corresponding threads, so finishing work is easier to find.
- **Visible fork identity.** The app header shows `personal edition by Xab3r`
  with a link to this repository.
- **A separate release and update feed.** Personal desktop and standalone CLI
  builds update from this repository's nightly releases.
- **Matching Windows and WSL builds.** TeamCity packages the Windows desktop
  together with a Linux x64 WSL runtime built from the same source revision.

This list describes shipped differences. Keep it current when a fork feature is
added, changed, or removed; see the [fork workflow](docs/operations/personal-fork.md).

## Installation

Download the newest published nightly from
[this fork's releases](https://github.com/iXab3r/t3code/releases). Releases are
marked as prereleases, so use the releases list to find the newest one.

| Platform                            | Personal build                                                                                     |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- |
| Windows x64                         | `T3-Code-<version>-x64.exe` desktop installer, or `t3-<version>-win32-x64.zip` standalone CLI      |
| Linux x64, including Nobara and WSL | `t3-<version>-linux-x64.tar.gz` standalone CLI/runtime                                             |
| macOS                               | Personal packages are not published yet; packaging will be added when the Mac build agent is ready |

### Windows desktop

1. Download and run the `.exe` installer from a personal release.
2. Open T3 Code. The header identifies it as `personal edition by Xab3r`.
3. Install and authenticate at least one supported provider on the machine where
   agents will run, then select it in T3 Code.
4. Open your project folder, create a thread, and send a prompt.

To use the bundled `t3` command in a terminal, open **Settings → About → t3 command**.
To connect another device, open **Settings → Sharing & access** on the host and
follow the [remote access guide](docs/user/remote-access.md). Keep the host running.
The official upstream mobile app can connect to this server; this fork does not
currently publish its own mobile clients.

### Standalone CLI on Windows or Linux

Extract the matching CLI archive into its own folder and keep all its contents
together, including `client`, `resource-monitor`, and any bundled libraries.
Open a terminal in the extracted `t3-<version>-<platform>` folder.

On Windows:

```powershell
.\t3.exe --help
.\t3.exe serve
```

On Linux:

```sh
./t3 --help
./t3 serve
```

Open the browser/pairing URL printed by the command. Authenticate a provider on
that host before starting an agent thread. Add the extracted folder to your
`PATH` if you want to run `t3` from elsewhere. See
[remote access](docs/user/remote-access.md) for `t3 up` and multi-device use.

### Upstream installation methods

`npx t3`, the installers at `t3.codes`, and the upstream winget, Scoop, Homebrew,
AUR, and Nix packages install upstream T3 Code. To get this personal edition,
use the release assets above or build this repository from source.

## Updating

The personal desktop app uses its built-in updater to download this fork's
nightly releases. Follow the update prompt, or install a newer personal `.exe`
manually from the releases page.

For the standalone CLI, run from its extracted folder:

```powershell
# Windows
.\t3.exe update --channel nightly
```

```sh
# Linux
./t3 update --channel nightly
```

If `t3` is on your `PATH`, use `t3 update --channel nightly`. Desktop builds
and CLI/runtime archives in a release share the same version and source revision.

## Branches and contributions

- **`main`** is this fork's default branch, including personal changes. Fork PRs
  target `main`, and TeamCity publishes personal builds from this branch.
- **`upstream`** is a clean mirror of `pingdotgg/t3code:main`. Start upstream
  contribution branches here, keeping them free of personal patches.
- Periodically merge `upstream` into our `main` to bring in upstream changes.
- **`personal`** is a legacy branch retained for the migration; do not use it
  for new work or PRs.

See [the fork workflow](docs/operations/personal-fork.md) for synchronization and
upstream contribution rules.

## Documentation

Full docs live in [docs/](./docs). There's no docs site yet.

- [FAQ](./docs/user/faq.md)
- [Install and first run](./docs/user/install.md)
- [Permission modes](./docs/user/permission-modes.md)
- [Keyboard shortcuts](./docs/user/keybindings.md)
- [Project settings](./docs/user/project-settings.md)
- [Appearance preferences](./docs/user/appearance.md)
- [Remote access from a phone or another machine](./docs/user/remote-access.md)
- [Connect Claude Code, Codex, ChatGPT and other agents over MCP](./docs/user/outside-agents.md)
- [Keeping app and server in sync](./docs/user/updating.md)
- [Source control integrations](./docs/user/source-control.md)
- Multiple accounts: [Codex](./docs/user/providers-codex.md) · [Claude](./docs/user/providers-claude.md)
- [Run T3 Code as a background service](./docs/user/background-service.md)

Building from source? Start at [docs/internals/overview.md](./docs/internals/overview.md).

## Building from source

### Install `vp`

T3 Code uses Vite+ so you'll need to install the global `vp` command-line tool.

#### macOS / Linux

```bash
curl -fsSL https://vite.plus | bash
```

#### Windows

```bash
irm https://vite.plus/ps1 | iex
```

Checkout their getting started guide for more information: https://viteplus.dev/guide/

### Clone and run this fork

```sh
git clone --branch main https://github.com/iXab3r/t3code.git
cd t3code
```

### Install dependencies

```bash
vp i
vp run dev
```

Read [CONTRIBUTING.md](./CONTRIBUTING.md) before reporting a bug or opening a PR.

For fork-specific bugs and suggestions, use [our issues](https://github.com/iXab3r/t3code/issues). Upstream proposals belong in [upstream Ideas discussions](https://github.com/pingdotgg/t3code/discussions/categories/ideas).

The upstream [Discord](https://discord.gg/jn4EGJjrvv) supports upstream T3 Code; report personal-edition issues in this fork.
