import { encodeWav } from "./wav.js";

const PRE_ROLL_SECONDS = 0.4; // keep a little audio from before speech was detected
const START_MS = 150; // this much loud audio counts as "started talking"
const SILENCE_MS = 800; // this much quiet counts as "finished talking"
const MAX_SECONDS = 30;
// the mic hands over tiny 128-sample batches (under 3 ms). That's shorter than one
// vibration of a voice, so the volume is measured over 20 ms frames instead.
const FRAME_MS = 20;

/**
 * Listens to the mic, works out when the user starts and stops talking
 * (simple voice activity detection on the volume), and hands back each
 * utterance as a WAV file.
 */
export class Microphone {
  constructor({ onLevel, onSpeechStart, onSpeechEnd }) {
    this.onLevel = onLevel;
    this.onSpeechStart = onSpeechStart;
    this.onSpeechEnd = onSpeechEnd;
    this.listening = false;
    this.strict = false; // while Buddy talks, so his own voice doesn't count as the user
    this.level = 0;
    this.noiseFloor = 0.01;
    this.reset();
  }

  async start() {
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    this.context = new AudioContext();
    await this.context.audioWorklet.addModule("/mic-processor.js");
    const source = this.context.createMediaStreamSource(this.stream);
    this.node = new AudioWorkletNode(this.context, "mic-processor");
    this.node.port.onmessage = (event) => this.handleSamples(event.data);
    source.connect(this.node);
  }

  stop() {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.context?.close();
    this.stream = this.context = null;
  }

  reset() {
    this.recording = false;
    this.chunks = [];
    this.preRoll = [];
    this.loudMs = 0;
    this.quietMs = 0;
    this.pending = [];
    this.pendingLength = 0;
  }

  setListening(listening) {
    this.listening = listening;
    if (!listening) this.reset();
  }

  handleSamples(samples) {
    this.pending.push(samples);
    this.pendingLength += samples.length;
    if (this.pendingLength < (this.context.sampleRate * FRAME_MS) / 1000) return;

    const frame = new Float32Array(this.pendingLength);
    let offset = 0;
    for (const chunk of this.pending) {
      frame.set(chunk, offset);
      offset += chunk.length;
    }
    this.pending = [];
    this.pendingLength = 0;
    this.handleFrame(frame);
  }

  handleFrame(samples) {
    const rate = this.context.sampleRate;
    const ms = (samples.length / rate) * 1000;

    let sum = 0;
    for (const s of samples) sum += s * s;
    const rms = Math.sqrt(sum / samples.length);
    this.level = this.level * 0.7 + rms * 0.3;
    this.onLevel?.(Math.min(this.level * 8, 1));

    if (!this.listening) return;

    if (!this.recording) {
      // slowly learn how loud the room is when nobody is talking
      this.noiseFloor = this.noiseFloor * 0.995 + rms * 0.005;
      this.preRoll.push(samples);
      while (this.preRoll.length * samples.length > rate * PRE_ROLL_SECONDS) this.preRoll.shift();
    } else {
      this.chunks.push(samples);
    }

    const threshold = Math.max(0.01, this.noiseFloor * 3) * (this.strict ? 2.5 : 1);
    const loud = rms > threshold;

    if (!this.recording) {
      // a short dip between syllables shouldn't start the count over
      this.loudMs = loud ? this.loudMs + ms : Math.max(0, this.loudMs - ms);
      if (this.loudMs >= (this.strict ? START_MS * 2 : START_MS)) {
        this.recording = true;
        this.chunks = [...this.preRoll];
        this.quietMs = 0;
        this.onSpeechStart?.();
      }
      return;
    }

    this.quietMs = loud ? 0 : this.quietMs + ms;
    const seconds = (this.chunks.length * samples.length) / rate;
    if (this.quietMs >= SILENCE_MS || seconds >= MAX_SECONDS) {
      const wav = encodeWav(this.chunks, rate);
      this.reset();
      this.onSpeechEnd?.(wav);
    }
  }
}
