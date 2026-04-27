# Windows dev loop — troubleshooting and gotchas

This document captures Verji-specific quirks that Windows developers will hit when running `yarn start` in `element-web-v2`. Linux/macOS dev machines generally do not need any of this.

## 1. Why `yarn start` fails with `EEXIST`

### Symptom

```
[4/5] Linking dependencies...
error Error: EEXIST: file already exists, symlink 'C:\dev\fresh-fork\element-web-v2' ->
      'C:\dev\fresh-fork\element-web-v2\node_modules\@verji\verji-news-module\node_modules\element-web'
```

The install stalls for 30+ minutes before this line appears.

### Cause

`element-web-v2`'s [package.json](../../package.json) declares `"name": "element-web"`. Four of the seven Verji modules reference `element-web` in their dependency manifest. Two of them used to declare it as a `dependency` with the `link:` protocol, which is what created the original EEXIST problem. That has been **corrected** — those two now declare it as a `devDependency` instead — but the historical context below explains why you might still hit EEXIST on stale workspace state:

| Module | Declaration | Kind |
|---|---|---|
| `verji-news-module` | `"element-web": "link:../element-web-v2"` | `devDependency` (was `dependency` before Part B) |
| `verji-usermenu-module` | `"element-web": "link:../element-web-v2"` | `devDependency` (was `dependency` before Part B) |
| `verji-onboarding-module` | `"element-web": ">=1.11.0"` | `peerDependency` |
| `verji-roomsublist-module` | `"element-web": ">=1.11.0"` | `peerDependency` |

When `element-web` was in `dependencies`, during the installer's `yarn add -O file:../verji-*-module` call yarn v1 had to resolve it transitively. That resolution took two shapes:

- **Direct self-symlink** — for the peer-dep form, yarn matches by `name` and creates `node_modules/@verji/<module>/node_modules/element-web` pointing directly at the project root.
- **link-protocol indirection** — for the `link:../element-web-v2` form, yarn registers `element-web` in its **global link store** (`%LOCALAPPDATA%\Yarn\Data\link\element-web` on Windows, `~/.config/yarn/link/element-web` on POSIX), then creates `node_modules/@verji/<module>/node_modules/element-web` pointing into that global store entry. Worse, yarn v1 **also packs element-web itself** into its tarball cache as part of the circular dep resolution, producing multi-GB cache entries per attempt that accumulate indefinitely (we observed 46 GB of orphan `npm-element-web-*` entries on one machine, causing ENOSPC and BSODs).

On Windows, yarn v1 does **not** atomically unlink-then-recreate any of these symlinks. Stale state from a previous failed run — the nested consumer-side symlink, the global link-store entry, or both — makes the next install's `[4/5] Linking dependencies...` phase throw `EEXIST` and abort. The installer's `finally` block at [module_system/installer.ts](../../module_system/installer.ts) restores `package.json`/`yarn.lock` but does not clean any of the symlink state.

**Why moving `element-web` to `devDependencies` fixes this (Part B):**

- Yarn v1 does **not** install `devDependencies` when processing a `file:` dep transitively. So element-web-v2's `yarn add file:../verji-news-module` no longer sees element-web as something to install — no link protocol fires, no `@verji/<module>/node_modules/element-web` junction gets created, no multi-GB cache entry is produced.
- **Standalone dev in each module still works** because `devDependencies` **are** installed by direct `yarn install` runs inside the module. So `yarn build` in `verji-news-module/` still resolves `import from "element-web/..."` through the `link:../element-web-v2` just like before.
- **Webpack resolution inside element-web-v2 is handled via an explicit alias** in [webpack.config.js](../../webpack.config.js) (`"element-web": __dirname`). Before Part B, webpack's resolver followed the junction that yarn had created inside `@verji/<module>/node_modules/element-web`. After Part B the junction is gone, so the alias provides the resolution explicitly. This makes the previously-accidental self-reference robust and independent of yarn's link protocol behavior.

### Automatic mitigation

Two scripts in [package.json](../../package.json) handle this:

- `verji:prestart` — the Verji-owned entry point. Runs [`scripts/clean-verji-peerdep-symlinks.js`](../../scripts/clean-verji-peerdep-symlinks.js), which wipes all three places yarn v1 leaves stale link-protocol state:
  1. `element-web-v2/node_modules/@verji` — the consumer-side install tree. Removed entirely so yarn re-copies the `file:` deps into a guaranteed-empty directory. Not wasted work: yarn v1 re-copies `file:` deps on every `yarn add` anyway.
  2. Yarn's global link-store entry for `element-web` (`%LOCALAPPDATA%\Yarn\Data\link\element-web` on Windows; `~/.config/yarn/link/element-web` on POSIX), so the link protocol starts from a clean registration.
  3. Each sibling `verji-*-module/node_modules/element-web` junction in the workspace. These are created by standalone `yarn install` in a module (or by a failed `yarn add` from `element-web-v2`) and persist across runs. Dangling junctions — targeting a global link-store entry that we deleted earlier — break yarn's link reconciliation silently.
