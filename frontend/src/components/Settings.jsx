import { useEffect, useState } from "react";
import { api } from "../api.js";

function Status({ name, info, provider }) {
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
        <span className="source">{info.connected ? `Found: ${info.source}` : "Not set up"}</span>
        {provider && <button onClick={runTest}>Test</button>}
      </div>
      {info.models && (
        <div className="models">
          Fast: <code>{info.models.fast}</code> &nbsp; Smart: <code>{info.models.smart}</code>
        </div>
      )}
      {test && <div className={`test ${test.ok ? "good" : test.ok === false ? "bad" : ""}`}>{test.message}</div>}
    </div>
  );
}

export default function Settings({ onClose }) {
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getSettings().then(setSettings).catch((err) => setError(err.message));
  }, []);

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
            Add your keys below and set <code>DEMO_MODE=false</code> to talk to him for real.
          </p>
        )}

        {settings && (
          <>
            <Status name="Claude" info={settings.claude} provider="claude" />
            <Status name="ChatGPT" info={settings.openai} provider="openai" />
            <Status name="Voice (speech to text and back)" info={settings.voice} />
          </>
        )}

        <h3>How to connect Claude</h3>
        <ol>
          <li>Go to the <a href="https://console.anthropic.com" target="_blank" rel="noreferrer">Anthropic Console</a> and sign in.</li>
          <li>Open <strong>API Keys</strong> and create a new key.</li>
          <li>In the <code>backend</code> folder, copy <code>.env.example</code> to <code>.env</code> and paste it in as <code>ANTHROPIC_API_KEY=...</code></li>
          <li>Restart the backend.</li>
        </ol>
        <p className="hint">
          Already use Anthropic's <code>ant</code> command line tool? Run <code>ant auth login</code> once and Buddy
          will pick it up, no key needed. A Claude Pro/Max subscription or a Claude Code login doesn't include
          API access, the API is billed separately.
        </p>

        <h3>How to connect ChatGPT (and Buddy's voice)</h3>
        <ol>
          <li>Go to <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">platform.openai.com/api-keys</a> and sign in.</li>
          <li>Create a new secret key, and add some credit under Billing if you haven't already.</li>
          <li>Add it to <code>backend/.env</code> as <code>OPENAI_API_KEY=...</code></li>
          <li>Set <code>OPENAI_FAST_MODEL</code> and <code>OPENAI_SMART_MODEL</code> to the models you want, then restart the backend.</li>
        </ol>
        <p className="hint">
          Buddy uses OpenAI to hear you and to talk back, even when Claude is doing the thinking. A ChatGPT Plus
          subscription or a Codex login doesn't include API credit.
        </p>

        <p className="hint">Your keys stay in <code>backend/.env</code> on your computer. Buddy never shows or sends them anywhere else.</p>
      </div>
    </div>
  );
}
