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

## 2026-10-04 additional playback scope (after reviewed 65a7832)

The user extended both clients: retain manual version preferences while permitting explicitly announced temporary rescue, show the current queue beside progress, play multiple selected rows in visible order without old-list contamination, and open exact artist/album catalogs. The prior independent approval covers none of these new changes.

Root cause: Mylist manual source switching removed the original entry; automatic resolved-source writeback also replaced collection identities. URL cache aliased rescue resources under the requested ID. Multi-select Play ignored selected rows in both Mylist and OnlineList. New policy separates persistent preference/original ID from runtime resolved ID; batches reuse the existing FIFO queue with no base-list continuation. Desktop/mobile agree visible list order, not order of selection clicks. Catalog adapter/controller is shared from the new desktop work, with accurate IDs and stale-request guards.

Initial tests: versionPreference missing-module red recorded, then two identity/pin tests green; two real common URL facade/cache-boundary tests green. Further UI/event/queue validation and a new independent review are pending. One transient exec transport disconnect recovered with the mandated single read-only retry after five minutes. No new GitHub write attempted; previous connector 403 remains a publication blocker.

### Additional scope host candidate

- 65 suites / 836 tests PASS; full tsc PASS; changed production JS/TS original-rule lint PASS (test files follow the existing lint exclusion, but compile and run).
- Added true JS-boundary tests for FIFO next consumption, URL commit preserving original identity, local unknown-resolved identity notice, manual preview confirmation, A→B→A, and offline completed downloads. React host controls test close/late results; shared catalog adapter/controller and actual tx/wy SDK paging tests passed. Mobile's NetEase request API differs from desktop (`request.promise`), and this was adapted rather than copied blindly.
- Removed obsolete automatic writeback module and its now-superseded tests. Most added code is provider SDK/catalog support, two small native views, localized labels and regression fixtures. No dependency or independent queue/storage engine added. Related README/CHANGELOG/FAQ and each parity behavior/validation document updated; ADR untouched.
- Unsupported catalog provider/kind routes and local API URL-only unknown version identity remain explicitly disclosed. Real provider network/device playback and native hit-area/accessibility verification remain unperformed. Independent review and final Metro are next; no GitHub write attempt.

### Independent playback review repairs

Independent review of f2f90aa found four major interaction gaps. Its four external fixtures were rerun unchanged first: 5 tests failed, 2 passed (review-new-red.log). Fixes are now covered in repository fixtures:

1. Artwork requests could overwrite collection/version metadata, including A→B affecting independently owned B→C and stale A artwork erasing a newer choice. Removed online/local automatic whole-entry artwork writeback entirely: artwork is only a playback display result. Playback cover/lyric responses additionally require exact owner object and playback generation. This is narrower than adding another storage transaction/CAS layer. Both original corruption fixtures and a real delayed-player-artwork fixture pass.
2. Radio and old in-flight results could extend a finite selected batch. A finite-batch state now suppresses automatic radio and invalidates the old session epoch, preserving the persisted radio preference. It remains suppressed at batch end, until ordinary-list playback or an explicit new station. Tests use real recommendation session + player with both enabled-radio and delayed-engine return; the queue explains the temporary pause.
3. Preview C then restore A could retain C playback. The real modal captures its original playback context, tracks whether preview actually happened, strips nested preference from direct preview targets and passes the owner context on confirm. Its React fixture executes actual modal/row methods for A preview and C→A restore; the real manual handler fixture checks the corresponding state commit.
4. Changing a selected batch's version previously called ordinary list playback, clearing the FIFO. A narrow reload preserves base-list/batch state and the pending queue; queued owner entries also receive the new manual preference in place. Sequential playback also ignores history and cached next left by random mode, with a real selector/next regression.

Minor findings: queue/catalog use bounded FlatList rendering; catalog titles/errors/count unit use the existing three-language system; original local version can also be restored. No new dependency, storage abstraction, parallel queue engine or ADR change. Original-artwork auto-persistence was deliberately removed to eliminate an unneeded destructive write path; existing saved artwork remains readable.

