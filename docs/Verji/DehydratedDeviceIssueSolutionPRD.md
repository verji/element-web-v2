# PRD — Recommended Solution for the Dehydrated Device Issue

> **Status:** Draft for review
> **Author:** Engineering
> **Date:** 2026-04-30
> **Synthesizes:** [DehydratedDeviceIssue.md](DehydratedDeviceIssue.md), [DehydratedDeviceIssueRollbackClientSolutionPRD.md](DehydratedDeviceIssueRollbackClientSolutionPRD.md), [DehydratedDeviceIssueEmbraceUpgradeSolutionPRD.md](DehydratedDeviceIssueEmbraceUpgradeSolutionPRD.md), [DehydratedDeviceIssueSupportLegacyDehydrationSolutionPRD.md](DehydratedDeviceIssueSupportLegacyDehydrationSolutionPRD.md)

## Executive Summary

**Recommendation: a three-stage path that begins with the Legacy Dehydration Module on `element-web-v2`.**

1. **Stage 1 — Ship now (8–10 weeks).** Build `@verji/verji-legacy-dehydration-module` per the Legacy PRD: a userland module that talks MSC2697 to Verji's existing Synapse v1.94.0 and feeds extracted megolm keys into Rust crypto via `importRoomKeys()`. Gate behind `UIFeature.VerjiLegacyDehydration`. This unblocks the `element-web-v2` migration with no Synapse dependency, preserves the four-month absorption work, keeps the SSO-only UX, and protects all existing 1.11.68 dehydrated devices on the server.

2. **Stage 2 — Server upgrade (parallel, server-team owned).** Plan and execute Synapse upgrade from v1.94.0 to a release that supports MSC3814 (≥1.106). Treat as an independent server workstream; Stage 1 carries production while it lands.

3. **Stage 3 — Embrace MSC3814 + remove the bridge.** Once Synapse advertises `org.matrix.msc3814` in `.well-known`, execute the Embrace PRD's wiring + drain plan (W2/W3/W4 from that PRD), then flip `UIFeature.VerjiLegacyDehydration` off and remove the legacy module in one PR.

**Why this path.** It is the only one that satisfies all five user priorities simultaneously: existing dehydrated devices keep working (Stage 1's protocol is identical to today's); the migration moves forward in weeks rather than quarters (no Synapse blocker); the server upgrade and client embrace happen in controlled stages with the legacy module as a safety net; and the end state is full upstream alignment on Rust + MSC3814. The pure Rollback recommendation explicitly does *not* move forward, and the pure Embrace recommendation is structurally blocked on a multi-quarter Synapse upgrade. The Legacy Module is the bridge that makes Embrace tractable.

---

## 1. Problem recap (one paragraph)

`element-web-v2` (1.11.88, Rust-only) cannot do dehydrated devices against Verji's deployed Synapse. Three independent layers conspire: (1) Verji's `getDehydrationKey` callback is dead code on Rust crypto; (2) Rust crypto's MSC3814 manager owns its own random key, not the SSO key Verji injects; (3) Synapse v1.94.0 implements only MSC2697, not MSC3814. Result on v2: no rehydration of legacy ghosts, no creation of new ghosts, permanent UTDs on offline-delivered keys. Full causal analysis in [DehydratedDeviceIssue.md](DehydratedDeviceIssue.md).

## 2. The three proposals at a glance

| Proposal | What it does | Ships v2? | Synapse change? | Touches crypto-critical code? |
|---|---|---|---|---|
| **Rollback** ([PRD](DehydratedDeviceIssueRollbackClientSolutionPRD.md)) | Stay on `element-web/` 1.11.68; backport security patches; pause v2 migration. | No | No | No |
| **Embrace** ([PRD](DehydratedDeviceIssueEmbraceUpgradeSolutionPRD.md)) | Wire MSC3814 into v2; drain legacy ghosts before cutover; full upstream alignment. | Yes | **Yes (required)** | Yes (new wiring at safety-critical layer) |
| **Legacy-on-new** ([PRD](DehydratedDeviceIssueSupportLegacyDehydrationSolutionPRD.md)) | Keep v2; add a Verji userland module that re-implements MSC2697 against existing Synapse; sandbox libolm. | Yes | No | Sandboxed (libolm in userland, not re-attached to MatrixClient) |

