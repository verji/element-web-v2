# Verji modules — architecture, pitfalls, and fixes

This document is a living record of the Verji module system's architecture, the problems we've hit running it on Windows, and the fixes we've layered in to keep it workable. If you are debugging a strange `yarn start` failure, something in here probably applies. If you are adding a new module, read the "Architecture" and "Caveats" sections first.

## The actual root cause (April 2026 saga)

**Headline lesson**: a single leftover line in [element-web-v2/package.json](../../package.json) caused approximately one week of debugging that surfaced as module-side EEXIST errors, 7 GB cache entries, MAX_PATH cleanup failures, BSODs, and 1+ hour install times.

The line was:

```json
"devDependencies": {
    ...
    "element-web": "file:../element-web-v2",
    ...
}
```

**element-web-v2 declared itself as a dev dependency**, with a `file:` spec pointing back at its own directory. yarn v1, faithfully obeying the manifest, tried to satisfy the dep by installing element-web — which IS element-web-v2 — and recursively processed that "installed" copy's manifest, found the same self-reference, recursed again. Each level produced another full copy of the project's `node_modules` tree in the yarn cache (`%LOCALAPPDATA%\Yarn\Cache\v6\npm-element-web-1.11.88-<UUID>/`), reaching depth 5–7 before the run exhausted memory, disk, or patience.

**Every secondary trigger we identified during the saga** (a module's `link:` ref to element-web in its `dependencies`; a module's `peerDependencies` semver entry for element-web; etc.) was an _additional entry point_ into the same recursive code path. The modules' references made each install slower because they multiplied the number of times yarn entered the recursion. They were not the trigger. The trigger was element-web-v2's own self-reference; the modules' references just amplified it.

**Fix**: remove the line. After removal, plain `yarn install` in element-web-v2 completes in normal time with no `npm-element-web-*` cache entries created.

**Defense going forward**: [installer.ts](../../module_system/installer.ts)'s `verjiGuardAgainstRecursion()` now includes a "Check Z" at the very start — reads element-web-v2's own `package.json`, and if any dep section contains a key matching the project's own `name`, aborts immediately with a clear error pointing at this section. So this exact regression cannot recur silently.

The remainder of this document captures the symptom-side investigation we did along the way, plus the secondary fixes (Part B, webpack alias, prestart cleanup, install-cache short-circuit, etc.) that are all individually useful but were not the actual cure.

---

Companion docs:

- [Verji.md](../../Verji.md) — product-level overview of what each module does.
- [DevLoopWindows.md](./DevLoopWindows.md) — day-to-day Windows dev-loop troubleshooting (Defender, cache, prestart, etc.).

## Overview

Verji runs seven custom modules alongside the Element client:

| Module                     | Kind                                                      | Element-web source imports?                                    |
| -------------------------- | --------------------------------------------------------- | -------------------------------------------------------------- |
| `verji-cryptosetup-module` | Extension (`CryptoSetupExtensions`)                       | No                                                             |
| `verji-eventsearch-module` | Extension (`EventSearchExtensions`)                       | No                                                             |
| `verji-usersearch-module`  | Extension (`UserSearchExtensions`)                        | No                                                             |
| `verji-onboarding-module`  | GUI (`CustomComponentLifecycle.InviteDialog`)             | Yes — `element-web` peerDep **removed** (was `peerDependency`) |
| `verji-roomsublist-module` | GUI (`CustomComponentLifecycle.RoomSublist`)              | Yes — `element-web` peerDep **removed** (was `peerDependency`) |
| `verji-news-module`        | GUI (`CustomComponentLifecycle.NewsAndOperatingMessages`) | Yes (via `devDependency`, was `dependency`)                    |
| `verji-usermenu-module`    | GUI (`CustomComponentLifecycle.UserMenu`)                 | Yes (via `devDependency`, was `dependency`)                    |

