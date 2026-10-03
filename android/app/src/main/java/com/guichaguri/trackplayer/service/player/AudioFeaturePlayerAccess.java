package com.guichaguri.trackplayer.service.player;

import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;

/** Narrow access to our pinned TrackPlayer's protected player; never uses reflection. */
@UnstableApi
public final class AudioFeaturePlayerAccess {
    private AudioFeaturePlayerAccess() {}
    public static ExoPlayer get(ExoPlayback<?> playback) {
        return playback instanceof LocalPlayback ? ((LocalPlayback) playback).player : null;
    }
}
