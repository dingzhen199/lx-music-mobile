# Source runtime and playlist parity

Reference: desktop feature `df3e9791`, comparison base `ad95d509`; mobile base `fb848072`.

## Custom sources

- Android now keeps separate QuickJS threads keyed by API ID. Every native event and request is bound to an immutable per-load token; unloaded and older same-ID runtimes cannot initialize or answer for the current source.
- Primary initialization has an independent 10-second deadline. Switching releases previous waiters, and late valid initialization can recover later playback. Backup initialization does not settle primary readiness.
- Settings support ordered, independently enabled backups. Playback exhausts primary and enabled/ready backups for the current provider before trying another provider; explicit no-toggle mode and requested quality remain respected.
- Source imports, removals and update-alert changes are serialized across persistence and UI publication. Failed writes cannot publish phantom entries or mutate existing flags. Import/remove interleavings cannot resurrect a source whose script was removed.
- Storage stages uniquely named chunks before committing root references. Old chunks remain reachable on staging/commit failure. Retired chunks are cleaned only after success; cleanup failure does not turn a committed write into a false failure.
- Playback URL results retain resolved provider identity through cache hits and preloading. Pure list-writeback orchestration is injected into the player: only an owned list and a genuine provider change qualify, and stale playback is rechecked after asynchronous list operations.

## Online playlists

- Open-list input detects supported provider URLs, shows the detected provider, strips surrounding share text, and preserves token-bearing input. Plain IDs retain the selected provider. Authority extraction avoids incomplete React Native URL getters and rejects lookalike domains.
- Collection deduplicates by raw playlist ID plus provider and snapshots cover/description/author before fetching songs. Metadata survives local list creation, ordinary edits, backup import/export and sync serialization. Older sync peers cannot erase populated local metadata with absent fields.
- Online lists update sequentially at startup by default unless explicitly disabled. Settings → List exposes per-list automatic-update controls, manual update, last success and failure details.
- Refresh waits for song persistence before recording success. Song replacement persists before publishing memory/events; failure keeps the previous in-memory and persisted list.

## Verification

Native-free regression coverage includes runtime generations, request routing, readiness isolation, backup rotation, transactional source mutations, storage failure cases, resolved-identity writeback, URL handling, metadata persistence, duplicate collection, metadata snapshots, update completion and failed overwrite retention. The parent task runs the combined single-worker Vitest suite.

Android compilation and device/emulator behavior are not verified by these mocked tests. Native multi-runtime initialization, teardown, background playback, UI layout, and the real persistence backend still require Android acceptance testing. No new iOS native implementation was introduced.

## Independent review repair

Failed staged writes now clean only this attempt's chunks/scripts after rereading their authoritative root/list references. Commit-then-error does not delete live data; failed reread or cleanup conservatively retains data rather than guessing. Subsequent source-list mutations reload durable state. Deferred-write, partial-write, commit-then-error, failed-reread and real storage/import tests cover these paths. Primary timeout updates per-source status, and removal clears runtime capabilities before notifying observers.