- `prestart` — a thin delegator (`yarn verji:prestart`) that exists only so the npm lifecycle auto-fires the Verji script before `yarn start`. Upstream's `start` script is untouched, which keeps future upstream merges clean.

You should not need to intervene manually. If you ever want to run the cleanup on its own, `yarn verji:prestart` does it.

### Manual recovery if the prestart is bypassed

If the `prestart` delegation is ever disabled (for example, if you run `yarn build:module_system` directly instead of `yarn start`), run `yarn verji:prestart` from `element-web-v2/`, or equivalently from any PowerShell:

```powershell
# 1. Consumer-side state
Remove-Item -Recurse -Force c:\dev\fresh-fork\element-web-v2\node_modules\@verji -ErrorAction SilentlyContinue
# 2. Yarn global link-store entry
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\Yarn\Data\link\element-web" -ErrorAction SilentlyContinue
# 3. Sibling module junctions
Get-ChildItem c:\dev\fresh-fork -Directory -Filter 'verji-*-module' | ForEach-Object {
    $p = Join-Path $_.FullName 'node_modules\element-web'
    if (Test-Path $p) { Remove-Item -Recurse -Force $p }
}
```

## 2. Windows Defender exclusions (required for sane install times)

Windows Defender real-time scanning intercepts every file yarn touches. On a fresh install of `element-web-v2`, `yarn add` opens hundreds of thousands of files across `node_modules/`, the yarn cache, and the `file:` dep copies. Without exclusions, each of those triggers an AV scan and the install can take 10× longer than it should (1.7 cores pegged on `MsMpEng.exe`, visible in Task Manager).

Run the following from an **admin** PowerShell once per machine:

```powershell
# Project + yarn + npm caches
Add-MpPreference -ExclusionPath "c:\dev\fresh-fork"
Add-MpPreference -ExclusionPath "$env:LOCALAPPDATA\Yarn\Cache"
Add-MpPreference -ExclusionPath "$env:APPDATA\npm-cache"

# Optional, more aggressive — only on a dev machine you trust
Add-MpPreference -ExclusionProcess "node.exe"
Add-MpPreference -ExclusionProcess "yarn.exe"

# Verify
Get-MpPreference | Select-Object -ExpandProperty ExclusionPath
Get-MpPreference | Select-Object -ExpandProperty ExclusionProcess
```

To undo later:

```powershell
Remove-MpPreference -ExclusionPath "c:\dev\fresh-fork"
# etc.
```

