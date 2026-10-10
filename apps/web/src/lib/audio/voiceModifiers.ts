// ==============================================================================
// WebAudio Voice Modifiers & Anonymous Pitch Shifters
// Filters: none (natural), deep, helium, robot, whisper
// ==============================================================================

export type VoiceFilterType = 'none' | 'deep' | 'helium' | 'robot' | 'whisper'

export interface VoiceFilterOption {
  id: VoiceFilterType
  name: string
  emoji: string
  description: string
}

export const VOICE_FILTERS: VoiceFilterOption[] = [
  { id: 'none', name: 'Original', emoji: '🎙️', description: 'Natural voice' },
  { id: 'deep', name: 'Deep Pitch', emoji: '🕶️', description: 'Deep baritone pitch shifter' },
  { id: 'helium', name: 'Helium', emoji: '🎈', description: 'High-pitched frequency boost' },
  { id: 'robot', name: 'Cyborg Robot', emoji: '🤖', description: 'Modulated robotic ring frequency' },
  { id: 'whisper', name: 'Soft Whisper', emoji: '🤫', description: 'High-pass breathy whisper filter' },
]

export interface ProcessedAudioResult {
  stream: MediaStream
  audioContext: AudioContext
  cleanup: () => void
}

/**
 * Applies client-side WebAudio DSP filters to an incoming audio MediaStream.
 * Returns a new MediaStream destination suitable for MediaRecorder or WebRTC transmission.
 */
export function applyVoiceFilterToStream(
  inputStream: MediaStream,
  filterType: VoiceFilterType
): ProcessedAudioResult {
  if (filterType === 'none') {
    return {
      stream: inputStream,
      audioContext: new (window.AudioContext || (window as any).webkitAudioContext)(),
      cleanup: () => {},
    }
  }

  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
  const source = audioCtx.createMediaStreamSource(inputStream)
  const destination = audioCtx.createMediaStreamDestination()

  let lastNode: AudioNode = source

  if (filterType === 'deep') {
    // Low-pass filter to accentuate low frequencies + Biquad low-shelf boost
    const lowShelf = audioCtx.createBiquadFilter()
    lowShelf.type = 'lowshelf'
    lowShelf.frequency.value = 320
    lowShelf.gain.value = 14

    const lowPass = audioCtx.createBiquadFilter()
    lowPass.type = 'lowpass'
    lowPass.frequency.value = 1600

    lastNode.connect(lowShelf)
    lowShelf.connect(lowPass)
    lastNode = lowPass
  } else if (filterType === 'helium') {
    // High-pass filter with peaking resonance
    const highPass = audioCtx.createBiquadFilter()
    highPass.type = 'highpass'
    highPass.frequency.value = 650

    const peaking = audioCtx.createBiquadFilter()
    peaking.type = 'peaking'
    peaking.frequency.value = 2400
    peaking.gain.value = 12
    peaking.Q.value = 2

    lastNode.connect(highPass)
    highPass.connect(peaking)
    lastNode = peaking
  } else if (filterType === 'robot') {
    // Ring Modulation using an Oscillator connected to a GainNode
    const modulator = audioCtx.createOscillator()
    const modGain = audioCtx.createGain()
    const carrierGain = audioCtx.createGain()

    modulator.type = 'sine'
    modulator.frequency.value = 50 // 50Hz robotic ring frequency
    modGain.gain.value = 1

    carrierGain.gain.value = 0
    modulator.connect(carrierGain.gain)
    lastNode.connect(carrierGain)

    modulator.start()
    lastNode = carrierGain
  } else if (filterType === 'whisper') {
    // High-pass filter + Bandpass to simulate airy vocal breath
    const highPass = audioCtx.createBiquadFilter()
    highPass.type = 'highpass'
    highPass.frequency.value = 1200

    const bandPass = audioCtx.createBiquadFilter()
    bandPass.type = 'bandpass'
    bandPass.frequency.value = 3200
    bandPass.Q.value = 1.2

    lastNode.connect(highPass)
    highPass.connect(bandPass)
    lastNode = bandPass
  }

  // Connect final node to the stream destination
  lastNode.connect(destination)

  return {
    stream: destination.stream,
    audioContext: audioCtx,
    cleanup: () => {
      audioCtx.close().catch(() => {})
    },
  }
}
