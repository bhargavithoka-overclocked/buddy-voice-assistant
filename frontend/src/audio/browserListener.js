const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const browserListeningSupported = Boolean(Recognition);

/**
 * Free speech-to-text using the browser's built-in speech recognition.
 * Gives live "interim" text while you talk, then the final text when you
 * pause. Used in the free setup instead of sending audio to the server.
 */
export class BrowserListener {
  constructor({ onInterim, onFinal, onError }) {
    this.onInterim = onInterim;
    this.onFinal = onFinal;
    this.onError = onError;
    this.active = false;
  }

  start() {
    if (!Recognition || this.active) return;
    this.active = true;
    this.listen();
  }

  listen() {
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) this.onFinal(text);
        } else {
          interim += result[0].transcript;
        }
      }
      if (interim.trim()) this.onInterim(interim.trim());
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        this.active = false;
        this.onError?.("I can't hear you. Allow microphone access in your browser, or type to me instead.");
      }
      // "no-speech" and "aborted" are normal, it just starts again
    };

    // Chrome stops after a bit of silence, so keep it going while we're listening
    recognition.onend = () => {
      if (this.active) setTimeout(() => this.active && this.listen(), 250);
    };

    try {
      recognition.start();
    } catch {
      // already running
    }
    this.recognition = recognition;
  }

  stop() {
    this.active = false;
    this.recognition?.abort();
    this.recognition = null;
  }
}