## 3. Deep evaluation

Each option is scored across seven vectors. Where the source PRD provides numbers, those are used; gaps are filled with engineering estimates and called out as such.

### 3.1 Time and resource cost

| Option | Up-front engineering | Ongoing during bridge | Cost when bridge ends |
|---|---|---|---|
| **Rollback** | ~0 weeks (production already runs) | 0.25–0.5 FTE backports, weekly cadence | **High** — replay backports onto v2, then ~73-commit port queue resumes; growing conflict cost |
| **Embrace** | 3–6 engineer-weeks client (W2 + W3 + W4 drain) | Server-team owns Synapse MSC3814 work in parallel; client code waits idle | Low — already at upstream parity |
| **Legacy-on-new** | 8–10 engineer-weeks (new module, libolm round-trip, integration hooks, soak) | Low — own MSC2697 client correctness, but the protocol is frozen | Low — delete module + 2 hooks, ~1 PR |

**The hidden cost in Rollback** is the strategic tax: every week on 1.11.68 is a week of `@verji/*` modules and upstream Element drift, and a week of the four-month absorption work sitting unused. The Rollback PRD itself flags this — Option B's "12-month conflict-cost ceiling" is real.

**The hidden cost in Embrace** is the Synapse upgrade itself: v1.94.0 → ≥1.106 spans ~12 minor versions, schema migrations, possible breaking config changes, and a separate workstream that's not under the client team's control. None of the source PRDs costs this in detail; treat it as **months of server engineering**, not weeks. Stage 1's job is to remove the dependency on this timeline from production rollout.

**The hidden cost in Legacy-on-new** is the open technical questions in §7.4 of that PRD: cross-signing, AES envelope helpers, libolm bridge reuse vs reimplement. These are real risks to schedule slip; phase 2 of that PRD (megolm extraction → `importRoomKeys`) is the gating engineering test.

### 3.2 Risk — categorized

| Category | Rollback | Embrace | Legacy-on-new |
|---|---|---|---|
| **Crypto correctness risk** | None — exact code path runs in production | Medium — new wiring at safety-critical layer; 4S race conditions during init | Low–Medium — userland libolm sandboxed, output funneled through one typed `importRoomKeys` call; not re-attached to `MatrixClient` |
| **Message-loss risk during cutover** | None (no cutover) | **High without drain, Low with proper drain** — drain is non-trivial coordination (Strategy A patch + Strategy B server script) | Low — protocol unchanged; existing ghosts continue to be served by the same endpoints |
| **Security CVE exposure** | High and growing — every upstream CVE published since Apr 2024 unpatched unless backported | Low — on upstream | Low–Medium — `@matrix-org/olm` in maintenance mode; libolm CVE risk bounded by bridge length |
| **Coordination/dependency risk** | Tied to Synapse roadmap by recommendation D framing | **Critically tied to Synapse** — cannot ship without it | None — Verji-private, ships independently |
| **Upstream divergence cost** | Grows weekly | Lowest at end-state | Two integration hooks + one module entry; well-marked with `// VERJI` |
| **Reversibility if wrong** | Easy (resume migration) | Medium (UIFeature flag for a quarter) | High (single PR removes module) |

The headline finding: **Embrace's drain (Strategy A + B from that PRD) is the highest-stakes engineering work in any option**. The user's "messages here need to still be decryptable, and work reliably" priority makes the drain a hard requirement that adds weeks of careful coordination work — patching the legacy 1.11.68 client, building per-user feature gates, server-side admin tooling. Stage 1 sidesteps this entirely because it preserves the existing protocol.

### 3.3 Probability of success

Engineering judgement, not measured:

