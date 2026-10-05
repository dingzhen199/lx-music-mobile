# Additional playback experience scope

This is a new user-requested change after the independently reviewed desktop-port source commit 65a7832. It supersedes the old desktop automatic collection writeback behavior; it is not covered by that review.

## Version identity

- Original collection entry ID and position remain stable. Manual choice stores `meta.toggleMusicInfo` and `meta.manualVersionPinned: true`. Choosing the original clears the alternate preference but preserves the explicit-choice marker.
- Historical unmarked `toggleMusicInfo` remains a legacy preference; no migration invents a manual choice.
- The common URL facade resolves the preferred version for playback and preload. Rescue only records runtime `resolvedMusicInfo`, never mutates the collection. A notice and the queue's temporary-source label explain the substitution. Next playback retries the preferred version.
- Cache records are accepted only when actual ID equals requested ID. New rescue URLs are stored only under their actual ID. Completed download files remain local-first, even offline. Local-source APIs that only return a URL cannot provide reliable actual version metadata; their runtime state explicitly reports unknown identity.
- Cover fetching never writes entire collection metadata; old playback responses require owner identity and generation.
- Version changes reload the current owner without clearing pending selected songs, and update matching queued entries in place.
- Previewing B and confirming it returns the player to original collection identity A. The version dialog shows the effective preference and provides a direct original-version action; A → B → A is supported even when search does not return A.

## Queue and multiple selection

- The button beside progress opens current song, actual next song, pending FIFO items and the current base playlist. The playlist section does not promise a full random future order; next uses the same selector as playback/preload.
- Radio retains its saved preference but is suspended throughout a finite batch and at its end; ordinary-list playback or explicitly starting a station restores recommendations. Old in-flight results are invalidated. The queue states this pause.
- Multi-select Play uses visible row order, clears the old pending queue and history, then plays exactly the selected rows through the existing temporary queue. No old/default playlist is appended after the batch. Ordinary single-row playback retains existing behavior.
- Queue reads invalidate pending next-song results on close/unmount/newer updates. New selection clears temporary resolution metadata.

## Exact artist/album catalogs

The horizontal and vertical player headers have artist and album actions. The shared desktop adapter/controller is adapted to the mobile request-object API. Artist IDs survive SDK normalization and conversion. Old tracks can resolve IDs from exact song detail; no fuzzy name search is presented as a full catalog. Collaborations show an artist picker. Virtualized views bound rendered rows. Catalog errors/titles/count units follow the active language. Paging deduplicates results, supports retry, and rejects stale close/switch results.

Currently integrated SDK routes: tx/wy/kg artist, tx/wy/kw/kg/mg album. QQ supports both numeric album IDs and existing alphanumeric album MIDs. Other online provider/kind combinations report not-integrated, without claiming the provider permanently lacks that capability. Local tracks report unsupported; missing identity and failed responses remain separate errors. Results are the provider's catalog, subject to its availability. Unknown totals remain unknown, and a short page without a total is not falsely called complete.

## Verification boundaries and size

New host tests cover preferred URL/cache behavior, real manual handler identity, real player FIFO/URL commit, completed-download file-first behavior, provider paging, controller cancellation and rendered React controls with native hosts mocked. No live provider availability, Android rendering/accessibility/touch hit area or real device playback claim is made. Historical source a42c560 passed its recorded host checks and production Metro; that statement is not validation of the current candidate. The 2026-10-05 queue/catalog candidate has separate review logs and WORK_LOG entries. Its initial default-suite, type/lint and Metro failures were caused by missing locked-Git dependency artifacts. After explicit authorization, exact-revision local TypeScript artifact restoration unblocked these checks; current results are recorded separately from the historical failure logs. Isolated native mocks still do not replace default/build validation. Native/device validation remains open.

Most added lines are reusable catalog SDK/adapters/controllers, two small RN views, three-language labels and regression fixtures. Existing queue/store/selection machinery is reused; the old automatic-writeback module/tests are removed. No new queue engine, storage layer or package dependency was added. ADRs remain untouched.

## Playback event ownership and exhausted cleanup (2026-10-05 candidate)

Playback generation is the existing player-state generation; no parallel owner counter or queue engine is introduced. Event payloads append it without changing the existing reason/progress values.

| Event group | Delivery / owner-writing consumer | Ownership handling |
| --- | --- | --- |
| `playerEnded` | Deferred `init/player/player.handleEnded`; progress/status/next | Emission generation checked before any side effect; current natural ending retains list/list-loop/single-loop/random behavior |
| `playerError`, `playerLoadstart`, `playerPlaying`, `playerWaiting`, `playerEmptied` | Deferred `playerEvent` handlers | Emission generation at entry; original owner also spans position reads and both timer levels |
| `play`, `pause`, `stop`, `error` | Synchronous player/progress/recommendation observers; deferred lyric/notification projection | Immediate observers run at emission; deferred projections check emission generation. A stop may still clear lyrics when no current owner remains |
| `setProgress` | Deferred native seek/progress and preload cursor | Generation is the third payload field, after the existing time/max-time values; stale seek is rejected |
| `musicToggled` | Synchronous retry/progress/recommendation/preload reset; deferred lyric reset | Reason remains first, generation is second; internal resets are synchronous, deferred lyric reset is owner-checked |
| `picUpdated`, `lyricUpdated` | Deferred notification / lyric update | Emission generation at entry; downstream metadata and lyric async reads retain their own generation |
| `playerLoadeddata` | Synchronous recommendation duration snapshot | Tagged at emission; no deferred playback-owner write in current consumers |
| `playerPause`, `lyricOffsetUpdate` | No active playback-owner consumer found | `playerPause` is tagged consistently with raw playback events; offset event currently has no active listener |
| Collection / UI / volume events | List changes, favorites, panels and global settings | Not an instruction to replay an old song. Collection watchers resolve the current relevant list; these notifications are not discarded as old track transitions |

