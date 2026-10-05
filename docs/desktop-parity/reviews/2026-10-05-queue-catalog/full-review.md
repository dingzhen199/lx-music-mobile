# Mobile cycle 9 — independent full review

## Verdict

**No verified major or minor finding remains in this review. Spec: approve at source/host-test level. Quality/KISS: approve.** The two cycle-8 major findings are independently re-executed and now pass. This is not APK, device, audible playback, physical touch, or live-provider acceptance.

Reviewed checkout: `mobile`, branch `fix/mobile-queue-catalog-20261005`, HEAD/base `d77421200ee69c22e5b2548064999250aee25e9c`. The supplied shorthand omitted the leading `d`; the actual commit was verified. Candidate `mobile-candidate-cycle9.patch` SHA-256: `e4b705c4ea1456afef1038d5a906814ac2835a3a8b458bb15e4b28a312a3a691`.

This was a fresh read of the complete tracked production diff, untracked implementation/tests and relevant existing callers/SDK/native code, rather than only a check of the latest two fixes. Source, staged content, ADRs, dependencies, commits and remotes were not changed. Evidence is outside the mobile checkout in `mobile-cycle9-full-audit/`.

## Cycle-8 findings closed

### Former M1: stopped in-flight installer recreates end authority

Relevant paths: `src/plugins/player/playList.ts`, `src/plugins/player/utils.ts`, `src/core/player/player.ts`, `src/event/appEvent.ts`.

`resourceOperationId` now owns both pending and installed resource intent. Stop increments it synchronously and clears installed evidence. The installer retains the operation captured when requested and rechecks it after native lookup/add/queue/skip/pause/seek, before publishing installed authority or initiating the next step. Debounced installation retains its original operation. Core play carries the operation through notification permission, initialization, native stop, and debounce; the deliberate internal stop adopts only its own new operation. Completed stop projection does not call a second native stop and cancel subsequent intent.

Independently re-executed the cycle-8 focused author's unchanged cross-boundary suite: **12/12 pass**, including the formerly failing same-generation pending install/stop overlap and ordinary natural-end positive control. This is explicitly a re-run of that author's fixture, not a claim that its reproduction was independently invented this cycle. Current source suites additionally exercise stop at add/getQueue/skip, queued install cancellation, explicit later install, stale direct install, and core permission/native-stop/debounce revocation.

### Former M2: old native error adopts an uninstalled B

Relevant paths: `src/plugins/player/service.ts`, `src/core/init/player/playerEvent.ts`, `src/plugins/player/playList.ts`.

Error and state producers now require a non-null installed resource, validate native current-track identity, and retain the selected generation, object, resource and operation across the native read. Emission is guarded again at synchronous/deferred listener delivery. The error consumer preserves its operation through native position reading and URL-retry scheduling. A merely selected/uninstalled B no longer authenticates A's native error. Same-object reselection and same-generation replacement are covered; genuine installed-current-owner errors still refresh and eventually advance.

Independently re-executed cycle-8 full-review error fixture unchanged: **2/2 pass**, including the formerly failing A-native/B-selected negative case and current-owner retry positive case.

## New independent boundary probes

`mobile-cycle9-full-audit/native-owner-boundaries.test.ts` reuses the older isolated native/mock boilerplate and its two controls, then adds **three independently authored scenarios**: hold the real service error callback's native identity lookup pending, then (1) select another song, (2) explicitly stop the same generation, or (3) request a same-generation resource replacement. Resolve the old native lookup afterwards. In all three, neither the actual AppEvent/error consumer's final progress effect nor its URL retry is called. **5/5 pass total.**

The tests use the real resource builder/installer, selected store actions, service registration/callback, AppEvent and playerError consumer. Native bridge and final URL/progress leaf effects are mocked. They do not simulate an APK or prove real native timing.

## Full-scope observations