| Option | P(meets requirements) | Dominant failure mode |
|---|---|---|
| Rollback | ~95% short-term, ~50% beyond 12 months | matrix-js-sdk eventually deletes legacy `Crypto` source; bridge ceiling hit |
| Embrace | ~70% within 6 months, conditional on Synapse | Synapse upgrade slips; or drain misses inactive users → support tickets and message loss |
| Legacy-on-new | ~80% within 10 weeks | Cross-signing question (§7.4 Q1) blocks `createOrRotate`; fallback is rehydrate-only — still useful, but partial |

**Composite path (recommended) success**: ~85%. Stage 1 carries Stage 3 — even if Embrace stalls, production is fine.

### 3.4 Move-forward index

A direct read of priority #2 ("we want to move forward"):

| Option | Ships v2 | Catches up on absorption work | Customer-visible feature parity with upstream Element | Honest "forward" rating |
|---|---|---|---|---|
| Rollback | ✗ | ✗ (paused) | ✗ (drifts further) | **0/3** |
| Embrace | ✓ (after Synapse) | ✓ | ✓ | **3/3 — eventually** |
| Legacy-on-new | ✓ (8–10 weeks) | ✓ | ✓ | **3/3 — soon** |
| **Composite** | ✓ Stage 1 | ✓ Stage 1 | ✓ Stage 1 | **3/3 — soon, with cleanup later** |

### 3.5 Alignment with the Synapse v1.94.0 reality

This is the dimension the source PRDs underweight. Synapse v1.94.0 is from October 2023. Server-side MSC3814 lands around Synapse 1.106. That's ~12 minor versions of accumulated schema migrations, config surface changes, and operational risk to absorb. **Pure Embrace is structurally blocked on this** — and the Embrace PRD candidly notes this as the "gating dependency" but does not estimate the work.

| Option | Tolerates current Synapse? |
|---|---|
| Rollback | ✓ (no v2) |
| Embrace | ✗ — blocks until Synapse ≥1.106 with `experimental_features.msc3814_enabled` and `.well-known` advertisement |
| Legacy-on-new | ✓ — by design |

This vector alone is sufficient to recommend Stage 1 as the entry point regardless of the long-term direction.

### 3.6 Strategic / opportunity cost

| Option | Cost of not picking the others |
|---|---|
| Rollback | Every quarter on 1.11.68 makes the eventual catch-up harder; module ecosystem fragments; engineers lose context on the new stack |
| Embrace | Without Stage 1 as a bridge, production carries dehydration breakage during the entire Synapse upgrade window — unacceptable per priority #1 |
| Legacy-on-new | Owning a custom MSC2697 implementation creates ongoing maintenance, but bounded by bridge horizon |
| **Composite** | Highest one-time investment, lowest accumulated drift |

### 3.7 Reversibility

| Option | Effort to abandon if wrong |
|---|---|
| Rollback | Trivial — resume v2 migration |
| Embrace | Medium — UIFeature flag stays for a quarter; if a critical bug surfaces, flip flag and patch |
| Legacy-on-new | Trivial — flip flag, remove module entry from `build_config.verji.yaml`, ~1 PR |
| **Composite** | Stage 1 is fully reversible; Stage 3 inherits Embrace's reversibility |

## 4. Comparison matrix

| Criterion | Rollback | Embrace | Legacy-on-new | Composite (recommended) |
|---|---|---|---|---|
| Up-front engineering | Low | Medium (3–6 wk) | High (8–10 wk) | High (Stage 1 = Legacy) |
| Ongoing cost during bridge | Medium (backports) | Low | Low–Medium | Low–Medium |
| Crypto-correctness risk | None | Medium | Low–Medium | Low–Medium → Medium at Stage 3 |
| Message-loss risk | None | High w/o drain | Low | Low → managed via drain at Stage 3 |
| Synapse dependency to ship | None | **Hard blocker** | None | None for Stage 1; required for Stage 3 |
| Ships v2 in 2026 | ✗ | Conditional | ✓ | ✓ |
| Preserves 1.11.68 dehydration semantics | ✓ | After drain | ✓ | ✓ |
| Path to upstream parity | Long, painful | Direct | Via Stage 3 | **Yes, staged** |
| Reversibility | Easy | Medium | Easy | Easy at each stage |
| Aligns with all 5 user priorities | 2/5 | 3/5 (blocked on server) | 4/5 | **5/5** |

