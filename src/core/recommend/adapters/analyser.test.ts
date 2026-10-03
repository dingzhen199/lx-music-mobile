import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const native = vi.hoisted(() => ({ setEnabled: vi.fn(), sample: vi.fn() }))
vi.mock('react-native', () => ({ Platform: { OS: 'android' }, NativeModules: { AudioFeatureModule: native } }))
import { configureAudioAnalysis, getAnalyser, refreshAnalyser, releaseAudioAnalysis } from './analyser'

const activate = (trackId = 'song') => configureAudioAnalysis({ enabled: true, playing: true, trackId })
const frame = () => ({ generation: native.setEnabled.mock.calls.at(-1)![1], sessionId: 14, musicId: 'song', trackId: 'song__//1__//url', waveform: Array(128).fill(0.25), spectrum: Array(64).fill(-20) })
beforeEach(() => { releaseAudioAnalysis(); vi.clearAllMocks() })
afterEach(() => { releaseAudioAnalysis(); vi.useRealTimers() })

describe('per-player audio analyser', () => {
  it('does not sample without explicit opt-in and playback', async() => {
    await refreshAnalyser()
    expect(native.sample).not.toHaveBeenCalled()
    expect(getAnalyser()).toBeNull()
    configureAudioAnalysis({ enabled: true, playing: false, trackId: 'song' })
    await refreshAnalyser()
    expect(native.sample).not.toHaveBeenCalled()
  })
  it('uses a real frame once and exposes matching time/FFT arrays', async() => {
    activate()
    native.sample.mockResolvedValue(frame())
    await refreshAnalyser()
    const analyser = getAnalyser()!
    expect(analyser.fftSize).toBe(128)
    const wave = new Float32Array(128)
    const fft = new Float32Array(64)
    analyser.getFloatTimeDomainData(wave)
    analyser.getFloatFrequencyData(fft)
    expect(wave[0]).toBe(0.25)
    expect(fft[0]).toBe(-20)
    expect(getAnalyser()).toBeNull()
  })
  it.each(['pause', 'track', 'release'] as const)('discards in-flight samples after %s', async action => {
    activate()
    const old = frame()
    let resolve!: (value: ReturnType<typeof frame>) => void
    native.sample.mockImplementation(() => new Promise(r => { resolve = r }))
    const request = refreshAnalyser()
    await Promise.resolve()
    if (action === 'pause') configureAudioAnalysis({ enabled: true, playing: false, trackId: 'song' })
    if (action === 'track') activate('other')
    if (action === 'release') releaseAudioAnalysis()
    resolve(old)
    await request
    expect(getAnalyser()).toBeNull()
  })
  it('deduplicates concurrent requests and rejects session zero, placeholders, malformed and stale frames', async() => {
    activate()
    for (const change of [{ sessionId: 0 }, { trackId: 'song__//1__//default' }, { musicId: 'other' }, { waveform: [NaN] }]) {
      native.sample.mockResolvedValue({ ...frame(), ...change })
      await Promise.all([refreshAnalyser(), refreshAnalyser()])
      expect(getAnalyser()).toBeNull()
    }
    expect(native.sample).toHaveBeenCalledTimes(4)
    vi.useFakeTimers()
    native.sample.mockResolvedValue(frame())
    await refreshAnalyser()
    vi.advanceTimersByTime(501)
    expect(getAnalyser()).toBeNull()
  })
  it('recovers after a synchronously unavailable native module', async() => {
    activate()
    native.sample.mockImplementationOnce(() => { throw new Error('unavailable') })
    await refreshAnalyser()
    expect(getAnalyser()).toBeNull()
    native.sample.mockResolvedValue(frame())
    await refreshAnalyser()
    expect(getAnalyser()).not.toBeNull()
  })
  it('leaves unavailable or denied capture unknown', async() => {
    activate()
    native.sample.mockResolvedValue(null)
    await refreshAnalyser()
    expect(getAnalyser()).toBeNull()
    native.sample.mockRejectedValue(new Error('permission denied'))
    await refreshAnalyser()
    expect(getAnalyser()).toBeNull()
  })
})
