# Additional playback experience scope

This is a new user-requested change after the independently reviewed desktop-port source commit 65a7832. It supersedes the old desktop automatic collection writeback behavior; it is not covered by that review.

## Version identity

- Original collection entry ID and position remain stable. Manual choice stores `meta.toggleMusicInfo` and `meta.manualVersionPinned: true`. Choosing the original clears the alternate preference but preserves the explicit-choice marker.
- Historical unmarked `toggleMusicInfo` remains a legacy preference; no migration invents a manual choice.
- The common URL facade resolves the preferred version for playback and preload. Rescue only records runtime `resolvedMusicInfo`, never mutates the collection. A notice and the queue's temporary-source label explain the substitution. Next playback retries the preferred version.
- Cache records are accepted only when actual ID equals requested ID. New rescue URLs are stored only under their actual ID. Completed download files remain local-first, even offline. Local-source APIs that only return a URL cannot provide reliable actual version metadata; their runtime state explicitly reports unknown identity.
- Previewing B and confirming it returns the player to original collection identity A. The version dialog shows the effective preference and provides a direct original-version action; A → B → A is supported even when search does not return A.

## Queue and multiple selection

- The button beside progress opens current song, actual next song, pending FIFO items and the current base playlist. The playlist section does not promise a full random future order; next uses the same selector as playback/preload.
- Multi-select Play uses visible row order, clears the old pending queue and history, then plays exactly the selected rows through the existing temporary queue. No old/default playlist is appended after the batch. Ordinary single-row playback retains existing behavior.
- Queue reads invalidate pending next-song results on close/unmount/newer updates. New selection clears temporary resolution metadata.

## Exact artist/album catalogs

The horizontal and vertical player headers have artist and album actions. The shared desktop adapter/controller is adapted to the mobile request-object API. Artist IDs survive SDK normalization and conversion. Old tracks can resolve IDs from exact song detail; no fuzzy name search is presented as a full catalog. Collaborations show an artist picker. Paging deduplicates results, supports retry, and rejects stale close/switch results.

Currently available SDK routes: tx/wy/kg artist, kw/kg/mg album. Other provider/kind combinations explicitly report unsupported; this does not mean every provider exposes a full catalog. Results are the provider's catalog, subject to its availability. Unknown totals remain unknown, and a short page without a total is not falsely called complete.

## Verification boundaries and size

New host tests cover preferred URL/cache behavior, real manual handler identity, real player FIFO/URL commit, completed-download file-first behavior, provider paging, controller cancellation and rendered React controls with native hosts mocked. No live provider availability, Android rendering/accessibility/touch hit area or real device playback claim is made. Fresh independent review and final Metro are required after these additions.

Most added lines are reusable catalog SDK/adapters/controllers, two small RN views, three-language labels and regression fixtures. Existing queue/store/selection machinery is reused; the old automatic-writeback module/tests are removed. No new queue engine, storage layer or package dependency was added. ADRs remain untouched.
