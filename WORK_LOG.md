# Desktop parity port work log

## Fixed inputs
- Mobile default master: fb8480728d875fa5e0da25eebd3a26bb71723aae
- New work branch: feat/desktop-parity-20261003
- Desktop master: ad95d5091c9ed689fa72b5e5c849df65f5a679ce
- Desktop feature: df3e97915d40bd7b9efceb8421a120637b0c4617
- Desktop read only; no ADR changes. No Codex CLI dispatch or independent cloud task.
- Connected GitHub identity dingzhen199; repository metadata grants push/admin. CLI unauthenticated. Collaborator-permission endpoint is unavailable to integration (403), not used to override access.

## Inventory and implementation plan
See docs/desktop-parity/requirements.md and desktop-diff.tsv. Requirements derive from actual diff and feature code, not branch name.

## Verification boundary
Host unit tests are not Android/iOS device E2E. Native bridges, actual source scripts, external provider availability and audio analysis require explicit separate evidence. No completion claim until implementation/review and checks are recorded.

## Root cause observations
- Mobile custom API storage mutates memory before persistence; removal mutates caller IDs using a list index.
- Native initialization can relabel stale callbacks with current source; readiness has no deadline.
- Playback lacks ordered custom-source backups and per-source runtime isolation.

## Size policy
Porting independent new recommendation, radio, profile and source-management capabilities necessarily adds code. Reuse the desktop pure algorithms/tests and mobile persistence/player/UI conventions; avoid reimplementing mature state machines. Added compatibility dependencies must reduce bespoke adapter complexity and be documented.

## Early review findings (not final acceptance)
1. Stale optional recommendation metadata in RN state bridge: explicit undefined reset; real store/StateEvent/AppEvent A→B→A regression added
2. Import/delete/alert mutation races: common serialized source mutation boundaries; deferred storage non-resurrection/failure tests
3. RN asynchronous lifecycle ordering differs from PC: separate synchronous observers preserve existing async UI, exception isolation, copied listeners and symmetric unsubscribe; native bridge tests
4. Duration read can arrive for an obsolete same-ID playback generation: generation guard on position/duration reads; dedicated deferred-read regression pending
5. PC synchronous save seams versus RN promises: per-key serialized snapshot writes with observed errors; failure/retry-order regression pending
6. Missing AI connection-test UI: five-state UI implementation pending

2026-10-03: Host tests round3 42 suites / 734 cases pass. This is portable logic plus mock boundaries, NOT Android/native E2E. Dependency installation after Git-prepare OOM uses isolated registry-only tooling with 512 MB Node cap; exact four upstream Git revisions materialized as archives without prepare, never executed installation scripts. Lock-only update succeeded separately.

## Pre-review candidate
- Tests: 52 suites / 790 passed; full TypeScript passed
- Lint: full-rule serial batches and final changed-file recheck passed under 512 MB; one-shot heap OOM is preserved as an environment limit
- Metro production bundle passed once; later source edits are type/test-checked, final bundle rerun pending coordination
- Real provider registration regression caught missing simiSong export and is fixed
- Early review persistence/identity/ordering/duration issues fixed and covered by real JS bridge or deferred storage tests
- Native Android audio analysis implemented as an explicit opt-in Visualizer adaptation; approximate 8-bit signal statistics, not full-precision WebAudio parity. No Android SDK/adb available, native/device gates remain open
- No desktop-reference changes, no ADR edits, no remote push

## Independent final review round 1 (frozen e16d551)
Feature and source/runtime reviewers found 3 major + 4 minor issues. Changes below are the unified repair pass, not yet a fresh acceptance.

- Major feature M1: delayed asynchronous play callbacks could start duration reads under a new selection epoch while the native engine still held the old track. Reproduced with actual AppEvent/StateEvent/store/adapters/progress. Fixed with synchronous progress lifecycle, captured epoch and exact native resource identity checks before/after reads and before commits; native installation carries its originating epoch through both scheduling layers. Only validated native duration emits loadeddata; restored UI progress is not evidence
- Major feature M2: profile did not pause on error/playerError. Reproduced false completion after 14s listen + 5s silent retry on a 20s track. Both interruptions now idempotently pause; real event/store/profile tests cover duplicate errors and recovery
- Major source S1: failed root/list commits left new staged chunks/scripts behind. New cleanup rereads authoritative roots/list and deletes only this attempt's unreferenced staging. Commit-then-error and read-failure cases preserve referenced/uncertain data; later source mutations reconcile durable state
- Minor source S2/S3: main timeout now updates per-API status; runtime removal clears capabilities then notifies subscribers
- Minor feature S1/S2: immutable path batch engine/radius/instruction headers and persistent default-radius controls added (radius semantics hidden for platform batches/mode)

RED evidence: lifecycle/profile 5 failing new assertions; storage/source 8 failing assertions across fault-injection stages. Focused GREEN: lifecycle/profile/bridge 37 tests; source/storage 24 tests; extra actual event/profile + resource-install tests 11 tests. Full final rerun follows.

Existing build-test CI now also triggers only this feature branch on push, adds unit/type and Android debug compilation with read-only contents permission. No deploy, release workflow, release keystore, branch protection, paid runner or pull_request_target changes. Debug configuration no longer eagerly requires a private release keystore. CI has not yet run for these changes.

### Review-repair candidate verification
- Full host regression: 57 suites / 811 tests passed (`reviewfix-tests-freeze.log`, exit 0)
- Full `tsc --noEmit`: passed, exit 0
- All 718 JS/TS inputs have up-to-date original-rule ESLint records; missing/stale/errors = 0 across bounded batches and changed-file rechecks
- Real React component boundary tests now cover the two UI parity gaps (native host views mocked; not device layout evidence)
- Exact-feature CI YAML parsed and its read-only permission/trigger scope checked; CI is unexecuted until an authorized push
- Final Metro rerun reserved for after the next independent review; native/device checks remain unrun locally

## Final source gate and publication preparation
- Fresh independent feature and source/runtime reviews of 65a7832 found no remaining blocker/critical/major/minor issue in reviewed source/host scope
- Final production Metro bundle at exact source commit 65a7832 passed with one worker and a 512 MB Node heap, copying 8 assets
- This final documentation update changes no runtime/test/build input
- Publication target verified: connected GitHub dingzhen199 (206642280), dingzhen199/lx-music-mobile, new feat/desktop-parity-20261003; remote branch absent and repository push permission confirmed
- Native/device and remote CI status are separate. CI must be observed on the exact published commit; no merge/release/force update is authorized

### Initial publication attempt blocked
After identity verification, the connected GitHub integration rejected the first Git Data blob write to dingzhen199/lx-music-mobile with HTTP 403 `Resource not accessible by integration`. Repository metadata reports the user's admin/push rights, but that does not establish the integration's actual write permission. No remote branch/commit/ref was created by this attempt and no CI run was triggered. Publication is paused for access repair; no alternate write route or force update was attempted. This is an authorization blocker, not a code/build failure.