- **Catalog UI:** Artist/album actions use exact current preferred metadata. Song actions are an absolute full-area sibling overlay inside the existing native Modal, above the catalog sheet; underlying accessibility descendants are hidden while active. Back closes action selection before closing the catalog. Backdrop dismissal and action controls are explicit; row/action targets have 44-point minimum dimensions. Row play uses the visible remainder; menu play, next, append dispatch existing intended playback/queue paths. Host rendering and handler tests pass. Physical interception/accessibility behavior remains unmeasured on device.
- **Provider contracts:** Traced actual tx/wy/kg artist and tx/wy/kw/kg/mg album integrations. NetEase detail uses the request's `.promise`; its album adapter reads complete `body.songs` and applies one-based slicing. QQ differentiates numeric album ID and alphanumeric MID and maps `songList[].songInfo`; search/playlist/detail/saved conversion paths are tested. Kuwo honors SDK page size, while Migu avoids using its reported total as page size. Local unsupported, online provider not integrated, missing identity, malformed transport response and request error remain distinct recoverable outcomes. No fuzzy artist/album substitution was introduced. These are code/fixture contract checks, not a claim that remote services are currently reachable.
- **Catalog races:** Controller revision handles close, new target, retry and late responses. Paging deduplicates IDs, retains unknown totals and reports a page making no progress instead of repeatedly appending/looping. Long lists are rendered through FlatList.
- **Queue mutation:** Play, next, append, move, remove and clear are wired to session/pending operations. Base edits copy the saved list; no queue action calls saved-list reorder/delete. Current anchor survives moves; temporary anchor removal resumes its successor. Pending entries are occurrence objects, so duplicates and their alternative/recommendation metadata remain independent. Clear keeps current audio, removes continuation and suppresses radio. Ordinary explicit list playback resets the edited session.
- **Queue progression:** Current/sole-current removal, enqueues during an awaited stop, delayed cleanup, cleared/deleted backing lists, concurrent next/previous filtering and random preview are tested. Shared random preview and queue revision avoid drawing another candidate or resurrecting a removed one. List/list-loop/single-loop/random behavior and temporary continuation preserve existing semantics. Recommendation integration's exclusive-batch checks prevent finite selections or clear from silently resuming radio.
- **Playback/worker ownership:** Traced URL requests and cleanup, restore progress/metadata, initialization sharing, permission awaits, native resource installation, producer identity, synchronous event reentry, deferred delivery, native position reads, timeout/retry, lyric and notification paths. Selection generation remains the song-owner boundary; operation identity now handles cancellation/replacement within a selection. The native Android producer really sends code/message for errors and numeric track-change indices, so it cannot authenticate an original event already delayed before JS entry. The code appropriately requires current installed evidence and does not infer ownership from a song ID or event index alone. No new verified cross-owner effect was found.
- **Quality/KISS/performance:** Reuses existing session list, queue selector, event hub and playback pipeline. The unified operation identity is preferable to unrelated cancellation counters. No runtime dependency or second playback engine is added. Existing array scans/copies are bounded by the user-visible list; expensive row rendering is virtualized. No measured performance claim is made. The new checks are concentrated around actual async ownership boundaries rather than replacing normal playback with blanket event suppression.

## Independently executed gates

All commands ran against this candidate without npm ci/install or dependency changes:

| Check | Result | Evidence |
|---|---|---|
| `npm test` | 80 files / **1037 tests pass** | `full-tests.log` |
| `npm run typecheck` | pass | `typecheck.log` |
| `npm run lint` | pass | `lint.log` |
| native contract Vitest config | 4 files / **16 tests pass** | `native.log` |
| previous full-review error probes | **2 pass** | `cycle8-error-regressions.log` |
| previous focused-review stop probes | **12 pass** | `cycle8-stop-regressions.log` |
| isolated current review probes | **5 pass** | `probes.log` |
| Android production Metro, `--dev false` | pass, bundle and 8 assets emitted | `metro.log` |
| `git diff --check` | pass | `diff-check.log` |

Reproduction commands from mobile:

```
./node_modules/.bin/vitest run --config ../mobile-cycle9-full-audit/vitest.config.mjs
./node_modules/.bin/vitest run --config ../mobile-cycle8-full-audit/vitest.config.mjs
./node_modules/.bin/vitest run --config ../mobile-cycle8-focus-audit/vitest.config.mjs
./node_modules/.bin/vitest run --config test/native-stop/vitest.config.mjs
./node_modules/.bin/react-native bundle --platform android --dev false --entry-file index.js --bundle-output /tmp/mobile-cycle9-full-metro/index.android.bundle --assets-dest /tmp/mobile-cycle9-full-metro/assets
```

## Remaining acceptance boundary

Not performed: Gradle/APK build; emulator/device; actual audible playback, seek or native interruption timing; physical touch/Back/accessibility acceptance; live provider requests. These remain release/acceptance work, not passed stages. No code finding was inferred merely from their absence. Review approval is scoped to the inspected candidate and executed host gates; it must not be represented as real-device completion.
