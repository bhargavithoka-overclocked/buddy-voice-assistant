import { useEffect, useState } from "react";
import { api } from "../api.js";
import DesktopSettings from "./DesktopSettings.jsx";

function Status({ name, info, provider, extra }) {
  const [test, setTest] = useState(null);

  async function runTest() {
    setTest({ message: "Checking..." });
    try {
      setTest(await api.testConnection(provider));
    } catch (err) {
      setTest({ ok: false, message: err.message });
    }
  }

  return (
    <div className="status-card">
      <div className="status-line">
        <span className={`dot ${info.connected ? "on" : ""}`} />
        <strong>{name}</strong>
        <span className="source">{info.connected ? info.source : "Not set up"}</span>
        {provider && <button onClick={runTest}>Test</button>}
      </div>
      {info.models && (
        <div className="models">
          Fast: <code>{info.models.fast}</code> &nbsp; Smart: <code>{info.models.smart}</code>
        </div>
      )}
      {extra}
      {test && <div className={`test ${test.ok ? "good" : test.ok === false ? "bad" : ""}`}>{test.message}</div>}
    </div>
  );
}

function Code({ children }) {
  return <pre className="command">{children}</pre>;
}

export default function Settings({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch((err) => setError(err.message));
  }, []);

  const missing = settings?.ollama.connected && settings.ollama.missing.length > 0 && (
    <div className="test bad">Not downloaded yet: {settings.ollama.missing.join(", ")}</div>
  );

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <div className="modal-head">
          <h2>Settings</h2>
          <button className="icon-button" onClick={onClose} title="Close">✕</button>
        </div>

        {error && <p className="error">Can't reach the backend: {error}</p>}

        {settings?.demo_mode && (
          <p className="notice">
            Buddy is in <strong>demo mode</strong>, so replies are made up and his voice is a beep.
            Set <code>DEMO_MODE=false</code> in <code>backend/.env</code> to talk to him for real.
          </p>
        )}

        {settings && (
          <>
            <Status name="Local AI (free)" info={settings.ollama} provider="ollama" extra={missing} />
            <Status name="Gemini (free)" info={settings.gemini} provider="gemini" />
            <Status name="Claude" info={settings.claude} provider="claude" />
            <Status name="ChatGPT" info={settings.openai} provider="openai" />
            <div className="status-card">
              <div className="status-line">
                <span className={`dot ${settings.voice.engine === "openai" || settings.voice.piper_installed ? "on" : "meh"}`} />
                <strong>Voice</strong>
                <span className="source">
                  Talks with {settings.voice.voice}, listens with {settings.voice.listening}
                </span>
              </div>
            </div>
          </>
        )}

        <DesktopSettings />

        {/* in the desktop app the setup wizard already took care of these */}
        {!window.buddyDesktop && (
          <>
            <h3>Free: AI on your own computer (Ollama)</h3>
            <ol>
              <li>Download Ollama from <a href="https://ollama.com/download" target="_blank" rel="noreferrer">ollama.com</a> and open it.</li>
              <li>Download the two models Buddy uses (a few GB, once):</li>
            </ol>
            <Code>ollama pull {settings?.ollama.models.fast || "llama3.2:3b"}{"\n"}ollama pull {settings?.ollama.models.smart || "llama3.1:8b"}</Code>
            <p className="hint">That's it, no account or key. It runs offline and nothing leaves your computer.</p>

            <h3>Free: Buddy's voice (Piper)</h3>
            <p>Without this he uses your browser's voice, which works but sounds more robotic. From the <code>backend</code> folder:</p>
            <Code>python -m piper.download_voices {settings?.voice.piper_voice || "en_US-ryan-medium"} --download-dir voices</Code>
            <p className="hint">About 60 MB, then restart the backend. Listening always uses your browser's speech recognition (Chrome, Edge or Safari).</p>
          </>
        )}

        <h3>Free: Gemini (smarter, runs in the cloud)</h3>
        <ol>
          <li>Go to <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a> and sign in with a Google account.</li>
          <li>Create an API key. No card needed for the free tier.</li>
          <li>
            Add it as <code>GEMINI_API_KEY=...</code> to {window.buddyDesktop ? <code>buddy.env</code> : <code>backend/.env</code>}
            {window.buddyDesktop ? " in Buddy's folder, then restart Buddy." : " and restart the backend."}
          </li>
        </ol>
        <p className="hint">The free tier has daily limits, and Google may use free-tier conversations to improve their products.</p>

        <details>
          <summary>Paid options: Claude and ChatGPT</summary>
          <p>
            These use API keys, which are billed separately from a Claude Pro/Max or ChatGPT Plus subscription.
            Subscriptions and logins like Claude Code or Codex can't be used by other apps.
          </p>
          <ol>
            <li>
              Claude: create a key in the <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">Anthropic Console</a> and
              add it as <code>ANTHROPIC_API_KEY=...</code> (or run <code>ant auth login</code> if you use Anthropic's CLI).
            </li>
            <li>
              ChatGPT: create a key at <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a>,
              add it as <code>OPENAI_API_KEY=...</code> and set <code>OPENAI_FAST_MODEL</code> / <code>OPENAI_SMART_MODEL</code>.
            </li>
            <li>For OpenAI's voice instead of the free one, also set <code>VOICE_ENGINE=openai</code>.</li>
          </ol>
        </details>

        <p className="hint">
          Keys stay in {window.buddyDesktop ? <code>buddy.env</code> : <code>backend/.env</code>} on your computer.
          Buddy never shows or sends them anywhere else.
        </p>
      </div>
    </div>
  );
}
