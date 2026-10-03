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
