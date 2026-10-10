// Web Audio API Sound Synthesizer & Player
// Generates pristine, instant iOS / Instagram-style acoustic cues without external asset lag

type SoundType = 'message_send' | 'message_receive' | 'voice_note_sent' | 'outgoing_ring' | 'incoming_ring' | 'call_connected' | 'call_ended'

let audioCtx: AudioContext | null = null

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
    if (AudioContextClass) {
      audioCtx = new AudioContextClass()
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
  return audioCtx
}

// Active loop ringtone references
let activeRingtoneOscillators: Array<{ stop: () => void }> = []

export function playDMSound(type: SoundType) {
  try {
    const ctx = getAudioContext()
    if (!ctx) return

    const now = ctx.currentTime

    switch (type) {
      case 'message_send': {
        // High, subtle warm "pop/whoosh" (Apple iOS sent message sound)
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(540, now)
        osc.frequency.exponentialRampToValueAtTime(1080, now + 0.08)

        gain.gain.setValueAtTime(0.18, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.1)
        break
      }

      case 'message_receive': {
        // Warm two-tone chime (Instagram/iMessage ding: F6 -> A6)
        const note1 = ctx.createOscillator()
        const gain1 = ctx.createGain()
        note1.type = 'sine'
        note1.frequency.setValueAtTime(1396.91, now) // F6

        gain1.gain.setValueAtTime(0.2, now)
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12)

        note1.connect(gain1)
        gain1.connect(ctx.destination)
        note1.start(now)
        note1.stop(now + 0.12)

        const note2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        note2.type = 'sine'
        note2.frequency.setValueAtTime(1760.0, now + 0.08) // A6

        gain2.gain.setValueAtTime(0.22, now + 0.08)
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

        note2.connect(gain2)
        gain2.connect(ctx.destination)
        note2.start(now + 0.08)
        note2.stop(now + 0.28)
        break
      }

      case 'voice_note_sent': {
        // Pleasant three-stage ascending harp ripple
        const freqs = [523.25, 659.25, 783.99] // C5, E5, G5
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          const startTime = now + idx * 0.06

          osc.type = 'triangle'
          osc.frequency.setValueAtTime(freq, startTime)
          gain.gain.setValueAtTime(0.22, startTime)
          gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.2)

          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(startTime)
          osc.stop(startTime + 0.2)
        })
        break
      }

      case 'call_connected': {
        // Pleasant upbeat confirmation chord
        const freqs = [440, 554.37, 659.25] // A4, C#5, E5
        freqs.forEach((freq) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.type = 'sine'
          osc.frequency.setValueAtTime(freq, now)
          gain.gain.setValueAtTime(0.15, now)
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
          osc.connect(gain)
          gain.connect(ctx.destination)
          osc.start(now)
          osc.stop(now + 0.35)
        })
        break
      }

      case 'call_ended': {
        // Gentle descending tone
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.setValueAtTime(440, now)
        osc.frequency.exponentialRampToValueAtTime(220, now + 0.25)
        gain.gain.setValueAtTime(0.18, now)
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now)
        osc.stop(now + 0.25)
        break
      }
    }
  } catch (err) {
    console.warn('Audio synthesis play error:', err)
  }
}

let ringtoneInterval: NodeJS.Timeout | null = null

export function startRingtone(mode: 'outgoing' | 'incoming') {
  stopRingtone()

  function playBurst() {
    const ctx = getAudioContext()
    if (!ctx) return
    const now = ctx.currentTime

    if (mode === 'outgoing') {
      // Clean European/iOS standard ringback: 440Hz + 480Hz dual-frequency chime
      const osc1 = ctx.createOscillator()
      const osc2 = ctx.createOscillator()
      const gain = ctx.createGain()

      osc1.type = 'sine'
      osc2.type = 'sine'
      osc1.frequency.setValueAtTime(440, now)
      osc2.frequency.setValueAtTime(480, now)

      gain.gain.setValueAtTime(0.12, now)
      gain.gain.linearRampToValueAtTime(0.12, now + 1.2)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3)

      osc1.connect(gain)
      osc2.connect(gain)
      gain.connect(ctx.destination)

      osc1.start(now)
      osc2.start(now)
      osc1.stop(now + 1.3)
      osc2.stop(now + 1.3)
    } else {
      // Instagram-style modern melodic ringtone: rapid marimba arpeggio
      const notes = [659.25, 783.99, 987.77, 1318.51, 987.77, 1318.51] // E5, G5, B5, E6, B5, E6
      notes.forEach((freq, idx) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        const start = now + idx * 0.12

        osc.type = 'sine'
        osc.frequency.setValueAtTime(freq, start)
        gain.gain.setValueAtTime(0.18, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.18)

        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.18)
      })
    }
  }

  playBurst()
  ringtoneInterval = setInterval(playBurst, mode === 'outgoing' ? 3200 : 2500)
}

export function stopRingtone() {
  if (ringtoneInterval) {
    clearInterval(ringtoneInterval)
    ringtoneInterval = null
  }
}
