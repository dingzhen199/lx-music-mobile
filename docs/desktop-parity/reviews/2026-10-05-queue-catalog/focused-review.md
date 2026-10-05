# Mobile cycle 9 independent focused review

## Verdict

**Approve the focused operation-lifecycle repair: no verified major or minor finding in this review.** Both cycle-8 majors are independently re-executed and fixed. Specification and quality/KISS approval here are limited to installation/cancellation/native-event ownership, not a replacement for the separate full-scope review or device acceptance.

Target: `fix/mobile-queue-catalog-20261005`, HEAD/base `d77421200ee69c22e5b2548064999250aee25e9c`. Supplied candidate `mobile-candidate-cycle9.patch` SHA-256: `e4b705c4ea1456afef1038d5a906814ac2835a3a8b458bb15e4b28a312a3a691` (verified). No source, staged content, ADR, dependency, commit, remote, CLI task, or independent cloud task changed/created. Artifacts are outside the mobile checkout.

## Independent reproductions and additional boundaries

Initially copied the two cycle-8 external probe files unchanged and ran them against the new candidate: **14/14 passed**, `mobile-cycle9-focus-audit/old-probes.log`. This establishes the original failing sequences are green, rather than replacing their assertions with candidate-owned tests.

Then extended those isolated probes with new cases: **29/29 passed**, `mobile-cycle9-focus-audit/expanded-probes.log`.

1. **Install cancellation at six native await boundaries.** Suspend `getCurrentTrack`, `add`, `getQueue`, `skip`, `pause`, or `seekTo`; call real `setStop`; finish the old native operation. Each case leaves installed evidence null, does not call native play again, and does not emit a queue advance. Then request a fresh direct install in the same selection generation: it reaches native play and publishes valid installed evidence. This verifies cancellation does not strand the serialized installer after the old promise settles.
2. **Queued direct installers.** Suspend an install at skip, enqueue another old direct install, stop, then release the first. Neither old request plays; the queued old URL is never added. A fresh explicit replay afterward installs successfully.
3. **Error cancellation across producer and consumer.** Suspend native identity lookup, stop between service emission and asynchronous delivery, or suspend native position read after delivery. Real stop at all three boundaries prevents URL retry and position import.
4. **Identity reuse.** Same object and a new object carrying the same song ID are both reselected through the real store action. Native error from the preceding installation cannot acquire authority for either uninstalled selection. Earlier manual-selection same-object/different-song probes also remain green.
5. **Positive controls.** Genuine paired-placeholder end advances with `playNext(true)`; current installed error retries its actual song and imports its position. A rejected position read still retries without a fabricated progress write. Normal installed native Playing state sets play status; post-stop state cannot restore it.
6. **Command and cancellation controls.** Remote play/pause/previous/next remain ordinary core dispatches after cancellation; RemoteStop still exits. Previously independent timeout-exit, null/negative/out-of-range identity, synchronous stop reentry, selection change during end pause, and a new same-generation resource installed after stop entry all pass.

These fixtures use actual resource builder/installer/list lookup, stop adapter, selection action, registered playback service, AppEvent, stop/ended and error consumers. Native bridge operations and final queue/URL/progress effects are mocked. The new native gates are independently authored here. They are deterministic host integration tests, not recorded Android behavior.

## Production entry and invariant review

- `src/plugins/player/playList.ts`: `invalidateResourceEnd` clears installed evidence and advances the shared resource operation ID. Direct install requests capture/revoke at submission rather than gaining authority when their queued callback eventually runs. Installer entry and each native await are checked; publishing the audio/placeholder pair requires the same generation and operation. The list is updated after native add/remove to preserve native/list correspondence for the next serialized install.
- `src/plugins/player/utils.ts`: `setResource` carries the operation through resource debounce. Real `setStop` revokes pending publishers synchronously before awaiting native stop and avoids its later skip when a new operation owns playback. This fixes cycle-8 M1 without relying on an audio ID changing after stop.
- `src/plugins/player/service.ts`: PlaybackError and PlaybackState now require a real installed pair and the native current audio ID, not a selected song with null resource. They preserve identity and operation across lookup and deferred event delivery. TrackChanged requires the installed placeholder and rechecks after pause and synchronous reentry. This fixes cycle-8 M2 while retaining real current error/end behavior.
- `src/core/init/player/playerEvent.ts`: error position and retry use operation-aware ownership, including after position rejection. Recovery after exhausted retries captures the operation after explicit stop. Existing related candidate tests also cover delayed recovery.
- `src/core/player/player.ts`: selection permission/setup/stop/debounce and URL work carry operation ownership; explicit core stop completion emits status using the `nativeStopped` marker. `src/core/init/player/player.ts` consumes this without starting a second native stop. Candidate tests for permission/native-stop/debounce cancellation, old completion suppression, and exactly-one-stop were separately executed; these are candidate tests, not claimed as independent real-native integrations.

**Quality/KISS:** one shared operation identity complements the existing selection generation and exact installed pair. It is threaded through the existing player and event paths; no second player engine or runtime dependency is introduced. This is a cohesive repair of the publisher/cancellation invariant rather than an additional song-ID heuristic. No extra cleanup or architectural change is requested in this focused review.

## Executed checks

All logs under `mobile-cycle9-focus-audit/`:

- Original external cycle-8 probes: **14 passed**, `old-probes.log`
- Expanded external probes: **29 passed**, `expanded-probes.log`
- Candidate installed-resource, resource-error, queue lifecycle, and error-consumer suites: **4 files / 86 tests passed**, `candidate-regressions.log`
- Candidate selection lifecycle suite: **17 passed**, `selection.log`
- Native contract harness: **4 files / 16 tests passed**, `native.log`
- `git diff --check`: passed

Run the external probes from `mobile`:

`./node_modules/.bin/vitest run --config ../mobile-cycle9-focus-audit/vitest.config.mjs`

Each executed command above completed with exit 0. Full unit/type/lint/Metro results supplied by the parent are not represented as independently rerun here. No npm ci/install was run.

## Limits

No Gradle/APK build, emulator, physical device, audible playback, real native event timing, or physical touch/accessibility acceptance. Native commands already dispatched cannot be retroactively canceled by JS; the tested contract is that stale continuations do not publish authority or issue subsequent playback effects. Progress after cancellation was tested once each suspended native promise resolves, not for a bridge that never settles. Fault injection of every installer promise rejection and physical delivery ordering remains outside this focused pass.
