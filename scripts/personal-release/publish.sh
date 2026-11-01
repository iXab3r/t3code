#!/usr/bin/env bash
set -euo pipefail

mode="${T3_PUBLISH:-off}"
if [[ "$mode" == off ]]; then
  echo 'GitHub publication is disabled; validated assets are available in TeamCity.'
  exit 0
fi
if [[ "$mode" != draft && "$mode" != release ]]; then
  echo 'T3_PUBLISH must be off, draft, or release.' >&2
  exit 1
fi
: "${GITHUB_TOKEN:?A GitHub token with contents:write for iXab3r/t3code is required.}"

if ! command -v gh >/dev/null; then
  apt-get update
  DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gh
fi
repo=iXab3r/t3code
version=$(node -p 'JSON.parse(require("fs").readFileSync("ci-out/release/manifest.json")).version')
revision=$(node -p 'JSON.parse(require("fs").readFileSync("ci-out/release/manifest.json")).revision')
tag="v$version"
if ! tag_revision=$(gh api "repos/$repo/git/ref/tags/$tag" --jq .object.sha 2>/dev/null); then
  tag_revision=''
fi
if [[ -n "$tag_revision" && "$tag_revision" != "$revision" ]]; then
  echo "Tag $tag already points at a different commit." >&2
  exit 1
fi

existing=$(gh release view "$tag" --repo "$repo" --json isDraft --jq .isDraft 2>/dev/null || true)
if [[ "$existing" == false ]]; then
  echo "Release $tag is already published; it will not be overwritten."
  exit 0
fi
if [[ "$existing" != true ]]; then
  gh release create "$tag" --repo "$repo" --target "$revision" --draft --prerelease \
    --title "T3 Personal $version" --notes "Personal T3 Code build from $revision. Windows x64 installer, Linux x64/ARM64 AppImage and deb packages, and matching CLI runtimes."
fi
mapfile -t assets < <(find ci-out/release -maxdepth 1 -type f -print | sort)
gh release upload "$tag" --repo "$repo" --clobber -- "${assets[@]}"
if [[ "$mode" == release ]]; then
  gh release edit "$tag" --repo "$repo" --draft=false
fi
echo "Release: https://github.com/$repo/releases/tag/$tag"
