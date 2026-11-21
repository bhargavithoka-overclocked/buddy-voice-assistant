import { useEffect, useState } from "react";

// only shown in the desktop app, where window.buddyDesktop exists
export default function DesktopSettings() {
  const desktop = window.buddyDesktop;
  const [info, setInfo] = useState(null);
  const [keepData, setKeepData] = useState(true);

  useEffect(() => {
    desktop?.info().then(setInfo);
  }, [desktop]);

  if (!desktop || !info) return null;

  return (
    <>
      <h3>Buddy's folder</h3>
      <p>Everything Buddy uses (chats, AI models, voice, settings) is in:</p>
      <div className="folder-row">
        <code>{info.dataDir}</code>
        <button onClick={() => desktop.showDataFolder()}>Show in Finder</button>
      </div>
      <p className="hint">
        Keys for Gemini, Claude or ChatGPT go in <code>buddy.env</code> in that folder (same format as the
        <code> .env</code> steps below), then restart Buddy.
      </p>

      <h3>Uninstall Buddy</h3>
      <label className="check">
        <input type="checkbox" checked={keepData} onChange={(e) => setKeepData(e.target.checked)} />
        Keep my chats and downloads (only remove the app)
      </label>
      <button className="danger" onClick={() => desktop.uninstall(keepData)}>
        {keepData ? "Uninstall the app" : "Uninstall Buddy and delete his folder"}
      </button>
    </>
  );
}