Repair validation: 69 suites / 847 cases PASS, full tsc PASS, changed production original-rule ESLint PASS. Root resolved cross-client radio policy: retain persisted radio preference, suspend for finite batch and at its end, resume only ordinary-list playback or explicit station restart. UI and three integration cases cover that policy. New reviewer fixtures remain in the repo with the new explicit modal-context/reload API; the original unchanged RED log is retained outside the repo. Source ready for a new independent focused + full audit; final Metro follows any final fixes.

### Fresh independent repair audit and final minor

A fresh independent audit at 9c93a4a rechecked the prior four major findings and relevant full paths: all four closed, no new major found. The reviewer independently ran 69 suites / 847 tests and tsc, plus external manual-context/radio and original artwork/queue regressions. The reviewer did not claim Metro, Android/device execution or a fresh lint run. One minor remained: an unnamed album target used a fixed Chinese fallback. A new test using the actual English language resource reproduced the failure; the adapter now uses the existing catalog_album key. Final host run: 69 suites / 848 cases PASS, full tsc PASS and the changed production files' original ESLint rules PASS. The tiny final localization change is awaiting independent focused confirmation; final Metro is next.

Final production Metro at source a42c560 completed once with one worker / Node max-old-space-size 512 MB, exit 0, 8 assets. No dependencies installed. Logs and exit record remain in the task workspace. No ADR, credentials, dependencies or caches were added to Git. All later changes are review/verification documentation only. GitHub write authorization remains unresolved; no write retry, remote feature ref or CI claim.

Final localization independently verified at a42c560: catalog 3 suites / 18 cases, full tsc, two production-file original-rule ESLint, and actual en/zh-cn/zh-tw empty/undefined-name probes all passed; existing names unchanged. No new finding. The reviewer observed only the three documentation edits after source freeze. The complete delivered runtime is now covered by the focused follow-up to the prior full audit.

### First published CI result and test-only lint repair

Official GitHub CLI device login completed as dingzhen199 with keyring storage. The original local history was pushed normally to dingzhen199/lx-music-mobile, feat/desktop-parity-20261003, and remote API readback matched a3ea882 exactly. No credential or device code is stored in this repository or backups.

Run 37170923497 on that SHA completed with failure at ESLint: npm ci, 69 suites / 848 tests and tsc passed; Metro/Android compilation were skipped. The only 18 lint findings were in two new React .test.tsx fixtures. The local changed-production lint gate had not included them; the repository ignore contains `*Test.ts`; it does not exempt these `.test.tsx` files. This gap is corrected without changing rules: imports are ordered, song fixtures fully satisfy their types, mocked hosts use the actual imported component types, and the renderItem boundary has an explicit ReactElement type. Both affected suites (4 cases), their original-rule ESLint and full tsc pass locally. No production/runtime/build behavior changed. A fresh independent test-only review precedes the next push and CI run.

Fresh independent review of f220c4f passed: the four React cases retain all eight assertions, both original-rule lint and full tsc pass, and no production code or lint-rule change is present. A documentation-only correction clarifies the actual ignore pattern rather than attributing the omission to `.test.ts` handling.

## 2026-10-05: mobile catalog and editable playback queue

- Baseline: `d77421200ee69c22e5b2548064999250aee25e9c` (`feat/desktop-parity-20261003`).
- Catalog: add QQ and NetEase album adapters using exact provider album IDs; retain the existing QQ/NetEase/Kugou artist and Kuwo/Kugou/Migu album adapters. NetEase's mobile singer transport was already correctly using `.promise`; the desktop transport bug was not present here. Unsupported local catalogs and online catalogs not yet integrated are now distinct errors; missing IDs and failed requests remain distinct from both.
- Catalog actions: song overflow / long-press opens an action layer within the catalog's native Modal, above the list. Play now, play next and queue are available. Back dismisses the action layer before the catalog; underlying catalog accessibility elements are hidden while actions are open.
- Queue: play an exact entry, move up/down, play next, enqueue from the base list, remove, and confirm clear. Controls have 44-point minimum touch targets. Editing a base queue creates an in-memory snapshot; saved playlists are not changed. Current identity, queued recommendation metadata and playback mode are retained. Explicit ordinary playback resets the snapshot; clear retains current audio and stops continuation/recommendation refill after it finishes.
- Fix two random-play correctness issues: playNext now consumes the previewed random next track, and a late async calculation cannot resurrect a removed queue entry. Reordering/removal preserve the continuation anchor, including while a temporary track is playing.
- Tests cover duplicate queued occurrences, stale row actions, all four sequence/random/repeat modes, current-track removal, temporary-track anchors, snapshots vs saved lists, clear confirmation, catalog action layer dismissal and provider transport/pagination contracts. Native-device rendering and live provider availability are separate from mocked component/contract tests.
- Provider evidence shared by the parallel desktop investigation: QQ public album 8220 returned HTTP 200, business success, 11 total and two songInfo rows for the requested first two songs. The public NetEase album API probe returned -462 (phone binding requirement); this does not validate the separate existing eapi transport used by this implementation. Kuwo artist candidate timed out and Migu artist candidate returned route-not-supported; neither candidate is shipped. These observations concern those requests, not permanent platform capability claims.

