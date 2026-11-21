/**
 * Plays Buddy's reply one sentence at a time, in order, even if the
 * audio for sentence 3 arrives before sentence 2. Also measures how loud
 * he is right now, which drives his mouth.
 */
export class SpeechPlayer {
  constructor({ onSentence, onFinished }) {
    this.onSentence = onSentence; // called when a sentence starts playing
    this.onFinished = onFinished; // called when the whole reply has played
    this.context = null;
    this.reset();
  }

  ensureContext() {
    if (!this.context) {
      this.context = new AudioContext();
      this.analyser = this.context.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.connect(this.context.destination);
      this.samples = new Float32Array(this.analyser.fftSize);
    }
    // browsers start audio "suspended" until the user has clicked something
    if (this.context.state === "suspended") this.context.resume();
  }

  reset() {
    this.decoded = new Map(); // index -> { buffer, text }
    this.nextIndex = 0;
    this.playing = null;
    this.replyComplete = false;
    this.generation = (this.generation || 0) + 1;
  }

  get isPlaying() {
    return this.playing !== null;
  }

  async add(index, base64, text) {
    this.ensureContext();
    const generation = this.generation;
    const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
    const buffer = await this.context.decodeAudioData(bytes.buffer);
    if (generation !== this.generation) return; // stopped while decoding
    this.decoded.set(index, { buffer, text });
    this.playNext();
  }

  // the server has sent every sentence of this reply
  finishReply() {
    this.replyComplete = true;
    this.checkFinished();
  }

  playNext() {
    if (this.playing || !this.decoded.has(this.nextIndex)) return;
    const { buffer, text } = this.decoded.get(this.nextIndex);
    this.decoded.delete(this.nextIndex);
    this.nextIndex += 1;

    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    source.onended = () => {
      if (this.playing !== source) return;
      this.playing = null;
      this.playNext();
      this.checkFinished();
    };
    this.playing = source;
    source.start();
    this.onSentence?.(text);
  }

  checkFinished() {
    if (this.replyComplete && !this.playing && this.decoded.size === 0) {
      this.replyComplete = false;
      this.onFinished?.();
    }
  }

  stop() {
    const source = this.playing;
    this.reset();
    if (source) {
      source.onended = null;
      source.stop();
    }
  }

  get level() {
    if (!this.playing) return 0;
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const s of this.samples) sum += s * s;
    return Math.min(Math.sqrt(sum / this.samples.length) * 5, 1);
  }
}
