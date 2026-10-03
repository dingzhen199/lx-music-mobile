# Validation ledger

## Pinned inputs
Mobile master `fb8480728d875fa5e0da25eebd3a26bb71723aae`; desktop master `ad95d5091c9ed689fa72b5e5c849df65f5a679ce`; desktop feature `df3e97915d40bd7b9efceb8421a120637b0c4617`.

## Evidence as of current implementation pass

1. Portable algorithms and mocked orchestration: 52 suites / 790 tests passed (pre-review final). Includes ranking, identity, cancellation, radio/profile, source readiness and storage failure scenarios. No live music/LLM account requests were made
2. Real JavaScript event/store/storage boundary: `nativeBridge.test.ts` uses actual AppEvent/StateEvent, player store mutations and adapter subscriptions. It checks same-tick A→B→A identity reset, queue metadata, old UI asynchronous delivery, exception isolation, synchronous unsubscribe and deferred duration generation rejection. `recommendationData.test.ts` verifies ordered snapshots and recovery from rejected writes. Storage tests use controlled AsyncStorage I/O, not a real Android database
3. Full TypeScript check passed again after all source changes with `tsc --noEmit`. Exact Git dependencies were materialized from their pinned upstream source archives and their declaration build run separately; no recursive Git prepare or native build scripts executed
4. Android production Metro JavaScript bundle passed once with one worker and a 512 MB Node heap, producing a 2.9 MB bundle and 8 assets. A temporary external watch folder was needed for isolated dependency materialization. Small subsequent callback/preload/settings fixes require a final bundle recheck if resources allow
5. One-shot full ESLint hit the 512 MB V8 heap limit; log preserved. The identical repository rules then passed across serialized bounded groups covering all 713 JS/TS input files (including ignored-path notices), followed by corrected/changed-file rechecks. No global lint rule was disabled
6. Java available; Android SDK/ANDROID_HOME and adb not available. Android Java/Kotlin/Gradle build, install, native bridge execution, UI layout and real-device lifecycle tests NOT RUN. No iOS delivery claim

## Required Android/device checks

- Import valid/invalid/local/URL scripts, remove a source during import, failed storage, reordered main/backups, late/same-ID init and script cancellation; independent real script runtimes must be proven
- Main-source failure → ordered backup stream → known alternate same-song → provider search; unsupported providers, quality fallback, cache hit and current-list replacement without interrupting playback
- Radio start/stop/restart, repeated taps, rapid A→B→A, pause/stop/error/manual/natural/deletion transitions, speed changes, queue ownership, background/foreground and screen rotation
- Explore page on narrow phones, accessibility labels, scrolling, feedback/path replay, AI connection states and permission interruption
- Playlist URL detection/token form, duplicate collect, startup opt-out, manual update failure preserves local songs, restore/sync with older peers retains metadata
- Optional analyzer: deny/revoke permission, disable offload and restart, valid current-session samples, pause/repeat/cancel/teardown races, unsupported device/silent route stays unknown. Android Visualizer is approximate output measurement, not desktop full-precision WebAudio parity

## Primary API references
- [Android Visualizer](https://developer.android.com/reference/android/media/audiofx/Visualizer)
- [Media3 ExoPlayer](https://developer.android.com/reference/androidx/media3/exoplayer/ExoPlayer)

## Publication gate
Independent spec and quality review still pending. No push, merge or release is implied by these host checks.
