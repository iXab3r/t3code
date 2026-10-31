# Personal Edition by Xab3r

This is [iXab3r/t3code](https://github.com/iXab3r/t3code), a personal fork of
[pingdotgg/t3code](https://github.com/pingdotgg/t3code). The personal edition keeps
upstream T3 Code plus personal patches and publishes its own desktop updates.

## Branches and PR targets

- `main` is the upstream lane. It follows upstream and may accept focused changes
  that we intend to contribute upstream. Personal customizations never belong here.
- `personal` is the integration and release branch: upstream plus our personal
  changes, including branding, update URLs, and TeamCity release infrastructure.
- Start personal topic branches from `origin/personal`, use the `bugfix/` prefix
  by default, and target PRs at `iXab3r/t3code:personal`.
- Start upstream contribution branches from clean `main` (or `upstream/main` if
  our `main` contains unrelated pending contributions). PRs into our `main` are
  exclusively for upstream contributions. Review the topic's diff against
  `upstream/main` before opening its upstream PR; it must contain no personal changes.
- Never merge `personal` into `main` or base an upstream contribution on `personal`.
  If a fix was discovered there, cherry-pick only that focused change onto a clean
  upstream contribution branch.

Keep the lanes synchronized by bringing upstream changes into `main`, then
periodically back-merging `main` into `personal`. Resolve conflicts on `personal`
while preserving its customizations. Do not reset or force-push away personal work.

After `origin/main` has been updated, a personal topic branch can bring it in with:

```sh
git fetch origin
git switch -c bugfix/personal-upstream-sync origin/personal
git merge origin/main
# Resolve conflicts, verify, then push and target personal when a PR is requested.
```

## Builds and updates

[T3 Personal in TeamCity](https://build.eyeauras.net/project/T3Personal) uses
`T3Personal_Git`, whose default branch is `refs/heads/personal`. The release trigger
is restricted to that default branch. `main` does not publish personal releases.

The chain prepares the shared bundle and Linux x64 WSL runtime, packages and
checks Windows x64 in an interactive user session, then validates and publishes
the matching assets to [our GitHub releases](https://github.com/iXab3r/t3code/releases).
The desktop updater uses that repository's nightly feed. macOS packaging will be
added when the macOS agent is ready; the Linux archive is a CLI/WSL runtime.

Versioned TeamCity settings synchronize from `.teamcity` on `personal`. Builds use
current TeamCity settings (`alwaysUseCurrent`) so inherited authorization is not
replayed from an obsolete build-settings snapshot. Secrets stay in TeamCity;
never commit them. Release manifests require matching source revisions and hashes
across the chain. Setup is in `scripts/personal-release/configure-teamcity.ps1`.