### Independent-review repair cycle

- Fixed the reviewed saved-list/snapshot separation bug: playback anchor is derived from the session even when the saved list is empty or deleted; persisted source-list index remains separate.
- Concurrent random preview/preload requests now reuse a candidate populated during their shared generation's filter await, instead of drawing separate songs.
- A completed old sole-entry removal cannot clear a newer selection. Native stop completion, delayed stop notification and exhausted-queue cleanup are generation-guarded; the native adapter also avoids skipToNext after a newer selection takes ownership.
- `src/core/player/queueLifecycle.test.ts` uses real filtering and mocked native audio. Initial six cases reproduced five failures before the fixes; the final eight cases also cover repeated selection of the same ID, ordinary stop completion and delayed exhausted-queue cleanup.
- Isolated native-adapter contract harness: `node node_modules/vitest/vitest.mjs run --config test/native-stop/vitest.config.mjs`. It imports the real adapter with an explicit test-only native mock; two stale-stop cases failed before the two-line native guard, and all four pass afterward. It does not repair, replace or validate the installed native dependency or device playback.
- The final default suite retains the real dependency-resolution gates. Missing built artifacts in locked Git dependencies still prevent the two existing resource-generation tests, the full type/lint gates and Metro bundle from passing; these limitations remain separate from the isolated native contract test.

### Second full-review repair cycle

- QQ album requests now preserve the real producer contract: numeric IDs (including numeric strings) use albumID, while search, playlist, detail and legacy saved metadata containing alphanumeric MIDs use albumMid. No arbitrary string is converted to NaN/null. Added converter-to-catalog-to-HTTP integration fixtures for all four paths and numeric/invalid input checks. The desktop investigation separately observed a successful albumMid request for `003DFRzD192KKD`; this mobile test suite uses mocked HTTP and does not claim additional live validation.
- Previous-song filtering now observes the same playback-generation and queue-revision boundaries as next-song filtering. A newer selection or cleared/replaced list cancels the old request; an edit to the same queue recomputes against the edited queue. The same cleared-list check also prevents a stale next-song retry from stopping the current song after clear.
- Reproduced all six independent review assertions before repair. The five unchanged previous-song review probes pass after repair. The original QQ review probe demanded a numeric albumID specifically; the replacement integration contract instead asserts the supported exact albumMid path, plus separate numeric-ID coverage. The reviewer-owned fixture was not modified.
- Additional same-boundary regression: a next-song calculation already awaiting filtering now observes priority entries added through the existing temporary-list API (including catalog Play next). Two red tests reproduced an old base song winning over the inserted song; both pass after rechecking pending priority after await.

### Third full-review lifecycle audit

Completed an await/callback ownership pass along queue selection → handlePlay → native stop/resource/restore/metadata, rather than treating the native callee's early return as cancellation of its caller:

- handlePlay captures one generation at entry and checks it after notification permission, shared initialization and native stop, before pause events, timer clearing, history or playback scheduling. Restore intent is claimed before those waits so another selection cannot inherit it.
- Debounced playback carries its original generation instead of adopting the generation present when the callback finally runs. Restore progress/artwork/lyrics, URL-request cleanup and old load/error timers obey the same generation. A new same-ID selection clears its request marker before waiting for native stop; old cleanup cannot suppress its new request.
- Player initialization now has one shared in-flight Promise; concurrent selections await both native setup and option application. Setup failure releases the in-progress state for retry. This is shared service initialization, not a new playback engine.
- Audited the native restore add/getQueue/skip caller and metadata duration/state callbacks; stale callers do not schedule later effects. Native resource installation already guarded intermediate boundaries; its final play/pause completion now also precedes a generation check before queue pruning. Prefix pruning is awaited in the existing serialization chain and uses its captured count rather than a later changing list length.
- Read-only native getters and final calls with no subsequent owner side effects need no additional caller mutation guard. Pause has no JS continuation side effect. Collect/uncollect target their captured collection entries. Dislike completion now cannot skip a subsequently selected track.
- The reviewer-owned two queue-selection probes pass unchanged. Added real-event-handler caller tests cover queue/next/same-object reselection, delayed permission/setup, restore callbacks, debounce, old load timers and same-ID request restart. Isolated native mocks cover shared initialization, restore boundaries, metadata lookup and stale resource cleanup, plus the original resource-generation contracts.
- The isolated harness explicitly aliases native audio for tests only. The unmodified default suite still reports its two missing-package-entry failures; neither the dependency/build limitation nor the device-validation boundary has been hidden or removed. `docs/desktop-parity/playback-experience.md` now lists tx/wy album integration and distinguishes historical source validation from this candidate's open gates.

### Fourth full-review native-event ownership audit

Reviewed every active asynchronous read, delayed callback and lifecycle listener in `core/init/player/playerEvent.ts`, including the previously unchanged error-recovery path:

- `getPosition().then/catch/finally`: capture the existing playback generation and selected object at error-handler entry. Position, retry count, URL refresh and status updates require that owner still be current; same-object reselections are distinguished by generation. A failed position lookup still permits the current owner's normal retry and no longer leaves an unhandled rejection.
- Exhausted errors: retain the existing deferred outer timeout and five-second BackgroundTimer, but track/cancel both handles and carry the original owner through both callbacks. A stale outer callback cannot create a new timer or cancel the newer owner's timer. Stale/canceled inner callbacks cannot clear status or advance playback.
- Loading timeout: the 25-second callback validates both its handle and captured owner before first-refresh or second-timeout-next behavior. Playing/emptied cancel outstanding loading and error schedules; queued callbacks that already escaped cancellation are still rejected by handle checks.
- Event delivery itself is deferred by AppEvent. The five native events consumed here now carry the existing generation captured at emission, and their handlers validate it before adopting current state. Five independent tests first reproduced queued A events changing B's status/recovery and then passed. This does not infer a native track identity that an upstream event does not provide; device/native timing remains an explicit unverified boundary.
- `musicToggled` retry/timer reset is a synchronous internal lifecycle observer, so a new owner receives its own retry budget before deferred UI notifications. Waiting/playing/emptied contain no asynchronous read after their guarded entry. The fire-and-forget native stop has no state continuation and tolerates stop failure while the existing recovery path proceeds.
- Positive tests retain two URL retries, saved-position retry, lookup-failure retry, unchanged-owner five-second next, inactive-app immediate next, and the existing first-refresh/second-next loading behavior. The unchanged independent three error probes pass; the full playerEvent ownership file has 27 passing cases.
- Cross-platform follow-up check: mobile filterList has no internal await, so the desktop worker's late worker-response history-reset defect does not transfer directly. A distinct sole-current-removal/native-stop race did reproduce: a newly queued item must be rechecked after native stop, before clearing current playback. Its regression now passes and preserves recommendation metadata.

### Fifth full-review ended / cleanup / event-delivery pass

