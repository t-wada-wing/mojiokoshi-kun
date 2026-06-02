import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import DownloadPage from './pages/DownloadPage';

function navClassName(baseClassName: string) {
  return ({ isActive }: { isActive: boolean }) =>
    `${baseClassName}${isActive ? ' active' : ''}`;
}

export default function App() {
  const isAnalysisPage = useLocation().pathname.startsWith('/download');

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">音声ファイルアップロード</p>
          <h1>文字起こしくん</h1>
        </div>
        <nav className="app-nav">
          <NavLink to="/" end className={navClassName('nav-link nav-link-main')}>
            アップロード
          </NavLink>
          <NavLink to="/download" className={navClassName('nav-link nav-link-sub')}>
            分析
          </NavLink>
        </nav>
      </header>
      <main className={`app-main${isAnalysisPage ? ' app-main--wide' : ''}`}>
        <Routes>
          <Route path="/" element={<UploadPage />} />
          <Route path="/download" element={<DownloadPage />} />
        </Routes>
      </main>
    </div>
  );
}
