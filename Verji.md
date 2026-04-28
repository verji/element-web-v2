# Verji

## What is Verji?

Verji is a secure communications platform built for regulated industries — primarily law firms, financial institutions, and public sector organizations in the Nordics. It is based on the [Matrix](https://matrix.org/) open standard for decentralized, end-to-end encrypted messaging.

The client application — the product end-users interact with — is a customized fork of [Element Web](https://github.com/element-hq/element-web), the reference Matrix client. Verji tailors this client to meet the strict security, compliance, and usability requirements of its customers, while continuing to track upstream Element development for new features and bug fixes.

Verji is **not** a white-label or skin of Element. It is a maintained fork with substantial behavioral differences, a custom module ecosystem, a different role-based access model, and tight integration with Verji's own identity and administration infrastructure.

---

## How Verji Differs from Standard Element Web

### 1. Authentication and Identity

Verji does not use Element's built-in login or registration flows. Users authenticate through Verji's own identity provider via SSO (OIDC). The standard Element login page, registration page, and password reset are all disabled.

Key configuration:

- `sso_immediate_redirect: true` — users are redirected to the Verji identity provider on load
- `UIFeature.enableLoginPage: false` — the built-in login page is hidden
- `UIFeature.registration: false` — self-registration is disabled
- `UIFeature.passwordReset: false` — password management is handled externally

External service URLs (`verjiIdUrl`, `vmxAccountUrl`, `verjiAclUrl`, `verjiLinkOnboardingUrl`) connect the client to Verji's identity, account management, ACL, and onboarding services.

### 2. Encryption is Mandatory and Transparent

Verji enforces end-to-end encryption on all rooms. The UI elements that would let users create unencrypted rooms or interact with encryption internals are disabled.

- `UIFeature.createRoomE2eeSection: false` — no option to toggle E2EE when creating rooms
- `UIFeature.advancedEncryption: false` — advanced encryption settings hidden
- `UIFeature.userSettingsResetCrossSigning: false` — users cannot reset cross-signing
- `UIFeature.setupEncryptionResetButton: false` — encryption reset is hidden
- `UIFeature.userSettingsDeleteBackup: false` — backup deletion is hidden

The **verji-cryptosetup-module** handles encryption setup automatically. During login, the server provides a `secure_backup_key` in the login response. The module extracts this key, stores it in `localStorage`, and uses it for secret storage, key backup, and device dehydration — all without any user interaction. Users never see the standard "Verify this device" or "Set up encryption" dialogs.

### 3. Heavily Reduced UI Surface

Verji disables approximately 70 UIFeature flags in its default configuration, hiding functionality that is irrelevant, confusing, or risky for its target users. The philosophy is: less is more for enterprise users who need to communicate securely without being exposed to protocol-level complexity.

**Disabled categories include:**

- Federation and public room discovery (`networkOptions`, `roomListExplorePublicRooms`, `showExploreRoomsButton`)
- Identity server management (`identityServer`, `userSettingsSetIdServer`, `userSettingsDiscovery`)
- Third-party integrations (`userSettingsIntegrationManager`, `showAddWidgetsInRoomInfo`, `widgetContextDeleteButton`)
- Developer tools (`enableRoomDevTools`, `baseToolActionButton`, `accountSendAccountEvent`, `accountSendRoomEvent`)
- Social and sharing features (`shareQrCode`, `shareSocial`, `showSendMessageToUserLink`, `sendInviteLinkPrompt`)
- Stickers, chat effects, URL previews (`showStickersButtonSetting`, `showChatEffectSetting`, `urlPreviews`)
- Self-service account management (`deactivate`, `userSettingsChangePassword`, `userSettingsExternalAccount`)
- Spaces power-user features (`showCreateSpaceButton`, `addSubSpace`, `addSpace`, `showSpaceLandingPageDetails`)
- Matrix branding and disclosures (`helpShowMatrixDisclosurePolicyAndLinks`, `feedback`)
- NSFW content settings (`showNsfwContentSetting`)

What remains is a focused messaging experience: rooms, direct messages, file sharing, video calls, and basic room management.

### 4. Custom Role-Based Access Control (RBAC)

Verji replaces Element's simple Admin/Moderator power level model with a granular 7-tier role hierarchy:

| Power Level    | Role Name | Description                          |
| -------------- | --------- | ------------------------------------ |
| 0              | Standard  | Basic user                           |
| (usersDefault) | Default   | Default power level for room members |
| 50             | Moderator | Can moderate content                 |
| 80             | Admin     | Organization administrator           |
| 90             | Tenant    | Tenant-level administrator           |
| 95             | Verji     | Verji platform administrator         |
| 100            | System    | System-level operations              |

These roles are defined in `src/Roles.ts` and use Verji-specific translation keys (`verji|power_level|*`). The `RolesRoomSettingsTab` and `PowerSelector` components are customized to display and enforce this hierarchy. Custom power level values are restricted (`UIFeature.powerSelectorCustomValue: false`) so users can only choose from the predefined levels.

### 5. Custom Verji Theme

Verji ships with custom light and dark themes (`Verji_light` and `Verji_dark`) that use the Jost font family and a green accent color (#578E2F). The default theme is `custom-Verji_light`. Standard Element theme customization is disabled (`UIFeature.customThemePanel: false`).

### 6. Slash Commands Filtering

Verji restricts the available slash commands to a curated allowlist. Only the following commands are available to users:

- `/devtools`, `/confetti`, `/me`, `/shrug`, `/tableflip`, `/unflip`, `/spoiler`

All other slash commands (invite, ban, kick, topic, nick, etc.) are filtered out. This is implemented as a filter on the exported `Commands` array in `src/SlashCommands.tsx`.

### 7. Usercontent Versioning

File downloads use a versioned `usercontent/` iframe path (`usercontent/?v=${process.env.VERSION}`) to prevent caching issues across deployments. This is a Verji modification in `MFileBody.tsx`.

### 8. Freshworks Support Widget

Verji integrates a Freshworks support widget (`src/components/structures/scripts/freshworks.js`) for in-app customer support. The widget is styled with Verji's green branding and configured for Norwegian locale (`nb-NO`).

### 9. Custom Dispatcher Actions

Verji adds custom dispatcher actions for its module ecosystem:

- `ViewNews` — triggers the news module to display product news
- `ViewOperatingMessages` — triggers display of operational status messages

### 10. DM Space-Switching Behavior

Verji overrides Element's default behavior of switching space context when selecting a DM. The flag `UIFeature.switchSpaceOnDMSelect` (default: false) prevents the UI from attempting to find and switch to a "parent space" of DM rooms, which is confusing in Verji's workspace model.

### 11. Search Behavior

- `UIFeature.searchInAllRooms: false` — the "All rooms" tab in search is hidden
- `UIFeature.spotlightDialogShowOtherSearches: false` — public space filtering in the spotlight dialog is disabled
- `UIFeature.showRoomMembersInSuggestions: false` — invite suggestions rely on search results rather than room membership lists
- `UIFeature.showRecentsInSuggestions: false` — recent contacts are hidden from invite suggestions

### 12. Export Behavior

Verji modifies chat export to be simpler and more restrictive:

- `UIFeature.exportDefaultSizeLimit: false` — sets the limit to 20 MB (vs Element's 8 MB) and removes the UI to adjust it
- `UIFeature.allExportTypes: false` — exports always start from the beginning rather than offering timeline-based options
- `UIFeature.exportAttatchmentsDefaultOff: false` — attachments are always exported

### 13. Auto-Logout

Verji supports automatic session logout after a configurable idle threshold (`logoutThreshhold` config option, default 3 hours / 10800000ms). This is tied to the `autologout` feature flag.

---

## Custom Modules

Verji uses the Element module system (`@matrix-org/react-sdk-module-api`) to inject custom functionality at runtime. Modules are installed during the build via `build_config.yaml` and loaded by the `ModuleRunner`. There are two types:

### GUI Modules (Custom Components)

These modules use `CustomComponentLifecycle` hooks to swap standard Element components with Verji-custom implementations.

#### verji-onboarding-module

- **Lifecycle:** `CustomComponentLifecycle.InviteDialog`
- **Purpose:** Replaces the standard invite dialog with Verji's custom invitation and onboarding flow ("Person+ invite"). Includes custom invite dialog, new member invitation flow, and external user confirmation.
- **Key features:** Integration with Verji's onboarding API, phone number input with country code support, external user invite confirmation.
- **Repository:** [github.com/verji/verji-onboarding-module](https://github.com/verji/verji-onboarding-module)

#### verji-usermenu-module

- **Lifecycle:** `CustomComponentLifecycle.UserMenu`
- **Purpose:** Replaces the standard user menu with a Verji-branded version that integrates with Verji's portal, account management, and logout URLs.
- **Repository:** [github.com/verji/verji-usermenu-module](https://github.com/verji/verji-usermenu-module)

#### verji-news-module

- **Lifecycle:** `CustomComponentLifecycle.NewsAndOperatingMessages`
- **Purpose:** Displays product news and operational status messages from Verji's RSS feeds (verji.no). Shows notification badges for unread items.
- **Repository:** [github.com/verji/verji-news-module](https://github.com/verji/verji-news-module)

#### verji-roomsublist-module

- **Lifecycle:** `CustomComponentLifecycle.RoomSublist`
- **Purpose:** Customizes the room list sidebar grouping and display behavior.
- **Repository:** [github.com/verji/verji-roomsublist-module](https://github.com/verji/verji-roomsublist-module)

### Extension Modules

These modules use extension interfaces to inject custom logic without replacing UI components.

#### verji-cryptosetup-module

- **Extension:** `CryptoSetupExtensions`
- **Purpose:** Automatic encryption key management. Extracts the `secure_backup_key` from the login response, persists it to `localStorage`, and provides it for secret storage, key backup, and device dehydration. Eliminates all user-facing encryption setup.
- **Key property:** `SHOW_ENCRYPTION_SETUP_UI = false` — suppresses the standard encryption setup dialog.
- **Repository:** [github.com/verji/verji-cryptosetup-module](https://github.com/verji/verji-cryptosetup-module)

#### verji-usersearch-module

- **Extension:** `UserSearchExtensions`
- **Purpose:** Augments the `/user-directory/search` Matrix API calls with custom headers and body arguments for Verji-specific user search behavior.
- **Repository:** [github.com/verji/verji-usersearch-module](https://github.com/verji/verji-usersearch-module)

#### verji-eventsearch-module

- **Extension:** `EventSearchExtensions`
- **Purpose:** Overrides the default event search with a Verji-specific search implementation.
- **Repository:** [github.com/verji/verji-eventsearch-module](https://github.com/verji/verji-eventsearch-module)

---

## CustomComponentLifecycle Hooks

The Verji fork of `@matrix-org/react-sdk-module-api` defines 23 `CustomComponentLifecycle` events. These are insertion points in the Element UI where modules can swap in custom React components. Not all are currently used by modules — many exist as extension points for future use.

Currently active hooks (used by modules):

- `InviteDialog` — verji-onboarding-module
- `UserMenu` — verji-usermenu-module
- `NewsAndOperatingMessages` — verji-news-module
- `RoomSublist` — verji-roomsublist-module

Available hooks (for future modules):

- `AppsDrawer`, `EntityTile`, `ErrorBoundary`, `Experimental`, `HelpUserSettingsTab`, `LegacyRoomHeader`, `LeftPanel`, `LoggedInView`, `MatrixChat`, `MemberTile`, `MessageContextMenu`, `ReactionsRow`, `ReactionsRowButtonTooltip`, `RolesRoomSettingsTab`, `RoomHeader`, `RoomView`, `SessionManagerTab`, `SpacePanel`

---

## Configuration Architecture

Verji's configuration is layered:

1. **`build_config.yaml`** — Compile-time module installation. Lists which modules to include in the build.
2. **`config.json`** (runtime) — Deployed per environment. Contains homeserver URLs, Verji service URLs, feature flags, theme definitions, and all `setting_defaults` that control UIFeature flags.
3. **`UIFeature.ts`** (code) — Enum defining all available feature flags. Each flag maps to a string key that is read from `config.json`'s `setting_defaults`.
4. **`Settings.ts`** (code) — Registers each UIFeature flag with a default value (`true`). The config.json overrides bring most flags to `false` for Verji.

A reference Verji configuration is maintained in `config.verji.samlple.json`.

---

## Code Markers

Verji custom code in the Element codebase is marked with comment markers for traceability. The marker text is case-tolerant (`VERJI`, `Verji`, `verji` all recognized); the syntax varies by file type:

- **JS/TS/TSX/CSS** (line comment): `// Verji - <reason>` for single-line additions; `// Verji Start: <reason>` ... `// Verji End` for multi-line blocks.
- **JS/TS/CSS** (block comment, e.g. file-header): `/* Verji - <reason> */` or `/* Verji Start: <reason> ... Verji End */`.
- **Ini-like / shell / yaml** (no `//` comments): `# Verji - <reason>` on the line before the setting.
- **Markdown**: `<!-- Verji -->` HTML comment above new sections. Files that are 100% Verji-custom (like this one and everything under `docs/Verji/`) do not need per-section markers.
- **JSON** (no native comments): use a sibling `"//verji_<key>"` pseudo-key only if attribution would otherwise be unclear; prefer naming the referenced script/file with a Verji prefix instead (e.g. the `verji:prestart` entry in `package.json`).
- **Legacy / merge-tracking markers**:
    - `// ROSBERG` or `// Rosberg` — legacy marker from an earlier project name (same meaning as `// Verji`; do not strip when seen).
    - `// VERJI MERGE` — flags areas that need attention after upstream merges.

These markers are critical during upstream syncs — they identify every line of custom code that must survive a merge. An approximate baseline count lives in the workspace-level `CLAUDE.md`; the authoritative audit command is:

```bash
git grep -c -i "VERJI\|ROSBERG" -- "*.ts" "*.tsx" "*.js" "*.css" "*.pcss" "*.yaml" "*.yml" | grep -v node_modules | grep -v i18n
```

---

## Repository Structure

The Verji ecosystem spans multiple repositories:

| Repository                    | Purpose                                                                   | Key Branch                  |
| ----------------------------- | ------------------------------------------------------------------------- | --------------------------- |
| `element-web-v2`              | Main client application (fork of Element Web)                             | `verji-develop`             |
| `matrix-js-sdk-v2`            | Matrix SDK (fork with Verji customizations)                               | `verji-merge-matrix-js-sdk` |
| `matrix-react-sdk-module-api` | Module API surface (Verji fork with extra lifecycle hooks and extensions) | `verji-main`                |
| `verji-cryptosetup-module`    | Automatic encryption setup module                                         | `main-v2`                   |
| `verji-onboarding-module`     | Custom invite/onboarding flow                                             | `main-v2`                   |
| `verji-usermenu-module`       | Custom user menu                                                          | `main-v2`                   |
| `verji-news-module`           | News and operating messages                                               | `main-v2`                   |
| `verji-roomsublist-module`    | Custom room list                                                          | (check repo)                |
| `verji-usersearch-module`     | Custom user search                                                        | (check repo)                |
| `verji-eventsearch-module`    | Custom event search                                                       | (check repo)                |

---

## Verji developer documentation

Deeper Verji-specific developer docs live under [`docs/Verji/`](docs/Verji/):

- [`VerjiConfig.md`](docs/Verji/VerjiConfig.md) — reference for Verji-specific config flags and their effects.
- [`VerjiModules.md`](docs/Verji/VerjiModules.md) — module architecture, the issues we've hit (yarn v1 link-protocol circular references, 7 GB recursive cache entries, `MAX_PATH` cleanup problems, etc.), the layered fixes now in place (install-cache short-circuit, devDep move, webpack alias, smart prestart), and guidance for adding new modules without tripping the same traps.
- [`DevLoopWindows.md`](docs/Verji/DevLoopWindows.md) — day-to-day Windows dev-loop gotchas: the `yarn start` EEXIST symlink failure, required Defender exclusions, the webpack filesystem cache, the install-cache short-circuit, why install progress goes silent under `concurrently`, Node heap OOM during long sessions, and the future alias optimization.

New Verji-specific operational docs (troubleshooting, build quirks, ops runbooks) should go here rather than into the upstream `docs/` tree, so the folder serves as a single stable home for Verji-only material that must not drift during upstream merges.

---

## Why This Document Matters

Verji's value comes from the sum of all these customizations working together. Individually, each change is small — a disabled flag, a swapped component, a filtered command list. Together, they transform Element from a developer-friendly Matrix client into a locked-down, enterprise-grade communications platform.

When syncing with upstream Element (which we must do regularly to receive security fixes, performance improvements, and new features), every one of these customizations is at risk of being overwritten, broken by upstream refactors, or made incompatible by API changes. This document serves as the authoritative reference for **what makes Verji, Verji** — so that nothing gets lost in the merge.
