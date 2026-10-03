package cn.toside.music.mobile.audioFeature;

import android.Manifest;
import android.content.ComponentName;
import android.content.Intent;
import android.content.ServiceConnection;
import android.content.pm.PackageManager;
import android.media.audiofx.Visualizer;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import androidx.core.content.ContextCompat;
import androidx.media3.common.TrackSelectionParameters.AudioOffloadPreferences;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import com.facebook.react.bridge.*;
import com.guichaguri.trackplayer.service.MusicBinder;
import com.guichaguri.trackplayer.service.MusicService;
import com.guichaguri.trackplayer.service.Utils;
import com.guichaguri.trackplayer.service.models.Track;
import com.guichaguri.trackplayer.service.player.AudioFeaturePlayerAccess;
import com.guichaguri.trackplayer.service.player.ExoPlayback;

/** Captures only this app's current player session, never output mix (session zero) or microphone. */
@UnstableApi
public final class AudioFeatureModule extends ReactContextBaseJavaModule implements ServiceConnection {
    private final Handler main = new Handler(Looper.getMainLooper());
    private MusicBinder binder;
    private boolean bound;
    private boolean enabled;
    private int generation;
    private Visualizer visualizer;
    private Promise pending;

    public AudioFeatureModule(ReactApplicationContext context) { super(context); }
    @Override public String getName() { return "AudioFeatureModule"; }

    private boolean permitted() {
        return ContextCompat.checkSelfPermission(getReactApplicationContext(), Manifest.permission.RECORD_AUDIO)
                == PackageManager.PERMISSION_GRANTED;
    }

    @ReactMethod public void setEnabled(boolean value, int nextGeneration) {
        main.post(() -> {
            generation = nextGeneration;
            enabled = value && permitted();
            finish(null);
            if (!enabled) unbind();
            else bind();
        });
    }

    private void bind() {
        if (bound || !enabled || !permitted()) return;
        Intent intent = new Intent(getReactApplicationContext(), MusicService.class);
        intent.setAction(Utils.CONNECT_INTENT);
        try {
            // Deliberately no startService and no BIND_AUTO_CREATE.
            bound = getReactApplicationContext().bindService(intent, this, 0);
        } catch (RuntimeException ignored) { bound = false; }
    }

    private void unbind() {
        binder = null;
        if (bound) {
            try { getReactApplicationContext().unbindService(this); } catch (RuntimeException ignored) {}
            bound = false;
        }
    }
    @Override public void onServiceConnected(ComponentName name, IBinder service) {
        if (!enabled || !bound || !(service instanceof MusicBinder)) { unbind(); return; }
        binder = (MusicBinder) service;
    }
    @Override public void onServiceDisconnected(ComponentName name) { finish(null); unbind(); }
    @Override public void onBindingDied(ComponentName name) { finish(null); unbind(); }
    @Override public void onNullBinding(ComponentName name) { finish(null); unbind(); }

    private String identity(ExoPlayback<?> playback, String expectedMusicId) {
        Track track = playback.getCurrentTrack();
        if (track == null || track.originalItem == null) return null;
        Object musicId = track.originalItem.get("musicId");
        Object rawId = track.originalItem.get("id");
        if (musicId == null || rawId == null || !expectedMusicId.equals(String.valueOf(musicId))) return null;
        String id = String.valueOf(rawId);
        return id.endsWith("__//default") ? null : id;
    }

    private boolean usable(ExoPlayer player) {
        // Conservatively reject even potential offload rather than reporting misleading PCM features.
        return player != null && player.getApplicationLooper() == Looper.getMainLooper()
                && player.isPlaying() && player.getAudioSessionId() > 0 && !player.isSleepingForOffload()
                && player.getTrackSelectionParameters().audioOffloadPreferences.audioOffloadMode
                == AudioOffloadPreferences.AUDIO_OFFLOAD_MODE_DISABLED;
    }

