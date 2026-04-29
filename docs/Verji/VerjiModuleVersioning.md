# Verji modules — versioning and publishing

This document is the authoritative reference for how the seven `@verji/*` modules are versioned, branched, and published. If you are cutting a new module release, adding a new module, or wondering "where does the verji-v2 tag come from", read this.

For the local development side of the same modules — install loops, EEXIST errors, recursion saga, and webpack aliasing — see [VerjiModules.md](./VerjiModules.md). That's a complementary doc, focused on day-to-day dev-loop pain. This one focuses on the release/CI side.

---

## Overview: two parallel tracks

Each `@verji/*` module repo maintains **two release tracks** in parallel, one per branch:

| Branch in module repo | Track | Consumed by | Identifier |
|---|---|---|---|
| `main` | **Legacy** | `element-web` v1.11.68 + `matrix-react-sdk` v3.100.0 + `@matrix-org/react-sdk-module-api` v2.4.0 (npm) | npm `latest` dist-tag (today) |
| `main-v2` | **v2** | `element-web-v2/verji-develop` + `matrix-js-sdk-v2` + `matrix-react-sdk-module-api/verji-main-v2` | npm `verji-v2` dist-tag |

Why two tracks: Element absorbed `matrix-react-sdk` into `element-web` in Dec 2024. Verji is doing the equivalent absorption on `element-web-v2`. While that migration is in flight, both ecosystems must remain patchable. The two tracks share repos but never share version numbers.

The seven modules:

- `verji-cryptosetup-module`
- `verji-eventsearch-module`
- `verji-news-module`
- `verji-onboarding-module`
- `verji-roomsublist-module`
- `verji-usermenu-module`
- `verji-usersearch-module`

Plus a related upstream — `matrix-react-sdk-module-api` — which has the same `verji-main` (legacy) and `verji-main-v2` (v2) split.

## Version policy: hard major-version split

The two tracks own disjoint version ranges. **Legacy never reaches `2.x`; v2 never reaches anything below `2.0.0`.**

| Module | Legacy series (today) | v2 starting version |
|---|---|---|
| verji-cryptosetup-module | `0.0.x` | `2.0.0` |
| verji-eventsearch-module | `0.0.x` | `2.0.0` |
| verji-news-module | `0.0.x` | `2.0.0` |
| verji-onboarding-module | `0.x.x` | `2.0.0` |
| verji-roomsublist-module | `0.0.x` | `2.0.0` |
| verji-usermenu-module | `1.1.x` | `2.0.0` |
| verji-usersearch-module | `0.0.x` | `2.0.0` |

Rules:

- **Every `main-v2` branch resets to `2.0.0` on first publish**, regardless of where its legacy series sits. Subsequent v2 releases increment within `2.x.x`.
- **Legacy `main` continues its current series** — `0.0.x` stays in `0.0.x`, `1.1.x` stays in `1.1.x`. Never bump legacy past `1.x.x` until v2 is fully retired.
- **The split protects both tracks**: legacy can ship `0.0.7`, `0.0.8`, ..., `0.99.99` indefinitely without ever colliding with the v2 range.

If at some future point legacy genuinely needs a major bump (e.g. ABI break), it can go to `1.0.0` for cryptosetup or skip past `2.0.0` for usermenu. Rare, and worth handling case-by-case if reached.

## npm dist-tag convention

Both tracks publish to **GitHub Packages** (`https://npm.pkg.github.com`) under the `@verji` scope. Tags distinguish the tracks at install time:

| Track | dist-tag | Install command | Notes |
|---|---|---|---|
| Legacy | `latest` (default) | `npm install @verji/<module>` | Default tag — what you get when no spec is given |
| v2 | `verji-v2` | `npm install @verji/<module>@verji-v2` | Explicit opt-in — does not affect `latest` |

`verji-v2` was chosen as the tag name because it is **not parseable as a SemVer range** (`v2` alone is rejected by npm — it parses as `2.x.x`). Any tag containing the letter combination `verji` is safely outside the SemVer parse grammar.

Until v2 is fully validated and rolled out, **`latest` stays pinned to legacy**. This means existing consumers running `yarn add @verji/foo` (no spec) keep getting production-tested versions. Promoting v2 to `latest` is a one-line operation when ready: `npm dist-tag add @verji/<module>@<v2-version> latest`.

