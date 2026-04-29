#!/usr/bin/env bash
# Build element-web-v2 with a version string that combines the package.json
# version, the current commit SHA, and the BUILD_ID passed from the CI runner.
#
# The previous version of this script depended on:
#   - git tags being pushed to origin (they weren't)
#   - matrix-js-sdk being installed via the legacy `yarn link` flow that left
#     a .git dir in node_modules (we dropped those link scripts in favor of
#     yarn install + git insteadOf auth)
# Both of those broke in the GHCR pipeline cutover, so this rewrite gets the
# version from package.json + the element-web-v2 commit SHA — no external
# dependencies.

set -ex

PKG_VERSION=$(node -p "require('./package.json').version")
SHA=$(git rev-parse --short=12 HEAD)
DIST_VERSION="verji-${PKG_VERSION}-${SHA}-${1}"

VERSION=$DIST_VERSION yarn build
echo "$DIST_VERSION" > /src/webapp/version
