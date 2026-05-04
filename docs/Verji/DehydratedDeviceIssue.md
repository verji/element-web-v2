# Dehydrated Device Issue — Verji on element-web-v2

## HUMAN NOTE::
- Current plan is to leave element-web-v2 in its current state (v1.11.88)
- We won't handle this issue now, we want to move forward, so in order to solve this "correctly", we have to upgrade synapse etc, and potentially finish the safety nets we gain from finishing up roomkey-store. 
- We instead are going to continue developing 1.11.68 (Pre element-web absorbed)

## TL;DR

Dehydrated devices do not work in `element-web-v2` (the new Rust-crypto-only base, element-web 1.11.88). Verji depends on dehydrated devices to ensure users can decrypt messages that arrive while their devices are offline. The breakage is caused by three independent, mutually-reinforcing layers of incompatibility — client, SDK, and server — all triggered by upstream Element/Matrix retiring the legacy libolm dehydration spec (MSC2697) in favor of the Rust-only MSC3814 spec. **Users on `element-web-v2` will lose the ability to receive room keys and decrypt messages delivered while they were offline.**

## Why dehydrated devices matter to Verji

A dehydrated device is a server-side "ghost" device that holds an encrypted, at-rest copy of a user's Olm sessions. When a user is offline and another participant sends a room key (e.g., joining a new encrypted room, key rotation), the sender's client encrypts the key for every recipient device — including the dehydrated one. When the user returns online and logs into a real device, that real device "rehydrates" the ghost: it decrypts the dehydrated device using a known key, and pulls down the to-device messages (including the room keys) that were sent to the ghost while the user was away.

Without rehydration, those room keys are lost, and the affected encrypted messages become permanently undecryptable on the user's new session — the classic "Unable to decrypt" placeholder.

For Verji this is not a tolerable degradation. Users routinely log in fresh, switch devices, or come back online after extended periods, and they must be able to read encrypted history and recently-delivered messages. The whole point of Verji's SSO + auto-encryption-setup design is to make this seamless.

## How dehydration is wired today (legacy stack — element-web 1.11.68)

Verji's design assumes the SSO login response provides a `secure_backup_key`, and that *the same key* is reused as the dehydration key. The flow:

