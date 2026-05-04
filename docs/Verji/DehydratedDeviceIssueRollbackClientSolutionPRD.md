# PRD — Rollback Client Solution for Dehydrated Device Issue

> **Status:** Draft for review
> **Author:** Engineering
> **Date:** 2026-04-30
> **Related:** [DehydratedDeviceIssue.md](DehydratedDeviceIssue.md)

## 1. Context

Per [DehydratedDeviceIssue.md](DehydratedDeviceIssue.md), the in-progress migration of Verji's web client from the `element-web` 1.11.68 base (`element-web/`) to the `element-web` 1.11.88 base (`element-web-v2/`) breaks dehydrated devices. The breakage spans three independent layers: (1) Verji's `getDehydrationKey` callback wiring is dead on Rust crypto; (2) Rust crypto's MSC3814 dehydration uses a different key model than Verji's MSC2697 design; (3) Verji's Synapse implements MSC2697 only, not MSC3814. Together these mean that on `element-web-v2`, users cannot rehydrate previously-dehydrated devices and cannot create new dehydrated devices — pending to-device messages (and the room keys they carry) become permanently undecryptable.

Verji has stated this is non-negotiable: users must retain the ability to receive room keys delivered while offline. The current migration cannot ship as-is.

This PRD evaluates one specific class of solution: **continuing on, or returning to, an earlier client stack where the legacy libolm crypto path and MSC2697 dehydration are still functional**. It does *not* evaluate forward-fix options (server upgrade to MSC3814, custom rust-sdk patches, alternative dehydration designs) — those belong in their own PRDs.

## 2. Problem statement

Verji needs a client that:

1. Implements MSC2697 dehydrated devices (not MSC3814).
2. Calls `cryptoCallbacks.getDehydrationKey` so the SSO-supplied `secure_backup_key` is consumed (the existing `verji-cryptosetup-module` contract).
3. Continues to receive security patches and critical bug fixes.
4. Remains buildable, testable, and shippable through Verji's existing pipelines.
5. Is compatible with Verji's currently-deployed Synapse.

`element-web-v2` (1.11.88 / matrix-js-sdk 35) does not satisfy (1) or (2). The legacy `element-web/` (1.11.68 / matrix-js-sdk 33) does — and is what production runs today.

## 3. Goals & non-goals

**Goals**

- Preserve dehydrated-device functionality and message decryptability for users.
- Provide a defensible bridge solution while Synapse MSC3814 support is being implemented (separate workstream).
- Minimize maintenance burden during the bridge period.
- Keep a clear exit path: when Synapse supports MSC3814, the migration to `element-web-v2` can resume.

**Non-goals**

- Achieving feature parity with upstream Element during the bridge period.
- Permanently abandoning the migration to `element-web-v2`.
- Solving dehydration on the new stack (covered by a separate forward-fix PRD).
- Shipping new UI features that depend on post-1.11.68 upstream changes.

## 4. The hard upstream constraint

The decision tree is shaped by one fact: **the matrix-react-sdk absorption (which `element-web-v2` is built on) shipped in element-web 1.11.86, while Rust crypto was forced for all logins back at 1.11.70**.

| Capability | Available in | Implication |
|---|---|---|
| matrix-react-sdk absorbed into element-web | ≥1.11.86 | `element-web-v2`'s monorepo structure |
| Legacy libolm crypto fully wired (`initCrypto()`) | matrix-js-sdk ≤33.x | Last working = `element-web/` stack today |
| Optional Rust crypto with libolm fallback | element-web ≤1.11.69 | Last upstream version supporting both |
| Rust-only, libolm path removed from MatrixClient | ≥1.11.70 | All upstream from here on |

**You cannot have the absorbed monorepo AND working libolm legacy crypto in any unmodified upstream release.** They are 16 versions apart on opposite sides of the legacy-crypto retirement.

This rules out any rollback option that keeps the absorbed monorepo. Any rollback solution is a return to a pre-absorption stack: `element-web` + separate `matrix-react-sdk` + `matrix-js-sdk ≤33`.

## 5. Options considered