| Ended / stop / cleanup state | Existing-path action |
| --- | --- |
| Old ended event delivered after a new selection, including same-object reselection | Ignore before progress, status or next selection |
| Current owner naturally ends | Existing `playNext(true)` and configured mode select the next entry |
| Current owner exhausts finite/base continuation | Await native stop, then defer final cleanup using the original generation |
| New explicit selection while stop or cleanup is pending | Original generation no longer matches; do not stop/clear/advance the new owner |
| Pending songs arrive during native stop | Final cleanup callback consumes the first through existing playNext; preserves remaining FIFO, alternatives and recommendation metadata |
| Pending songs arrive after stop resolves but before cleanup executes | Same final callback recheck; no premature empty-current transition |
| No pending song at the final callback | Clear current; preserve finite-batch recommendation suppression |
| Songs arrive after current has already been cleared | Existing addTempPlayList auto-start path applies |
| Normal stop projection arrives after current was cleared | Empty-owner lyric cleanup is allowed; it must not touch a subsequently selected active owner |

These are JS ownership and host-contract guarantees. They do not invent a native track identifier absent from an upstream event, and do not constitute APK/device/audio/accessibility acceptance.

## Native playback ownership

The existing selection generation and native install action have different lifetimes. The former identifies the selected occurrence; the latter identifies work allowed to install or stop its native resource. The old random install action ID is now the single monotonic resourceOperationId. There is no second playback engine or scheduler.

| Identity | Created / changed | What it proves |
| --- | --- | --- |
| playbackGeneration | Every selection change, including the same song object | The selected occurrence is still current |
| resourceOperationId | A resource request claims it before debounce; direct native installation claims it at entry; explicit stop increments it synchronously | Only the latest installation/stop operation may continue. Stop permanently revokes earlier pending publishers even if their audio ID was already assigned |
| installedResource | Published only after actual native add/skip completes under the current operation; contains generation, operation ID, unique audio ID and its separately generated placeholder ID | This exact pair was installed for the current operation. Null, a song ID, a suffix, or an early-assigned resourceTrackId is not installation evidence |
| Stop completion token | The same resourceOperationId captured after stop's synchronous revocation | A late stop continuation may skip/project/clear only if no newer operation claimed ownership. It is not an additional counter |

The URL attempt, play initialization waits, existing debounce and actual installer all preserve their operation token. A stop cancels work already waiting in any of those stages. A new explicit resource request after stop gets a new token and can install normally. Metadata-only restore installation also checks cancellation at its awaits. The installer still reflects completed native add/remove bookkeeping to keep the app-managed list aligned, even when the canceled work can no longer start playback or publish installed authority.

The completed core stop emits a status projection marked nativeStopped; its consumer does not start a second native stop. Exhausted cleanup uses the same stop token while retaining its final pending-FIFO check. Normal empty-owner lyric cleanup remains allowed, while a new selection or resource invalidates the old stop projection.

| Active native callback | Required evidence / effects |
| --- | --- |
| PlaybackTrackChanged | Capture selection and operation at entry; read actual app-managed current native ID. Initial assignment may update the shared native ID but cannot end playback. Natural end requires the current installed pair's exact placeholder, before pause, after pause and before every emitted effect |
| PlaybackState | Capture the installed resource, await current native audio identity, then require the same installed object/operation before state effects and timeout exit |
| PlaybackError | Same installed-current-audio proof before logical error and raw playerError. No resource or an old native audio under a newly selected song is rejected |
| RemoteSeek | Explicit current-user intent carrying its selection generation |
| RemotePlay / Pause / Next / Previous | Existing explicit user commands, not inferred native lifecycle events |
| RemoteStop | Existing global user exit action |
| playerLoadeddata | Core native duration read checks exact audio ID, selection and operation; deferred delivery retains that operation proof |
| Legacy PlaybackQueueEnded | Commented out; no listener is registered |

Automatic native events carry a validation closure for the captured installed resource through the existing Event delivery mechanism. It is checked before each synchronous and deferred listener, so a synchronous observer or a resource replacement before deferred delivery cannot retag the event. Event ordering and its existing setImmediate scheduling remain unchanged. The error consumer also captures the operation for native position reads, URL retry and recursive timers; its intentional exhausted-retry stop captures the resulting recovery operation for normal next scheduling.

PlaybackTrackChanged is the only registered native natural-end producer. Error and state callbacks cannot authenticate a selected but uninstalled song from a stable null resource. Installed-current error still retries twice and then follows the existing error-next path; normal current playback and paired natural ending remain enabled.

The native API supplies no original occurrence ID in state/error payloads. Current-resource proof rejects observable mismatches; it cannot reconstruct the historical origin of an event already delayed until after a different resource is fully current. Already-issued native commands cannot be retroactively canceled; the guards prevent later JS continuation, event attribution and republishing, not execution of bridge work already sent. These tests use the real installer/list/stop/AppEvent/error and ended consumers with native bridge leaf operations mocked. They are not APK, physical-device, audible playback or touch/accessibility acceptance.
