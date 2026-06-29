import { NavLink, Route, Routes } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import DownloadPage from './pages/DownloadPage';
import { APP_UPDATED_DATE, APP_VERSION } from './appInfo';

function navClassName(baseClassName: string) {
  return ({ isActive }: { isActive: boolean }) =>
    `${baseClassName}${isActive ? ' active' : ''}`;
}

export default function App() {
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
    </div>
  );
}