**Trust tradeoff**: excluded paths are not scanned on access, so a malicious `npm install` dropping code in those paths would not be caught by on-access detection. Reasonable for a dev machine where you are already running the code under development; not appropriate for your system-wide `C:\` or home directory.

Expected speedup: 2–10× on `yarn install` and `yarn add`, often 3–5× on webpack cold compiles.

## 3. Why install progress looks frozen under `concurrently`

### Symptom

`yarn start` prints `[3/5] Fetching packages...` and then falls silent for 10–20 minutes. No per-package output, no progress bar, no heartbeat.

### Cause

Yarn v1 only emits its per-package progress output (`[===> ] 3/127`-style lines) when stdout is attached to a TTY. The `concurrently` wrapper in the `start` script line-prefixes each child's output, which requires piping stdout through `concurrently` → child does not see a TTY → yarn v1 goes silent after the phase header until the phase finishes.

### Getting visibility when debugging

Run the installer step standalone in PowerShell (no `concurrently` wrapper):

```powershell
yarn build:module_system
```

That inherits the TTY and you will see per-package progress. To see individual HTTP requests as well, pass `--verbose` to the nested yarn add call — that requires editing [module_system/installer.ts](../../module_system/installer.ts), so it is not part of the default dev loop.

### The misleading "trouble with your network" message

When a single registry HTTP request takes longer than yarn v1's default `network-timeout` (30 s), yarn prints `"info There appears to be trouble with your network connection. Retrying..."`. This is almost never an actual connectivity problem; it is a slow metadata response (especially on Windows with Defender scanning every cache hit). The [.yarnrc](../../.yarnrc) in this repo bumps the timeout to 10 minutes, which silences the spurious retries without masking real failures.

## 4. Webpack filesystem cache — workflow and invalidation

### What the cache does

[webpack.config.js](../../webpack.config.js) enables the webpack 5 persistent filesystem cache:

```js
cache: {
    type: "filesystem",
    buildDependencies: {
        config: [__filename],
    },
},
```

First successful compile writes to `node_modules/.cache/webpack/`. On subsequent starts, webpack reads the cached dependency graph instead of re-parsing every module from scratch. A cold 13-minute compile typically becomes a 1–3 minute warm compile; incremental rebuilds on file save are seconds.

### How invalidation works

Webpack 5 snapshots every file in the dependency graph (content hash + mtime) and invalidates any entry whose file has changed on disk. Unchanged modules are reused; changed modules are re-parsed, re-transformed, and re-bundled. The `buildDependencies.config` entry ties the entire cache to `webpack.config.js`, so config changes auto-bust everything.

### Your module-edit loop is unchanged

The cache does not alter the existing workflow for changes to Verji modules:

1. Edit `verji-<module>/src/<something>.tsx`.
2. Run `yarn build` in the module — this rewrites its `lib/`.
3. Stop `yarn start` in `element-web-v2`.
4. Run `yarn start` again.

Step 4's installer re-copies the module's `lib/` into `element-web-v2/node_modules/@verji/<module>/lib/`. The file hashes change, webpack invalidates only the affected modules, and your changes show up. Everything else (React, matrix-js-sdk, element-web source) is served from cache — that is where the time savings come from.

### Cache escape hatch

Rare webpack snapshot misses can happen with unusual import patterns (for example, dynamic `require` calls behind a runtime flag). If you suspect stale module code is being served:

```powershell
Remove-Item -Recurse -Force c:\dev\fresh-fork\element-web-v2\node_modules\.cache\webpack
```

Then restart `yarn start`. This does not touch `node_modules/@verji/*` or anything the prestart hook manages.

### `verji:prestart` does not invalidate the webpack cache

The cleanup script at [scripts/clean-verji-peerdep-symlinks.js](../../scripts/clean-verji-peerdep-symlinks.js) removes only the `node_modules/@verji/*/node_modules/element-web` stale symlinks. It does not touch `node_modules/.cache/webpack`, so the webpack cache is preserved across `yarn start` runs. Both mechanisms are independent.

### HMR across the module boundary is not supported

If `yarn start` is already running and you edit a module's source and run `yarn build` in the module, the webpack dev server will **not** pick up the change live. Webpack is watching `element-web-v2/node_modules/@verji/<module>/lib/`, not the module's source, and yarn only re-copies on `yarn start`. You must stop and restart `yarn start` to see the change.

This is a current limitation of the installer-driven `file:` dep approach, not a regression from adding the cache. See the future-optimization section at the end of this document for the alias-based path that would fix it.

## 5. Install-cache short-circuit for `yarn start`

The dominant cost of every `yarn start` on Windows is the installer's `yarn add -O file:../verji-*-module` call — roughly ~1 hour per run, even when the module set hasn't changed since the previous successful install. [module_system/installer.ts](../../module_system/installer.ts) now short-circuits this when possible.

### How it works

On every `yarn start`, the installer computes a **fingerprint** (SHA-256) over:

- The module list from [build_config.yaml](../../build_config.yaml).
- Each `file:` dep module's `package.json` content.
- Each `file:` dep module's `lib/` most-recent mtime (recursive walk — milliseconds to compute).

After a successful `yarn add`, the fingerprint plus the list of installed modules is written to `node_modules/.verji-install-cache.json`. On the next `yarn start`:

- **Fingerprint matches AND `node_modules/@verji` exists AND `src/modules.ts` exists** → `yarn add` is skipped entirely. The installer regenerates `src/modules.ts` from the cached list and exits in under a second.
- **Fingerprint differs** (module added/removed, a `package.json` changed, a module's `lib/` was rebuilt) → `yarn add` runs fresh, cache is rewritten on success.
- **Cache file missing or malformed** → fresh install, cache written on success.

### Expected effect on the dev loop

| Scenario | Before | After |
|---|---|---|
| Repeat `yarn start` with same module set | ~1 hour | <1 s (installer) + cold or warm webpack compile |
| Toggle a module in `build_config.yaml` | ~1 hour | ~1 hour (expected — different module set) |
| Edit a module's source and `yarn build` in that module | ~1 hour | ~1 hour (expected — lib mtime changed) |

Combined with the webpack filesystem cache from §4, a repeated `yarn start` with no changes can drop from "hour+" to "seconds" end-to-end.

### Working with the cache

- **Force a fresh install**: `Remove-Item element-web-v2\node_modules\.verji-install-cache.json` before `yarn start`.
- **The cache lives inside `node_modules/`** so it's already `.gitignore`d. Nothing to commit.
- **The `verji:prestart` hook** (see §1) has a complementary health check: when no dangling symlinks are detected, the ~60-second `@verji` wipe is skipped entirely. On a healthy repeat run both layers compound — prestart exits in <1 s, installer exits in <1 s, webpack-dev-server starts from cache.

### When the short-circuit may mislead you

The fingerprint is conservative but not exhaustive:

- Changes **outside** a module's `lib/` + `package.json` are not detected. In practice this is fine because the module's `"files"` whitelist limits what yarn actually copies.
- Drift in the yarn global link-store state from outside activity (`yarn link` run elsewhere, etc.) is not detected.

Both are rare in normal dev. If in doubt, delete the cache file and rebuild.

## 6. Node heap OOM during long dev sessions

### Symptom

After `yarn start` has been running for an hour or two and survived several incremental rebuilds, the dev server dies with:

```
<--- Last few GCs --->
[xxxx:...] Mark-Compact 4022.3 (4136.8) -> 4008.3 (4138.8) MB, pooled: 0 MB, 3879.10 / 0.00 ms
FATAL ERROR: Ineffective mark-compacts near heap limit Allocation failed - JavaScript heap out of memory
...
yarn start:js exited with code 134
```

Heap usage in the GC lines sits right at ~4 GB before the crash.

### Cause

Node's default old-generation heap cap on 64-bit is ~4 GB. The `webpack serve` process retains the module graph, HMR state, and filesystem-cache metadata across rebuilds, so memory grows monotonically over a dev session even when individual rebuilds are small. For a bundle the size of element-web-v2, the cap is typically reached after roughly an hour of active editing. Not Windows-specific, but more visible on Windows because webpack compiles are slower there and sessions stay open longer per rebuild.

### Fix

Baked into `start:js` in [package.json](../../package.json) — the script invokes `node --max-old-space-size=8192 ./node_modules/webpack/bin/webpack.js serve …` rather than `webpack serve` directly, so `yarn start` and `yarn start:https` (which delegates to `start:js`) both get an 8 GB old-space cap on every platform without needing `cross-env` or shell env vars.

If you run webpack or node-based tooling outside the `yarn start` scripts (for example, `yarn build` on a constrained machine, or a standalone test run that hits the cap), raise the limit for that shell:

```powershell
$env:NODE_OPTIONS = "--max-old-space-size=8192"
```

Or permanently for your user, affecting every Node process you launch:

```powershell
# Once, from any PowerShell. New processes pick it up; existing shells need a restart.
[Environment]::SetEnvironmentVariable("NODE_OPTIONS", "--max-old-space-size=8192", "User")
```

### Why not higher than 8 GB?

Diminishing returns, and past a point counterproductive:

- **GC pauses scale with heap size.** The ~4 s Mark-Compact pauses already visible in the OOM trace get noticeably worse at 16 GB — you would feel it as the dev server freezing for several seconds on save.
- **Physical RAM is the real ceiling.** If Node grabs 12 GB on a 16 GB machine, the OS + browser + editor start swapping, which hurts more than an occasional `yarn start` restart.
- **If 8 GB still OOMs in a normal session, the growth is pathological** — investigate rather than mask. Restarting `yarn start` once a day is a fine workflow.

Full production builds (`yarn build`) sometimes legitimately need 12 GB because the entire graph is in memory at once. Only bump above 8 GB if a prod build OOMs.

## 7. Future optimization — webpack aliases (not implemented)

An alias-based dev path would eliminate the `yarn add` step from `yarn start` entirely, dramatically speeding up dev and enabling HMR across the module boundary.

### Idea

In dev mode only, add `resolve.alias` entries in [webpack.config.js](../../webpack.config.js) that point `@verji/<module>` directly at `../verji-<module>/lib`. Webpack would resolve module imports straight from the sibling directories without going through `node_modules/@verji/`. The `build:module_system` installer step would be skipped entirely behind an opt-in env flag (for example, `VERJI_DEV_ALIAS=1`).

### Payoff

- Eliminates the 30+ minute `yarn add` phase from `yarn start`.
- Enables live HMR across module boundaries: `yarn build` in a sibling module triggers webpack-dev-server reload automatically.

### Caveats

1. **Circular `element-web` dep**. `verji-news-module` and `verji-usermenu-module` declare `"element-web": "link:../element-web-v2"` as a **dependency** (not peerDep). Aliasing removes the installer-driven circular symlink, so type resolution for imports _from_ the module _into_ element-web needs to be handled via `tsconfig` `paths` or a mirrored alias. The three pure-peerDep modules (`onboarding`, `roomsublist`, and `cryptosetup` via its extension surface) alias cleanly.

2. **Must stay opt-in**. Production and staging builds need to continue going through the installer so the published-package flow is exercised. Use an env flag that defaults off.

3. **Per-module divergence**. The story for each module differs (see (1)); this is not a single config switch.

### Recommendation

Investigate after validating that the fixes in Sections 1–4 bring `yarn start` below ~5 minutes on a Defender-excluded Windows machine. If that holds, the alias approach may not be worth the complexity. If the 30-minute ceiling persists even with exclusions applied, this is the next lever.