Four rollback variants are evaluated below. All assume Verji's Synapse remains MSC2697-only for the duration of the bridge.

### Option A — Pure stay-put (no migration, freeze on 1.11.68)

Continue shipping from the existing `element-web/` (1.11.68 / matrix-js-sdk 33.0.0 / matrix-react-sdk 3.100.0) repos as-is. Cancel or indefinitely pause the `element-web-v2` migration.

**What happens to in-flight work**

- Any merged commits on `element-web-v2/verji-develop` are preserved on the branch but unused.
- The ~73 unported commits from `matrix-react-sdk/verji-develop` (PRs #103–#112) and 5 commits from `element-web/verji-develop` referenced in [ClaudeAssistedSyncVerjiElementWeb.md](../../ClaudeAssistedSyncVerjiElementWeb.md) — the four-month sync work — never lands on the new fork.
- The four open `// VERJI MERGE` TODOs from the Dec 2024 absorption become irrelevant.

**Pros**

- Zero crypto regression risk — exact code already runs in production.
- No engineering work required to preserve dehydration; the existing module wiring works today and continues to work.
- Lowest immediate effort. Frees engineers from the migration and back to feature work.
- All existing `@verji/*` modules continue to function without modification.

**Cons**

- **Security exposure grows over time.** Every upstream CVE published after April 2024 is potentially unpatched. Notable retroactive items: CVE-2024-42347 (1.11.73), CVE-2024-47080 / GHSA-4jf8-g8wp-cx7c (matrix-js-sdk 34.8.0), and any CVEs published between then and now.
- **Compounding upstream drift.** Each month away from upstream makes a future migration harder. By the time Synapse MSC3814 ships, the gap could be 30+ versions.
- **Loss of new features.** Element shipped Threads Activity Centre, pinned-message banner, new room header, MatrixRTC improvements, OIDC/MSC3861 work, etc. — all unavailable.
- **Loss of the matrix-react-sdk absorption.** The two-repo split is harder to maintain than the new monorepo.
- **Eventually impossible.** matrix-js-sdk source for legacy `Crypto` still exists in v35 but is unmaintained; future versions will delete the directory entirely. Verji's `matrix-js-sdk` git URL pin will eventually be unable to upgrade past whatever version drops legacy Crypto wholesale.
- **Module cross-version risk.** `@verji/*` modules continue to be developed; if any of them adopts `matrix-js-sdk` v35-only APIs, the legacy fork breaks.

**Verdict**: Lowest immediate risk, highest long-term cost. Acceptable only if Synapse MSC3814 support is genuinely imminent (≤3 months).

### Option B — Stay-put plus active backporting

Same as A, but with an explicit, ongoing process to backport security patches and critical bug fixes from upstream `element-web`/`matrix-react-sdk`/`matrix-js-sdk` to Verji's pinned versions.

**What this looks like operationally**

- A weekly or bi-weekly process: scan upstream changelog, identify CVE/security/critical fixes, cherry-pick to `verji-develop` on each repo, resolve conflicts, ship.
- Reject anything touching crypto (specifically: `src/crypto/*`, `src/rust-crypto/*`, `MatrixClient` crypto initialization, `cryptoCallbacks`, `SecurityManager`, `MatrixClientPeg.initClientCrypto`).
- Maintain a backport log so reviewers can verify nothing crypto-related slipped through.

**Pros**

- All of A's pros.
- Mitigates A's #1 con: security exposure is bounded.
- Provides time discipline — engineers see the maintenance cost weekly and notice when it gets out of hand.
- Preserves the option to migrate later when server is ready.

**Cons**

- **Sustained maintenance cost.** Realistically 0.25–0.5 FTE-equivalent ongoing, plus spikes when complex CVEs require deep merges.
- **Cherry-pick conflicts grow over time.** A patch from element-web 1.12.x landing on a 1.11.68 base will increasingly require manual reconstruction.
- **Scope creep risk.** "Just one more feature" — the temptation to backport non-security improvements turns the legacy fork into a long-tail product line.
- **Same eventual ceiling as A** (matrix-js-sdk legacy Crypto deletion) — backporting buys time but doesn't change the outcome.
- **Module fragmentation.** Some `@verji/*` modules may need backward-compatible branches if newer modules consume v35-only APIs.

**Verdict**: The disciplined version of A. Fits a 6–12 month bridge cleanly. Beyond 12 months, backport conflict cost dominates.

### Option C — Hybrid hard-fork (stay on 1.11.86+ structure but revert crypto changes)

Keep the `element-web-v2` (1.11.88 / monorepo) base, but maintain Verji-private reverts of the commits that removed legacy crypto. Specifically:

- Revert element-web#28582 (`Features.RustCrypto` flag deletion).
- Revert matrix-react-sdk#12630 (forced Rust crypto for all logins).
- Revert matrix-js-sdk-side commits that disconnected `initCrypto()` from MatrixClient (multiple PRs across v34.x).
- Keep `cryptoCallbacks.getDehydrationKey` wired to the legacy code path.

Effectively: take the absorbed monorepo, back out ~6 months of crypto retirement work.

**Pros**

- Keeps the new monorepo structure (the upstream direction of travel).
- Keeps the absorption work that's already been done on `element-web-v2/verji-develop` (~73 unported commits' worth of effort partially preserved).
- Most of the post-1.11.70 features become available — only crypto modernization is reverted.