## Per-module manifest (`package.json`) on `main-v2`

The shape varies based on whether the module imports from `element-web/src/...`. Two patterns:

### Pattern A — modules without `element-web` dep (cryptosetup, usersearch, eventsearch)

```jsonc
{
  "name": "@verji/<module>",
  "version": "2.0.0",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "tag": "verji-v2"
  },
  "peerDependencies": {
    "@matrix-org/react-sdk-module-api": "^2.4.0",
    "matrix-js-sdk": ">=35.0.0"
  },
  "devDependencies": {
    "@matrix-org/react-sdk-module-api": "https://github.com/verji/matrix-react-sdk-module-api.git#verji-main-v2",
    "matrix-js-sdk": "35.0.0"
    // ... other build-time tooling
  }
}
```

Notes:

- `matrix-js-sdk` in **devDeps is the npm version `35.0.0`**, NOT the verji fork. The npm tarball ships pre-built `lib/` + `.d.ts` files; tsc uses them under `skipLibCheck`. The verji fork's git repo does not commit `lib/`, and yarn 1 does not run a `prepare` script during git-URL installs — so a github URL ref produces an empty `node_modules/matrix-js-sdk` and breaks tsc. The runtime concern (the verji fork) is satisfied via element-web-v2's own deps, not the module's.
- `@matrix-org/react-sdk-module-api` IS the github URL fork — that repo commits `lib/` to git, so the github form works fine. The npm-published `2.4.0` is also yalc-contaminated (the published tarball includes `.yalc/` because the source repo's `package.json` `files` allowlist did not exclude it).

### Pattern B — modules with `element-web` dep (news, roomsublist, usermenu, onboarding)

These import from `element-web/src/...` paths. Their tsc-emit traverses element-web-v2's source code, which surfaces real type errors that element-web-v2's own build never validates (because element-web-v2 ships with webpack+babel only, no tsc). The **resolutions** field is the workaround:

```jsonc
{
  "name": "@verji/<module>",
  "version": "2.0.0",
  "publishConfig": {
    "registry": "https://npm.pkg.github.com",
    "tag": "verji-v2"
  },
  "resolutions": {
    "matrix-js-sdk": "https://github.com/verji/matrix-js-sdk-v2.git#verji-develop",
    "**/matrix-js-sdk": "https://github.com/verji/matrix-js-sdk-v2.git#verji-develop",
    "**/matrix-widget-api": "1.10.0"
  },
  "dependencies": {
    "@matrix-org/react-sdk-module-api": "https://github.com/verji/matrix-react-sdk-module-api.git#verji-main-v2",
    "matrix-js-sdk": "https://github.com/verji/matrix-js-sdk-v2.git#verji-develop"
    // ...
  },
  "devDependencies": {
    "element-web": "https://github.com/verji/element-web-v2.git#verji-develop",
    // The full @types/* coverage list — see below
    // ...
  }
}
```

Why each resolution matters:

- **`**/matrix-js-sdk` → verji fork**: element-web's source uses verji-modified signatures (e.g. 3-arg `searchUserDirectory` in `useUserDirectory.ts`). Forcing matrix-js-sdk to the upstream npm version breaks element-web's type check.
- **`**/matrix-widget-api: 1.10.0`**: matrix-js-sdk-v2's `src/embedded.ts` calls `widgetApi.updateDelayedEvent(...)`. That method exists in matrix-widget-api **1.10.0** (which element-web-v2 pins) but was removed in **1.17.0** (which yarn would otherwise pick at top-level via `^1.10.0`). Forcing 1.10.0 everywhere keeps embedded.ts type-clean.
- **`@types/*` coverage in devDeps**: every transitive dep from element-web's source that lacks bundled types needs an `@types/*` package. The canonical list (use as a checklist when adding a new element-web-dep module):

  ```
  @types/commonmark, @types/content-type, @types/counterpart, @types/css-tree,
  @types/diff-match-patch, @types/escape-html, @types/file-saver, @types/glob-to-regexp,
  @types/katex, @types/lodash, @types/modernizr, @types/pako, @types/qrcode,
  @types/sanitize-html, @types/sdp-transform, @types/seedrandom, @types/tar-js,
  @types/ua-parser-js
  ```
- **`matrix-web-i18n`** in devDeps: element-web's `languageHandler.tsx` imports it; tsc cannot resolve the module otherwise.

### tsconfig path gotcha (Pattern B only)

Some modules' `tsconfig-build.json` uses `paths` mapping `"element-web/*"` to `"../element-web-v2/*"` (sibling-dir relative path). That works in local dev where the workspace has `element-web-v2/` as a sibling, but **fails in CI** which only has `node_modules/element-web/` from the github URL devDep. Use:

```jsonc
"paths": {
  "element-web/*": ["./node_modules/element-web/*"],
  "matrix-js-sdk/*": ["./node_modules/matrix-js-sdk/*"]
}
```

Same fix for any `include` entries that reference `../element-web-v2/...`.

## Publish workflow (`.github/workflows/publish-v2.yaml`)

Each module repo has a workflow that auto-publishes on push to `main-v2`. The shape is uniform; key steps:

```yaml
name: Publish v2
on:
    push:
        branches: [main-v2]
        paths-ignore:
            - "**.md"
            - ".github/**"

jobs:
    publish:
        runs-on: ubuntu-latest
        permissions:
            contents: write    # needed for git tag push
            packages: write    # needed for GitHub Packages publish
        steps:
            - uses: actions/checkout@v4
            - uses: actions/setup-node@v4
              with:
                  node-version: 20
                  registry-url: https://npm.pkg.github.com
                  scope: "@verji"

            - name: Install dependencies
              run: yarn install --frozen-lockfile
              env:
                  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

            - name: Verify no yalc refs leaked
              run: |
                  if grep -E '"file:\.yalc|link:' package.json; then
                      echo "::error::yalc/link refs in package.json — refusing to publish"
                      exit 1
                  fi

            - name: Verify version not already published
              run: |
                  PKG=$(node -p "require('./package.json').name")
                  VER=$(node -p "require('./package.json').version")
                  if npm view "$PKG@$VER" version 2>/dev/null; then
                      echo "::error::Version $VER of $PKG is already published — bump package.json"
                      exit 1
                  fi
              env:
                  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

            - name: Build
              run: yarn build

            - name: Publish to GitHub Packages
              run: npm publish --tag verji-v2
              env:
                  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}

            - name: Tag git release
              run: |
                  VER=$(node -p "require('./package.json').version")
                  git config user.name 'github-actions[bot]'
                  git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
                  git tag "v$VER"
                  git push origin "v$VER"
```

Critical details:

- **`paths-ignore: ['**.md', '.github/**']`** — adding the workflow file itself does NOT trigger publish. README updates also don't trigger. Use any other file change (or `git commit --allow-empty`) to retrigger.
- **`NODE_AUTH_TOKEN` on the install step** — required for any module that depends on `@verji/*` packages from GitHub Packages. Without it: `401 Unauthorized` on transitive `@verji/verji-api-sdk` etc. fetches.
- **Yalc-leak guard** — refuses to publish if `package.json` contains `file:.yalc/...` or `link:` refs. Prevents the kind of contamination we hit on `@matrix-org/react-sdk-module-api@2.4.0`.
- **Version-already-published guard** — fails fast if `package.json` `version` matches an existing published version. Forces author to bump in PR rather than silently no-op.
- **`--tag verji-v2`** — every v2 publish goes to this dist-tag. Never to `latest` (until v2 is promoted explicitly).

### Author responsibility

Bump `version` in `package.json` as part of the PR before merging to `main-v2`. CI publishes whatever version is committed. If unbumped, the version-already-published check fails the workflow.

### Cross-repo package access (one-time setup per consumer repo)

The Actions-issued `GITHUB_TOKEN` only has read access to packages **in the workflow's own repo** by default. To consume `@verji/verji-api-sdk` (published from a different `@verji/*` repo) from `verji-roomsublist-module`'s workflow, the publisher repo's package settings need:

> Package settings → "Manage Actions access" → add the consumer repo with **Read** role

This is per-package configuration. Without it, install will 401 even with `NODE_AUTH_TOKEN` set. Alternative: a PAT secret with `read:packages` scope, but the Actions-token-with-grant approach is cleaner.

## Consumer side: `element-web-v2/build_config.verji.yaml`

The verji build config pins all 7 modules to the `verji-v2` dist-tag:

```yaml
modules:
    - "@verji/verji-cryptosetup-module@verji-v2"
    - "@verji/verji-usermenu-module@verji-v2"
    - "@verji/verji-onboarding-module@verji-v2"
    - "@verji/verji-usersearch-module@verji-v2"
    - "@verji/verji-news-module@verji-v2"
    - "@verji/verji-eventsearch-module@verji-v2"
    - "@verji/verji-roomsublist-module@verji-v2"
```

The installer at [module_system/scripts/install.ts](../../module_system/scripts/install.ts) passes each entry verbatim to `yarn add -O`. yarn resolves `verji-v2` to the latest version on that dist-tag (currently `2.0.0` for all 7) and pins it in `yarn.lock` for build reproducibility.

For local dev, [build_config.yaml](../../build_config.yaml) uses `file:../verji-*-module` refs to the sibling working dirs — that path is unchanged by this versioning policy.

## Local development still uses yalc

Versioning/publishing is a CI-side concern. Local dev iterating on a module does **not** require version bumps or registry publishes:

1. Develop in the sibling module dir (`c:/dev/fresh-fork/verji-<module>/`).
2. Build the module (`yarn build`).
3. element-web-v2's installer picks up changes via `file:../verji-<module>` (in `build_config.yaml`) and copies the built `lib/` into `node_modules/@verji/<module>/`.

See [DevLoopWindows.md](./DevLoopWindows.md) for the full Windows dev-loop story (Defender exclusions, EEXIST recovery, install-cache short-circuit).

**Never commit yalc-modified `package.json` or `yarn.lock`** to a module repo. The publish workflow's yalc-leak guard catches this if you forget; the better fix is to keep yalc state ephemeral.

## Recovery procedures

Two stuck-state recipes worth knowing:

### `yarn install` fails or yarn.lock has stale `link:`/`"file:`/`.yalc` entries

```bash
cd verji-<module>
rm -rf node_modules yarn.lock
yarn install
```

Delete **both** together — yarn.lock-only deletion replays a broken lockfile, node_modules-only deletion preserves the contaminated cache state. This is the standard recovery for the historic element-web-v2 circular-dep + yalc-contamination class of issue.

### Workflow doesn't trigger after pushing a fix

`paths-ignore` on the workflow excludes `.md` and `.github/**`. If the only change was a workflow edit or README update, no fire. Push any other change (or `git commit --allow-empty -m "ci: retrigger"`).

## Status table — current state of the 7 modules

| Module | Legacy version (npm `latest`) | v2 version (npm `verji-v2`) | Element-web dep? |
|---|---|---|---|
| verji-cryptosetup-module | 0.0.6 | 2.0.0 | No |
| verji-eventsearch-module | 0.0.27 | 2.0.0 | No |
| verji-usersearch-module | 0.0.17 | 2.0.0 | No |
| verji-news-module | 0.0.20 | 2.0.0 | Yes |
| verji-roomsublist-module | 0.0.96 | 2.0.0 | Yes |
| verji-usermenu-module | 1.1.26 | 2.0.0 | Yes |
| verji-onboarding-module | 0.3.0 | 2.0.0 | Yes |

Verify any module's published versions: `npm view @verji/<module> dist-tags`.

## Open follow-ups (not yet done)

- **Legacy publish workflow** — `main` branches need their own `publish-legacy.yaml` with `--tag legacy` (and `publishConfig.tag: legacy`). Until this is set up, manual `yarn publish` from `main` defaults to `latest` — fine for now, but a one-line `--tag latest` slip from `main-v2` could collide. The publish-v2 workflow's `--tag verji-v2` makes that collision unlikely in practice; the legacy workflow would close it definitively.
- **Republish `@matrix-org/react-sdk-module-api@3.0.0`** cleanly — the current published `2.4.0` ships `.yalc/` baked into the tarball (because the source repo's `package.json` `files` allowlist did not exclude it). Doesn't break installs, but it's a leak that should be cleaned up on the next major version cut on `verji-main-v2`.

## Related docs

- [VerjiModules.md](./VerjiModules.md) — local-dev install architecture, the April 2026 EEXIST/recursion saga, webpack alias mechanism.
- [VerjiConfig.md](./VerjiConfig.md) — UIFeature flags and runtime configuration.
- [DevLoopWindows.md](./DevLoopWindows.md) — Windows-specific dev-loop troubleshooting.
- [Verji.md](../../Verji.md) — top-level architecture overview, what each module does.