- The unchanged external 22-case fixture first reproduced four failures (two old ended events and two enqueue windows), then passed all 22 after repair.
- `playerEnded` now carries its emission generation; its consumer validates before progress, status or next. Final exhausted cleanup rechecks pending inside the final timer, not merely after native stop, and uses the existing next path with the original transition reason. FIFO remainder, alternatives, recommendation metadata and finite-batch suppression are retained.
- Completed the AppEvent producer/consumer inventory, recorded as event and transition tables in `docs/desktop-parity/playback-experience.md`. Additional executable red examples demonstrated old seeks and deferred lyric/notification projections affecting a newer selection. Progress/reason payloads remain in their original positions; generation is appended for owner-bound asynchronous consumers.
- Lyrics also retain their owner across native position, desktop-lyric and setting-refresh waits; an unchanged owner still publishes lyrics and starts at its actual position. Normal stop can clear the lyric projection after current is cleared, while a newer active owner remains protected.
- Dependency verification limits changed only after the user's explicit minimal-restoration approval: exact locked Git revisions were used, with local installed TypeScript tooling and no prepare/npm install. Track-player `bfe33933793460e7588d4d8f38eddf7910806f29`, file-system `fcb0e6f55af684ac60598c720c77cfe0502f2c65`, local-media-metadata `1b5be310d112afce0df598d3e9c7521c3311049c`. The dependency worker verified source identity and unchanged lock, and generated required local artifacts. Its build/type/lint/production-Metro logs are preserved outside source in the task's mobile-dependency-evidence directory. These generated node_modules artifacts are not committed and a later `npm ci --ignore-scripts` removes them; Node-only native package entrypoints and physical device integration are distinct from the RN Metro/source/types targets that were verified.
- Earlier 2-test / 35-type / 35-lint failures are historical results from before authorized artifact recovery, not the final candidate verdict. Final candidate default tests and static checks are rerun against the restored environment; production Metro is separately rerun. Metro success is not APK signing/build or device playback verification.

### Sixth full-review native service producer audit

- Reproduced the unchanged real-service registration probe: two stale track-read/pause cases RED, one unchanged-owner end positive. All three pass after the repair.
- Added 29 registered-callback contract cases; the initial run had 17 RED and 12 positive controls, then all pass. Covered same-object reselection at both awaits, replacement of a known resource within the same logical generation, initial assignment vs actual placeholder ending, absent/rejected identity, pause failure, synchronous event-observer replacement, timeout exit, all active remote command routes, normal native state forwarding and expired explicit AppEvent tokens.
- service.ts captures existing generation/selected object/resourceTrackId synchronously at native entry, keeps awaited track lookup local until ownership is checked, and carries the explicit original generation through each event. The per-event check handles synchronous observer reentry; native pause completion cannot continue an old producer.
- AppEvent's small guarded playback emitter rejects stale explicit generations before either synchronous or deferred listeners. The optional default remains for immediate current-owner callers; asynchronous producers must pass their captured generation. Existing reason/progress argument positions remain unchanged.
- The active native callback/await/effect/identity inventory is recorded in playback-experience.md. Unknown native identity is not guessed to mean end; no index-to-song inference or second scheduler/owner counter was introduced. Native operations already issued under a valid owner cannot be canceled retroactively by this JS guard.
- Two additional registered-service tests put an owner-changing observer before the real synchronous core consumer in the same broadcast; both were RED before consumer checks. Core player/progress and internal reset consumers now validate the supplied generation too, so a valid producer token cannot authorize a later consumer after earlier synchronous reentry changed the owner. This expands the service file to 31 passing cases without changing the generic Event scheduler.


### Seventh full-review installed-resource ownership repair

- Reproduced the unchanged cross-boundary probe: actual installer → new selection → stop/skip → registered service incorrectly advanced different-song and same-object selections (2 RED); actual natural end was the positive control. All three pass after repair.
- Retain the existing installer's unique audio ID, separately generated paired placeholder ID and generation. End requires all three to match the current installed resource; missing resource or merely matching song/suffix never proves ownership. Explicit native stop revokes this end evidence synchronously, and each end emission rechecks it after awaits and synchronous observers.
- Installer awaits also require their exact audio ID to remain current, so a same-generation replacement cannot complete an old install. No extra counter, scheduler or native queue was introduced.
- Added a real installer/service/stop integration suite covering manual selection, same-object reselection, unchanged-selection explicit stop, absent/replaced resources, same-generation replacement and normal end, delayed lookup/pause, native lookup failures, and synchronous replacement/revocation. Native bridge calls and final queue advance are mocked; the resource/list/stop/AppEvent/ended chain is real. Existing 31 service boundary cases retain remote commands, native error/state positives and reentry checks.
- Audited every native ending entry: PlaybackTrackChanged is the only active natural-end producer; queue-ended legacy code is unregistered. State/error callbacks and explicit remote commands retain their separate established semantics. The documentation lists the ownership evidence and limits; no claim of APK/device/audio verification.

- The wider adapter audit also reproduced one additional RED: while stop awaits the native bridge, a resource can be installed within the same generation and then be skipped by the old stop continuation. setStop now compares its captured exact resource ID as well as generation before skipToNext; the unchanged-owner stop positive remains. The native harness contains 16 cases after this regression.