## 5. Recommendation

**Adopt the composite three-stage path.**

### Stage 1 — Ship the Legacy Dehydration Module on `element-web-v2`

Execute the [Legacy PRD](DehydratedDeviceIssueSupportLegacyDehydrationSolutionPRD.md) as written, with these emphases:

- **Phase ordering matters.** Land `rehydrate()` first (Phase 2 of that PRD); only ship `createOrRotate()` after the cross-signing decision (§7.4 Q1) is resolved. Rehydrate-only is already enough to protect existing 1.11.68 dehydrated devices on day one.
- **Default `UIFeature.VerjiLegacyDehydration` to `false`.** Verji production sets it `true` via `config.json`; non-Verji deployments and CI see no behavioural change.
- **Bound the bridge horizon explicitly.** Document Stage 3 as the exit path in the module's README — the legacy module is intentionally named and structured for removal.

Estimated 8–10 weeks. Unblocks v2 migration. No Synapse work required.

### Stage 2 — Synapse upgrade (parallel server workstream)

Server team plans and executes Synapse v1.94.0 → ≥1.106 with `experimental_features.msc3814_enabled` and `.well-known: { "org.matrix.msc3814": true }`. Out of scope for client engineering, but tracked as the precondition for Stage 3.

This stage runs **in parallel** with Stage 1 and continues after Stage 1 ships. Production is not blocked on this work because Stage 1 is carrying it.

### Stage 3 — Embrace MSC3814, then delete the bridge

When staging Synapse advertises `org.matrix.msc3814` and `crypto.isDehydrationSupported()` returns `true`:

1. Execute the [Embrace PRD](DehydratedDeviceIssueEmbraceUpgradeSolutionPRD.md) workstreams W2 (client wiring) and W3 (cryptosetup module v2) as written.
2. **Skip W4 Strategy A (legacy 1.11.68 drain patch)** — because Stage 1 has been keeping all users on a working dehydration path on v2, the legacy 1.11.68 fleet is no longer the primary source of pending to-device events. Instead, run W4 Strategy B (server-side sweep) once, plus a coordinated final rehydrate via the legacy module before the cutover. This is materially simpler than the Embrace PRD's drain because Stage 1 already collapsed the population onto a single client codebase.
3. Per-user staged rollout (Phase 4 of Embrace PRD): 5% → 25% → 100% with `UIFeature.DehydratedDevices` (new MSC3814 flag) replacing `UIFeature.VerjiLegacyDehydration`.
4. After 30 days at 100%: delete `verji-legacy-dehydration-module` from `build_config.verji.yaml`, remove its two integration hooks, remove the `VerjiLegacyDehydration` UIFeature, archive the module repo. Single PR per the Legacy PRD's exit plan.

Estimated 4–8 weeks of client work once Synapse is ready. Drain risk is materially reduced compared to the Embrace PRD's "naive cutover from 1.11.68" framing.

## 6. Why each pure option is rejected

- **Pure Rollback**: violates priority #2 ("move forward"). The four-month absorption effort sits unused; module ecosystem fragments; the eventual catch-up grows monotonically harder. Defensible only if Stage 1 is impossible — and Stage 1 is well-specified by the Legacy PRD.
- **Pure Embrace**: structurally blocks on a multi-quarter Synapse upgrade. During that window, dehydration is broken on v2 — violating priority #1. The drain (Strategy A + B from the Embrace PRD) is the most coordination-heavy work in any option, and is materially simpler when Stage 1 has already homogenized the client fleet.
- **Pure Legacy-on-new**: leaves Verji on a custom MSC2697 path indefinitely. The Legacy PRD itself names this risk ("Engineering treats this PRD as a permanent solution"). Without Stage 3 explicitly planned, the bridge becomes the destination.

## 7. Critical files (Stage 1 — read first)

For implementation in Stage 1, the must-read files are documented in detail in the Legacy PRD §7. The shortlist:

