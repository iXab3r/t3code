#!/usr/bin/env bash
set -euo pipefail

phase=prepare
if [[ "${1:-}" == linux-arm64 ]]; then
  phase=$1
  shift
fi

export DEBIAN_FRONTEND=noninteractive
export VP_HOME=/root/.vite-plus
export CARGO_HOME=/root/.cargo
export RUSTUP_HOME=/root/.rustup
export RUSTUP_TOOLCHAIN=1.96.1
export PATH="$VP_HOME/bin:$CARGO_HOME/bin:$PATH"
export CI=true

node scripts/personal-release/run.mjs check-github

apt-get update
apt-get install -y --no-install-recommends libsecret-1-dev pkg-config patchelf libatomic1 \
  imagemagick libwayland-dev libxkbcommon-dev libgtk-3-0 libnss3 libasound2 libxss1 \
  libgbm1 libatk-bridge2.0-0 libdrm2 xvfb xauth dbus-x11
if ! command -v rustup >/dev/null; then
  curl --location --fail --silent --show-error https://sh.rustup.rs -o /tmp/t3-rustup.sh
  sh /tmp/t3-rustup.sh -y --profile minimal --default-toolchain "$RUSTUP_TOOLCHAIN" --no-modify-path
fi
rustup toolchain install "$RUSTUP_TOOLCHAIN" --profile minimal
if ! command -v vp >/dev/null; then
  curl --location --fail --silent --show-error https://vite.plus -o /tmp/t3-vp.sh
  VP_VERSION=1.4.0 bash /tmp/t3-vp.sh
fi
vp env exec --node 26.12.1 --package-manager pnpm@12.14.0 node scripts/personal-release/run.mjs "$phase" "$@"