**Cons**

- **Massive engineering effort up front.** Every crypto-related upstream commit between matrix-js-sdk v33 and v35 must be examined and selectively reverted/preserved. The legacy `Crypto` code in v35's `src/crypto/` is unmaintained — making it work again means re-wiring its callsites that were systematically removed.
- **Verji becomes a hard-fork of three projects** (matrix-js-sdk, element-web, matrix-react-sdk-equivalent). Every subsequent upstream change has to be manually replayed onto a divergent base.
- **Crypto correctness risk.** The reverts touch the most safety-critical part of the codebase. A subtle bug in re-wiring legacy Crypto in v35 could cause silent decryption failures, key-loss, or worse — categories of bug that don't fail loudly in tests.
- **Highest CVE exposure.** Crypto CVEs in the modern Element/matrix-js-sdk are fixed in Rust crypto. A Verji fork re-enabling libolm legacy crypto inherits any libolm CVE that upstream stopped backporting.
- **Module layer complexity.** The `verji-cryptosetup-module` contract works on legacy crypto; on the hybrid fork it would need to detect which crypto backend is active and adapt (or refuse one).
- **No clear exit ramp.** Rolling these reverts back out (when Synapse MSC3814 is ready) is its own multi-week project.

**Verdict**: Highest engineering investment, highest risk surface, in a security-critical area. Inferior to B in almost every dimension. Would only make sense if there were a feature in 1.11.86–88 that Verji absolutely needed *and* couldn't backport to 1.11.68.

### Option D — Defer the migration; bundle it with the Synapse upgrade

Recognize that the dehydration issue is fundamentally a server-side problem (Synapse lacks MSC3814) and that fixing it client-only on the new stack is impossible. Pause the `element-web-v2` migration entirely; treat it as blocked on Synapse MSC3814 support; resume only when Synapse is ready.

This is operationally the same as Option B (stay on 1.11.68 with backports during the bridge), but with explicit framing: the bridge is short and ends at the Synapse cutover.

**Pros**

- Honest about the actual dependency. The client migration unblocks the moment the server does.
- Aligns engineering effort: server and client teams have a shared milestone (MSC3814 in Synapse → unblock client migration).
- Avoids investing in any rollback/revert work that gets thrown away.
- Same pros as B during the bridge.

**Cons**

- **Hard dependency on the Synapse roadmap.** If MSC3814 in Synapse slips by a year, the bridge becomes long enough to hit Option B's 12-month conflict-cost ceiling.
- **Requires a credible Synapse plan.** Deferring without a target date is just Option A in disguise.
- **Doesn't decouple workstreams.** Client engineers can't make independent progress on the new stack.

**Verdict**: This is the right framing if Synapse MSC3814 is realistically 3–9 months out. If the Synapse path is uncertain, B is safer because it doesn't tie itself to the server timeline.