- Cycle 8 final gates: default Vitest 79 files / 1,012 tests passed; native contract harness 4 files / 16 passed; typecheck, lint, Android production Metro and diff whitespace check all exit 0. The restored dependency artifacts remain local and package/lock content is unchanged. No APK/device acceptance or commit/push.


### Eighth dual-review unified native operation repair

- Reproduced both unchanged independent probes before editing: focused 1 RED / 11 positives (pending installation revives authority after stop), full 1 RED / 1 positive (A's native error borrows uninstalled B's position/retry). Both now pass, 12/12 and 2/2.
- Replaced the installer's existing random action identity with one resourceOperationId in player state. Resource scheduling claims it before debounce; explicit stop revokes it synchronously. Native install continuation/publication requires the same token, selection and exact audio ID. This makes cancellation persistent instead of clearing an object that a pending installer can recreate.
- Native state/error/end routes share installed-resource evidence. State/error also read the actual current native audio identity; end requires the installed paired placeholder. Existing event transport checks captured evidence at every actual listener delivery without changing its scheduler or payload argument positions. Error position/retry waits and normal recovery timers retain operation ownership.
- Extended cancellation through the actual pending play/URL/debounce chain. Additional 3 RED tests exposed play intent revival after permission, native-stop and debounce waits; 3 other RED tests exposed late core stop/new-resource races and duplicate native stop on completed projection. All now pass with the same operation identity. Completed native stop is marked on its status event to avoid issuing it twice; exhausted cleanup retains the original token and final pending consumption behavior.
- Cross-boundary regressions cover actual installer/stop/service/error consumers; explicit positive controls include new installation after stop, genuine paired end, current native state, current error retry and exhausted retry-next, remote commands, same-object selection, same-generation resource replacement at event delivery and native position, missing/rejected native lookup, stop at add/getQueue/skip, and the original resource debounce.
- The documentation now states selection, installation, installed-resource and stop-token lifecycles together and inventories every active native event entry. Already-issued native commands and payloads without an original occurrence ID remain explicit limitations. No native device or APK acceptance is claimed.

- Final request-entry check also rejects an expired selection before claiming an operation token; its regression first failed because an old direct request revoked current installed evidence, then passes. Cycle 9 final gates: default 80 files / 1,037 tests passed with saved exit code 0; native contract harness 4 files / 16 passed; typecheck, lint, Android production Metro and diff-check passed. A canceled polling session left an earlier full run incomplete; after the required wait, a single complete rerun established the final result. Dependencies/lock remain unchanged, no commit or push.

### Final independent review and delivery

- Cycle 9 focused and full reviews approve source/host scope with no verified major/minor findings. Full review independently reran 1,037 tests, native 16, typecheck, lint and production Metro; focused review added 29 external boundary probes. Reports are saved under docs/desktop-parity/reviews/2026-10-05-queue-catalog. Approved code candidate SHA256: e4b705c4ea1456afef1038d5a906814ac2835a3a8b458bb15e4b28a312a3a691.
- Delivery uses the isolated fix/mobile-queue-catalog-20261005 branch. Existing push CI filters cover feat/desktop-parity-20261003, master and beta; this fix branch is outside those filters. Local/independent host gates do not establish remote CI or APK/device acceptance.

### Enable build checks for the queue/catalog fix branch

- Add only fix/mobile-queue-catalog-20261005 to the existing build-test push branch filter; retain feat/desktop-parity-20261003 and pull requests targeting dev. Existing npm ci, unit tests, typecheck, lint, Metro build-test and Android debug assembly commands and read-only permissions are unchanged. Release/deployment workflows are unchanged.
- Locally reran the actual workflow commands available here: npm test (1,037 passed), npm run typecheck, npm run lint, npm run build-test -- --max-workers 1; all exit 0. This repository has no test:ci script. Generated bundle/assets are preserved outside the checkout.
- npm ci was not repeated over the authorized restored dependency artifacts. Android debug assembly is not locally verified: this environment has Java 21, no configured/discovered Android SDK, adb or sdkmanager; workflow uses Java 17 and the GitHub runner SDK. Debug signing uses the existing debug keystore and needs no private release-signing secret. Remote exact-commit CI verification is pending this isolated workflow patch review and push.
