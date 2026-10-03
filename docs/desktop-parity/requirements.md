# Desktop → mobile parity matrix

Fixed reference: df3e97915d40bd7b9efceb8421a120637b0c4617 compared with ad95d5091c9ed689fa72b5e5c849df65f5a679ce. 211 changed files. Complete file inventory: desktop-diff.tsv. All rows initially pending; no row is implicitly waived.

| Capability | Desktop evidence | Mobile adaptation / acceptance |
|---|---|---|
| Platform aggregate recommendation | platformRecall/platformEngine, tx/wy simiSong, similarFusion/Cache, seedMatch | Exact cross-platform seed matching; provider partial/all/empty states; bounded cache, cancellation, de-duplication and provenance; default zero-LLM route |
| AI and local exploration | engine/recall/judgment/prompts/gates/vocalGate/confidenceGate | Preserve filters, confidence gates, instruction changes, diversity, ranking and no-key local path; OpenAI-compatible/Anthropic transport with cancellation, retry/concurrency/token handling |
| Explore screen | views/Explore, nav, PlayBar | Reachable RN exploration screen, engine/settings, anchor/path/reason/provider status, play/feedback/dislike and manual start |
| Radio lifecycle | session/session-core, player events | Persistent toggle; first-play restart, manual off, follow-song reanchor, run-scoped policy, user queue preservation; epoch cancellation and bounded retry/failure closure; automatic refill gating |
| Profile and metrics | profile/profile-core, data, list events | Persist local counters, 500-event/200-artist bounds, love/complete/actual user skip; pause/stop/speed correctness; endorsement and independent summary channel; no telemetry |
| Audio feature facts | feature, player analyzer | Native playback analysis seam; report unavailable honestly, never manufacture acoustic facts; requires native validation |
| Alternate playback identity | player/action, music toggleWriteback, songIdentity | Prefer recommended source then alternate same-song, before ordinary fallback; preserve source evidence and same-song association; writeback guards |
| Main/backup custom sources | main/userApi, useInitUserApi, apiSource, sourceRotation/Capabilities | Multiple enabled sources ordered; independent native runtimes/init generations; main-only nonstream requests; finite readiness/cancellation; UI removal/order/recovery |
| Import integrity | userApi main/rendererEvent, backup E2E | Script/list persistence atomicity, stale init prevention, import local/URL errors, single import per gesture, remove caller IDs untouched |
| Playlist URL recognition | songListUrl, OpenListModal | Share-text/provider detection, SDK-compatible identifiers incl. token form; explicit source when numeric IDs ambiguous |
| Playlist origin metadata | list types/DB/store/detail/update/share/sync | Imported sourceListId/source location survives restore, sync and update; local list identity preserved; migrate old metadata safely |
| Playback/cache consistency | music URL DB/cache, preload/search, request, list watcher | Preserve per-source cache namespace and quality; no stale autoplay/update races; request error handling |
| Secrets and settings | sensitiveSetting, Backup, setting sync | Strip API keys and source selections from exported/synced configuration as PC; local key persistence disclosed |
| Regression/infrastructure | tests, e2e, CI/docs | Reuse portable regression suites, add mobile event/adapter tests; lint/types/Metro and native build checked where environment supports; true device validation tracked separately |

## Documentation policy
Update mobile documentation to describe delivered behavior. Do not copy desktop historical completion claims or ADRs. Existing desktop docs remain reference-only.
