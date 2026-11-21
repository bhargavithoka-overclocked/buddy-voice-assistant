// "hey buddy", plus the ways speech recognition likes to mishear it
const WAKE_PHRASE = /\b(hey|hi|hay|ok|okay)[\s,.!]*bud+(y|dy|ie)?\b/i;

const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export const wakeWordSupported = Boolean(Recognition);

export function isWakePhrase(text) {
  return WAKE_PHRASE.test(text);
}

/**
 * Listens for "Hey Buddy" using the browser's built-in speech recognition.
 * Only runs while Buddy is asleep. Nothing goes to Buddy's backend until the
 * phrase is heard (note: Chrome's recognition itself runs on Google's servers).
 */
export class WakeWordListener {
  constructor(onWake) {
    this.onWake = onWake;
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
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (isWakePhrase(event.results[i][0].transcript)) {
          this.stop();
          this.onWake();
          return;
        }
      }
    };
    recognition.onerror = (event) => {
      // the user said no to the mic, so stop asking
      if (event.error === "not-allowed" || event.error === "service-not-allowed") this.active = false;
    };
    // Chrome stops listening after a while on its own, so start again
    recognition.onend = () => {
      if (this.active) setTimeout(() => this.active && this.listen(), 300);
    };

    try {
      recognition.start();
    } catch {
      // already started
    }
    this.recognition = recognition;
  }

  stop() {
    this.active = false;
    this.recognition?.abort();
    this.recognition = null;
  }
}
