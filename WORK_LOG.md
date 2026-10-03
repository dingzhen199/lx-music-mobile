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
