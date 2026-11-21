// a deeper-sounding voice suits a gorilla, if the browser has one
function pickBrowserVoice() {
  const voices = speechSynthesis.getVoices().filter((v) => v.lang.startsWith("en"));
  return (
    voices.find((v) => /daniel|alex|aaron|arthur|male/i.test(v.name)) || voices.find((v) => v.default) || voices[0] || null
  );
}

/**
 * Plays Buddy's reply one sentence at a time, in order, even if the
 * audio for sentence 3 arrives before sentence 2. Also measures how loud
 * he is right now, which drives his mouth.
 *
 * Sentences come either as audio (from Piper or OpenAI) or as plain text
 * with format "browser", which the browser's own voice reads out.
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

  async add(index, base64, text, format = "wav") {
    this.ensureContext();
    const generation = this.generation;
    let buffer = null;
    if (format !== "browser") {
      const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0));
      buffer = await this.context.decodeAudioData(bytes.buffer);
    }
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

    if (buffer) this.playBuffer(buffer);
    else this.speakWithBrowser(text);
    this.onSentence?.(text);
  }

  sentenceEnded(current) {
    if (this.playing !== current) return;
    this.playing = null;
    this.playNext();
    this.checkFinished();
  }

  playBuffer(buffer) {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.connect(this.analyser);
    const current = {
      stop: () => {
        source.onended = null;
        source.stop();
      },
    };
    source.onended = () => this.sentenceEnded(current);
    this.playing = current;
    source.start();
  }

  speakWithBrowser(text) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = pickBrowserVoice();
    utterance.pitch = 0.8;
    // there's no audio to measure, so make his mouth move on each word instead
    utterance.onboundary = () => (this.pulse = 1);
    const current = {
      browser: true,
      stop: () => {
        utterance.onend = utterance.onerror = null;
        speechSynthesis.cancel();
      },
    };
    utterance.onend = utterance.onerror = () => this.sentenceEnded(current);
    this.playing = current;
    this.pulse = 0.6;
    speechSynthesis.speak(utterance);
  }

  checkFinished() {
    if (this.replyComplete && !this.playing && this.decoded.size === 0) {
      // the next reply numbers its sentences from 0 again
      this.reset();
      this.onFinished?.();
    }
  }

  stop() {
    const current = this.playing;
    this.reset();
    current?.stop();
  }

  get level() {
    if (!this.playing) return 0;
    if (this.playing.browser) {
      this.pulse *= 0.9;
      return 0.2 + this.pulse * 0.6 * (0.7 + 0.3 * Math.sin(performance.now() / 60));
    }
    this.analyser.getFloatTimeDomainData(this.samples);
    let sum = 0;
    for (const s of this.samples) sum += s * s;
    return Math.min(Math.sqrt(sum / this.samples.length) * 5, 1);
  }
}