1. SSO completes → IdP returns `secure_backup_key` in the login response.
2. [verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx:21-27](../../../verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx#L21-L27) — `examineLoginResponse()` extracts the key into `credentials.secureBackupKey`.
3. [verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx:28-34](../../../verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx#L28-L34) — `persistCredentials()` writes it to `localStorage["mx_secure_backup_key"]`.
4. [verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx:86-95](../../../verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx#L86-L95) — `getDehydrationKeyCallback()` returns a callback that resolves to that same key.
5. [src/MatrixClientPeg.ts:452-456](../../src/MatrixClientPeg.ts#L452-L456) — that callback is wired into `MatrixClient.cryptoCallbacks.getDehydrationKey`.
6. The legacy `MatrixClient.rehydrateDevice()` path consults `cryptoCallbacks.getDehydrationKey` to obtain the unwrap key and rehydrates the ghost device — pulling down its pending to-device messages.

Same key for 4S and dehydration. One SSO trip, no passphrase prompt, no separate key management. This is the contract Verji is built on.

## What changed upstream

Three changes in `element-web` between 1.11.68 (Apr 2024) and 1.11.88 (Dec 2024) collectively retired this design:

| Version | Date | Change | Source |
|---|---|---|---|
| 1.11.58 | 2024-02-13 | Rust crypto became the default backend | [CHANGELOG.md:676](../../CHANGELOG.md#L676) |
| 1.11.70 | 2024-07-08 | Legacy crypto fallback removed; Rust forced for all logins | [CHANGELOG.md:383](../../CHANGELOG.md#L383) (matrix-react-sdk#12630) |
| 1.11.88 | 2024-12-17 | `Features.RustCrypto` flag deleted entirely | [CHANGELOG.md:10](../../CHANGELOG.md#L10) (element-web#28582) |

In matrix-js-sdk, the legacy MSC2697 dehydration entry points were marked deprecated and disconnected from the Rust backend:

- [matrix-js-sdk-v2/src/client.ts:1651](../../../matrix-js-sdk-v2/src/client.ts#L1651) — `MatrixClient.rehydrateDevice()` is annotated `@deprecated MSC2697 device dehydration is not supported for rust cryptography`.
- A new Rust-native dehydration path (MSC3814) was added: [matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts](../../../matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts).

There is no fallback. `element-web-v2` is Rust-only, and Rust crypto does not implement MSC2697 at all.

## The three layers of incompatibility

### Layer 1 — Client wiring is dead on the new stack

The `getDehydrationKey` callback that the verji-cryptosetup-module installs is no longer consulted by Rust crypto. It is set on `cryptoCallbacks.getDehydrationKey` ([src/MatrixClientPeg.ts:452-456](../../src/MatrixClientPeg.ts#L452-L456)) but the only code path that reads that callback is the deprecated `MatrixClient.rehydrateDevice()` ([matrix-js-sdk-v2/src/client.ts:1680](../../../matrix-js-sdk-v2/src/client.ts#L1680)) — which is not invoked from anywhere in `element-web-v2/src/`.

Corroborating dead-code marker already present in the source:

- [src/SecurityManager.ts:162](../../src/SecurityManager.ts#L162) — `// VERJI - Dead code?` above `getDehydrationKey()`. Confirmed dead on Rust.

So even though the module looks correctly wired and the SSO key is sitting in `localStorage`, nothing in Rust crypto ever asks for it.

### Layer 2 — Rust crypto's dehydration design uses a *different* key

`DehydratedDeviceManager.getKey()` does not consult any callback. It reads only from server-side secret storage:

- [matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts:169-182](../../../matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts#L169-L182) — `getKey()` calls `secretStorage.get("org.matrix.msc3814")`.
- [matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts:155-160](../../../matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts#L155-L160) — `resetKey()` generates a *random 32-byte* key, stores it in 4S, and uses it as the dehydration key.

The Rust design is:

| Key | Purpose | Source |
|---|---|---|
| 4S master key (`mx_secure_backup_key`) | Decrypt 4S entries | Verji SSO response |
| Dehydration key | Encrypt/decrypt dehydrated device | Random; stored *inside* 4S under name `org.matrix.msc3814` |

So even if Verji wanted the SSO-supplied key to be the dehydration key, there is no API surface for the cryptosetup module to inject it. The Rust manager owns key creation internally, and its key is intentionally distinct from any caller-supplied key.

A side-effect of this is that Verji's pre-existing dehydrated devices on the server (created under MSC2697 with the SSO key) cannot be rehydrated by the new client even in principle — wrong key, wrong endpoint, wrong spec.

### Layer 3 — Verji's Synapse does not support the new spec

The Rust manager talks to MSC3814 endpoints under the unstable prefix:

- [matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts:47](../../../matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts#L47) — `UnstablePrefix = "/_matrix/client/unstable/org.matrix.msc3814.v1"`.

Detection happens on first call: if the server returns `M_UNRECOGNIZED`, `isSupported()` returns `false` ([DehydratedDeviceManager.ts:104-105](../../../matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts#L104-L105)) and dehydration is silently disabled.

Verji's deployed Synapse predates MSC3814 support and only implements the MSC2697 endpoints. Result: even on a clean install with Rust + MSC3814 design, the client would observe "dehydration unsupported" and never create or rehydrate a device.

## What this means in practice

Combining the three layers, the failure modes for users on `element-web-v2`:

| Scenario | Outcome on `element-web-v2` |
|---|---|
| User logs in fresh (SSO) | No dehydrated device is created. Future offline-delivered keys cannot be retrieved. |
| User had a dehydrated device created by a 1.11.68-era client | The ghost device persists on the server but cannot be rehydrated — wrong key, wrong endpoint, wrong spec. Pending to-device messages on it are unreachable. |
| User comes back online after being offline during a key rotation in an encrypted room | Affected messages are **undecryptable** ("Unable to decrypt" UTDs). |
| User joins a new encrypted room while offline | Room key delivered to ghost only. After login, the user cannot decrypt the room's recent messages. |
| Cross-device key sharing via dehydration | Does not happen. |

The user-visible symptom is permanent UTDs on messages that the legacy client would have decrypted successfully.

## Constraints (stated as fact, not preference)

- **Dehydrated device support is required.** Loss of message decryptability for offline-delivered keys is not an acceptable regression.
- **Verji's Synapse only supports MSC2697.** Server-side support for MSC3814 is not currently available.
- **`element-web-v2` is Rust-only.** The legacy crypto code path was removed by upstream and there is no client-side flag to re-enable it ([element-web#28582](https://github.com/element-hq/element-web/pull/28582)).
- **matrix-js-sdk v35 does not implement MSC2697 on the Rust backend.** The deprecated `MatrixClient.rehydrateDevice()` exists only as a legacy entry point that is not exercised in `element-web-v2`.

## Affected files (for traceability)

Verji custom code that depends on the legacy design:

- [verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx:86-95](../../../verji-cryptosetup-module/src/VerjiCryptoSetupModule.tsx#L86-L95) — `getDehydrationKeyCallback()` returns the SSO key. Currently dead on Rust.
- [src/MatrixClientPeg.ts:452-456](../../src/MatrixClientPeg.ts#L452-L456) — wires the dead callback onto `MatrixClient.cryptoCallbacks.getDehydrationKey`.
- [src/MatrixClientPeg.ts:348](../../src/MatrixClientPeg.ts#L348) — stale `// TODO: device dehydration and whathaveyou` left during the Dec 2024 absorption; the original author flagged dehydration as unfinished here.
- [src/SecurityManager.ts:162](../../src/SecurityManager.ts#L162) — `// VERJI - Dead code?` above `getDehydrationKey()`. Confirmed dead on Rust.

Upstream code that defines the new contract:

- [matrix-js-sdk-v2/src/client.ts:1644-1790](../../../matrix-js-sdk-v2/src/client.ts#L1644-L1790) — deprecated MSC2697 entry points.
- [matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts](../../../matrix-js-sdk-v2/src/rust-crypto/DehydratedDeviceManager.ts) — full MSC3814 implementation, owns its own key, talks to unstable server endpoints.
- [src/utils/device/dehydration.ts](../../src/utils/device/dehydration.ts) — the trigger that calls into `DehydratedDeviceManager`, gated on the homeserver advertising `org.matrix.msc3814` in `.well-known`.

Out-of-scope but worth noting (orphan strings, no functional impact): [src/i18n/strings/nb_NO.json](../../src/i18n/strings/nb_NO.json) lines 2038–2043 still contain `rust_crypto_*` translation strings for a UI that has been deleted from `src/`.

## Document scope

This document describes the issue only. It does not propose a fix. Resolution will require coordinated decisions across (a) the Verji homeserver/Synapse roadmap, (b) the cryptosetup module, and (c) `element-web-v2` wiring, and is tracked separately.