## 6. Comparison matrix

| Criterion | A: Stay-put | B: Stay-put + backport | C: Hybrid hard-fork | D: Defer + bundle |
|---|---|---|---|---|
| Dehydration works | ✓ | ✓ | ✓ | ✓ |
| Up-front effort | None | Low | **High** | Low |
| Ongoing cost | None | Medium | **High** | Medium |
| Security exposure | **High** | Low–Medium | High (crypto) | Low–Medium |
| Crypto-safety risk | None | None | **Highest** | None |
| Preserves absorption work | No | No | Yes | No |
| Reversibility (when server ready) | Easy | Easy | Hard | Easy |
| Upstream catch-up cost later | **Highest** | High | Medium | High |
| Realistic bridge length | <3 months | 6–12 months | 12+ months | Tied to server roadmap |

## 7. Recommendation

**Option D, executed as Option B during the bridge.**

Frame the bridge as a server-blocked deferral, not a permanent rollback:

1. **Pause the `element-web-v2` migration.** Stop porting commits onto `element-web-v2/verji-develop`. Document the pause in [ClaudeAssistedSyncVerjiElementWeb.md](../../ClaudeAssistedSyncVerjiElementWeb.md) with the dehydration issue cited as the blocker. Tag the current `verji-develop` HEAD so the work isn't lost.

2. **Continue shipping from `element-web/` (1.11.68 base) as production.** Pin the matrix-js-sdk dependency at 33.0.0 (already so). No changes to module wiring required — dehydration continues to work.

3. **Establish a backport discipline.** Weekly review of element-web, matrix-react-sdk, and matrix-js-sdk upstream CHANGELOGs for security/critical-fix items. Backport to Verji's pinned branches. Reject any change touching `src/crypto/`, `src/rust-crypto/`, `MatrixClient` crypto init, or `cryptoCallbacks` — those are part of the architecture being preserved during the bridge.

4. **Track the server side as the unblock condition.** Synapse MSC3814 support (or a Verji-specific dehydration solution agreed with the Synapse team) is the gate that resumes the client migration. Concrete milestone: when Verji's deployed Synapse responds successfully to `GET /_matrix/client/unstable/org.matrix.msc3814.v1/dehydrated_device`, unblock the client migration.

5. **Set a review checkpoint.** At 6 months, re-evaluate. If Synapse MSC3814 is not on a credible track, the recommendation may need to shift toward investing in a forward-fix on `element-web-v2` (different PRD), since Option B's conflict cost will be approaching unmanageable.

**Why not C (hybrid)**: re-enabling legacy crypto on top of matrix-js-sdk v35 means re-wiring the most safety-critical code in the stack against a code base that has been deliberately disconnected from it for a year. The probability of introducing silent crypto bugs is high, and crypto bugs are exactly the class of bug Verji cannot afford. The "preserve the absorption work" benefit isn't worth the risk surface.

**Why not A (no backports)**: security CVEs accumulate. A 6-month bridge with no security backporting is a real exposure and not defensible.

**Why D over B**: the framing matters operationally. "Pausing until Synapse is ready" gives both teams a shared milestone and a clear exit. "Permanent rollback" doesn't.

## 8. Implementation plan (if recommendation accepted)

### 8.1 Immediate (week 1)

- [ ] Communicate decision: engineering + product. Update [ClaudeAssistedSyncVerjiElementWeb.md](../../ClaudeAssistedSyncVerjiElementWeb.md) status section.
- [ ] Tag current `element-web-v2/verji-develop` HEAD as `archive/verji-develop-pre-rollback-2026-04` so partial migration work is preserved for resumption.
- [ ] Restate `element-web/` `verji-develop` as the production branch in CI/CD docs.
- [ ] Add a CODEOWNERS or PR-template note in `element-web-v2/` warning that the repo is paused.

### 8.2 Backport process (weeks 2+)

