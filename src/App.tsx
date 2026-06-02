import { Link, Route, Routes } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import DownloadPage from './pages/DownloadPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">文字起こしPWA</p>
          <h1>文字起こしくん</h1>
        </div>
        <nav className="app-nav">
          <Link to="/">アップロード</Link>
          <Link to="/download">ダウンロード</Link>
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
