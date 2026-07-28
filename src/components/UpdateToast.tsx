import { useEffect, useState } from 'react';

export function UpdateToast() {
  const [visible, setVisible] = useState(false);
  const [text, setText] = useState('A new update is available.');
  const [canInstall, setCanInstall] = useState(false);

  useEffect(() => {
    window.gcalc?.onUpdateAvailable?.((d) => {
      setText(`Downloading update ${d.version}…`);
      setCanInstall(false);
      setVisible(true);
    });
    window.gcalc?.onUpdateProgress?.((d) => {
      setText(`Downloading update… ${d.percent}%`);
      setVisible(true);
    });
    window.gcalc?.onUpdateReady?.((d) => {
      setText(`Update ${d.version} is ready to install.`);
      setCanInstall(true);
      setVisible(true);
    });
    window.gcalc?.onUpdateError?.(() => setVisible(false));
  }, []);

  if (!visible) return null;

  return (
    <div className="update-toast">
      <div className="update-text">{text}</div>
      <div className="update-actions">
        {canInstall && (
          <button
            type="button"
            className="update-btn"
            onClick={() => window.gcalc?.installUpdate?.()}
          >
            Restart &amp; Update
          </button>
        )}
        <button type="button" className="update-btn ghost" onClick={() => setVisible(false)}>
          Later
        </button>
      </div>
    </div>
  );
}
