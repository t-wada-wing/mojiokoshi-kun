import { useEffect, useState } from 'react';
import { NavLink, Route, Routes } from 'react-router-dom';
import UpdateAvailableToast from './components/UpdateAvailableToast';
import UploadPage from './pages/UploadPage';
import DownloadPage from './pages/DownloadPage';
import { APP_UPDATED_DATE, APP_VERSION } from './appInfo';
import {
  applyPwaUpdate,
  registerPwaUpdateListener,
  subscribeToPwaUpdates,
} from './lib/pwaUpdate';

function navClassName(baseClassName: string) {
  return ({ isActive }: { isActive: boolean }) =>
    `${baseClassName}${isActive ? ' active' : ''}`;
}

export default function App() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToPwaUpdates(setUpdateAvailable);
    registerPwaUpdateListener();
    return unsubscribe;
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      await applyPwaUpdate();
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">音声ファイルアップロード</p>
          <h1>文字起こしくん</h1>
          <p className="app-version">Ver {APP_VERSION} / 更新日 {APP_UPDATED_DATE}</p>
        </div>
        <nav className="app-nav">
          <NavLink to="/" end className={navClassName('nav-link nav-link-main')}>
            アップロード
          </NavLink>
          <NavLink to="/download" className={navClassName('nav-link nav-link-sub')}>
            ダウンロード
          </NavLink>
        </nav>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/download" element={<DownloadPage />} />
        </Routes>
      </main>
      {updateAvailable ? (
        <UpdateAvailableToast updating={updating} onUpdate={() => void handleUpdate()} />
      ) : null}
    </div>
  );
}