Each module is a separate git repo. The element-web-v2 fork consumes them via `file:../verji-*-module` specs in [build_config.yaml](../../build_config.yaml). The installer at [module_system/installer.ts](../../module_system/installer.ts) runs `yarn add -O` on those specs at `yarn start` time.

## The dependency-mechanism zoo

Three mechanisms coexist, and part of the pain has been understanding how they interact:

| Mechanism   | Used for                                                                           | Behavior                                                                                                                                                                                                                                                                      |
| ----------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **yalc**    | `matrix-js-sdk`, `@matrix-org/react-sdk-module-api`                                | Copies package content into `element-web-v2/.yalc/`. Consumer references via `"file:.yalc/..."`. Updates require `yalc push` + `yalc update`. Does **not** use yarn's link registry.                                                                                          |
| **`file:`** | All seven verji-\*-modules, in `build_config.yaml`                                 | Yarn v1 copies the module's `"files"`-whitelisted content into `node_modules/@verji/<module>/` on every `yarn add`. Respects the `"files"` whitelist so it ships only `lib/`, `README.md`, etc.                                                                               |
| **`link:`** | `"element-web": "link:../element-web-v2"` inside **two** of the modules' manifests | Yarn v1 registers the linked package in its global link store (`%LOCALAPPDATA%\Yarn\Data\link\<pkg>`) and creates junctions in consumer `node_modules` pointing there. Does **not** respect `"files"` when resolving circular refs — this was the source of most of our pain. |

## The circular reference that caused everything

`element-web-v2`'s `package.json` declares `"name": "element-web"`. The two GUI modules that use element-web's internal React components (`verji-news-module`, `verji-usermenu-module`) originally declared `"element-web": "link:../element-web-v2"` as a **dependency** so their standalone `yarn build` could resolve `import from "element-web/src/MatrixClientPeg"` and similar.

When element-web-v2 then ran `yarn add file:../verji-news-module`, yarn v1 saw `element-web` in the module's deps and tried to install it **transitively**. Because the current project _is_ element-web, this is a circular reference:

```
element-web-v2  ──installs──▶  verji-news-module  ──transitively requires──▶  element-web-v2
```

Yarn v1 handles this with its link protocol, which creates **two** symlinks for every `link:` reference:

1. A global-store entry at `%LOCALAPPDATA%\Yarn\Data\link\element-web` pointing at `c:\dev\fresh-fork\element-web-v2\`.
2. A per-consumer junction at `element-web-v2\node_modules\@verji\<module>\node_modules\element-web` pointing into the global store.

On Windows, yarn v1 does not atomically unlink-then-recreate these symlinks. Any stale entry from a previous failed or interrupted run causes the next install to throw `EEXIST` mid-linking and abort.

## The issues we uncovered in April 2026

### Issue 1 — `EEXIST` during `[4/5] Linking dependencies...`

First symptom. Yarn fails with `EEXIST: file already exists, symlink …\node_modules\@verji\<module>\node_modules\element-web`. Standard remedies (clean `node_modules/@verji`) didn't stick because the same state was recreated on every run and the global link-store entry persisted.

### Issue 1.5 — Peer-dependencies **also** trigger recursive packing

Discovered after Part B supposedly "fixed" the dependency-side trigger. A test run with _only_ `verji-roomsublist-module` in `build_config.yaml` — which has **no `link:` references anywhere**, only `"element-web": ">=1.11.0"` in `peerDependencies` — still produced a 7 GB cache entry with depth-5 nesting. Confirmed that yarn v1 resolves peer dependencies by `name` match against the current project, and when the match is the self-same `"name": "element-web"` project, yarn treats it as a link-protocol satisfier and falls into the recursive-packing code path. `dependencies` with `link:` was a _faster_ route into the bug; peerDep with semver gets there too, just via peer resolution.

**Fix:** remove `"element-web"` entirely from `peerDependencies` in [verji-onboarding-module/package.json](https://github.com/verji/verji-onboarding-module/blob/main-v2/package.json) and [verji-roomsublist-module/package.json](../../../verji-roomsublist-module/package.json). The runtime dependency on element-web is handled by the webpack alias in [element-web-v2/webpack.config.js](../../webpack.config.js); documenting it as a peerDep adds nothing functional and triggers the bug. The installer's `verjiGuardAgainstRecursion()` now flags both `dependencies` and `peerDependencies` for `element-web`.

### Issue 2 — 7 GB cache entries, exponential self-packing

Far worse underlying bug. Every time yarn v1 processed a `link:../element-web-v2` dep, it decided to **pack element-web itself as a tarball into its cache**. That pack operation respected neither the `"files"` whitelist nor its own recursion guard — element-web's packed cache entry contained `node_modules/element-web/node_modules/element-web/node_modules/element-web/…` **seven levels deep**. Each cache entry weighed 7 GB+. A single `yarn add` attempt with news+usermenu-module involved would produce 14 GB of cache entries. Multiple attempts accumulated — we observed 46 GB of `npm-element-web-*` orphan entries on one machine.

Discovery path:

- ENOSPC error on copying `@ts-morph/common/dist/typescript.js` to a `Cache\v6\npm-element-web-…` directory.
- Windows "cannot find path specified" / "MS-DOS function invalid" errors on cleanup — `MAX_PATH` (260 chars) exceeded by the recursive nesting.

### Issue 3 — BSODs under disk pressure

The accumulating cache periodically filled C:, which on Windows triggers kernel/driver instability below a few GB free. We lost work to two BSODs during iteration before diagnosing this as disk exhaustion caused by Issue 2.

### Issue 4 — "Is it hung?" for hours

Silent, long `[3/5] Fetching packages...` phases. Yarn v1 only emits per-package progress when stdout is a TTY; the `concurrently` wrapper in the `start` script prevents that, so yarn goes silent after the phase header for 30–60 min at a stretch. Combined with genuine slowness (Issue 2's multi-GB I/O), this was hard to distinguish from a true hang.

### Issue 5 — Windows-specific compounding factors

- **`MAX_PATH = 260`**: makes the recursive cache entries undeletable by Explorer, `rmdir`, or `Remove-Item`. Requires `robocopy` (uses `\\?\` prefix internally) or NTFS long-path support.
- **Windows Defender**: intercepts every file open during install. Without exclusions, makes the already-slow install 2–10× slower.
- **ts-node `--watch` shutdown hang**: `concurrently --kill-others-on-fail` can't always kill a `ts-node --watch` process cleanly on Windows, making it look like the whole pipeline is stuck post-failure.

## Solutions implemented

All of the following are in place on `verji-develop`. They compound — each addresses a different layer — and all are marked with Verji comment markers for traceability through future upstream merges.

### Part A — Install-cache short-circuit (installer.ts)

[module_system/installer.ts](../../module_system/installer.ts) now computes a SHA-256 fingerprint over the module list + each module's `package.json` + each module's `lib/` mtimes. After a successful install, the fingerprint + installed-module list is written to `node_modules/.verji-install-cache.json`. On the next `yarn start`, if the fingerprint matches and `node_modules/@verji` and `src/modules.ts` both exist, `yarn add` is skipped entirely — the installer regenerates `src/modules.ts` from the cached list and exits in under a second.

Effect: **first install ~minutes, every subsequent install of the same module set ~1 s.** See [DevLoopWindows.md §5](./DevLoopWindows.md#5-install-cache-short-circuit-for-yarn-start) for details and cache-working patterns.

### Part B — Move `element-web` to `devDependencies` in two modules

In [verji-news-module/package.json](https://github.com/verji/verji-news-module/blob/main-v2/package.json) and [verji-usermenu-module/package.json](https://github.com/verji/verji-usermenu-module/blob/main-v2/package.json), `"element-web": "link:../element-web-v2"` was moved from `dependencies` to `devDependencies`.

- `devDependencies` are installed when a developer runs `yarn install` inside the module (for standalone dev), so `yarn build` in the module still resolves `import from "element-web/..."`.
- `devDependencies` are **not** processed transitively when element-web-v2 does `yarn add file:../verji-news-module`. So yarn's link protocol never fires from element-web-v2's perspective — no EEXIST, no 7 GB cache entries, no junction creation.

The other two element-web-referencing modules (`verji-onboarding-module`, `verji-roomsublist-module`) already used `peerDependencies`, which yarn similarly skips transitively.

### Webpack alias for `element-web`

Before Part B, webpack's resolver could follow the `@verji/<module>/node_modules/element-web` junction that yarn created to resolve `require("element-web/src/...")` from module `lib/*.js`. After Part B, the junction no longer exists. [webpack.config.js](../../webpack.config.js) now has an explicit alias `"element-web": __dirname` in its `resolve.alias` block, making the self-reference robust and independent of yarn's state.

### Prestart with smart detection

[scripts/clean-verji-peerdep-symlinks.js](../../scripts/clean-verji-peerdep-symlinks.js) cleans three places yarn v1 can leave stale link-protocol state: `node_modules/@verji`, the yarn global link-store entry, and sibling-module `node_modules/element-web` junctions. A health check at the top skips the full wipe when no dangling symlinks are detected — keeping the common healthy-state case sub-second. See [DevLoopWindows.md §1](./DevLoopWindows.md#1-why-yarn-start-fails-with-eexist) for details.

### Webpack filesystem cache

[webpack.config.js](../../webpack.config.js) has `cache: { type: "filesystem" }`, so every successful dev compile is reused on the next `yarn start`. After Part A short-circuits `yarn add`, the webpack cache handles the second half — a warm `yarn start` goes from ~1 hour to seconds end-to-end. See [DevLoopWindows.md §4](./DevLoopWindows.md#4-webpack-filesystem-cache--workflow-and-invalidation).

### Runtime guard against the failure conditions

[module_system/installer.ts](../../module_system/installer.ts) has a `verjiGuardAgainstRecursion()` check that runs right before every fresh `yarn add` (skipped on short-circuit runs since those don't call yarn add). It aborts with a clear error if any of these conditions is detected:

**Manifest shape (A)** — a `file:` dep module declaring:

- `"element-web"` in its `dependencies` (any spec form). This is the exact condition Part B was meant to eliminate; the guard catches it if a future module regresses or a new module is added with the wrong declaration.
- Any workspace-sibling `link:` reference in its `dependencies`. Generalizes the check so another `link:../verji-*-module` or similar triggers the same alarm.

**Residual state (B)** — from a prior crashed/interrupted run:

- Any orphan `npm-element-web-*` entries in the yarn cache (`%LOCALAPPDATA%\Yarn\Cache\v6`), meaning the recursive packing has started building up again.
- A recursive `node_modules/@verji/<mod>/node_modules/element-web/node_modules/element-web` nesting already on disk.

When the guard fires, the installer prints the specific problems and exits with code 1 before yarn runs. Cost: ~100 ms on clean runs, saves hours and gigabytes on regression. Marked with Verji comment markers in installer.ts so it survives upstream merges.

### Windows Defender exclusions (per-machine)

Not a repo change, but part of the setup. Each Windows dev adds `c:\dev\fresh-fork`, `%LOCALAPPDATA%\Yarn\Cache`, `%APPDATA%\npm-cache` to Defender exclusions. Typical 2–10× install speedup. See [DevLoopWindows.md §2](./DevLoopWindows.md#2-windows-defender-exclusions-required-for-sane-install-times).

## What to check if issues recur

If `yarn start` starts behaving pathologically again, walk through this checklist:

### 1. Does `node_modules/.verji-install-cache.json` exist?

If no → installer will run fresh `yarn add`, which is the slow path. That's expected on first run after a module set change.

### 2. Are there orphan `npm-element-web-*` or `npm-@verji-*` entries in the yarn cache?

```powershell
Get-ChildItem "$env:LOCALAPPDATA\Yarn\Cache\v6" -Directory -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^npm-(@verji|element-web)-' } | ForEach-Object { $size = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum / 1MB; "{0,10:N0} MB  {1}" -f $size, $_.Name }
```

Any result means yarn's link protocol fired unexpectedly. Investigate whether Part B was reverted or a new module was added with `element-web` in `dependencies`.

### 3. Is a sibling module's `node_modules/element-web` dangling?

```powershell
@('verji-news-module','verji-usermenu-module','verji-onboarding-module','verji-roomsublist-module') | ForEach-Object { $p = "c:\dev\fresh-fork\$_\node_modules\element-web"; if (Test-Path $p) { try { Get-Item (Get-Item $p -Force).Target -ErrorAction Stop | Out-Null; "{0,-26}  OK" -f $_ } catch { "{0,-26}  DANGLING" -f $_ } } else { "{0,-26}  absent" -f $_ } }
```

Dangling = prior failed install or manual delete of the global link-store entry. Run `yarn verji:prestart` to clean.

### 4. Is the yarn cache growing unboundedly?

```powershell
$stats = Get-ChildItem "$env:LOCALAPPDATA\Yarn\Cache" -Recurse -File -ErrorAction SilentlyContinue | Measure-Object Length -Sum; "{0} files, {1:N2} GB" -f $stats.Count, ($stats.Sum/1GB)
```

Normal healthy cache: a few GB. >10 GB means something is creating orphan entries — inspect with the §2 query above.

### 5. Are long paths blocking `rmdir` / Explorer from cleaning up?

If `rmdir /s /q` fails with "the system cannot find the path specified" or "invalid MS-DOS function", you've hit `MAX_PATH`. Use robocopy with mirror-from-empty-dir:

```powershell
$empty = Join-Path $env:TEMP "empty-$(Get-Random)"; New-Item -ItemType Directory -Path $empty | Out-Null; robocopy $empty "$env:LOCALAPPDATA\Yarn\Cache\v6" /MIR /NFL /NDL /NJH /NJS /R:1 /W:1; Remove-Item $empty -Recurse -Force; Remove-Item "$env:LOCALAPPDATA\Yarn\Cache\v6" -Recurse -Force -ErrorAction SilentlyContinue
```

Robocopy uses the `\\?\` path prefix internally and handles paths beyond 260 characters. Optionally enable NTFS long-path support permanently (admin PowerShell, requires reboot):

```powershell
New-ItemProperty -Path 'HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem' -Name 'LongPathsEnabled' -Value 1 -PropertyType DWORD -Force
```

## Caveats and known gaps

### When you add a new module

If the new module's source imports from `element-web/src/...` at build time:

- Put `"element-web": "link:../element-web-v2"` in `devDependencies`, never in `dependencies`.
- Make sure the module's tsconfig has `paths: { "element-web/*": ["../element-web-v2/*"] }` so tsc resolves types during standalone build.
- Don't include `../element-web-v2/**` files in the module's `tsconfig.include` — doing so drags element-web-v2 into the computed `rootDir` and produces a broken `lib/` layout (we observed this in `verji-roomsublist-module`; its `lib/` contains a copy of element-web-v2 source).

If it does **not** import from `element-web/src/...`:

- Use `peerDependencies` for `element-web` if you need a version constraint, or skip the entry entirely. Either is fine.

### HMR across the module boundary is still not supported

Editing a module's source and running `yarn build` in the module does not hot-reload element-web-v2's dev server. You must stop and restart `yarn start`, which now hits Part A's short-circuit if nothing else changed, so the penalty is seconds rather than hours — but it is not live.

The future webpack-alias approach ([DevLoopWindows.md §7](./DevLoopWindows.md#7-future-optimization--webpack-aliases-not-implemented)) would fix this by pointing webpack at each module's `src/` or `lib/` directly, bypassing the installer entirely. Not implemented because the circular self-reference in news-module and usermenu-module requires careful handling and testing.

### Publishing modules

The devDep move (Part B) is also correct for published packages: `dependencies` of a published package become install-time deps of its consumers, which would force anyone installing the module from GitHub Packages to also pull `link:../element-web-v2` — nonsense for a published package. The corrected manifests are safer to publish.

When publishing a new version of `verji-news-module` or `verji-usermenu-module`:

1. Commit the Part B manifest change in the module's repo.
2. Bump the version.
3. Publish to GitHub Packages.
4. No changes needed in the module's consumers beyond the version bump in build_config.yaml (if they switch from `file:` to registry refs).

### The 60-second cleanup if state is actually broken

The prestart's health check skips the wipe when state is healthy, but when state _is_ broken, the full wipe of `node_modules/@verji` can still take ~60 seconds on a populated tree. This is pure filesystem I/O at Windows' small-file throughput; no known way to make it faster.

## Open questions / future work

- **Is the circular `element-web` reference actually necessary?** News-module and usermenu-module import from element-web's internal source, but arguably those imports could be satisfied through a more formal API (e.g. an additional `CustomComponentLifecycle` hook that passes required utilities as props). Eliminating the reference entirely would remove a whole class of failure modes.
- **Should `verji-roomsublist-module`'s `tsconfig-build.json` be fixed?** It currently emits `lib/` with duplicated element-web-v2 source due to the `../element-web-v2/*` patterns in `include`. Doesn't break runtime but bloats the package and confuses `package.json.types`.
- **Should we switch all verji modules to yalc?** Would give us the same semantic (copy-into-consumer) without yarn's link protocol involvement. Requires operator changes to the release flow.
- **Dev-only webpack aliases for `@verji/*` modules** (the §7 future optimization). Biggest potential dev-loop speedup; biggest complexity to implement correctly given the self-reference story.

## Change history

| Date       | Change                                                                                                           | Reason                                                                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| April 2026 | Install-cache short-circuit in installer.ts                                                                      | Turn repeat `yarn start` from ~1 hour → <1 s                                                                                                                                                                                                    |
| April 2026 | Smart detection in clean-verji-peerdep-symlinks.js                                                               | Skip 60-s wipe on healthy state                                                                                                                                                                                                                 |
| April 2026 | Part B: element-web → `devDependencies` in news and usermenu modules                                             | Stop yarn v1's recursive self-packing into the yarn cache (7 GB per entry, 46 GB accumulated)                                                                                                                                                   |
| April 2026 | Webpack alias `"element-web": __dirname`                                                                         | Replace the accidental junction-based resolution that Part B removed                                                                                                                                                                            |
| April 2026 | Webpack `cache: { type: "filesystem" }`                                                                          | Make cold compiles incremental                                                                                                                                                                                                                  |
| April 2026 | `.yarnrc network-timeout 600000`                                                                                 | Silence spurious retry messages during slow installs                                                                                                                                                                                            |
| April 2026 | Removed `element-web` peerDep from onboarding and roomsublist modules                                            | Verified that peerDeps also trigger recursive self-packing (5-level nesting with only roomsublist enabled, no `link:` refs)                                                                                                                     |
| April 2026 | `verjiGuardAgainstRecursion` updated to flag peerDep form too                                                    | Previous guard only checked `dependencies`; missed the peerDep path into the same bug                                                                                                                                                           |
| April 2026 | **Removed `"element-web": "file:../element-web-v2"` self-reference from element-web-v2's own `devDependencies`** | **The actual root cause of the entire saga.** Plain `yarn install` (no module involvement) was triggering recursive packing because element-web-v2 declared itself as a dep. All other module-side fixes addressed amplifiers, not the trigger. |
| April 2026 | `verjiGuardAgainstRecursion` Check Z added                                                                       | Detects the self-reference pattern (any dep section keyed by the project's own `name`) so this exact bug cannot recur silently                                                                                                                  |
