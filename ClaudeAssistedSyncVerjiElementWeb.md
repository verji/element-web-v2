# PRD: Claude-Assisted Sync of Verji Element-Web Fork

> **Document created**: 2026-03-02
> **Author**: JTS + Claude (Opus 4.6)
> **Last refreshed**: 2026-04-22 (Claude Opus 4.7)
> **Status**: Active — PR #113 + paired element-web `ea504ee14` now ported on top of prior work. All uncommitted on `jts/claude-assisted-merge`, awaiting commit/validate per §15.
> **Scope**: Local development only. All commits, pushes, and PRs are handled manually by the developer.

---

## 0. Refresh Log

### 2026-04-22 refresh

**Source forks fast-forwarded**

- `matrix-react-sdk/verji-develop` fast-forwarded `68d635bba4 → f8f596a8a5` (+5 commits, PR #113).
- `element-web/verji-develop` fast-forwarded `c9aede187 → ea504ee14` (+5 commits, includes NSFW wrapper merge PR #13 + ea504ee14 for #113).
- `matrix-react-sdk-module-api` untouched (already at `4abcdd7`).

**PR #113 + ea504ee14 ported into element-web-v2 (uncommitted on `jts/claude-assisted-merge`)**

- `src/settings/UIFeature.ts` — added `VerjiSpaceDmBadges = "UIFeature.verjiSpaceDmBadges"` after `ShowNsfwContentSetting`.
- `src/settings/Settings.tsx` — registered with `LEVELS_UI_FEATURE`, `default: false`, with `// VERJI` marker comment.
- `src/stores/spaces/SpaceStore.ts` — (a) added `private verjiDmRoomsBySpace = new Map<SpaceKey, Room[]>()`; (b) added public `setVerjiDmRoomsForSpace(spaceKey, rooms)`; (c) refactored `visibleRooms.filter(...)` → named `filteredRooms` const and merged `verjiDmRoomsBySpace` entries under the `verjiDmBadgesEnabled && !isMetaSpace(s)` guard, deduped by `roomId`. PR #108's `switchSpaceIfNeeded` guard preserved intact; the two edits live in separate regions so no conflict.
- `src/i18n/strings/en_EN.json`, `nb_NO.json` — 3 new keys each (`dm_fetch_error_message`, `dm_fetch_error_timeout`, `dm_fetch_error_unknown`) added inside the existing `"verji"` section.
- `src/i18n/strings/sv.json` — added a new top-level `"verji"` section with the 3 keys (Swedish didn't have one prior).
- `config.verji.sample.json` — added `"UIFeature.verjiSpaceDmBadges": true` after the other UIFeature entries (typo-fixed filename kept; `config.verji.samlple.json` still shows as deleted from prior work).
- `docs/Verji/VerjiConfig.md` — added the two-line doc entry for the new flag after `UIFeature.showNsfwContentSetting`.
- **Not ported**: the `feature_group_calls: false` line that ea504ee14 also carried — out of scope for PR #113 per PRD §10b, and unrelated to badge notifications.

**Validation status**

- All four edited JSON files (sv.json, en_EN.json, nb_NO.json, config.verji.sample.json) parse as valid JSON.
- Not yet run: `yarn install/lint/test/build` — §15 step 1 still pending before committing.

**Follow-ups still open** (unchanged from 2026-04-21 list)

- Split working tree into PR-boundary commits (§15 step 2).
- Resolve the 4 `// VERJI MERGE` TODOs (§13, §5).
- Update `verji-roomsublist-module@main-v2` to call `setVerjiDmRoomsForSpace` (or track as follow-up).
- Update `verji-*-module` dep refs from `verji-merge-react-sdk` → `verji-develop` **after** this PR lands.

### 2026-04-21 refresh

**Port work status in element-web-v2**

- Active branch: `jts/claude-assisted-merge` (off `verji-develop` @ `07100dfb3e`, 2025-04-02).
- `verji-develop` is in sync with `origin/verji-develop` (0 ahead / 0 behind).
- Working tree has **29 modified + 6 untracked files** — footprint matches Section 6 almost exactly. Spot-checks confirm the major ports are implemented (uncommitted):
    - Phase 2 flags present in `src/settings/UIFeature.ts`: `EnableRoomDevToolsOptions`, `SwitchSpaceOnDMSelect`, `ShowNsfwContentSetting`.
    - PR #104 power-level rename: `Roles.ts` and `EntityTile.tsx` use Verji naming (`VerjiAdmin`, `verji|power_level|…`).
    - PR #106 slash-commands allowlist: `allowedCommands` array + `.filter()` present in `src/SlashCommands.tsx`.
    - PR #103/#105 RoomSublist hook: `ModuleRunner.instance.invoke(CustomComponentLifecycle.RoomSublist, …)` present in `src/components/views/rooms/RoomSublist.tsx`.
- `matrix-react-sdk-module-api` is at `origin/verji-main` @ `4abcdd7` (2025-06-06 "Add lifecyclehook for RoomSublist"). `CustomComponentLifecycle.RoomSublist = "room_sublist"` is defined — no action needed there.

**Upstream gap has grown**

- `matrix-react-sdk/origin/verji-develop` advanced from `68d635bba4` (2026-01-23) to `f8f596a8a5` (2026-04-08). **+5 commits**, touching 6 files. One new merged PR (#113) introduces a new UIFeature flag.
- `element-web/origin/verji-develop` advanced from `aeea8cec2` (2025-11-28) to `ea504ee14` (2026-04-08). **+1 commit** — sample config + docs for the same new flag.
- **New commit totals**: matrix-react-sdk 73 → **78**, element-web 5 → **6**.

**New delta (PR #113 — Space DM Badge Notifications, 2026-04-08)**

- Files: `src/settings/UIFeature.ts`, `src/settings/Settings.tsx`, `src/stores/spaces/SpaceStore.ts`, `src/i18n/strings/en_EN.json`, `src/i18n/strings/nb_NO.json`, `src/i18n/strings/sv.json` (new Swedish file).
- Introduces `UIFeature.VerjiSpaceDmBadges = "UIFeature.verjiSpaceDmBadges"` (default `false`).
- Adds `SpaceStore.setVerjiDmRoomsForSpace(spaceKey, rooms)` and a `verjiDmRoomsBySpace: Map<SpaceKey, Room[]>` — a public API that lets `verji-roomsublist-module` register Verji-backend DM rooms and have them merged into the space's notification state. The merge happens at the end of `updateNotificationStates`, only for non-meta spaces, guarded by the flag.
- Paired element-web commit `ea504ee14` adds the flag to `config.verji-local.json`, `config.verji-staging.json`, and documents it in `docs/Verji/VerjiConfig.md`.
- Non-PR translation commits: `87bbf37ecb` (2026-03-23) added translation keys for error messages; `f1b2c57f87` (2026-03-23) is a merge commit.

**Coordination with PR #108 (switchSpaceOnDMSelect)**

- PR #113's `SpaceStore.ts` edits live in the same `updateNotificationStates`/filter region the working tree is already modifying for PR #108. When the PR #113 port lands, the merge point in `SpaceStore.ts` will be the same area — port sequentially to avoid conflicting edits.

---

## 1. Executive Summary

This document is a comprehensive Product Requirements Document (PRD) that captures the full state of the Verji element-web fork migration, identifies the exact delta of work remaining, and provides a step-by-step action plan to bring `element-web-v2` to parity with all custom Verji code.

**The core problem**: In December 2024, Verji created a fresh fork (`element-web-v2`) and performed the initial absorption of `matrix-react-sdk/verji-develop` into it. Work was then paused. Meanwhile, development continued on the old `matrix-react-sdk` fork — resulting in **73 new commits across 10 merged PRs** and **5 commits on the old element-web fork** that now need to be ported to `element-web-v2`.

**The goal**: Get `element-web-v2` running locally with ALL Verji customizations — both the already-absorbed code and the new changes — so it represents the complete "Verji world-view" and can later be brought up to date with upstream Element.

---

## 2. Background & Motivation

### Why this migration exists

The upstream Element team decided to absorb `matrix-react-sdk` directly into `element-web`. This was a major architectural change — `matrix-react-sdk` was previously a separate package containing all the React UI components, and `element-web` was a thin shell around it. After absorption, everything lives in `element-web`.

Verji maintains customized forks of both `element-web` and `matrix-react-sdk`, with significant modifications including:

- **100+ custom UIFeature flags** for fine-grained UI control
- **CustomComponentLifecycle hooks** allowing modules to inject custom components
- **Custom power level mappings** (VerjiAdmin role at level 95)
- **Custom local search** (VerjiLocalSearch.ts)
- **7+ custom modules** that plug into the module system
- **Freshworks support widget** integration
- Extensive comment markers (`// VERJI`, `// ROSBERG`) throughout the codebase identifying custom code

To continue receiving upstream updates, Verji must follow suit and absorb their matrix-react-sdk customizations into their element-web fork.

### The hybrid approach

The team chose a hybrid strategy:

1. Create fresh forks from upstream (`element-web-v2`, `matrix-js-sdk-v2`)
2. Merge the existing `matrix-react-sdk/verji-develop` branch on top, preserving git history
3. Resolve conflicts and adapt to the new structure

This approach was partially completed in December 2024 before work was paused.

---

## 3. Repository Inventory

| Repository                    | Role                                | Version  | Main Branch                 | Remote URL                                           |
| ----------------------------- | ----------------------------------- | -------- | --------------------------- | ---------------------------------------------------- |
| `element-web-v2`              | **Target** — new unified fork       | v1.11.88 | `verji-develop`             | https://github.com/verji/element-web-v2              |
| `matrix-react-sdk`            | **Source** — old UI component fork  | v3.100.0 | `verji-develop`             | https://github.com/verji/matrix-react-sdk            |
| `element-web`                 | **Source** — old element-web fork   | v1.11.68 | `verji-develop`             | https://github.com/verji/element-web                 |
| `matrix-js-sdk-v2`            | JS SDK fork (v2)                    | v35.0.0  | `verji-merge-matrix-js-sdk` | https://github.com/verji/matrix-js-sdk-v2            |
| `matrix-react-sdk-module-api` | Module API surface                  | v2.4.0   | `verji-main`                | https://github.com/verji/matrix-react-sdk-module-api |
| `verji-news-module`           | GUI module — RSS news               | v0.0.20  | `main-v2`                   | https://github.com/verji/verji-news-module           |
| `verji-onboarding-module`     | GUI module — invite/onboarding      | v0.2.3   | `main-v2`                   | https://github.com/verji/verji-onboarding-module     |
| `verji-usermenu-module`       | GUI module — custom user menu       | v1.1.25  | `main-v2`                   | https://github.com/verji/verji-usermenu-module       |
| `verji-usersearch-module`     | Extension module — user search      | TBD      | TBD                         | https://github.com/verji/verji-usersearch-module     |
| `verji-cryptosetup-module`    | Extension module — crypto setup     | TBD      | TBD                         | https://github.com/verji/verji-cryptosetup-module    |
| `verji-eventsearch-module`    | Extension module — event search     | TBD      | TBD                         | https://github.com/verji/verji-eventsearch-module    |
| `verji-roomsublist-module`    | GUI module — room sublist (**NEW**) | TBD      | TBD                         | https://github.com/verji/verji-roomsublist-module    |

### Key version differences

| Aspect           | element-web (old)    | element-web-v2                |
| ---------------- | -------------------- | ----------------------------- |
| Version          | 1.11.68              | 1.11.88                       |
| React            | 17.0.2               | 18.3.1                        |
| matrix-js-sdk    | 33.0.0               | 35.0.0 (via matrix-js-sdk-v2) |
| Module API       | git ref (verji-main) | 2.4.0 (exact)                 |
| matrix-react-sdk | 3.100.0 (separate)   | Absorbed into element-web     |

---

## 4. Merge History & Timeline

### December 2024 — Initial absorption

| Date         | Action              | Details                                                                                |
| ------------ | ------------------- | -------------------------------------------------------------------------------------- |
| Dec 2024     | Fresh forks created | `element-web-v2` and `matrix-js-sdk-v2` forked from upstream                           |
| Dec 2024     | Workspace setup     | Cloned repos, created `verji-merge-react-sdk` branch                                   |
| Dec 2024     | Remote added        | `git remote add -f matrix-react-sdk ../matrix-react-sdk`                               |
| Dec 13, 2024 | **Main merge**      | `git merge matrix-react-sdk/verji-develop --allow-unrelated-histories --no-commit`     |
| Dec 2024     | Conflict resolution | Manual resolution of merge conflicts (documented in VerjiMergeNotes-December2024.md)   |
| Dec 2024     | Deleted file triage | Components/tests marked ✅ (keep) or ❌ (delete) based on Verji customization presence |
| Dec 2024     | Test overhaul       | Fixed failing tests, removed duplicates, moved custom tests to new structure           |
| Dec 2024     | Sonarqube/CI fixes  | Workflow updates, lint fixes, dead code analysis config                                |
| Dec 2024     | PR #1 merged        | `verji-merge-react-sdk` → `verji-develop`                                              |

### Post-merge work on element-web-v2

| Date         | Action                                              | Branch                                |
| ------------ | --------------------------------------------------- | ------------------------------------- |
| Jan–Apr 2025 | Dead code removal, support button re-implementation | `jts/fix-dead-code`                   |
| Apr 2, 2025  | PR #3 merged                                        | `jts/fix-dead-code` → `verji-develop` |
| Apr 2025     | Playwright tests skipped (all)                      | `verji-develop`                       |

### Continued development on matrix-react-sdk (the gap)

| Date         | PR      | Description                                                       |
| ------------ | ------- | ----------------------------------------------------------------- |
| May 20, 2025 | PR #103 | RoomSublist module — initial implementation                       |
| May 21, 2025 | PR #104 | Power level mappings — rename Rosberg → Verji                     |
| Jun 6, 2025  | PR #105 | RoomSublist module — `CustomComponentLifecycle.RoomSublist` hook  |
| Aug 20, 2025 | PR #106 | Slash commands — filter on "Verji allowed" commands               |
| Sep 9, 2025  | PR #107 | Empty PR / state check + misc (uifeature-settings, package reset) |
| Oct 17, 2025 | PR #108 | `UIFeature.switchSpaceOnDMSelect` — switch to space on DM select  |
| Oct 20, 2025 | PR #109 | Open Space Settings correctly (topic/description button)          |
| Oct 29, 2025 | PR #110 | Fix PCSS — copy-paste CSS mistake, scss→pcss migration            |
| Nov 28, 2025 | PR #111 | `UIFeature.showNsfwContentSetting` — hide NSFW setting            |
| Jan 23, 2026 | PR #112 | Usercontent versioning — version the usercontent iframe           |

**Non-PR commits also on `origin/verji-develop`:**

- Translation bug fix (Nov 7, 2025)
- Mobile number validation on invite texts (Sep 12, 2025)
- RBAC POC example — roomlist Person+ toggle (Aug 20, 2025)
- Export size increase 20→2000 MB (May 20, 2025)
- Eventsearch extension (Feb 5, 2025)
- Console warning improvements (Jan 13, 2026)
- VerjiDark/light color and translations (Mar–Apr 2025)

### Continued development on element-web (old fork)

| Date         | Commit      | Description                                                             |
| ------------ | ----------- | ----------------------------------------------------------------------- |
| Feb 6, 2025  | `c9aede187` | Added eventsearch to `build_config.verji.yaml`                          |
| Jun 6, 2025  | `a8468a423` | Added `@verji/verji-roomsublist-module` to build config                 |
| Oct 17, 2025 | `dcd322915` | New feature-flag: update verji-sample configs for switchSpaceOnDMSelect |
| Nov 28, 2025 | `7890a02f3` | Update VerjiConfig.md docs for NSFW flag                                |
| Nov 28, 2025 | `aeea8cec2` | Merge PR #13 (uiFeatureNsfw)                                            |

---

## 5. Current State Assessment

### Branch topology in element-web-v2

```
develop (upstream baseline, Dec 18 2024)
  └── verji-merge-react-sdk (absorption work, Dec 2024)
        └── verji-develop (PR #1 + PR #3 merged, Apr 2025) ← CURRENT MAIN
              └── jts/claude-assisted-merge (working branch) ← CHECKED OUT
```

### What's on `verji-develop` today

- All upstream element-web code as of v1.11.88 (Dec 18, 2024)
- All matrix-react-sdk/verji-develop customizations as of Dec 13, 2024
- Dead code fixes and support button re-implementation (Apr 2025)
- Playwright tests skipped (need re-enabling after sync)
- Build infrastructure adapted (knip, eslint, analyse_unused_exports, webpack)

### What's NOT on `verji-develop` yet

- 73 commits from `matrix-react-sdk/origin/verji-develop` (PRs #103–#112)
- 5 commits from `element-web/origin/verji-develop`
- 3 new UIFeature flags
- RoomSublist module hook
- Slash commands filtering
- Power level renaming (Rosberg → Verji)
- Various bug fixes and improvements

### Open VERJI MERGE TODOs in element-web-v2

These comments were left during the December 2024 merge and flag areas that may need revisiting:

| File                                                        | Line  | Note                                                                                                           |
| ----------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------- |
| `src/components/structures/RoomView.tsx`                    | ~2607 | "VERJI MERGE - MAY CONTAIN ISSUES - CHANGES MADE IN ROOMVIEW"                                                  |
| `src/components/structures/RoomView.tsx`                    | ~2632 | "VERJI MERGE MAY CONTAIN ISSUES - CHANGES MADE IN WRAPPED COMPONENT"                                           |
| `src/components/views/context_menus/MessageContextMenu.tsx` | ~196  | "VERJI MERGE - May have to revisit pin-button mechanics"                                                       |
| `src/components/views/settings/ThemeChoicePanel.tsx`        | ~37   | "VERJI MERGE - Heavily altered file, we must likely revisit and reimplement the CustomThemePanel Feature flag" |

---

## 6. Gap Analysis: matrix-react-sdk

### Summary

- **Commits behind**: 78 (local `verji-develop` vs `origin/verji-develop`) — _was 73 at PRD creation; +5 as of 2026-04-21_
- **Files changed**: 38 (original) + 6 new touched by PR #113 (2 overlap: `UIFeature.ts`, `SpaceStore.ts`, `Settings.tsx`, 3 i18n)
- **Merged PRs**: 11 (#103–#113) — _was 10; PR #113 merged 2026-04-08_

### Files changed in the delta

These 38 files were modified between the Dec 2024 merge point and the current `origin/verji-develop`:

**Source files (22):**

1. `src/Roles.ts` — Power level mapping rename (Rosberg→Verji)
2. `src/SlashCommands.tsx` — Allowed commands filter
3. `src/components/structures/RoomView.tsx` — Minor changes
4. `src/components/structures/scripts/freshworks.js` — Support widget updates
5. `src/components/views/dialogs/DevtoolsDialog.tsx` — DevTools options flag
6. `src/components/views/dialogs/ExportDialog.tsx` — Export size limit increase
7. `src/components/views/elements/RoomTopic.tsx` — Space settings fix
8. `src/components/views/messages/MFileBody.tsx` — File body changes
9. `src/components/views/rooms/EntityTile.tsx` — Power status enum update
10. `src/components/views/rooms/MemberTile.tsx` — VerjiAdmin power level mapping
11. `src/components/views/rooms/RoomSublist.tsx` — Module hook injection
12. `src/components/views/settings/tabs/room/RolesRoomSettingsTab.tsx` — Role display updates
13. `src/components/views/settings/tabs/user/PreferencesUserSettingsTab.tsx` — NSFW setting flag
14. `src/i18n/strings/en_EN.json` — English translations
15. `src/i18n/strings/nb_NO.json` — Norwegian translations
16. `src/settings/Settings.tsx` — New flag registrations
17. `src/settings/UIFeature.ts` — 3 new enum values
18. `src/stores/spaces/SpaceStore.ts` — Switch space on DM logic
19. `src/theme.ts` — Theme/color fixes
20. `src/utils/FileDownloader.ts` — Usercontent versioning
21. `.eslintignore` — Ignore updates
22. `.gitignore` — Ignore updates

**CSS files (2):** 23. `res/css/_components.pcss` — Component PCSS imports 24. `res/css/structures/_TabbedView.pcss` — Tabbed view styles

**Test files (14):** 25. `test/SlashCommands-test.tsx` 26. `test/TextForEvent-test.ts` 27. `test/components/views/dialogs/__snapshots__/DevtoolsDialog-test.tsx.snap` 28. `test/components/views/elements/SyntaxHighlight-test.tsx` 29. `test/components/views/rooms/ReadReceiptGroup-test.tsx` 30. `test/components/views/rooms/__snapshots__/ReadReceiptGroup-test.tsx.snap` 31. `test/components/views/rooms/wysiwyg_composer/utils/message-test.ts` 32. `test/components/views/settings/PowerLevelSelector-test.tsx` 33. `test/components/views/settings/__snapshots__/PowerLevelSelector-test.tsx.snap` 34. `test/components/views/settings/tabs/room/RolesRoomSettingsTab-test.tsx` 35. `test/theme-test.ts` 36. `test/utils/DateUtils-test.ts`

**Config/build (2):** 37. `res/css/views/dialogs/_ConfirmInviteExternalUsersDialog.pcss` 38. `res/css/views/dialogs/_InviteNewMembersDialog.pcss`

### PR-by-PR breakdown

#### PR #103 + #105: RoomSublist Module Hook (May–Jun 2025)

**What**: Adds a `CustomComponentLifecycle.RoomSublist` hook to `RoomSublist.tsx`, allowing modules to inject custom components into room sublists.

**Files**: `src/components/views/rooms/RoomSublist.tsx`

**Porting notes**: The `RoomSublist.tsx` in element-web-v2 has a different structure than in matrix-react-sdk. Need to find the equivalent location and add the lifecycle hook. This is needed for the new `verji-roomsublist-module`.

#### PR #104: Power Level Mappings (May 2025)

**What**: Renames "Rosberg" references to "Verji" throughout. Updates power level role names and their translations.

**Files**: `src/Roles.ts`, `src/components/views/rooms/EntityTile.tsx`, `src/components/views/rooms/MemberTile.tsx`, `src/components/views/settings/tabs/room/RolesRoomSettingsTab.tsx`, translation files, test files

**Porting notes**: element-web-v2 still uses `RosbergAdmin` — this rename needs to be applied. Check `PowerStatus` enum, `powerLevelDescriptors`, and all translation keys.

#### PR #106: Slash Commands Filtering (Aug 2025)

**What**: Adds an `allowedCommands` array and filters the exported `Commands` array to only include Verji-approved slash commands.

**Files**: `src/SlashCommands.tsx`, `test/SlashCommands-test.tsx`

**Porting notes**: The SlashCommands file structure may differ in element-web-v2. Need to verify the command list and apply the filter. The `VERJI TECH` comment markers delineate this code.

#### PR #107: Misc / State Check (Sep 2025)

**What**: Contains package.json reset, uifeature-settings work, mobile number validation texts. Some commits are exploratory.

**Files**: Various, including `src/settings/Settings.tsx`

**Porting notes**: Cherry-pick the substantive changes (settings, validation texts), skip the empty PR commits.

#### PR #108: UIFeature.switchSpaceOnDMSelect (Oct 2025)

**What**: New feature flag that controls whether selecting a DM switches the active space. Also includes scss→pcss file renames.

**Files**: `src/settings/UIFeature.ts`, `src/settings/Settings.tsx`, `src/stores/spaces/SpaceStore.ts`, CSS files

**Porting notes**: Add the new UIFeature enum value, register in Settings.tsx, implement the conditional logic in SpaceStore.ts. CSS file renames need to match element-web-v2's structure.

#### PR #109: Open Space Settings Correctly (Oct 2025)

**What**: The edit topic/description button now checks if a room is a space and opens SpaceSettings instead of RoomSettings.

**Files**: `src/components/views/elements/RoomTopic.tsx`

**Porting notes**: Straightforward logic change, should port cleanly.

#### PR #110: Fix PCSS (Oct 2025)

**What**: Fixes a copy-paste CSS mistake and addresses scss→pcss migration issues.

**Files**: CSS/PCSS files

**Porting notes**: Verify that the same CSS files exist in element-web-v2 and apply the fixes.

#### PR #111: UIFeature.showNsfwContentSetting (Nov 2025)

**What**: New feature flag to hide/show the NSFW content setting in user settings.

**Files**: `src/settings/UIFeature.ts`, `src/settings/Settings.tsx`, `src/components/views/settings/tabs/user/PreferencesUserSettingsTab.tsx`

**Porting notes**: Add enum value, register setting, add conditional guard in the preferences tab.

#### PR #112: Usercontent Versioning (Jan 2026)

**What**: Applies versioning to the usercontent iframe to handle cache busting.

**Files**: `src/utils/FileDownloader.ts`

**Porting notes**: Check if `FileDownloader.ts` exists in element-web-v2 with the same structure. Apply the versioning change.

#### PR #113: Space DM Badge Notifications — `UIFeature.VerjiSpaceDmBadges` (Apr 2026) — **NEW since PRD**

**What**: New UIFeature flag that, when enabled, lets external modules (specifically `verji-roomsublist-module`) register Verji-backend DM rooms on a per-space basis so they are counted in each space's badge/notification state.

**Commits**: `87bbf37ecb`, `f1b2c57f87` (merge), `6bf17ed2b1`, `51398f51d5`, `f8f596a8a5` (merge PR #113).

**Files**:

- `src/settings/UIFeature.ts` — add `VerjiSpaceDmBadges = "UIFeature.verjiSpaceDmBadges"` enum value (after `ShowNsfwContentSetting`).
- `src/settings/Settings.tsx` — register with `LEVELS_UI_FEATURE`, `default: false`. Mark with `// VERJI` comment.
- `src/stores/spaces/SpaceStore.ts` — (a) add private `verjiDmRoomsBySpace = new Map<SpaceKey, Room[]>()`; (b) add public `setVerjiDmRoomsForSpace(spaceKey, rooms)` gated on the flag; (c) in `updateNotificationStates`, refactor the inline `visibleRooms.filter(...)` into a named `filteredRooms` const, then merge in `verjiDmRoomsBySpace.get(s)` entries that aren't already present, guarded by `verjiDmBadgesEnabled && !isMetaSpace(s)`. Finally call `this.getNotificationState(s).setRooms(filteredRooms)`.
- `src/i18n/strings/en_EN.json`, `nb_NO.json` — 3 new translation keys (error messages from the 2026-03-23 translation commits).
- `src/i18n/strings/sv.json` — **new file** (Swedish), 5 lines. Confirm whether element-web-v2 carries Swedish translations at all before porting as-is.

**Porting notes**:

- This PR edits the **same region** of `SpaceStore.ts` that PR #108 (`switchSpaceOnDMSelect`) already modifies. Land PR #108 first, then layer PR #113 on top — they are additive but the filter-refactor in PR #113 must wrap PR #108's logic, not overwrite it.
- The paired config/docs commit in element-web (`ea504ee14`) must ship together: `config.verji-local.json`, `config.verji-staging.json`, and `docs/Verji/VerjiConfig.md`. In element-web-v2 the corresponding files are `config.verji.samlple.json` and `docs/Verji/VerjiConfig.md`.
- The public method `setVerjiDmRoomsForSpace` is a new API surface consumed by `verji-roomsublist-module`. That module's `main-v2` branch will need to be updated to call it. Confirm the module's integration before declaring the port complete.

### Non-PR changes to port

| Change                       | Files                     | Notes                                                   |
| ---------------------------- | ------------------------- | ------------------------------------------------------- |
| Export size 20→2000 MB       | `ExportDialog.tsx`        | Already partially in v2, verify                         |
| Console warning improvements | Various                   | Console branding text changes                           |
| Translation fixes (nb_NO)    | `i18n/strings/nb_NO.json` | Merge translation keys                                  |
| Translation fixes (en_EN)    | `i18n/strings/en_EN.json` | Merge translation keys                                  |
| VerjiDark/light color + name | `src/theme.ts`            | Theme color updates                                     |
| Eventsearch extension        | `src/VerjiLocalSearch.ts` | Verify if already absorbed                              |
| Mobile validation texts      | Invite-related files      | Translation changes for mobile invite                   |
| RBAC POC                     | RoomList area             | May be exploratory — confirm if intended for production |

---

## 7. Gap Analysis: element-web (old fork)

### Commits to port from `element-web/origin/verji-develop`

| Date         | Hash        | Description                                                                                       | Target in v2                                             |
| ------------ | ----------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Feb 6, 2025  | `c9aede187` | Added `@verji/verji-eventsearch-module` to `build_config.verji.yaml`                              | `build_config.verji.yaml`                                |
| Jun 6, 2025  | `a8468a423` | Added `@verji/verji-roomsublist-module` to `build_config.verji.yaml`                              | `build_config.verji.yaml`                                |
| Oct 17, 2025 | `dcd322915` | New feature-flag config: update verji-sample configs for switchSpaceOnDMSelect                    | Config samples                                           |
| Nov 28, 2025 | `7890a02f3` | Update VerjiConfig.md docs for NSFW flag                                                          | `docs/Verji/VerjiConfig.md`                              |
| Nov 28, 2025 | `aeea8cec2` | Merge PR #13 (uiFeatureNsfw wrapper)                                                              | N/A (merge commit)                                       |
| Apr 8, 2026  | `ea504ee14` | **NEW** — Config + docs for `UIFeature.verjiSpaceDmBadges` (paired with matrix-react-sdk PR #113) | `config.verji.samlple.json`, `docs/Verji/VerjiConfig.md` |

---

## 8. UIFeature Flag Inventory

### Status legend

- **Ported** — Already exists in element-web-v2 `verji-develop`
- **NEW** — Exists in matrix-react-sdk `origin/verji-develop` but NOT in element-web-v2
- **Upstream** — Standard Element feature flag (not Verji-specific)

### Upstream flags (all ported)

| Flag                                       | Status |
| ------------------------------------------ | ------ |
| `UIFeature.advancedEncryption`             | Ported |
| `UIFeature.urlPreviews`                    | Ported |
| `UIFeature.widgets`                        | Ported |
| `UIFeature.locationSharing`                | Ported |
| `UIFeature.voip`                           | Ported |
| `UIFeature.feedback`                       | Ported |
| `UIFeature.registration`                   | Ported |
| `UIFeature.passwordReset`                  | Ported |
| `UIFeature.deactivate`                     | Ported |
| `UIFeature.shareQrCode`                    | Ported |
| `UIFeature.shareSocial`                    | Ported |
| `UIFeature.identityServer`                 | Ported |
| `UIFeature.thirdPartyId`                   | Ported |
| `UIFeature.advancedSettings`               | Ported |
| `UIFeature.roomHistorySettings`            | Ported |
| `UIFeature.timelineEnableRelativeDates`    | Ported |
| `UIFeature.BulkUnverifiedSessionsReminder` | Ported |

### Verji custom flags

| Flag                                               | Status            | Used by                                  |
| -------------------------------------------------- | ----------------- | ---------------------------------------- |
| `UIFeature.showCreateSpaceButton`                  | Ported            | SpaceRoomView.tsx                        |
| `UIFeature.showLeaveSpaceInContextMenu`            | Ported            | SpaceContextMenu.tsx                     |
| `UIFeature.showMembersListForSpaces`               | Ported            | SpaceRoomView.tsx                        |
| `UIFeature.showPlusMenuForMetaSpace`               | Ported            | RoomListHeader.tsx                       |
| `UIFeature.showStartChatPlusMenuForMetaSpace`      | Ported            | RoomList.tsx                             |
| `UIFeature.showAddRoomPlusMenuForMetaSpace`        | Ported            | RoomList.tsx                             |
| `UIFeature.showExploreRoomsButton`                 | Ported            | LeftPanel.tsx                            |
| `UIFeature.showAddWidgetsInRoomInfo`               | Ported            | RoomSummaryCard.tsx                      |
| `UIFeature.addExistingRoomToSpace`                 | Ported            | RoomList.tsx, RoomListHeader.tsx         |
| `UIFeature.showAddMoreButtonForSpaces`             | Ported            | SpaceRoomView.tsx                        |
| `UIFeature.addSubSpace`                            | Ported            | SpaceContextMenu.tsx                     |
| `UIFeature.addSpace`                               | Ported            | RoomListHeader.tsx                       |
| `UIFeature.showStickersButtonSetting`              | Ported            | PreferenceUserSettingsTab.tsx            |
| `UIFeature.insertTrailingColonSetting`             | Ported            | PreferenceUserSettingsTab.tsx            |
| `UIFeature.showJoinLeavesSetting`                  | Ported            | PreferenceUserSettingsTab.tsx            |
| `UIFeature.showChatEffectSetting`                  | Ported            | PreferenceUserSettingsTab.tsx            |
| `UIFeature.unverifiedSessionsToast`                | Ported            | BulkUnverifiedSessionsToast.tsx          |
| `UIFeature.searchShortcutPreferences`              | Ported            | PreferenceUserSettingsTab.tsx            |
| `UIFeature.homePageButtons`                        | Ported            | Homepage.tsx                             |
| `UIFeature.userInfoVerifyDevice`                   | Ported            | UserInfo.tsx                             |
| `UIFeature.userInfoShareLinkToUserButton`          | Ported            | UserInfo.tsx                             |
| `UIFeature.userInfoRedactButton`                   | Ported            | UserInfo.tsx, RoomList.tsx               |
| `UIFeature.roomListExplorePublicRooms`             | Ported            | Settings.tsx                             |
| `UIFeature.createRoomE2eeSection`                  | Ported            | CreateRoomDialog.tsx                     |
| `UIFeature.createRoomShowJoinRuleDropdown`         | Ported            | CreateRoomDialog.tsx                     |
| `UIFeature.createRoomShowAdvancedSettings`         | Ported            | CreateRoomDialog.tsx                     |
| `UIFeature.roomSummaryFilesOption`                 | Ported            | RoomContextMenu.tsx, RoomSummaryCard.tsx |
| `UIFeature.roomSummaryCopyLink`                    | Ported            | RoomSummaryCard.tsx                      |
| `UIFeature.newRoomIntroInviteThisRoom`             | Ported            | NewRoomIntro.tsx                         |
| `UIFeature.emailAddressShowRemoveButton`           | Ported            | EmailAddresses.tsx                       |
| `UIFeature.emailAddressShowAddButton`              | Ported            | EmailAddresses.tsx                       |
| `UIFeature.phoneNumerShowRemoveButton`             | Ported            | PhoneNumbers.tsx                         |
| `UIFeature.phoneNumerShowAddButton`                | Ported            | PhoneNumbers.tsx                         |
| `UIFeature.roomSettingsAlias`                      | Ported            | GeneralRoomSettingsTab.tsx               |
| `UIFeature.userSettingsExternalAccount`            | Ported            | GeneralUserSettingsTab.tsx               |
| `UIFeature.userSettingsChangePassword`             | Ported            | GeneralUserSettingsTab.tsx               |
| `UIFeature.userSettingsSetIdServer`                | Ported            | GeneralUserSettingsTab.tsx               |
| `UIFeature.userSettingsDiscovery`                  | Ported            | GeneralUserSettingsTab.tsx               |
| `UIFeature.userSettingsIntegrationManager`         | Ported            | GeneralUserSettingsTab.tsx               |
| `UIFeature.userSettingsResetCrossSigning`          | Ported            | CrossSigningPanel.tsx                    |
| `UIFeature.userSettingsDeleteBackup`               | Ported            | SecureBackupPanel.tsx                    |
| `UIFeature.userSettingsResetBackup`                | Ported            | SecureBackupPanel.tsx                    |
| `UIFeature.setupEncryptionResetButton`             | Ported            | SetupEncryptionBody.tsx                  |
| `UIFeature.accountSendAccountEvent`                | Ported            | AccountData.tsx                          |
| `UIFeature.accountSendRoomEvent`                   | Ported            | AccountData.tsx                          |
| `UIFeature.enableLoginPage`                        | Ported            | Login.tsx                                |
| `UIFeature.enableNewRoomIntro`                     | Ported            | CreationGrouper.tsx                      |
| `UIFeature.enableRoomDevTools`                     | Ported            | DevtoolsDialog.tsx                       |
| `UIFeature.enableRoomDevToolsOptions`              | **NEW**           | DevtoolsDialog.tsx                       |
| `UIFeature.widgetContextDeleteButton`              | Ported            | WidgetContextMenu.tsx                    |
| `UIFeature.exportDefaultSizeLimit`                 | Ported            | ExportDialog.tsx                         |
| `UIFeature.allExportTypes`                         | Ported            | ExportDialog.tsx                         |
| `UIFeature.exportAttatchmentsDefaultOff`           | Ported            | ExportDialog.tsx                         |
| `UIFeature.roomSettingsSecurity`                   | Ported            | RoomSettingsDialog.tsx                   |
| `UIFeature.roomPreviewRejectIgnoreButton`          | Ported            | RoomPreviewBar.tsx                       |
| `UIFeature.baseToolActionButton`                   | Ported            | BaseTool.tsx                             |
| `UIFeature.networkOptions`                         | Ported            | NetworkDropdown.tsx                      |
| `UIFeature.searchWarnings`                         | Ported            | SearchWarning.tsx                        |
| `UIFeature.powerSelectorCustomValue`               | Ported            | PowerSelector.tsx                        |
| `UIFeature.customThemePanel`                       | Ported            | ThemeChoicePanel.tsx                     |
| `UIFeature.videoMirrorLocalVideo`                  | Ported            | VoiceUserSettingsTab.tsx                 |
| `UIFeature.videoConnectionSettings`                | Ported            | VoiceUserSettingsTab.tsx                 |
| `UIFeature.spotlightDialogShowOtherSearches`       | Ported            | SpotlightDialog.tsx                      |
| `UIFeature.multipleCallsInRoom`                    | Ported            | LegacyCallHandler.tsx                    |
| `UIFeature.showSpaceLandingPageDetails`            | Ported            | SpaceRoomView.tsx                        |
| `UIFeature.showSendMessageToUserLink`              | Ported            | InviteDialog.tsx                         |
| `UIFeature.sendInviteLinkPrompt`                   | Ported            | InviteDialog.tsx                         |
| `UIFeature.helpShowMatrixDisclosurePolicyAndLinks` | Ported            | HelpUserSettingsTab.tsx                  |
| `UIFeature.showInviteToSpaceFromPeoplePlus`        | Ported            | RoomList.tsx                             |
| `UIFeature.settingShowMessageSearch`               | Ported            | SecuritySettingsTab.tsx                  |
| `UIFeature.showRoomMembersInSuggestions`           | Ported            | InviteDialog/SpotlightDialog             |
| `UIFeature.showRecentsInSuggestions`               | Ported            | InviteDialog                             |
| `UIFeature.allowDirectUserInvite`                  | Ported            | verji-onboarding-module                  |
| `UIFeature.searchInAllRooms`                       | Ported            | SearchBar.tsx                            |
| `UIFeature.leaveSpaceButton`                       | Ported            | SpaceSettingsGeneralTab.tsx              |
| `UIFeature.switchSpaceOnDMSelect`                  | **NEW**           | SpaceStore.ts                            |
| `UIFeature.showNsfwContentSetting`                 | **NEW**           | PreferencesUserSettingsTab.tsx           |
| `UIFeature.verjiSpaceDmBadges`                     | **NEW** (2026-04) | SpaceStore.ts + verji-roomsublist-module |

**Total**: ~71 Verji custom flags. 67 ported, **4 NEW** to port.

---

## 9. CustomComponentLifecycle Hooks

These hooks allow Verji modules to inject custom components at specific points in the UI:

| Hook                                                | Location (matrix-react-sdk) | Location (element-web-v2) | Status                  |
| --------------------------------------------------- | --------------------------- | ------------------------- | ----------------------- |
| `CustomComponentLifecycle.NewsAndOperatingMessages` | LeftPanel.tsx               | LeftPanel.tsx             | Ported                  |
| `CustomComponentLifecycle.LoggedInView`             | LoggedInView.tsx            | LoggedInView.tsx          | Ported                  |
| `CustomComponentLifecycle.SpacePanel`               | LoggedInView.tsx            | LoggedInView.tsx          | Ported                  |
| `CustomComponentLifecycle.LeftPanel`                | LoggedInView.tsx            | LoggedInView.tsx          | Ported                  |
| `CustomComponentLifecycle.RoomHeader`               | RoomView.tsx                | RoomView.tsx              | Ported                  |
| `CustomComponentLifecycle.MessageContextMenu`       | MessageContextMenu.tsx      | MessageContextMenu.tsx    | Ported                  |
| `CustomComponentLifecycle.InviteDialog`             | InviteDialog.tsx            | InviteDialog.tsx          | Ported                  |
| `CustomComponentLifecycle.OnboardingDialog`         | InviteDialog.tsx            | InviteDialog.tsx          | Ported                  |
| `CustomComponentLifecycle.RoomSublist`              | RoomSublist.tsx             | **NOT PORTED**            | **NEW — needs porting** |

---

## 10. Custom Module Migration Status

### Modules with `main-v2` branches (already adapted)

| Module                  | Version | Branch    | Depends on                           | Build Status | Notes                              |
| ----------------------- | ------- | --------- | ------------------------------------ | ------------ | ---------------------------------- |
| verji-news-module       | 0.0.20  | `main-v2` | element-web-v2#verji-merge-react-sdk | Buildable    | Imports from `element-web/src/...` |
| verji-onboarding-module | 0.2.3   | `main-v2` | element-web-v2#verji-merge-react-sdk | Buildable    | Tests and build working            |
| verji-usermenu-module   | 1.1.25  | `main-v2` | element-web-v2#verji-merge-react-sdk | Buildable    | Working tests                      |

**Note**: These modules currently point to `element-web-v2#verji-merge-react-sdk`. After the sync work lands on `verji-develop`, their dependency refs should be updated to point to `verji-develop`.

### Modules needing investigation (not cloned locally)

| Module                   | Expected Action                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| verji-usersearch-module  | Check if `main-v2` branch exists; if not, create one and update matrix-react-sdk→element-web dependency |
| verji-cryptosetup-module | Check if `main-v2` branch exists; extension module, likely fewer import changes                         |
| verji-eventsearch-module | Check if `main-v2` branch exists; extension module                                                      |
| verji-roomsublist-module | **NEW module** (created Jun 2025). Check if it already targets element-web-v2                           |

### Module API

| Module                      | Branch       | Status                                    |
| --------------------------- | ------------ | ----------------------------------------- |
| matrix-react-sdk-module-api | `verji-main` | 2 commits behind origin — pull and verify |

---

## 11. VERJI/ROSBERG Code Markers

Custom Verji code is identified throughout the codebase with comment markers. These **must be preserved** during any porting or refactoring work.

### Marker patterns

- `// VERJI` / `// Verji` / `//Verji` — Start of custom code block
- `// VERJI END` / `// Verji end` — End of custom code block
- `// ROSBERG` / `// Rosberg` — Legacy company name, same meaning
- `/* VERJI Custom Functions */` / `/* END VERJI Custom Functions */` — Block comment style
- `// VERJI MERGE` — Flags areas from the Dec 2024 merge that need revisiting

### Marker count

- **matrix-react-sdk** `origin/verji-develop`: 198 markers across 60 files
- **element-web-v2** `verji-develop`: 240 markers across 77 files

### Key files with dense custom code

| File                       | Markers | Nature of customization                                          |
| -------------------------- | ------- | ---------------------------------------------------------------- |
| `MessageContextMenu.tsx`   | 20+     | Redact rules, removed share/report, poll ownership, module hooks |
| `LoggedInView.tsx`         | 5+      | Freshworks widget, module lifecycle hooks                        |
| `RoomView.tsx`             | 6+      | Local search, merge warnings, module hooks                       |
| `MatrixClientPeg.ts`       | 4       | Custom functions block                                           |
| `EntityTile.tsx`           | 8+      | Power level enum and display names                               |
| `RolesRoomSettingsTab.tsx` | 4+      | Hidden event types filter (rosbergHidden)                        |
| `InviteDialog.tsx`         | 2+      | Module hook workaround props                                     |
| `AppsDrawer.tsx`           | 4       | Widget height, custom start/end blocks                           |
| `SlashCommands.tsx`        | 3       | Allowed commands filter                                          |
| `ViewSource.tsx`           | 6+      | Removed edit button, commented code                              |

---

## 12. Step-by-Step Action Plan

All work is local. No pushes, commits, or PRs — those are handled manually by the developer.

### Phase 1: Preparation

- [ ] Ensure `element-web-v2` is on `jts/claude-assisted-merge` branch (or create a new working branch from `verji-develop`)
- [ ] Ensure `matrix-react-sdk` local `verji-develop` is pulled to match `origin/verji-develop` (73 commits)
- [ ] Run `yarn install` on element-web-v2 to verify starting state

### Phase 2: Port UIFeature Flags + Settings

- [ ] Add to `src/settings/UIFeature.ts`:
    - `EnableRoomDevToolsOptions = "UIFeature.enableRoomDevToolsOptions"`
    - `SwitchSpaceOnDMSelect = "UIFeature.switchSpaceOnDMSelect"`
    - `ShowNsfwContentSetting = "UIFeature.showNsfwContentSetting"`
- [ ] Register all 3 in `src/settings/Settings.tsx` with `LEVELS_UI_FEATURE` and default values

### Phase 3: Port Power Level Mappings (PR #104)

- [ ] Update `src/Roles.ts` — rename power level display names from Rosberg to Verji translations
- [ ] Update `src/components/views/rooms/EntityTile.tsx` — rename `RosbergAdmin` → `VerjiAdmin` in PowerStatus enum
- [ ] Update `src/components/views/rooms/MemberTile.tsx` — update power level mapping (95 → VerjiAdmin)
- [ ] Update `src/components/views/settings/tabs/room/RolesRoomSettingsTab.tsx` — rename `rosbergHidden`
- [ ] Update translation files (`en_EN.json`, `nb_NO.json`) with new power level translation keys

### Phase 4: Port Slash Commands Filtering (PR #106)

- [ ] Add `allowedCommands` array to `src/SlashCommands.tsx`
- [ ] Add `.filter()` call on the exported Commands array
- [ ] Port or create `test/SlashCommands-test.tsx` equivalent

### Phase 5: Port RoomSublist Module Hook (PR #103 + #105)

- [ ] Add `CustomComponentLifecycle.RoomSublist` to the lifecycle enum (if not already present)
- [ ] Add module hook invocation in `src/components/views/rooms/RoomSublist.tsx`
- [ ] Verify ModuleRunner integration

### Phase 6: Port SpaceStore Switch-on-DM Logic (PR #108)

- [ ] Add conditional logic in `src/stores/spaces/SpaceStore.ts` guarded by `UIFeature.switchSpaceOnDMSelect`
- [ ] Port any CSS/PCSS changes related to this feature

### Phase 7: Port Space Settings Fix (PR #109)

- [ ] Update `src/components/views/elements/RoomTopic.tsx` to check isSpace and open SpaceSettings

### Phase 8: Port PCSS Fixes (PR #110)

- [ ] Apply CSS copy-paste fix
- [ ] Verify scss→pcss migration in element-web-v2 context

### Phase 9: Port NSFW Setting Flag (PR #111)

- [ ] Add conditional guard in `src/components/views/settings/tabs/user/PreferencesUserSettingsTab.tsx`

### Phase 10: Port Usercontent Versioning (PR #112)

- [ ] Update `src/utils/FileDownloader.ts` with iframe versioning logic

### Phase 10b: Port Space DM Badge Notifications (PR #113) — **NEW (2026-04)**

> Port this **after** Phase 6 (PR #108) lands in `SpaceStore.ts` — the two changes overlap in `updateNotificationStates`. Do not port concurrently.

- [ ] Add `VerjiSpaceDmBadges = "UIFeature.verjiSpaceDmBadges"` to `src/settings/UIFeature.ts` (after `ShowNsfwContentSetting`).
- [ ] Register in `src/settings/Settings.tsx` with `LEVELS_UI_FEATURE`, `default: false`, `// VERJI` marker.
- [ ] In `src/stores/spaces/SpaceStore.ts`:
    - [ ] Add `private verjiDmRoomsBySpace = new Map<SpaceKey, Room[]>();` next to `_msc3946ProcessDynamicPredecessor`.
    - [ ] Add public method `setVerjiDmRoomsForSpace(spaceKey: SpaceKey, rooms: Room[]): void` that early-returns when the flag is off, stores the list, and calls `this.updateNotificationStates([spaceKey])`.
    - [ ] Inside `updateNotificationStates`, extract `visibleRooms.filter(...)` into a `const filteredRooms` and, when `verjiDmBadgesEnabled && !isMetaSpace(s)`, merge any `verjiDmRoomsBySpace.get(s)` entries that aren't already in `filteredRooms` (dedupe by `roomId`). Pass the merged array to `setRooms`.
- [ ] Merge the 3 translation keys into `src/i18n/strings/en_EN.json` and `nb_NO.json`.
- [ ] Decide whether to carry the new `sv.json` (Swedish) file — verify if element-web-v2 is meant to support Swedish; if not, skip.
- [ ] Port the paired element-web commit `ea504ee14`:
    - [ ] Add the flag entry to `config.verji.samlple.json`.
    - [ ] Document the flag in `docs/Verji/VerjiConfig.md` (copy the two-line description from upstream).
- [ ] Coordinate with `verji-roomsublist-module` — confirm (or open a follow-up task) that its `main-v2` branch is updated to call `setVerjiDmRoomsForSpace`.

### Phase 11: Port Miscellaneous Changes

- [ ] Export size increase (20→2000 MB) in `ExportDialog.tsx` (verify if already in v2)
- [ ] Console warning text changes
- [ ] Translation updates (`en_EN.json`, `nb_NO.json`)
- [ ] Theme color updates (`src/theme.ts`)
- [ ] Mobile number validation texts
- [ ] `EnableRoomDevToolsOptions` guard in `DevtoolsDialog.tsx`
- [ ] Freshworks script updates

### Phase 12: Port element-web Old Fork Changes

- [ ] Add `@verji/verji-eventsearch-module` to `build_config.verji.yaml`
- [ ] Add `@verji/verji-roomsublist-module` to `build_config.verji.yaml`
- [ ] Update verji sample configs with new feature flags
- [ ] Update `docs/Verji/VerjiConfig.md` with new flags documentation

### Phase 13: Resolve Open VERJI MERGE TODOs

- [ ] Review `RoomView.tsx` lines ~2607, ~2632 — verify correctness or fix
- [ ] Review `MessageContextMenu.tsx` line ~196 — verify pin-button mechanics
- [ ] Review `ThemeChoicePanel.tsx` line ~37 — reimplement CustomThemePanel feature flag

### Phase 14: Validate

- [ ] `yarn install` — clean dependency resolution
- [ ] `yarn lint` — no new lint errors
- [ ] `yarn test` — tests pass (accounting for known skips)
- [ ] `yarn build` — successful production build
- [ ] Local dev server — client loads and basic navigation works
- [ ] Verify module loading — custom modules appear in build output
- [ ] Spot-check feature flags — toggle a few flags in config and verify UI changes

---

## 13. Risk Register & Caveats

| Risk                                                                                                   | Severity | Mitigation                                                                                                            |
| ------------------------------------------------------------------------------------------------------ | -------- | --------------------------------------------------------------------------------------------------------------------- |
| **File structure mismatch**: matrix-react-sdk files may not map 1:1 to element-web-v2 after absorption | High     | Manual verification of each file. Some code may have been restructured (e.g., test paths moved to `test/unit-tests/`) |
| **RBAC POC code**: The "rbac poc example (roomlist Person+ toggle)" commit may be experimental         | Medium   | Confirm with team whether this should be included in production                                                       |
| **Playwright tests skipped**: All E2E tests are currently disabled                                     | Medium   | Address separately — focus on unit tests first                                                                        |
| **Module dependency refs**: Modules point to `verji-merge-react-sdk` branch                            | Low      | Update to `verji-develop` after sync work is complete                                                                 |
| **VERJI MERGE TODOs**: 3 files flagged during Dec 2024 merge may have latent issues                    | Medium   | Review each during Phase 13                                                                                           |
| **Translation key conflicts**: New translation keys may conflict with existing ones                    | Low      | Merge carefully, prefer newer translations                                                                            |
| **CSS/PCSS divergence**: element-web-v2 may use different CSS tooling than matrix-react-sdk            | Medium   | Verify PostCSS config and file extensions                                                                             |
| **React 17→18 differences**: Some patterns may behave differently                                      | Low      | Already addressed during initial merge, but watch for edge cases                                                      |

---

## 14. Verification Plan

### Build verification

```bash
cd element-web-v2
yarn install
yarn lint
yarn test
yarn build
```

### Functional verification

1. **Start local dev server**: `yarn start` and navigate to `http://localhost:8080`
2. **Login**: Verify login page respects `UIFeature.enableLoginPage`
3. **Room navigation**: Open rooms, verify message context menu customizations
4. **Space navigation**: Verify space settings open correctly (PR #109 fix)
5. **Feature flags**: Test toggling at least 3 flags in config:
    - `UIFeature.showNsfwContentSetting` (new)
    - `UIFeature.switchSpaceOnDMSelect` (new)
    - `UIFeature.leaveSpaceButton` (existing)
6. **Slash commands**: Type `/` in composer, verify only allowed commands appear
7. **Power levels**: Open room settings → Roles, verify "Verji" naming (not "Rosberg")
8. **Support widget**: Verify Freshworks widget loads in room header
9. **Module hooks**: Verify custom component lifecycle hooks fire (check browser console)

### Code marker audit

After all porting is complete, run:

```bash
git grep -c -i "VERJI\|ROSBERG" -- "*.ts" "*.tsx" "*.js" | grep -v node_modules | grep -v i18n
```

Compare the count against the baseline (240 markers in 77 files) to ensure no custom code was lost.

---

## 15. Proposed Next Step (2026-04-21)

The uncommitted working tree on `jts/claude-assisted-merge` already carries the bulk of Phase 2–11 ports. The next step is **stabilize-and-land what's done, then layer PR #113 on top** — not keep accumulating uncommitted work.

### Recommended sequence

1. **Freeze the current surface and validate it.**

    - Run `yarn install` → `yarn lint` → `yarn test` → `yarn build` on `jts/claude-assisted-merge` as-is.
    - Fix whatever breaks. Do **not** add new ports on top of a broken working tree — each subsequent port needs a known-good baseline.

2. **Split the working tree into reviewable commits along PR boundaries.**

    - Stage file-by-file so each commit maps to a source PR (e.g., "port PR #104 — Rosberg→Verji", "port PR #106 — slash-commands allowlist", etc.). This keeps the later rebase / conflict resolution against upstream Element tractable.
    - Resolve the 4 open `// VERJI MERGE` TODOs (Section 5) as their own commit; don't leave them bundled with unrelated ports.

3. **Port PR #113 + element-web `ea504ee14` as a single new commit set (Phase 10b).**

    - Do this **after** step 2 lands, because PR #113 edits the same block in `SpaceStore.ts` that the PR #108 port touches. Sequencing avoids a merge-with-self conflict.
    - Verify at the end that `verji-roomsublist-module` (on `main-v2`) either already consumes `setVerjiDmRoomsForSpace` or is tracked as a follow-up.

4. **Open a PR from `jts/claude-assisted-merge` → `verji-develop`.** Use the PR description to reference this PRD and the range of source PRs ported (#103–#113). JTS handles the push/merge manually per the PRD's scope constraint.

### What I am **not** recommending

- Don't start porting PR #113 ahead of committing current work — it will land in the same `SpaceStore.ts` region as PR #108 and make the diff harder to reason about.
- Don't re-fetch/re-baseline the source forks again until PR #113 is landed. If another upstream PR appears in the meantime, add it to a new "Phase 10c" rather than interleaving.
- Don't update the `verji-*-module` `main-v2` branch dependency refs (from `verji-merge-react-sdk` → `verji-develop`) until after this PR merges — keep the scope tight.

---

## Appendix A: Commit Reference

### matrix-react-sdk `origin/verji-develop` — commits after Dec 13, 2024

```
68d635bba4 2026-01-23 Merge pull request #112 from verji/jts/usercontent-versioning
159a2f39e9 2026-01-23 fixed old lint error
b54634c307 2026-01-23 Apply versioning to the usercontent iframe
d9bbbfb3cc 2026-01-13 fixed _pcss error
60d5ff82fa 2026-01-13 2421 Improve console warning
4f6d6f6fce 2026-01-13 2421 Improve console warning
35f0122f4d 2026-01-13 2421 Improve console warning
3a989cb3f3 2025-11-28 Merge pull request #111 from verji/jts/2410-uiFeatureNsfw
05d61fad93 2025-11-28 UIFeature.showNsfwContentSetting
4f933985c4 2025-11-07 update bug in translation string
946e6cdcf3 2025-10-29 Merge pull request #110 from verji/jts/fix-pcss
8f803194aa 2025-10-29 lint fix again
c340409931 2025-10-29 prettier run
523800fb2e 2025-10-29 lint fix
0ef2fd8dba 2025-10-29 Fix copy-paste mistake in css
fb3d324309 2025-10-20 Merge pull request #109 from verji/jts/2345-openSpaceSettings
7ed7c0fe82 2025-10-20 lint and prettier
f6d12ff25e 2025-10-20 Edit topic/description button space check
edeb59b523 2025-10-17 hotfix forgot to remove unused imports
0b15ab96b9 2025-10-17 Merge pull request #108 from verji/jts/2333-switchSpaceOnDmSelect
066601906b 2025-10-17 revert eslintignore
8f99be0459 2025-10-17 remove old scss
71a569628b 2025-10-17 lint
afd2206c5d 2025-10-17 lint
54a56f42c1 2025-10-17 test
6321b12ab4 2025-10-17 rename back to org file name for scss files
48c0d4263c 2025-10-17 Attempt to rewrite scss to pcss files
9514bbe618 2025-10-17 linting
0acfaafe73 2025-10-17 Added new UI feature: UIFeature.switchSpaceOnDMSelect
e86d6cb0f2 2025-09-12 2305 validate mobilenumbers on invite - texts
b999b22c8f 2025-09-09 Merge pull request #107 from verji/eik/empty_pr
9cd06fde14 2025-09-09 empty pr to check state of matrix-react-sdk
5f08b8fa9b 2025-09-09 empty pr to check state of matrix-react-sdk
f6a3f80fb6 2025-09-09 reset package.json and yarn.lock
f4aefb4bfc 2025-09-09 2314 uifeature-settings
c15c34a19b 2025-09-01 Merge branch 'verji-develop'
f5d1d70459 2025-09-01 div
5bc3da2adb 2025-08-20 rbac poc example (roomlist Person+ toggle)
4beebc51ca 2025-08-20 Merge pull request #106 from verji/jts/2293-slash-commands
619ad390c3 2025-08-20 skip slashcommand tests
7be48d39cd 2025-08-20 skip slashcommand tests
b2479b7124 2025-08-20 lint
1863f8f814 2025-08-20 Filter slash commands on "Verji allowed" commands
4816083fcd 2025-06-06 Merge pull request #105 from verji/jts/roomsublist-module
f9c791594d 2025-06-06 Add component hook for <RoomSublist>
3913ddfa60 2025-05-21 Merge pull request #104 from verji/jts/powerlevel-mappings
f895e52707 2025-05-21 lint
e104f8d616 2025-05-21 lint
e28c0994d1 2025-05-21 skip snapshot tests (Dynamic ids in snapshot)
4e40c03fc6 2025-05-21 fix tests to match Verji Power Level roles
1e9388b923 2025-05-21 re-enable "m.room.redact" (remove own messages)
e4fa92f917 2025-05-21 lint
e6c363fa85 2025-05-21 Change enum, and fix test
35ff4d8d79 2025-05-21 linting
0969f47895 2025-05-21 Fix powerlevel mappings - Rosberg → Verji
44e305ab22 2025-05-20 prettier
ba4124acc4 2025-05-20 skip broken test
a6ce254cf6 2025-05-20 update snapshot
3271ce0e2b 2025-05-20 update snapshot for Ståle
7ea05681b2 2025-05-20 update test
5fa6c01557 2025-05-20 Fix tests for Ståle
b80fcd5ce0 2025-05-20 Eslint for Ståle
5d0f406a2b 2025-05-20 Update package.json
f43c7fa333 2025-05-20 eslint RoomSublist.tsx
11644d3f38 2025-05-20 Increase default size, on room export (20→2000 MB)
9f2112aecc 2025-05-19 roomsublist module hook
db78903261 2025-04-14 initial push functional "mock" example for dmSorting on tenant
45e90bcb3b 2025-04-09 2077 VerjiDark/light color, name translation
07dc341bbe 2025-04-08 2077 VerjiDark/light color
53531dfa28 2025-03-18 2200 - language changes
3f1cc38c14 2025-02-05 Added eventsearch extension, working code
0924306bc3 2024-12-13 Improve error message when not permission to invite to tenant
```

### element-web `origin/verji-develop` — commits after Dec 13, 2024

```
aeea8cec2 2025-11-28 Merge pull request #13 from verji/jts/2410-uiFeatureNsfw
7890a02f3 2025-11-28 update VerjiConfig.md docs
dcd322915 2025-10-17 New feature-flag: update verji-sample configs
a8468a423 2025-06-06 add @verji/verji-roomsublist-module
c9aede187 2025-02-06 Added eventsearch to build config
```
