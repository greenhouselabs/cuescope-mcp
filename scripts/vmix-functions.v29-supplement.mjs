/**
 * vMix 29 shortcut-function supplement — curated stopgap.
 *
 * CueScope's validator allowlist (src/validation/vmix-functions.generated.ts) is
 * generated from the `vmix-function-list` npm package, which is still at vMix 27
 * (latest published = 27.0.1 on npm AND the maintainer's GitHub master). These are
 * the 82 net-new shortcut functions in vMix 29, taken from the official reference:
 *   https://www.vmix.com/help29/ShortcutFunctionReference.html  (scraped 2026-06-30)
 * All 82 were verified verbatim in that page; 80/82 also appear in vmixapi.com's
 * data (the 2 it lacks, GO and VideoCallReconnect, are genuine Input-category rows
 * in the official page — vmixapi.com just lags).
 *
 * RETIREMENT: once `vmix-function-list` publishes a release >= the vMix version
 * that includes these, bump the devDependency, run `npm run generate:functions`,
 * and delete the now-redundant entries here (the union dedupes, so output is
 * unchanged).
 *
 * NOTE: names are stored in original case for readability; the generator
 * lowercases them. This list adds NAMES to the allowlist only — broader v29
 * feature support (e.g. 16 overlay channels, master/bus volume-fade adoption in
 * src/tools/audio/volume.ts) is deferred to a later release.
 */
export const V29_SUPPLEMENT = [
  // Audio (8)
  'SetBusAVolumeFade', 'SetBusBVolumeFade', 'SetBusCVolumeFade', 'SetBusDVolumeFade',
  'SetBusEVolumeFade', 'SetBusFVolumeFade', 'SetBusGVolumeFade', 'SetMasterVolumeFade',
  // Input (4)
  'GO', 'VideoCallConnect', 'VideoCallReconnect', 'ZoomJoinMeeting',
  // OMT (2)
  'OMTSelectSourceByIndex', 'OMTSelectSourceByName',
  // Overlay (28)
  'OverlayInput5', 'OverlayInput5In', 'OverlayInput5Last', 'OverlayInput5Off', 'OverlayInput5Out', 'OverlayInput5Zoom',
  'OverlayInput6', 'OverlayInput6In', 'OverlayInput6Last', 'OverlayInput6Off', 'OverlayInput6Out', 'OverlayInput6Zoom',
  'OverlayInput7', 'OverlayInput7In', 'OverlayInput7Last', 'OverlayInput7Off', 'OverlayInput7Out', 'OverlayInput7Zoom',
  'OverlayInput8', 'OverlayInput8In', 'OverlayInput8Last', 'OverlayInput8Off', 'OverlayInput8Out', 'OverlayInput8Zoom',
  'PreviewOverlayInput5', 'PreviewOverlayInput6', 'PreviewOverlayInput7', 'PreviewOverlayInput8',
  // Replay (28)
  'ReplayAppendLastEventText', 'ReplayAppendLastEventTextCamera',
  'ReplayAppendSelectedEventText', 'ReplayAppendSelectedEventTextCamera',
  'ReplayCCamera1', 'ReplayCCamera2', 'ReplayCCamera3', 'ReplayCCamera4',
  'ReplayCCamera5', 'ReplayCCamera6', 'ReplayCCamera7', 'ReplayCCamera8',
  'ReplayDCamera1', 'ReplayDCamera2', 'ReplayDCamera3', 'ReplayDCamera4',
  'ReplayDCamera5', 'ReplayDCamera6', 'ReplayDCamera7', 'ReplayDCamera8',
  'ReplayJumpToSelectedInPoint', 'ReplayJumpToSelectedOutPoint',
  'ReplayQuadModeOff', 'ReplayQuadModeOn',
  'ReplaySetChannelAToBTimecodeAndCamera', 'ReplaySetChannelBToATimecodeAndCamera',
  'ReplayToggleQuadMode', 'ReplayUpdateSelectedSpeedFromValue',
  // Transition (12)
  'SetStingerGTInput1', 'SetStingerGTInput2', 'SetStingerGTInput3', 'SetStingerGTInput4',
  'SetStingerGTInput5', 'SetStingerGTInput6', 'SetStingerGTInput7', 'SetStingerGTInput8',
  'Stinger5', 'Stinger6', 'Stinger7', 'Stinger8',
];
