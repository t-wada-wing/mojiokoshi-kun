import { useEffect, useState } from 'react';
import { SCHOOLS } from '../constants';
import {
  deleteRecord,
  downloadUrl,
  downloadZipUrl,
  fetchRecords,
  verifyPasscode,
  type RecordItem,
} from '../lib/api';

const PASSCODE_STORAGE_KEY = 'transcribe-passcode';

export default function DownloadPage() {
  const [passcode, setPasscode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [school, setSchool] = useState('');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [actionMessage, setActionMessage] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(PASSCODE_STORAGE_KEY);
    if (saved) {
      setPasscode(saved);
      setAuthenticated(true);
    }
  }, []);

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError('');
    const ok = await verifyPasscode(passcode);
    if (!ok) {
      setAuthError('パスコードが正しくありません');
      setAuthenticated(false);
      return;
    }
    sessionStorage.setItem(PASSCODE_STORAGE_KEY, passcode);
    setAuthenticated(true);
  };

  const loadRecords = async (selectedSchool: string) => {
    setSchool(selectedSchool);
    setLoading(true);
    setListError('');
    setActionMessage('');
    try {
      const items = await fetchRecords(passcode, selectedSchool);
      setRecords(items);
    } catch (error) {
      setRecords([]);
      setListError(error instanceof Error ? error.message : '一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('この記録を削除しますか？')) return;
    try {
      await deleteRecord(passcode, id);
      setActionMessage('削除しました');
      if (school) {
        await loadRecords(school);
      }
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : '削除に失敗しました');
    }
  };

  if (!authenticated) {
    return (
      <section className="card narrow">
        <h2>ダウンロード / 管理</h2>
        <p className="lead">パスコードを入力してください。</p>
        <form className="form-grid" onSubmit={handleAuth}>
          <label>
            パスコード
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {authError ? <p className="field-error">{authError}</p> : null}
          <button type="submit" className="primary-button">
            ログイン
          </button>
        </form>
      </section>
    );
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h2>ダウンロード / 管理</h2>
          <p className="lead">スクールを選択して文字起こし結果を確認・ダウンロードできます。</p>
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            sessionStorage.removeItem(PASSCODE_STORAGE_KEY);
            setAuthenticated(false);
            setPasscode('');
            setSchool('');
            setRecords([]);
          }}
        >
          ログアウト
        </button>
      </div>

      <label>
        スクール
        <select value={school} onChange={(e) => loadRecords(e.target.value)}>
          <option value="">選択してください</option>
          {SCHOOLS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {school ? (
        <div className="toolbar">
          <a className="secondary-button" href={downloadZipUrl(passcode, school)}>
            このスクールを一括ダウンロード (zip)
          </a>
        </div>
      ) : null}

      {loading ? <p>読み込み中...</p> : null}
      {listError ? <p className="field-error">{listError}</p> : null}
      {actionMessage ? <p className="field-hint">{actionMessage}</p> : null}

      {records.length > 0 ? (
        <div className="record-list">
          {records.map((record) => (
            <article key={record.id} className="record-item">
              <div>
                <strong>{record.student_name}</strong>
                <p>
                  {record.grade} / {record.class} / {record.filename}
                </p>
                <p className="record-date">{record.created_at}</p>
              </div>
              <div className="record-actions">
                <a className="secondary-button" href={downloadUrl(passcode, record.id)}>
                  txt
                </a>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => handleDelete(record.id)}
                >
                  削除
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {school && !loading && records.length === 0 && !listError ? (
        <p className="field-hint">このスクールの記録はまだありません。</p>
      ) : null}
    </section>
  );
}
