# Personal Edition by Xab3r

This is [iXab3r/t3code](https://github.com/iXab3r/t3code), a personal fork of
[pingdotgg/t3code](https://github.com/pingdotgg/t3code). The personal edition keeps
upstream T3 Code plus personal patches and publishes its own desktop updates.

## Branches and PR targets

- `main` is the fork's default, integration, and release branch: upstream plus
  personal changes, including branding, update URLs, and TeamCity infrastructure.
  Visitors see this branch and its README by default.
- `upstream` mirrors `pingdotgg/t3code:main` exactly. It contains no fork changes
  or pending contribution candidates. The Git remote named `upstream` still points
  to `pingdotgg/t3code`; its `upstream/main` ref is distinct from our `origin/upstream` branch.
- Start fork topic branches from `origin/main`, use the `bugfix/` prefix by default,
  and target PRs at `iXab3r/t3code:main`.
- Start upstream contribution branches from `origin/upstream` or `upstream/main`.
  Review their diff against `upstream/main` before opening a PR to
  `pingdotgg/t3code:main`. An optional review PR here targets `upstream`; do not
  merge it into the mirror until the change has landed upstream.
- Never merge our `main` into `upstream` or base an upstream contribution on our
  `main`. If a fix was discovered in the fork, cherry-pick only that focused change
  onto a clean upstream contribution branch.

Update the clean mirror, then periodically merge it into our `main`, resolving
conflicts while preserving fork changes. Do not reset or force-push away fork work.

From a clean checkout:

```sh
git fetch upstream main
git push origin refs/remotes/upstream/main:refs/heads/upstream
git fetch origin main upstream
git switch -c bugfix/upstream-sync origin/main
git merge origin/upstream
# Resolve conflicts and verify. Push the topic branch; target our main if a PR is requested.
```

## Builds and updates

[T3 Personal in TeamCity](https://build.eyeauras.net/project/T3Personal) uses
`T3Personal_Git`, whose default branch is `refs/heads/main`. The release trigger
is restricted to that default branch. `upstream` does not publish releases.

The chain prepares the shared bundle and Linux x64 WSL runtime, packages and
checks Windows x64 in an interactive user session, then validates and publishes
the matching assets to [our GitHub releases](https://github.com/iXab3r/t3code/releases).
The desktop updater uses that repository's nightly feed. macOS packaging will be
added when the macOS agent is ready; the Linux archive is a CLI/WSL runtime.

Versioned TeamCity settings synchronize from `.teamcity` on `main`. Builds use
current TeamCity settings (`alwaysUseCurrent`) so inherited authorization is not
replayed from an obsolete build-settings snapshot. Secrets stay in TeamCity;
never commit them. Release manifests require matching source revisions and hashes
across the chain. Setup is in `scripts/personal-release/configure-teamcity.ps1`.

## Maintaining the fork overview

Keep [What this fork changes](../../README.md#what-this-fork-changes) current in
the same change that ships, changes, or removes a user-visible customization.
Describe the behavior and why it is useful, rather than implementation details.
Update README installation and usage instructions when the supported platforms,
release assets, or update process change. Open PRs and planned features do not
belong in the shipped feature list.
