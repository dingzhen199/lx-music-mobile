import { NativeModules, Platform } from 'react-native'

interface NativeFrame {
  generation: number
  sessionId: number
  musicId: string
  trackId: string
  waveform: number[]
  spectrum: number[]
}
interface NativeAnalyser {
  setEnabled: (enabled: boolean, generation: number) => void
  sample: (musicId: string, generation: number) => Promise<NativeFrame | null>
}
export interface AudioAnalysisContext {
  enabled: boolean
  trackId: string | null
  playing: boolean
}

let context: AudioAnalysisContext = { enabled: false, trackId: null, playing: false }
let generation = 0
let frame: { value: NativeFrame, receivedAt: number } | null = null
let pending: { generation: number, promise: Promise<void> } | null = null
const bridge = (): NativeAnalyser | undefined => Platform.OS === 'android' ? NativeModules.AudioFeatureModule : undefined
const active = (): boolean => context.enabled && context.playing && !!context.trackId

/** Explicit opt-in plus actual playback state. The native side independently checks permission/state. */
export const configureAudioAnalysis = (next: AudioAnalysisContext): void => {
  if (next.enabled === context.enabled && next.trackId === context.trackId && next.playing === context.playing) return
  context = { ...next }
  generation++
  frame = null
  pending = null
  try { bridge()?.setEnabled(active(), generation) } catch { /* Unsupported native build remains unknown. */ }
}

/** Releases capture/binding and invalidates every in-flight response. Call on stop/teardown. */
export const releaseAudioAnalysis = (): void => {
  context = { enabled: false, trackId: null, playing: false }
  generation++
  frame = null
  pending = null
  try { bridge()?.setEnabled(false, generation) } catch { /* Already torn down. */ }
}

const validFrame = (value: NativeFrame, expected: string, requestGeneration: number): boolean => {
  return value.generation === requestGeneration && value.musicId === expected && Number.isInteger(value.sessionId) && value.sessionId > 0 &&
    typeof value.trackId === 'string' && value.trackId.length > 0 && !value.trackId.endsWith('__//default') &&
    Array.isArray(value.waveform) && Array.isArray(value.spectrum) && value.waveform.length >= 128 &&
    value.waveform.length <= 1024 && value.spectrum.length * 2 === value.waveform.length &&
    value.waveform.every(n => Number.isFinite(n) && n >= -1 && n <= 1) && value.spectrum.every(Number.isFinite)
}

/** Await immediately before getAnalyser(). No timers, fabricated samples, or repeated cached frames. */
export const refreshAnalyser = async(): Promise<void> => {
  const native = bridge()
  if (!active() || !native) { frame = null; return }
  if (pending?.generation === generation) return pending.promise
  frame = null
  const currentGeneration = generation
  const expected = context.trackId!
  const promise = Promise.resolve().then(async() => {
    try {
      const value = await native.sample(expected, currentGeneration)
      if (generation !== currentGeneration || !active()) return
      if (value && validFrame(value, expected, currentGeneration)) frame = { value, receivedAt: Date.now() }
    } catch { /* Permission/device/capture failures remain unknown, with no feature bucket. */ } finally { if (pending?.generation === currentGeneration) pending = null }
  })
  pending = { generation: currentGeneration, promise }
  return promise
}

/** One-shot synchronous WebAudio-shaped view over a freshly awaited native frame. */
export const getAnalyser = () => {
  const current = frame
  frame = null
  if (!active() || !current || Date.now() - current.receivedAt > 500 || current.value.generation !== generation) return null
  const value = current.value
  return {
    fftSize: value.waveform.length,
    frequencyBinCount: value.spectrum.length,
    getFloatTimeDomainData: (data: Float32Array): void => { data.set(value.waveform.slice(0, data.length)) },
    getFloatFrequencyData: (data: Float32Array): void => { data.set(value.spectrum.slice(0, data.length)) },
  }
}
