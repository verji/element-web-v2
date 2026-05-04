# PRD — Support Legacy MSC2697 Dehydration on element-web-v2 (Module + Feature Flag)

> **Status:** Draft for review
> **Author:** Engineering
> **Date:** 2026-04-30
> **Related:** [DehydratedDeviceIssue.md](DehydratedDeviceIssue.md), [DehydratedDeviceIssueRollbackClientSolutionPRD.md](DehydratedDeviceIssueRollbackClientSolutionPRD.md)

## 1. Context

Per [DehydratedDeviceIssue.md](DehydratedDeviceIssue.md), Verji's MSC2697 dehydrated-device flow does not work on `element-web-v2` (1.11.88 / matrix-js-sdk 35). Three layers conspire: (1) Verji's `getDehydrationKey` callback wiring is dead on Rust crypto, (2) Rust crypto's MSC3814 manager owns its own randomly-generated key and does not consult any caller-supplied key, and (3) Verji's deployed Synapse implements only MSC2697.

The sibling document [DehydratedDeviceIssueRollbackClientSolutionPRD.md](DehydratedDeviceIssueRollbackClientSolutionPRD.md) evaluates the **rollback** family of solutions — staying on (or returning to) `element-web/` 1.11.68 until Verji's Synapse ships MSC3814. Its recommendation is "pause-and-backport," conditioned on Synapse MSC3814 landing within ~6 months. If that condition does not hold — i.e., MSC3814 is not on Synapse's near-term roadmap — the rollback path's conflict cost grows linearly with the bridge length and eventually dominates.

This PRD evaluates a **forward-fix** alternative: keep the migration on `element-web-v2`, and reintroduce the MSC2697 protocol behaviour in a strictly additive way — as a Verji-private module, gated behind a `UIFeature` flag, that talks to the existing MSC2697 Synapse and feeds its results into Rust crypto. **No Synapse change. No revival of the legacy `Crypto` class. No client-fork of matrix-js-sdk.**

## 2. Problem statement

Verji needs a client that simultaneously:

1. Talks **MSC2697** (not MSC3814) to dehydrated-device endpoints, because that's what the deployed Synapse implements.
2. Uses the **SSO `secure_backup_key`** as the dehydration key — preserving Verji's "one SSO trip, no passphrase prompt" UX contract.
3. Lives on the **`element-web-v2` (1.11.88)** base so the four-month migration effort and the matrix-react-sdk absorption work are not lost.
4. Is **opt-in and removable** — when Synapse MSC3814 eventually lands, the bridge code can be deleted in a single PR and the client returns to the upstream Rust dehydration path.

`element-web-v2` as currently built satisfies (3) but not (1) or (2). The legacy `element-web/` (1.11.68) satisfies (1) and (2) but not (3) — the migration to v2 stalls indefinitely.

This PRD's design satisfies all four.

## 3. Goals & non-goals

**Goals**

- Restore creation, rehydration, and ongoing rotation of dehydrated devices on `element-web-v2` against Verji's MSC2697 Synapse.
- Reuse the SSO key (no passphrase prompt) — same UX as the legacy stack.
- Keep the change strictly additive: a new module + a small set of integration hooks in `element-web-v2/src/`, all gated behind one `UIFeature` flag.
- Preserve a clean exit: when Synapse MSC3814 ships, flip the flag off, drop the module from `build_config.verji.yaml`, remove the two integration hooks. ~1 PR.

**Non-goals**

- Implementing MSC3814 anywhere (server or client).
- Modifying matrix-js-sdk-v2 source. (One narrow exception is acceptable — adding a new `DehydrationExtensions` interface to `matrix-react-sdk-module-api` if §7's design analysis says it's preferable. That change is mechanical and stays inside the module-api package, not matrix-js-sdk.)
- Reviving libolm as the *primary* crypto backend. Rust crypto remains the only message-encryption backend in `element-web-v2`. libolm is used **only** for the dehydration-pickle round-trip and to decrypt the dehydrated device's olm sessions long enough to extract megolm keys, which are then handed to Rust crypto.
- Solving the rollback PRD's question of whether to pause the migration. This PRD assumes the migration continues.

## 4. Why this is technically possible

The forward-fix design rests on five facts about the current code state:

1. **The MSC2697 HTTP endpoints still exist in matrix-js-sdk v35 source.** [matrix-js-sdk-v2/src/client.ts:1650-1791](../../../matrix-js-sdk-v2/src/client.ts#L1650-L1791) defines `rehydrateDevice()`, `getDehydratedDevice()`, `setDehydrationKey()`, and `createDehydratedDevice()` — all marked `@deprecated`, all still hitting the unchanged `/_matrix/client/unstable/org.matrix.msc2697.v2/...` endpoints with the same payload shapes as v33. The legacy `DehydrationManager` source still lives at [matrix-js-sdk-v2/src/crypto/dehydration.ts](../../../matrix-js-sdk-v2/src/crypto/dehydration.ts).

2. **Those methods are not callable on a Rust-only client** because they reach into `this.crypto.dehydrationManager`, and `client.crypto` is undefined when Rust crypto is the active backend. Calling them crashes. They are useful here only as a **reference implementation** for what our module must do at the HTTP/libolm layer — the wire format is unchanged.

3. **`@matrix-org/olm@3.2.15` is still resolvable.** [matrix-js-sdk-v2/package.json:54](../../../matrix-js-sdk-v2/package.json#L54) keeps libolm as a direct dependency of matrix-js-sdk-v2 even though Rust crypto is the active backend. Our new module can pull `@matrix-org/olm` in explicitly with the same pin, without resurrecting any other piece of legacy-crypto plumbing.

4. **`CryptoApi.importRoomKeys()` is the bridge into Rust crypto.** Defined at [matrix-js-sdk-v2/src/crypto-api/index.ts:139](../../../matrix-js-sdk-v2/src/crypto-api/index.ts#L139) on the public Rust crypto API surface. Once we extract megolm session keys from the claimed to-device messages via libolm, this is the single typed entry point that hands them to Rust crypto. No other Rust internals need to be touched.

5. **The SSO key is already plumbed.** [verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx:21-95](../../../verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx#L21-L95) already extracts `secure_backup_key` from the SSO login response, persists it to `localStorage["mx_secure_backup_key"]`, and exposes it via `getSecretStorageKey()` — already consumed at [src/SecurityManager.ts:119](../../src/SecurityManager.ts#L119) and [src/SecurityManager.ts:168](../../src/SecurityManager.ts#L168). The new module reads the same key through the same `ModuleRunner.instance.extensions.cryptoSetup` surface; no new key-retrieval channel is introduced.

**Design thesis**: the legacy MSC2697 protocol can be reimplemented as a userland module that owns its own libolm instance, hits the unchanged MSC2697 endpoints directly via `client.http.authedRequest()`, and feeds extracted megolm keys into Rust crypto via `importRoomKeys()`. Everything else in `element-web-v2/src/` stays on the upstream Rust path.

## 5. Architecture overview

```
SSO login → secure_backup_key → localStorage["mx_secure_backup_key"]
                                              │
                                              ▼  (read via cryptoSetup.getSecretStorageKey)
       ┌────────────────────────────────────────────────────────┐
       │  verji-legacy-dehydration-module (NEW, opt-in)         │
       │                                                         │
       │  - bundles @matrix-org/olm@3.2.15                       │
       │  - implements MSC2697 directly via client.http          │
       │  - decrypts pickled olm account, claims to-device msgs  │
       │  - extracts megolm keys → crypto.importRoomKeys()       │
       └────────────────────────────────────────────────────────┘
                       │                                │
                       ▼                                ▼
              Rust crypto (unchanged)        Synapse MSC2697 (unchanged)
```

Integration points in `element-web-v2/src/`:

| Hook | File | What changes |
|---|---|---|
| Post-login rehydrate trigger | [src/Lifecycle.ts](../../src/Lifecycle.ts) | If `UIFeature.VerjiLegacyDehydration` is on and the SSO key is present, call `legacyDehydrationManager.rehydrate()`. Mirrors [matrix-react-sdk/src/Lifecycle.ts:798-805](../../../matrix-react-sdk/src/Lifecycle.ts#L798-L805). |
| Bootstrap-time create trigger | [src/utils/device/dehydration.ts](../../src/utils/device/dehydration.ts) | Gate the existing `initialiseDehydration()` call on `!UIFeature.VerjiLegacyDehydration`; route to `legacyDehydrationManager.createOrRotate()` when on. The two paths are mutually exclusive. |
| UIFeature flag definition | [src/settings/UIFeature.ts](../../src/settings/UIFeature.ts), [src/settings/Settings.tsx](../../src/settings/Settings.tsx) | New `UIFeature.VerjiLegacyDehydration`, default `false`, `LEVELS_UI_FEATURE`. |
| Docs + sample config | [docs/Verji/VerjiConfig.md](VerjiConfig.md), `config.verji.samlple.json` | One new flag entry with description and default. |
| Module installer list | [build_config.verji.yaml](../../build_config.verji.yaml) | One new entry: `- "@verji/verji-legacy-dehydration-module@verji-v2"`. |

Total surface area in `element-web-v2/src/`: two files modified, plus the standard four-edit pattern for adding a UIFeature flag (per [CLAUDE.md](../../../CLAUDE.md)). No edits to `MatrixClientPeg.ts`, `SecurityManager.ts`, or any crypto-related upstream file.

## 6. Options for module shape

Three viable shapes for *where* the new code lives:

### Option A — Add the logic to `verji-cryptosetup-module`

**Pros**
- One module, no new package or publish pipeline.
- The module already owns the SSO key.

**Cons**
- `verji-cryptosetup-module`'s stated scope is "secret storage / login response inspection." Adding ~600+ lines of olm/MSC2697 logic conflates concerns.
- Bumping the cryptosetup module's version to ship the new logic risks regressing every consumer that only needs the SSO-key plumbing.
- When MSC3814 ships and we delete the legacy code, we can't simply uninstall the module — we have to refactor it.

### Option B — A new `verji-legacy-dehydration-module` *(Recommended)*

A new private package `@verji/verji-legacy-dehydration-module` that reads the SSO key from cryptosetup-module's existing extension surface (`getSecretStorageKey()`).

**Pros**
- Clean separation of concerns; the existing cryptosetup module is unchanged.
- The legacy-dehydration module is a single artefact: when Synapse MSC3814 ships, remove its entry from [build_config.verji.yaml](../../build_config.verji.yaml) and delete the integration hooks. The module repo can be archived without touching anything else.
- Independent release cadence — security patches to libolm or our MSC2697 implementation don't drag the cryptosetup module along.
- Mirrors the existing `@verji/*` module structure that engineers and CI already know how to build, test, and publish.

**Cons**
- One more module to maintain (build, publish, GitHub Actions auth per [feedback_workflow_install_auth.md](../../../../../.claude/projects/c--dev-fresh-fork/memory/feedback_workflow_install_auth.md)).
- One more entry in `build_config.verji.yaml`.

### Option C — Inline the code directly inside `element-web-v2/src/`

`// VERJI` blocks in `element-web-v2/src/`, no new module.

**Pros**
- Shortest path. No module-publishing pipeline. Tests live next to the code they test.

**Cons**
- Spreads load-bearing legacy-protocol code across an upstream-tracking repo. Every future upstream sync onto `element-web-v2/verji-develop` has to step around this code.
- Defeats the "isolate the bridge so it can be removed" goal — when MSC3814 lands, removal is a multi-file diff instead of a single module uninstall.
- Increases the [VERJI marker count](../../../CLAUDE.md) in the most-touched parts of the client (Lifecycle, dehydration utils) — exactly where merge conflicts hurt most.

**Recommendation: Option B.** The remainder of this PRD specifies Option B's design.

## 7. Detailed design

### 7.1 Module package

- **Name:** `@verji/verji-legacy-dehydration-module`. New private repo at `verji-legacy-dehydration-module/` alongside the other `@verji/*` modules.
- **Branch convention:** `main-v2` for the v2-targeted release line, matching [feedback_yarn_install_recovery.md](../../../../../.claude/projects/c--dev-fresh-fork/memory/feedback_yarn_install_recovery.md) and the other v2 modules.
- **Pattern:** copy the structure of [verji-cryptosetup-module](../../../verji-cryptosetup-module/) — `RuntimeModule` subclass, `package.json`, `tsconfig.json`, GitHub Actions `publish-v2.yaml` mirroring the `NODE_AUTH_TOKEN` recipe in [feedback_workflow_install_auth.md](../../../../../.claude/projects/c--dev-fresh-fork/memory/feedback_workflow_install_auth.md).
- **Direct deps:**
  - `@matrix-org/olm`: pinned to `3.2.15` — same version pinned in [matrix-js-sdk-v2/package.json:54](../../../matrix-js-sdk-v2/package.json#L54). Same pin avoids two olm copies in the bundle (yarn dedupe relies on exact version match).
  - `matrix-js-sdk`: peer dep, Verji fork URL — see [feedback_module_resolutions_for_element_web_dep.md](../../../../../.claude/projects/c--dev-fresh-fork/memory/feedback_module_resolutions_for_element_web_dep.md).
  - `@matrix-org/react-sdk-module-api`: GitHub URL on `verji-main-v2`.
- **Resolutions field:** match the recipe in [feedback_module_resolutions_for_element_web_dep.md](../../../../../.claude/projects/c--dev-fresh-fork/memory/feedback_module_resolutions_for_element_web_dep.md) — `**/matrix-js-sdk` → Verji fork, `**/matrix-widget-api: 1.10.0`, `@types/css-tree`. Necessary for `tsc` emit to pass.
- **File header:** `// VERJI` only, no SPDX / copyright (per [feedback_verji_authored_file_headers.md](../../../../../.claude/projects/c--dev-fresh-fork/memory/feedback_verji_authored_file_headers.md)).

### 7.2 Public surface of the module

The module exposes one class consumed by `element-web-v2/src/`:

```ts
export class LegacyDehydrationManager {
    constructor(client: MatrixClient, getKey: () => Promise<Uint8Array | null>);

    /** Probe the server. Caches the result for the session. */
    isSupported(): Promise<boolean>;

    /** GET the existing dehydrated device, claim its to-device msgs, import megolm keys.
     *  Returns null if no device exists, throws on protocol error. */
    rehydrate(): Promise<{ deviceId: string; importedKeys: number } | null>;

    /** Generate a fresh olm account, pickle with the SSO key, upload device + keys. */
    createOrRotate(displayName?: string): Promise<{ deviceId: string }>;

    /** Schedule periodic re-dehydration. Mirrors legacy DehydrationManager.queueDehydration. */
    scheduleRotation(): void;

    /** Cancel pending timers. Called on logout. */
    stop(): void;
}
```

Callers in `element-web-v2/src/`:

- [src/Lifecycle.ts](../../src/Lifecycle.ts) post-login flow → `rehydrate()`, then `createOrRotate()` if no device existed.
- [src/utils/device/dehydration.ts](../../src/utils/device/dehydration.ts) `initialiseDehydration()` → if the legacy UIFeature is on, route to `createOrRotate()`; otherwise fall back to upstream `crypto.startDehydration()`.

### 7.3 The four MSC2697 operations

The behavioural reference is the still-present-but-deprecated source at [matrix-js-sdk-v2/src/client.ts:1650-1791](../../../matrix-js-sdk-v2/src/client.ts#L1650-L1791) and the `DehydrationManager` at [matrix-js-sdk-v2/src/crypto/dehydration.ts](../../../matrix-js-sdk-v2/src/crypto/dehydration.ts). Endpoint paths, request bodies, and response shapes are unchanged on the wire; we reimplement the parts that touch `client.crypto` (which is `undefined` under Rust).

#### 7.3.1 Rehydrate existing dehydrated device (login)

1. `GET /_matrix/client/unstable/org.matrix.msc2697.v2/dehydrated_device` → returns `{ device_id, device_data: { algorithm, account, passphrase? } }` or 404 / `M_NOT_FOUND`.
2. Initialize libolm: `await Olm.init()`, `const account = new Olm.Account()`.
3. AES-decrypt the pickle envelope using the SSO key. The envelope format is the standard `EncryptedSecretStorageItem` shape. Reuse the helpers in [matrix-js-sdk-v2/src/utils.ts](../../../matrix-js-sdk-v2/src/utils.ts) (`decryptAESSecretStorageItem` / equivalent) — exported from the SDK for exactly this purpose. **Do not reimplement the AES envelope.**
4. `account.unpickle(pickleKey, decryptedPickleString)` — pickleKey here is the libolm-internal pickle key, which for MSC2697 is itself derived from the SSO key. Refer to [matrix-js-sdk-v2/src/crypto/dehydration.ts](../../../matrix-js-sdk-v2/src/crypto/dehydration.ts) for the exact derivation.
5. `POST /_matrix/client/unstable/org.matrix.msc2697.v2/dehydrated_device/claim` with body `{ device_id }` → returns array of claimed to-device events. Each event is `m.room.encrypted` addressed to the dehydrated device, encrypted with an olm session.
6. For each claimed event:
   - Decrypt with the unpickled olm account (using `Olm.Session` mechanics — see legacy reference impl).
   - Inspect the plaintext: it is a `m.room_key` event with `room_id`, `session_id`, `session_key`, plus claimed sender identity keys.
7. Convert into `IMegolmSessionData[]` (the type accepted by `importRoomKeys`).
8. `await client.getCrypto()!.importRoomKeys(sessions)`.
9. Discard the libolm account (`account.free()`) — the rehydrated device is one-shot. **Do not** call the claim endpoint twice; the server marks claimed events delivered.
10. Return `{ deviceId, importedKeys: sessions.length }`.

#### 7.3.2 Create a new dehydrated device (post-bootstrap)

1. `await Olm.init()`, `const account = new Olm.Account()`. Generate identity keys and one-time keys.
2. **Cross-sign device keys** — see §7.4 (open question; affects this step's exact contents).
3. AES-encrypt(account.pickle(pickleKey), ssoKey) → produces the on-wire `device_data.account` envelope.
4. `PUT /_matrix/client/unstable/org.matrix.msc2697.v2/dehydrated_device` body:
   ```json
   {
     "device_data": {
       "algorithm": "org.matrix.msc2697.v1.olm.libolm_pickle",
       "account": "<base64 envelope>",
       "passphrase": null
     },
     "initial_device_display_name": "Verji dehydrated"
   }
   ```
   → returns `{ device_id }`.
5. `POST /_matrix/client/unstable/org.matrix.msc2697.v2/keys/upload/{device_id}` with `{ device_keys, one_time_keys, "org.matrix.msc2732.fallback_keys": {...} }`.
6. `account.free()`. The pickled state is now solely on the server.
7. Schedule periodic re-dehydration via `scheduleRotation()` (mirrors the legacy `DehydrationManager`'s behaviour where re-dehydration consumes one OTK per cycle, so a quiet account does not exhaust them).

#### 7.3.3 `isSupported()`

- Probe with the GET in §7.3.1.
- Treat `M_UNRECOGNIZED`, 404, 405, or 501 as unsupported.
- Cache per session in module memory. Recheck after a 24h TTL — Verji's Synapse may evolve mid-session.

#### 7.3.4 Key rotation / re-dehydration

- Same as §7.3.2 (create).
- Trigger on a 24h timer, plus on Rust crypto's own key-changed signals if [matrix-js-sdk-v2/src/crypto-api/index.ts](../../../matrix-js-sdk-v2/src/crypto-api/index.ts) exposes them. If not, the timer alone suffices.

### 7.4 Open technical questions

These need resolution before Phase 3 of §10. The PRD does not pretend they are solved.

**1. Cross-signing of newly-created dehydrated devices.** Legacy code signs the dehydrated device's identity keys with the user's Self-Signing Key (SSK), so that other devices in the user's session see the dehydrated device as cross-signed. With Rust crypto, the SSK lives inside the Rust store and is not directly exported.

Options:
- **(a) Export the cross-signing private keys** via a Rust crypto API (e.g., `CryptoApi.exportSecretsBundle()`, if exposed), use them inline to sign, then discard. Risk: enlarges the surface where private cross-signing material is in JS memory.
- **(b) Skip device signing.** The dehydrated device shows up to other devices as unverified. UX cost depends on how Verji's verification UX treats unverified devices; for a dehydrated device that is never used to send messages, the cost may be acceptable.
- **(c) Server-side signing.** Verji's Synapse signs on the user's behalf. Requires Synapse change — outside this PRD's "no Synapse change" constraint, but listed for completeness.

**Recommendation for Phase 3 decision:** start with (b) for rehydrate-only support (so Phase 1 and 2 ship), then choose (a) or (c) for create. Document the choice in the decision log.

**2. AES envelope helpers.** Confirm by reading [matrix-js-sdk-v2/src/utils.ts](../../../matrix-js-sdk-v2/src/utils.ts) which AES helpers are still exported. If `decryptAESSecretStorageItem` / `encryptAESSecretStorageItem` are part of the SDK's public surface, reuse. If they have been moved to `internal/`, either (a) re-export from the Verji fork on a minor branch, or (b) reimplement (small risk surface — the algorithm is well-defined).

**3. Two libolm copies in the bundle.** `@matrix-org/olm@3.2.15` is pulled in transitively by `matrix-js-sdk-v2` and directly by the new module. Yarn should dedupe given identical pins, but webpack's bundle behaviour is what matters at runtime. **Verify a single olm.wasm in the final bundle** as a build-time check. A doubled olm.wasm would add ~290 KB to the bundle for no benefit.

**4. Server `M_FORBIDDEN` for unsigned dehydrated devices.** Verji's Synapse may reject a dehydrated-device upload whose device keys are not cross-signed. Verify against the staging Synapse before Phase 3.

**5. Reuse vs. reimplement libolm bridge logic.** [matrix-js-sdk-v2/src/crypto/OlmDevice.ts](../../../matrix-js-sdk-v2/src/crypto/OlmDevice.ts) (and adjacent files in `src/crypto/`) contain the legacy code that decrypts olm to-device messages. If those modules can be imported standalone (no transitive `client.crypto` dep), reuse them. If they require `client.crypto` to be initialized, reimplement the small subset we need (~100 lines).

### 7.5 UIFeature flag

Following the four-edit pattern documented in [CLAUDE.md](../../../CLAUDE.md):

- Add `VerjiLegacyDehydration = "UIFeature.verjiLegacyDehydration"` to [src/settings/UIFeature.ts](../../src/settings/UIFeature.ts).
- Register in [src/settings/Settings.tsx](../../src/settings/Settings.tsx) under `LEVELS_UI_FEATURE` with `default: false`.
- Document in [docs/Verji/VerjiConfig.md](VerjiConfig.md) — purpose, default, when to enable.
- Add to `element-web-v2/config.verji.samlple.json` under `setting_defaults`.

The runtime gate guards every callsite of `LegacyDehydrationManager` in `Lifecycle.ts` and `utils/device/dehydration.ts`. When the flag is `false`, the existing upstream MSC3814 path runs unchanged.

Verji production sets the flag to `true` via `config.json`; downstream/non-Verji deployments see no behavioural change.

## 8. Pros and cons

### 8.1 Pros

- **Unblocks the migration.** `element-web-v2` ships against Verji's existing Synapse. The ~73 unported commits stop accumulating cost. The four-month absorption work is preserved.
- **No client-fork of matrix-js-sdk.** Implementation is a userland module that uses only the public SDK surface (`client.http.authedRequest`, `client.getCrypto().importRoomKeys`, `@matrix-org/olm` directly). matrix-js-sdk-v2 stays on its current Verji branch with no protocol-level patches.
- **No revival of legacy `Crypto` class.** The rollback PRD's Option C ("re-thread libolm through `MatrixClient`") is rejected there for "highest crypto-safety risk." This design avoids that risk by *not* reattaching libolm to `MatrixClient` at all — libolm runs in a sandboxed userland module with a single narrow output (megolm keys → `importRoomKeys`).
- **Clean exit when Synapse MSC3814 ships.** Three actions: (1) flip `UIFeature.VerjiLegacyDehydration` to `false`, (2) remove the entry from [build_config.verji.yaml](../../build_config.verji.yaml), (3) delete the two integration hooks from `Lifecycle.ts` and `utils/device/dehydration.ts`. Total: ~1 small PR. The module repo can be archived without touching anything in `element-web-v2`.
- **Server stays unchanged.** Verji's Synapse remains MSC2697-only for the bridge duration. No coordination dependency on the Synapse roadmap — engineering can decide independently when MSC3814 is worth the server work.
- **Preserves Verji's UX contract.** SSO key is the dehydration key. No passphrase prompt. Same as today on the legacy stack.
- **Independent module release cadence.** Security patches to libolm or to our MSC2697 implementation ship without touching the cryptosetup module or `element-web-v2` itself.
- **Fail-closed by design.** If the module fails to load or `isSupported()` returns false, the existing MSC3814 trigger remains gated by the well-known check (already present at [src/utils/device/dehydration.ts](../../src/utils/device/dehydration.ts)). Worst case = current broken behaviour, no new regression class.

### 8.2 Cons

- **Verji owns a custom protocol implementation.** Even though the code lives in a userland module, *we* are now responsible for MSC2697 client correctness — AES envelope, olm session decryption, megolm key extraction, claim-endpoint semantics. Bug categories that the matrix-js-sdk team historically owned move onto Verji's plate. **Mitigation:** keep the implementation as close to the deprecated reference at [matrix-js-sdk-v2/src/crypto/dehydration.ts](../../../matrix-js-sdk-v2/src/crypto/dehydration.ts) as possible; treat the deprecated source as the conformance target.
- **Two crypto stacks in one bundle.** Rust crypto (WASM) for messaging, libolm (WASM) in userland for dehydration. Larger bundle (`olm.wasm` ~290 KB), longer cold start. **Mitigation:** dynamic-import the module on first use — most of an active session never touches dehydration after login.
- **Cross-signing is an open question (§7.4).** If we cannot or choose not to sign the dehydrated device, peers see it as unverified. UX cost depends on Verji policy. **Mitigation:** ship rehydrate-only first; stage create behind an explicit decision after Phase 2.
- **libolm is in maintenance mode.** matrix-org/olm is no longer the focus of upstream crypto investment. Future libolm CVEs may not be patched. **Mitigation:** the bridge is bounded — when MSC3814 ships in Synapse, the module is deleted. Bridge horizon: 6–18 months realistic.
- **Test surface.** Real-Synapse integration tests for the protocol round-trip, plus libolm-against-Rust-import unit tests, plus a "user offline → key delivered → user logs in → message decrypts" end-to-end test. Non-trivial test investment, ~1.5–2 weeks.
- **Upstream divergence in `element-web-v2/src/`.** Two integration hooks (`Lifecycle.ts`, `utils/device/dehydration.ts`) plus four UIFeature edits. Small surface, but every future upstream sync must step around them. **Mitigation:** wrap each hook in clear `// VERJI` markers so they survive merges (per [CLAUDE.md](../../../CLAUDE.md) markers section).
- **MSC3814-Synapse landing mid-bridge.** If Synapse starts advertising `org.matrix.msc3814` in `.well-known` while the Verji flag is still on, both code paths could run. **Mitigation:** the flag fully short-circuits the MSC3814 trigger in `dehydration.ts`. Per-deployment ops decision when to flip.
- **Bundle of legacy tech debt is highly visible.** The presence of `libolm` + `verji-legacy-dehydration-module` is a permanent marker in our codebase that "Verji is on a custom dehydration path." This is honest — but visible to anyone auditing.

## 9. Comparison vs the rollback PRD

| Criterion | This PRD (legacy-on-new-client) | Rollback PRD (D-as-B): pause + backport |
|---|---|---|
| Lets `element-web-v2` ship | ✓ | ✗ (stays on 1.11.68) |
| Bridge has a clean exit | ✓ (delete one module + 2 hooks) | ✓ (resume migration) |
| Up-front engineering | **High** (new module + olm integration + tests) | Low |
| Ongoing maintenance during bridge | Medium (own MSC2697 client correctness) | Medium (security backports) |
| Crypto-safety risk | Low (no `Crypto`-class revival, libolm sandboxed) | None |
| Tied to Synapse roadmap | No | Soft (D framing); No (B framing) |
| Preserves matrix-react-sdk absorption work | ✓ | ✗ |
| Upstream catch-up cost when bridge ends | Low (one module deletion) | High (12+ month gap eventually) |
| Realistic bridge horizon | 6–18 months | <12 months before B's conflict cost dominates |

**Reader takeaway:** this PRD is the right call when Synapse MSC3814 is **more than ~6 months out** and the engineering capacity exists to own MSC2697 client correctness during the bridge. The rollback PRD is the right call when MSC3814 is on the near horizon (≤6 months) and the libolm/MSC2697 module engineering capacity is unavailable.

The two PRDs are **not mutually exclusive**. A defensible plan is: pursue the rollback PRD's recommendation immediately to unblock production, *and* spec out this PRD as the contingency for the case where MSC3814 slips. If MSC3814 is on track, this PRD is shelved at zero further cost. If MSC3814 slips past 6 months, this PRD activates.

## 10. Recommendation

Ship Option B — a new `@verji/verji-legacy-dehydration-module` — gated behind `UIFeature.VerjiLegacyDehydration` (default `false`, set `true` in Verji's `config.json`). Treat the module as a removable bridge with a defined exit (Synapse MSC3814).

**Activate this PRD when:**
- The rollback PRD's 6-month checkpoint indicates Synapse MSC3814 is not on a credible track, **or**
- Leadership decides the cost of pausing migration outweighs the cost of owning MSC2697 client code.

**Why not Option A (extend cryptosetup-module):** conflates concerns and makes the eventual removal harder (refactor instead of uninstall).

**Why not Option C (inline in `element-web-v2/src/`):** spreads load-bearing legacy-protocol code across the upstream-tracking repo, raising merge-conflict cost and defeating the "removable bridge" goal.

**Why not the rollback PRD's recommendation:** that PRD is the right framing when Synapse MSC3814 is imminent. This PRD is the right framing when it is not. They answer different questions.

## 11. Implementation plan

8–10 weeks, phased to surface the open questions early.

### Phase 1 — Module scaffold + protocol round-trip (week 1–2)

- [ ] Create `verji-legacy-dehydration-module/` repo. Copy structure from `verji-cryptosetup-module/`. Set up `package.json`, `tsconfig.json`, `jest.config.js`.
- [ ] Pin `@matrix-org/olm@3.2.15`. Verify yarn dedupes (single olm in `node_modules`).
- [ ] Implement `isSupported()` and `rehydrate()` in protocol-only mode — no key import yet, just confirm GET/POST round-trips against the staging MSC2697 Synapse.
- [ ] Wire up the GitHub Actions publish workflow per [feedback_workflow_install_auth.md](../../../../../.claude/projects/c--dev-fresh-fork/memory/feedback_workflow_install_auth.md). Confirm `NODE_AUTH_TOKEN` is in the install step.
- [ ] First green test: module loads, calls `isSupported()`, sees `true` against staging Synapse.

### Phase 2 — Megolm key extraction + Rust import (week 3–4)

- [ ] Reuse or reimplement libolm session decrypt (per §7.4 question 5).
- [ ] Convert decrypted to-device payloads to `IMegolmSessionData[]`.
- [ ] Wire up `client.getCrypto()!.importRoomKeys(sessions)`.
- [ ] End-to-end test: a second account sends a room key to the dehydrated device's session ID; rehydrate; verify the room key appears in Rust crypto's store and decrypts a subsequent message. This is the gating test for the whole approach.

### Phase 3 — `createOrRotate` + cross-signing decision (week 5–6)

- [ ] Resolve §7.4 question 1 (cross-signing approach). Document the decision in this PRD's decision log.
- [ ] Implement `createOrRotate()`.
- [ ] Implement `scheduleRotation()` with a 24h timer.
- [ ] Test against staging Synapse: create → list user devices → confirm dehydrated device is present and (if §7.4 → option (a)) cross-signed.

### Phase 4 — Integration hooks + UIFeature flag (week 7)

- [ ] Add `UIFeature.VerjiLegacyDehydration` per the four-edit pattern (§7.5).
- [ ] Add the post-login hook in [src/Lifecycle.ts](../../src/Lifecycle.ts).
- [ ] Gate `initialiseDehydration()` in [src/utils/device/dehydration.ts](../../src/utils/device/dehydration.ts).
- [ ] Add the module to [build_config.verji.yaml](../../build_config.verji.yaml).
- [ ] Verify `yarn lint && yarn test` clean in `element-web-v2/`.
- [ ] Verify the existing MSC3814 trigger does NOT run when the flag is on (no double-creation).

### Phase 5 — Staging soak (week 8)

- [ ] Deploy to Verji staging with the flag enabled.
- [ ] Edge-case matrix:
  - Server returns 404 on first GET (fresh user) → create succeeds.
  - Server returns existing device → rehydrate + claim succeeds.
  - Server returns malformed pickle → graceful failure, no client crash.
  - OTKs exhausted on dehydrated device → re-dehydration recovers.
  - User logs out and back in → no duplicate dehydrated devices.
- [ ] Confirm bundle size delta (target: <300 KB additional gzip).
- [ ] Confirm a single `olm.wasm` in the final bundle (§7.4 question 3).
- [ ] Add monitoring/telemetry for rehydrate success/failure rates (per §13 question 3).

### Phase 6 — Production cutover + 30-day soak (week 9–10)

- [ ] Roll the flag on per-tenant for a controlled subset, then full Verji production.
- [ ] 30-day soak period before declaring stable.
- [ ] Document the **decommission criteria** for when MSC3814 lands in Synapse: which `.well-known` advertisement to expect, which integration test must pass on the upstream Rust path, and the exact PR shape for removal.

## 12. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| libolm CVE during bridge | Low–Medium | Medium | Pinned olm version; module is opt-in and removable in one PR if a fix is unavailable |
| Synapse-side change breaks MSC2697 endpoint behaviour | Low | High (silent decryption failures) | Contract tests against deployed Synapse run weekly; alerting on rehydrate-failure-rate metric |
| Cross-signing question (§7.4 Q1) blocks the create path | Medium | Medium | Phase 2 ships rehydrate-only; create gated until decision; (b) "skip signing" is always available as fallback |
| Bundle size regression breaks low-end devices | Low | Low–Medium | Dynamic-import the module on first use |
| Module publish pipeline auth | Medium | Low | Copy the proven `publish-v2.yaml` shape from another `@verji/*` module; verify NODE_AUTH_TOKEN in install step ([feedback_workflow_install_auth.md](../../../../../.claude/projects/c--dev-fresh-fork/memory/feedback_workflow_install_auth.md)) |
| Two `olm.wasm` copies in final bundle | Medium | Low (size only) | Phase 5 build-time check |
| MSC3814 lands in Synapse mid-bridge → ambiguous state | Medium | Low | Flag fully short-circuits MSC3814 trigger; per-deployment ops flag flip when ready |
| Verji tech-debt accumulates because the bridge "works fine" and MSC3814 deprioritized indefinitely | Medium | Medium (long-term) | Quarterly leadership review of MSC3814 server roadmap; the module is intentionally visible (not hidden behind a default-on flag) |
| Engineering treats this PRD as a permanent solution | Low–Medium | High (long-term) | Decommission criteria documented in Phase 6; module repo named `legacy-` to signal intent |

## 13. Open questions

1. **Cross-signing of newly-created dehydrated devices** (§7.4 Q1). Must be resolved before Phase 3.
2. **Periodic rotation cadence.** Legacy used a coarse timer; what does Verji want — every N hours, every login, on key-changed events?
3. **Telemetry.** Do we log success/failure of rehydrate, and where? Suggest: extend Verji's existing logging (Freshworks/Sentry) with a `verji.legacy_dehydration.{rehydrate,create,rotate}` event.
4. **Migration of pre-existing dehydrated devices.** Existing v1.11.68 users may already have a dehydrated device on the server. Does v2 with this flag rehydrate it once and then create a fresh one, or does it recreate from scratch ignoring the old one? Recommendation: rehydrate first (preserves any pending to-device messages), then re-dehydrate.
5. **Rust MSC3814 path interaction.** If the homeserver ever advertises both, does the flag fully suppress MSC3814 attempts? Confirm via inspection of [src/utils/device/dehydration.ts](../../src/utils/device/dehydration.ts) gate.
6. **Test coverage strategy.** Real-Synapse-via-docker vs mocked HTTP? Verji's existing test conventions favor mocked; for the protocol round-trip, recommend a small docker-Synapse integration test set in CI to catch wire-format drift.
7. **Should the legacy-dehydration module be loaded on non-Verji deployments?** Default is no (flag default `false` → unused → tree-shake-able), but the module bundle is still in the build artefact. Acceptable, or do we want a build-time exclusion?

## 14. Decision log

> _To be filled in once the recommendation is accepted/modified/rejected._
>
> - [ ] Accepted as written
> - [ ] Accepted with modifications: _______________
> - [ ] Rejected — alternative direction: _______________
>
> **Cross-signing decision (§7.4 Q1):** _______________
> **Decided by:** _______________
> **Decision date:** _______________