- New module: `verji-legacy-dehydration-module/` (alongside existing `@verji/*` modules; mirror [verji-cryptosetup-module/](../../../verji-cryptosetup-module/) structure).
- Reference (deprecated, do not invoke): [matrix-js-sdk-v2/src/client.ts:1650-1791](../../../matrix-js-sdk-v2/src/client.ts#L1650-L1791), [matrix-js-sdk-v2/src/crypto/dehydration.ts](../../../matrix-js-sdk-v2/src/crypto/dehydration.ts).
- Bridge target: [matrix-js-sdk-v2/src/crypto-api/index.ts:139](../../../matrix-js-sdk-v2/src/crypto-api/index.ts#L139) (`importRoomKeys`).
- Integration hooks (two files, marked `// VERJI`): [src/Lifecycle.ts](../../src/Lifecycle.ts), [src/utils/device/dehydration.ts](../../src/utils/device/dehydration.ts).
- UIFeature flag (four-edit pattern from [CLAUDE.md](../../../CLAUDE.md)): [src/settings/UIFeature.ts](../../src/settings/UIFeature.ts), [src/settings/Settings.tsx](../../src/settings/Settings.tsx), [docs/Verji/VerjiConfig.md](VerjiConfig.md), `config.verji.samlple.json`.
- Module installer: [build_config.verji.yaml](../../build_config.verji.yaml).

## 8. Risks of the composite path (and mitigations)

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Stage 1 cross-signing question (§7.4 Q1 of Legacy PRD) blocks `createOrRotate` | Medium | Medium | Ship rehydrate-only first; revisit `createOrRotate` after Phase 2 evidence |
| Stage 2 Synapse upgrade slips beyond 12 months | Medium | Medium | Stage 1 carries production; ongoing libolm CVE surface bounded by quarterly review |
| `@matrix-org/olm` CVE during the bridge | Low–Medium | Medium | Module is opt-in and removable in 1 PR; pin olm version; add CVE-watch to weekly upstream scan |
| Stage 3 cutover finds residual 4S incompleteness in production accounts | Low–Medium | High | Audit a sample of accounts before cutover; cryptosetup v2 can perform missing 4S setup at first v2 login per Embrace PRD §11 contingency |
| Stage 1 ships and Stage 3 is forgotten ("the bridge works fine") | Medium | Medium (long-term) | Quarterly leadership review; module repo named `legacy-`; decommission criteria documented at module README |
| Two `olm.wasm` copies in final bundle | Medium | Low (size only) | Build-time verification per Legacy PRD Phase 5 checklist |
| Customer pressure to skip Stage 3 once Stage 1 stabilizes | Medium | Medium | Surface the legacy module's CVE-exposure metric quarterly; tie removal to Synapse upgrade milestone, not feature work |

## 9. Open questions before implementation

1. **Engineering capacity for Stage 1.** 8–10 weeks against current roadmap — confirm slot.
2. **Synapse v1.94 → ≥1.106 upgrade plan.** Is server team scoped/staffed? What's the realistic landing window? Stage 3 timing flows from this answer.
3. **Cross-signing decision** (Legacy PRD §7.4 Q1). Resolve before Stage 1 Phase 3.
4. **User-targeting feature-flag infrastructure.** Stage 3's Phase 4 wants per-user staged rollout. If unavailable, fall back to percentage-based per Embrace PRD risk mitigation.
5. **Snapshot of MSC2697 ghost-device population.** Pull from Synapse before Stage 1 ships — sets the actual blast radius for both stages.
6. **Telemetry plan.** `verji.legacy_dehydration.{rehydrate,create,rotate}` events plus per-user UTD counter with cohort tags. Confirm pipeline (Sentry/Freshworks/other).

## 10. Decision log

> _To be filled in once the recommendation is accepted/modified/rejected._
>
> - [ ] Accepted as written
> - [ ] Accepted with modifications: _______________
> - [ ] Rejected — alternative direction: _______________
>
> **Stage 1 start date:** _______________
> **Synapse upgrade target window:** _______________
> **Decided by:** _______________
> **Decision date:** _______________