    @ReactMethod public void sample(String expectedMusicId, int requestedGeneration, Promise promise) {
        main.post(() -> sampleOnMain(expectedMusicId, requestedGeneration, promise, 0));
    }

    private void sampleOnMain(String expectedMusicId, int requestedGeneration, Promise promise, int bindWait) {
            if (!enabled || !permitted() || requestedGeneration != generation || pending != null) {
                promise.resolve(null); return;
            }
            bind();
            if (binder == null) {
                if (bound && bindWait < 10) {
                    main.postDelayed(() -> sampleOnMain(expectedMusicId, requestedGeneration, promise, bindWait + 1), 50);
                } else promise.resolve(null);
                return;
            }
            pending = promise;
            try {
                ExoPlayback<?> playback = binder.getPlayback();
                ExoPlayer player = AudioFeaturePlayerAccess.get(playback);
                String id = identity(playback, expectedMusicId);
                if (id == null || !usable(player)) { finish(null); return; }
                int session = player.getAudioSessionId();
                // Session is verified strictly positive before construction. Never use session 0.
                visualizer = new Visualizer(session);
                int[] sizes = Visualizer.getCaptureSizeRange();
                int size = Math.min(1024, sizes[1]);
                if (size < sizes[0] || visualizer.setCaptureSize(size) != Visualizer.SUCCESS
                        || visualizer.setScalingMode(Visualizer.SCALING_MODE_AS_PLAYED) != Visualizer.SUCCESS
                        || visualizer.setEnabled(true) != Visualizer.SUCCESS) { finish(null); return; }
                Visualizer capture = visualizer;
                // Allow a real current-session buffer to arrive; validate identity again before returning.
                main.postDelayed(() -> {
                    if (capture != visualizer) return;
                    try {
                        if (!enabled || !permitted() || generation != requestedGeneration || binder == null
                                || binder.getPlayback() != playback || !usable(player)
                                || player.getAudioSessionId() != session
                                || !id.equals(identity(playback, expectedMusicId))) { finish(null); return; }
                        byte[] wave = new byte[size];
                        byte[] fft = new byte[size];
                        if (capture.getWaveForm(wave) != Visualizer.SUCCESS
                                || capture.getFft(fft) != Visualizer.SUCCESS) { finish(null); return; }
                        // All-zero FFT is ambiguous (silence, unsupported route, or unready capture): unknown.
                        boolean signal = false;
                        for (byte value : fft) if (value != 0) { signal = true; break; }
                        if (!signal) { finish(null); return; }
                        WritableArray waveform = Arguments.createArray();
                        WritableArray spectrum = Arguments.createArray();
                        for (byte value : wave) waveform.pushDouble(((value & 255) - 128) / 128.0);
                        for (int k = 0; k < size / 2; k++) {
                            double re = fft[k == 0 ? 0 : k * 2];
                            double im = k == 0 ? 0 : fft[k * 2 + 1];
                            double magnitude = Math.hypot(re, im) / 128.0;
                            spectrum.pushDouble(magnitude > 0 ? 20 * Math.log10(magnitude) : -160);
                        }
                        WritableMap result = Arguments.createMap();
                        result.putInt("generation", requestedGeneration);
                        result.putInt("sessionId", session);
                        result.putString("musicId", expectedMusicId);
                        result.putString("trackId", id);
                        result.putArray("waveform", waveform);
                        result.putArray("spectrum", spectrum);
                        finish(result);
                    } catch (RuntimeException ignored) { finish(null); }
                }, 100);
            } catch (RuntimeException ignored) { finish(null); }
    }

    private void finish(WritableMap result) {
        if (visualizer != null) {
            try { visualizer.release(); } catch (RuntimeException ignored) {}
            visualizer = null;
        }
        Promise promise = pending;
        pending = null;
        if (promise != null) promise.resolve(result);
    }
    @Override public void invalidate() {
        main.post(() -> { enabled = false; generation++; finish(null); unbind(); });
        super.invalidate();
    }
}