- [ ] Define the scan: which upstream branches/changelogs are watched (element-web `master`, matrix-react-sdk `develop`, matrix-js-sdk `develop`).
- [ ] Define the rules: what gets backported (Security advisories, CVE fixes, critical correctness bugs that affect Verji-relevant flows).
- [ ] Define the rejection list: anything in `src/crypto/`, `src/rust-crypto/`, `MatrixClient.init*Crypto`, `cryptoCallbacks`, `SecurityManager`, `MatrixClientPeg.initClientCrypto`, dehydration code paths.
- [ ] Document the cherry-pick procedure in `element-web/docs/Verji/Backports.md` (new file, post-acceptance).
- [ ] Establish on-call ownership: who runs the weekly scan.

### 8.3 Server unblock conditions

- [ ] Coordinate with the Synapse team on MSC3814 implementation status. Get a credible target date.
- [ ] Define the validation test: `DehydratedDeviceManager.isSupported()` returns `true` against staging Synapse.
- [ ] Pre-build a forward-fix PRD for the resumed migration (separate document) so engineering isn't starting from scratch when the unblock arrives.

### 8.4 Bridge exit (when Synapse ready)

- [ ] Resume work on `element-web-v2/verji-develop` from the `archive/verji-develop-pre-rollback-2026-04` tag.
- [ ] Replay the backports landed on `element-web/` during the bridge that are relevant to `element-web-v2`.
- [ ] Resume the ~73-commit port queue documented in [ClaudeAssistedSyncVerjiElementWeb.md](../../ClaudeAssistedSyncVerjiElementWeb.md).
- [ ] Run the verification matrix from the dehydration forward-fix PRD.

## 9. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Synapse MSC3814 work slips → bridge becomes 12+ months | Medium | High (Option B's conflict cost dominates) | 6-month review checkpoint forces a re-decision |
| Cherry-pick conflict during a CVE backport | Medium | Medium | Maintain a clean `verji-develop`; refuse merges that aren't strictly security-relevant; have a second engineer review crypto-adjacent backports even if not crypto themselves |
| matrix-js-sdk upstream deletes legacy `Crypto` source entirely | Low (12+ months out) | High (forces hand) | Pin matrix-js-sdk at 33.0.0; never bump past v34. Accept that this caps available backports |
| `@verji/*` module adopts matrix-js-sdk v35-only API | Medium | Medium | Add a CI check that verifies modules build against matrix-js-sdk 33.0.0; freeze a known-good module set for the legacy fork |
| Engineering treats the pause as permanent and the migration never resumes | Medium | High (long-term ecosystem disconnect) | Quarterly leadership review; explicit milestone tied to Synapse readiness |
| User-visible feature gap (vs upstream Element) attracts customer pressure to resume migration before server is ready | Medium | Medium | Communicate the bridge framing externally if appropriate; resist client-only fixes that reintroduce the dehydration gap |
| Module repos (`verji-cryptosetup-module`, etc.) drift in the meantime, becoming incompatible with the legacy fork | Low | Medium | Tag a known-good module set; defer module work that doesn't serve the legacy fork |

## 10. Open questions

1. **What is the Synapse MSC3814 roadmap?** This PRD's recommendation hinges on it. If unknown, the decision between B and D becomes B by default.
2. **Are there post-1.11.68 upstream features that customer/product teams have committed to?** Anything committed and not yet shipped becomes a renegotiation if we pause. List them before approving this plan.
3. **Is there a customer-facing communication needed?** "Verji web client is not catching up to upstream Element for the next N months" may or may not be material to communicate — depends on positioning.
4. **Module strategy during the bridge**: do `@verji/*` modules continue to develop against the new stack (preparing for resumption), or freeze on the legacy stack? Recommend the former, with a CI matrix that builds them against both.
5. **Does the bridge change the security review cadence?** Legacy libolm has a different threat profile than Rust crypto — review cadence and surface should be re-examined.

## 11. Decision log placeholder

> _To be filled in once the recommendation is accepted/modified/rejected._
>
> - [ ] Accepted as written
> - [ ] Accepted with modifications: _______________
> - [ ] Rejected — alternative direction: _______________
>
> **Decided by:** _______________
> **Decision date:** _______________
