import { useEffect, useMemo, useState } from 'react';
import AnalysisModal, { type AnalysisModalMode } from '../components/AnalysisModal';
import BlockingProgressOverlay from '../components/BlockingProgressOverlay';
import { MAX_BULK_ANALYZE, SCHOOLS } from '../constants';
import {
  analyzeRecord,
  deleteRecord,
  downloadAnalysisSelectedZipUrl,
  downloadAnalysisZipUrl,
  downloadSelectedZipUrl,
  downloadUrl,
  downloadZipUrl,
  fetchMonthlyUsage,
  fetchRecords,
  fetchUploadMonitor,
  verifyPasscode,
  type MonthlyUsageResponse,
  type RecordItem,
  type UploadMonitorData,
} from '../lib/api';

const PASSCODE_STORAGE_KEY = 'transcribe-passcode';

type DownloadTab = 'ai' | 'admin';
type AiActionTab = 'download' | 'analyze' | 'view';

type BatchProgressState = {
  active: boolean;
  message: string;
  percent: number;
  note: string;
};

const IDLE_BATCH_PROGRESS: BatchProgressState = {
  active: false,
  message: '',
  percent: 0,
  note: '',
};

function parseServerDate(value: string | null | undefined): Date | null {
  if (!value) return null;

  const normalized = value.includes('T') ? value : `${value.replace(' ', 'T')}Z`;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function formatDateTime(value: string | null | undefined): string {
  const date = parseServerDate(value);
  if (!date) return value ?? '';

  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(date);
}

function dateTimeValue(value: string | null | undefined): number {
  return parseServerDate(value)?.getTime() ?? 0;
}

function formatBytes(value: number): string {
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)}KB`;
  return `${Math.floor(value / 1024 / 1024)}MB`;
}

function filenameFromDisposition(disposition: string | null, fallback: string): string {
  if (!disposition) return fallback;

  const encoded = disposition.match(/filename\*=UTF-8''([^;]+)/);
  if (encoded?.[1]) {
    try {
      return decodeURIComponent(encoded[1]);
    } catch {
      return fallback;
    }
  }

  const plain = disposition.match(/filename="?([^";]+)"?/);
  return plain?.[1] ?? fallback;
}

async function errorFromDownloadResponse(response: Response): Promise<string> {
  const contentType = response.headers.get('Content-Type') ?? '';
  if (contentType.includes('application/json')) {
    const data = (await response.json()) as { error?: string };
    return data.error ?? `ダウンロードに失敗しました (${response.status})`;
  }

  const text = await response.text();
  return text || `ダウンロードに失敗しました (${response.status})`;
}

async function startDownload(href: string, fallbackFilename: string): Promise<void> {
  const response = await fetch(href);
  if (!response.ok) {
    throw new Error(await errorFromDownloadResponse(response));
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filenameFromDisposition(response.headers.get('Content-Disposition'), fallbackFilename);
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

export default function DownloadPage() {
  const [passcode, setPasscode] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState('');
  const [school, setSchool] = useState('');
  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState('');
  const [actionMessage, setActionMessage] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [uploadMonitor, setUploadMonitor] = useState<UploadMonitorData | null>(null);
  const [monitorError, setMonitorError] = useState('');
  const [monthlyUsage, setMonthlyUsage] = useState<MonthlyUsageResponse | null>(null);
  const [usageError, setUsageError] = useState('');
  const [batchProgress, setBatchProgress] = useState<BatchProgressState>(IDLE_BATCH_PROGRESS);
  const batchBusy = batchProgress.active;
  const [activeTab, setActiveTab] = useState<DownloadTab>('ai');
  const [aiActionTab, setAiActionTab] = useState<AiActionTab>('download');
  const [adminLoaded, setAdminLoaded] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [analysisModal, setAnalysisModal] = useState<{
    open: boolean;
    title: string;
    content: string;
    loading: boolean;
    cached: boolean;
    mode: AnalysisModalMode;
    recordId: number | null;
    downloadName: string;
  }>({
    open: false,
    title: '',
    content: '',
    loading: false,
    cached: false,
    mode: 'view',
    recordId: null,
    downloadName: '',
  });

  const selectedRecords = useMemo(
    () => records.filter((record) => selectedIds.has(record.id)),
    [records, selectedIds],
  );

  const latestDownloads = useMemo(
    () =>
      [...records]
        .filter((record) => record.downloaded_at)
        .sort((a, b) => dateTimeValue(b.downloaded_at) - dateTimeValue(a.downloaded_at))
        .slice(0, 5),
    [records],
  );

  const allSelected = records.length > 0 && records.every((record) => selectedIds.has(record.id));
  const undownloadedCount = records.filter((record) => !record.downloaded_at).length;
  const unanalyzedRecords = useMemo(
    () => records.filter((record) => !record.analyzed_at),
    [records],
  );
  const selectedUnanalyzedRecords = useMemo(
    () => selectedRecords.filter((record) => !record.analyzed_at),
    [selectedRecords],
  );
  const analyzedRecords = useMemo(
    () => records.filter((record) => record.analyzed_at),
    [records],
  );
  const analyzedRecordsSorted = useMemo(
    () =>
      [...analyzedRecords].sort(
        (a, b) => dateTimeValue(b.analyzed_at) - dateTimeValue(a.analyzed_at),
      ),
    [analyzedRecords],
  );
  const latestAnalyzed = useMemo(() => analyzedRecordsSorted.slice(0, 5), [analyzedRecordsSorted]);
  const selectedAnalyzedRecords = useMemo(
    () => selectedRecords.filter((record) => record.analyzed_at),
    [selectedRecords],
  );

  useEffect(() => {
    const saved = sessionStorage.getItem(PASSCODE_STORAGE_KEY);
    if (saved) {
      setPasscode(saved);
      setAuthenticated(true);
    }
  }, []);

  const loadUploadMonitor = async (targetPasscode = passcode) => {
    try {
      const monitor = await fetchUploadMonitor(targetPasscode);
      setUploadMonitor(monitor);
      setMonitorError('');
    } catch (error) {
      setUploadMonitor(null);
      setMonitorError(error instanceof Error ? error.message : 'アップロード監視の取得に失敗しました');
    }
  };

  const loadMonthlyUsage = async (targetPasscode = passcode) => {
    try {
      const usage = await fetchMonthlyUsage(targetPasscode);
      setMonthlyUsage(usage);
      setUsageError('');
    } catch (error) {
      setMonthlyUsage(null);
      setUsageError(error instanceof Error ? error.message : '利用料金の取得に失敗しました');
    }
  };

  const refreshAdminPanels = async (targetPasscode = passcode) => {
    await Promise.all([loadUploadMonitor(targetPasscode), loadMonthlyUsage(targetPasscode)]);
  };

  const loadAdminPanels = async (targetPasscode = passcode) => {
    setAdminLoading(true);
    try {
      await refreshAdminPanels(targetPasscode);
      setAdminLoaded(true);
    } finally {
      setAdminLoading(false);
    }
  };

  const handleTabChange = (tab: DownloadTab) => {
    if (batchBusy) return;
    setActiveTab(tab);
    if (tab === 'admin' && !adminLoaded && !adminLoading) {
      void loadAdminPanels(passcode);
    }
  };

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
    setActiveTab('ai');
    setAdminLoaded(false);
  };

  const loadRecords = async (selectedSchool: string) => {
    setSchool(selectedSchool);
    setLoading(true);
    setListError('');
    setActionMessage('');
    try {
      const items = await fetchRecords(passcode, selectedSchool);
      setRecords(items);
      setSelectedIds(new Set());
    } catch (error) {
      setRecords([]);
      setSelectedIds(new Set());
      setListError(error instanceof Error ? error.message : '一覧の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (batchBusy) return;
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

  const beginBatch = (message: string, note: string) => {
    setBatchProgress({
      active: true,
      message,
      percent: 0,
      note,
    });
  };

  const updateBatch = (message: string, percent: number) => {
    setBatchProgress((current) => ({
      ...current,
      active: true,
      message,
      percent: Math.min(100, Math.max(0, percent)),
    }));
  };

  const endBatch = () => {
    setBatchProgress(IDLE_BATCH_PROGRESS);
  };

  const runDownload = async (href: string, fallbackFilename: string, message: string) => {
    beginBatch('ダウンロードを準備しています...', 'zip の作成が完了するまでお待ちください');
    try {
      updateBatch('ファイルを取得しています...', 30);
      await startDownload(href, fallbackFilename);
      updateBatch('一覧を更新しています...', 85);
      if (school) {
        await loadRecords(school);
      }
      setActionMessage(message);
      updateBatch('ダウンロードが完了しました', 100);
    } catch (error) {
      setActionMessage(error instanceof Error ? error.message : 'ダウンロードに失敗しました');
    } finally {
      endBatch();
    }
  };

  const toggleRecord = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(records.map((record) => record.id)));
  };

  const selectUndownloaded = () => {
    setSelectedIds(new Set(records.filter((record) => !record.downloaded_at).map((record) => record.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleDownloadSchool = async () => {
    if (!school || batchBusy) return;
    await runDownload(
      downloadZipUrl(passcode, school),
      `${school}_文字起こし.zip`,
      'スクール一括ダウンロードの履歴を更新しました',
    );
  };

  const handleDownloadSelected = async () => {
    if (batchBusy) return;
    if (selectedRecords.length === 0) {
      setActionMessage('ダウンロードするファイルを選択してください');
      return;
    }

    await runDownload(
      downloadSelectedZipUrl(
        passcode,
        selectedRecords.map((record) => record.id),
      ),
      school ? `${school}_選択文字起こし.zip` : '選択文字起こし.zip',
      `${selectedRecords.length}件のダウンロード履歴を更新しました`,
    );
  };

  const handleDownloadAnalysisSchool = async () => {
    if (!school || batchBusy) return;
    await runDownload(
      downloadAnalysisZipUrl(passcode, school),
      `${school}_AI分析.zip`,
      '分析結果をダウンロードしました',
    );
  };

  const handleDownloadAnalysisSelected = async () => {
    if (batchBusy) return;
    if (selectedAnalyzedRecords.length === 0) {
      setActionMessage('ダウンロードする分析結果を選択してください');
      return;
    }

    await runDownload(
      downloadAnalysisSelectedZipUrl(
        passcode,
        selectedAnalyzedRecords.map((record) => record.id),
      ),
      school ? `${school}_選択AI分析.zip` : '選択AI分析.zip',
      `${selectedAnalyzedRecords.length}件の分析結果をダウンロードしました`,
    );
  };

  const handleDownloadRecord = async (record: RecordItem) => {
    if (batchBusy) return;
    await runDownload(
      downloadUrl(passcode, record.id),
      record.filename,
      '最新のダウンロード履歴を更新しました',
    );
  };

  const analysisFilename = (filename: string) => filename.replace(/\.txt$/i, '_分析.txt');

  const openAnalysisModal = (
    record: RecordItem,
    options: {
      loading: boolean;
      mode: AnalysisModalMode;
      content?: string;
      cached?: boolean;
    },
  ) => {
    const title =
      options.mode === 'view'
        ? `分析結果: ${record.student_name}`
        : `AI分析中: ${record.student_name}`;
    setAnalysisModal({
      open: true,
      title,
      content: options.content ?? '',
      loading: options.loading,
      cached: options.cached ?? false,
      mode: options.mode,
      recordId: record.id,
      downloadName: analysisFilename(record.filename),
    });
  };

  const refreshAfterAnalysis = async () => {
    if (school) {
      await loadRecords(school);
    }
    if (adminLoaded) {
      void refreshAdminPanels(passcode);
    }
  };

  const handleViewAnalysis = async (record: RecordItem) => {
    if (batchBusy) return;
    openAnalysisModal(record, { loading: true, mode: 'view' });
    try {
      const result = await analyzeRecord(passcode, record.id);
      setAnalysisModal((current) => ({
        ...current,
        title: `分析結果: ${record.student_name}`,
        content: result.analysis,
        loading: false,
        cached: result.cached,
        mode: 'view',
      }));
    } catch (error) {
      setAnalysisModal((current) => ({ ...current, open: false, loading: false }));
      setActionMessage(error instanceof Error ? error.message : '分析結果の取得に失敗しました');
    }
  };

  const handleRunAnalysis = async (record: RecordItem) => {
    if (batchBusy) return;
    openAnalysisModal(record, { loading: true, mode: 'run' });
    try {
      const result = await analyzeRecord(passcode, record.id);
      setAnalysisModal((current) => ({
        ...current,
        title: `分析結果: ${record.student_name}`,
        content: result.analysis,
        loading: false,
        cached: result.cached,
        mode: 'view',
      }));
      await refreshAfterAnalysis();
    } catch (error) {
      setAnalysisModal((current) => ({ ...current, open: false, loading: false }));
      setActionMessage(error instanceof Error ? error.message : '分析に失敗しました');
    }
  };

  const handleReanalyze = async (record: RecordItem) => {
    if (batchBusy) return;
    openAnalysisModal(record, { loading: true, mode: 'run' });
    try {
      const result = await analyzeRecord(passcode, record.id, { force: true });
      setAnalysisModal((current) => ({
        ...current,
        title: `分析結果: ${record.student_name}`,
        content: result.analysis,
        loading: false,
        cached: result.cached,
        mode: 'view',
      }));
      await refreshAfterAnalysis();
    } catch (error) {
      setAnalysisModal((current) => ({ ...current, open: false, loading: false }));
      setActionMessage(error instanceof Error ? error.message : '再分析に失敗しました');
    }
  };

  const runBulkAnalyze = async (targets: RecordItem[], scopeLabel: string) => {
    beginBatch(`AI一括分析を開始しています（${scopeLabel}）...`, '分析が完了するまでお待ちください');
    let success = 0;
    let failed = 0;

    try {
      for (let index = 0; index < targets.length; index += 1) {
        const record = targets[index];
        const percent =
          targets.length > 0 ? Math.round(((index + 1) / targets.length) * 90) : 0;
        updateBatch(
          `AI一括分析中（${scopeLabel}）... ${index + 1}/${targets.length}（${record.student_name}）`,
          percent,
        );
        try {
          await analyzeRecord(passcode, record.id);
          success += 1;
        } catch {
          failed += 1;
        }
      }

      updateBatch('一覧を更新しています...', 95);
      await loadRecords(school);
      if (adminLoaded) {
        void refreshAdminPanels(passcode);
      }
      setActionMessage(
        `一括分析が完了しました（成功 ${success}件 / 失敗 ${failed}件）。「分析結果を見る」タブから確認できます。1回最大 ${MAX_BULK_ANALYZE} 件まで実行できます。`,
      );
      if (success > 0) {
        setAiActionTab('view');
      }
      updateBatch('一括分析が完了しました', 100);
    } finally {
      endBatch();
    }
  };

  const handleBulkAnalyzeSchool = async () => {
    if (!school || batchBusy) return;

    const targets = unanalyzedRecords.slice(0, MAX_BULK_ANALYZE);
    if (targets.length === 0) {
      setActionMessage('未分析の記録がありません');
      return;
    }

    if (unanalyzedRecords.length > MAX_BULK_ANALYZE) {
      const proceed = window.confirm(
        `未分析が ${unanalyzedRecords.length} 件あります。1回の一括分析は最大 ${MAX_BULK_ANALYZE} 件までです。\n今回 ${targets.length} 件を分析します。続行しますか？`,
      );
      if (!proceed) return;
    }

    await runBulkAnalyze(targets, 'スクール一括');
  };

  const handleBulkAnalyzeSelected = async () => {
    if (!school || batchBusy) return;

    if (selectedRecords.length === 0) {
      setActionMessage('分析するファイルを選択してください');
      return;
    }

    const targets = selectedUnanalyzedRecords.slice(0, MAX_BULK_ANALYZE);
    if (targets.length === 0) {
      setActionMessage('選択した記録はすべて分析済みです');
      return;
    }

    if (selectedUnanalyzedRecords.length > MAX_BULK_ANALYZE) {
      const proceed = window.confirm(
        `選択した未分析が ${selectedUnanalyzedRecords.length} 件あります。1回の一括分析は最大 ${MAX_BULK_ANALYZE} 件までです。\n今回 ${targets.length} 件を分析します。続行しますか？`,
      );
      if (!proceed) return;
    }

    await runBulkAnalyze(targets, '選択分');
  };

  const handleCopyAnalysis = async () => {
    if (!analysisModal.content) return;
    try {
      await navigator.clipboard.writeText(analysisModal.content);
      setActionMessage('分析結果をコピーしました');
    } catch {
      setActionMessage('コピーに失敗しました');
    }
  };

  const handleDownloadAnalysis = () => {
    if (!analysisModal.content) return;
    const blob = new Blob([analysisModal.content], { type: 'text/plain;charset=utf-8' });
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = analysisModal.downloadName || '分析.txt';
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
    setActionMessage('分析結果をダウンロードしました');
  };

  const formatMonthLabel = (month: string) => {
    const [year, mon] = month.split('-');
    return `${year}年${Number(mon)}月`;
  };

  const formatYen = (value: number) =>
    new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(value);

  const formatUsd = (value: number) => `$${value.toFixed(4)}`;

  if (!authenticated) {
    return (
      <section className="card narrow">
        <h2>分析</h2>
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
          <h2>分析</h2>
          <p className="lead">
            {activeTab === 'ai'
              ? 'スクールを選び、面談録音のAI分析と文字起こしの取得ができます。'
              : '利用料金の目安とアップロード監視を確認できます。'}
          </p>
        </div>
        <button
          type="button"
          className="secondary-button"
          disabled={batchBusy}
          onClick={() => {
            sessionStorage.removeItem(PASSCODE_STORAGE_KEY);
            setAuthenticated(false);
            setPasscode('');
            setSchool('');
            setRecords([]);
            setSelectedIds(new Set());
            setUploadMonitor(null);
            setMonitorError('');
            setMonthlyUsage(null);
            setUsageError('');
            setActiveTab('ai');
            setAdminLoaded(false);
            setAdminLoading(false);
          }}
        >
          ログアウト
        </button>
      </div>

      <div className="download-tabs" role="tablist" aria-label="分析メニュー">
        <button
          type="button"
          role="tab"
          id="download-tab-ai"
          aria-selected={activeTab === 'ai'}
          aria-controls="download-panel-ai"
          className={`download-tab${activeTab === 'ai' ? ' active' : ''}`}
          disabled={batchBusy}
          onClick={() => handleTabChange('ai')}
        >
          AI分析
        </button>
        <button
          type="button"
          role="tab"
          id="download-tab-admin"
          aria-selected={activeTab === 'admin'}
          aria-controls="download-panel-admin"
          className={`download-tab${activeTab === 'admin' ? ' active' : ''}`}
          disabled={batchBusy}
          onClick={() => handleTabChange('admin')}
        >
          管理
        </button>
      </div>

      {activeTab === 'ai' ? (
        <div id="download-panel-ai" role="tabpanel" aria-labelledby="download-tab-ai">
      <label>
        スクール
        <select
          value={school}
          disabled={batchBusy || loading}
          onChange={(e) => {
            setAiActionTab('download');
            void loadRecords(e.target.value);
          }}
        >
          <option value="">選択してください</option>
          {SCHOOLS.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>

      {school ? (
        <>
          <div className="ai-action-tabs" role="tablist" aria-label="音声の操作">
            <button
              type="button"
              role="tab"
              id="ai-action-tab-download"
              aria-selected={aiActionTab === 'download'}
              aria-controls="ai-action-panel-download"
              className={`ai-action-tab${aiActionTab === 'download' ? ' active' : ''}`}
              disabled={batchBusy}
              onClick={() => setAiActionTab('download')}
            >
              音声ファイルをダウンロード
            </button>
            <button
              type="button"
              role="tab"
              id="ai-action-tab-analyze"
              aria-selected={aiActionTab === 'analyze'}
              aria-controls="ai-action-panel-analyze"
              className={`ai-action-tab${aiActionTab === 'analyze' ? ' active' : ''}`}
              disabled={batchBusy}
              onClick={() => setAiActionTab('analyze')}
            >
              音声をAI分析
            </button>
            <button
              type="button"
              role="tab"
              id="ai-action-tab-view"
              aria-selected={aiActionTab === 'view'}
              aria-controls="ai-action-panel-view"
              className={`ai-action-tab${aiActionTab === 'view' ? ' active' : ''}`}
              disabled={batchBusy}
              onClick={() => setAiActionTab('view')}
            >
              分析結果を見る
            </button>
          </div>

          {aiActionTab === 'download' ? (
            <div
              id="ai-action-panel-download"
              role="tabpanel"
              aria-labelledby="ai-action-tab-download"
              className="ai-action-panel"
            >
              <div className="toolbar download-toolbar">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleDownloadSchool()}
                  disabled={batchBusy}
                >
                  このスクールを一括ダウンロード (zip)
                </button>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleDownloadSelected()}
                  disabled={batchBusy || selectedRecords.length === 0}
                >
                  選択したファイルをダウンロード (zip)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleDownloadAnalysisSchool()}
                  disabled={batchBusy || analyzedRecords.length === 0}
                >
                  このスクールの分析結果をダウンロード (zip)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleDownloadAnalysisSelected()}
                  disabled={batchBusy || selectedAnalyzedRecords.length === 0}
                >
                  選択した分析結果をダウンロード (zip)
                </button>
              </div>
              <p className="field-hint">
                文字起こし txt と分析結果（*_分析.txt）を zip で取得できます。分析結果 zip
                は分析済みのみ含みます（未分析は含まれません）。
              </p>
            </div>
          ) : null}

          {aiActionTab === 'analyze' ? (
            <div
              id="ai-action-panel-analyze"
              role="tabpanel"
              aria-labelledby="ai-action-tab-analyze"
              className="ai-action-panel"
            >
              <div className="toolbar download-toolbar">
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => void handleBulkAnalyzeSelected()}
                  disabled={batchBusy || selectedUnanalyzedRecords.length === 0}
                >
                  選択したファイルをAI分析
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleBulkAnalyzeSchool()}
                  disabled={batchBusy || unanalyzedRecords.length === 0}
                >
                  このスクールをまとめてAI分析
                </button>
              </div>
              <p className="field-hint">
                1回の一括AI分析は最大 {MAX_BULK_ANALYZE} 件までです（未分析 {unanalyzedRecords.length}{' '}
                件
                {selectedRecords.length > 0
                  ? ` / 選択中の未分析 ${selectedUnanalyzedRecords.length} 件`
                  : ''}
                ）。分析済みの選択はスキップされます。完了後は「分析結果を見る」タブで確認できます。
              </p>
            </div>
          ) : null}

          {aiActionTab === 'view' ? (
            <div
              id="ai-action-panel-view"
              role="tabpanel"
              aria-labelledby="ai-action-tab-view"
              className="ai-action-panel"
            >
              <div className="analysis-view-header">
                <h3>分析済み {analyzedRecords.length} 件</h3>
                <p className="field-hint">各行の「分析結果を見る」からレポートを開けます。</p>
              </div>
              <div className="toolbar download-toolbar">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleDownloadAnalysisSchool()}
                  disabled={batchBusy || analyzedRecords.length === 0}
                >
                  このスクールの分析結果をダウンロード (zip)
                </button>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void handleDownloadAnalysisSelected()}
                  disabled={batchBusy || selectedAnalyzedRecords.length === 0}
                >
                  選択した分析結果をダウンロード (zip)
                </button>
              </div>
              {analyzedRecordsSorted.length > 0 ? (
                <ul className="analysis-view-list">
                  {analyzedRecordsSorted.map((record) => (
                    <li key={record.id} className="analysis-view-item">
                      <div className="analysis-view-item-content">
                        <strong>{record.student_name}</strong>
                        <p>
                          {record.grade} / {record.class} / {record.filename}
                        </p>
                        <time dateTime={record.analyzed_at ?? undefined}>
                          分析: {formatDateTime(record.analyzed_at)}
                        </time>
                      </div>
                      <div className="analysis-view-item-actions">
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => void handleViewAnalysis(record)}
                          disabled={batchBusy}
                        >
                          分析結果を見る
                        </button>
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => void handleReanalyze(record)}
                          disabled={batchBusy}
                        >
                          再分析
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="field-hint">
                  まだ分析結果がありません。「音声をAI分析」タブから分析を実行してください。
                </p>
              )}
            </div>
          ) : null}
        </>
      ) : null}

      {school ? (
        <div className="download-history" aria-live="polite">
          <div className="history-header">
            <h3>最新のダウンロード履歴</h3>
            <span>{latestDownloads.length > 0 ? `${latestDownloads.length}件表示` : '履歴なし'}</span>
          </div>
          {latestDownloads.length > 0 ? (
            <ol>
              {latestDownloads.map((record) => (
                <li key={record.id}>
                  <span>
                    {record.student_name} / {record.filename}
                  </span>
                  <time>{formatDateTime(record.downloaded_at)}</time>
                </li>
              ))}
            </ol>
          ) : (
            <p className="field-hint">このスクールのダウンロード履歴はまだありません。</p>
          )}
        </div>
      ) : null}

      {school && latestAnalyzed.length > 0 ? (
        <div className="download-history analysis-recent" aria-live="polite">
          <div className="history-header">
            <h3>最新の分析結果</h3>
            <span>{latestAnalyzed.length}件表示</span>
          </div>
          <ol>
            {latestAnalyzed.map((record) => (
              <li key={record.id} className="analysis-recent-item">
                <span>
                  {record.student_name} / {record.filename}
                </span>
                <div className="analysis-recent-actions">
                  <time>{formatDateTime(record.analyzed_at)}</time>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleViewAnalysis(record)}
                    disabled={batchBusy}
                  >
                    結果を見る
                  </button>
                </div>
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      {loading ? <p>読み込み中...</p> : null}
      {listError ? <p className="field-error">{listError}</p> : null}
      {actionMessage ? <p className="field-hint">{actionMessage}</p> : null}

      {records.length > 0 ? (
        <>
          <div className="selection-toolbar">
            <p>
              {selectedRecords.length}件選択中 / {records.length}件
              {undownloadedCount > 0 ? `（未ダウンロード ${undownloadedCount}件）` : ''}
            </p>
            <div>
              <button
                type="button"
                className="secondary-button"
                onClick={selectAll}
                disabled={batchBusy || allSelected}
              >
                一括チェック
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={selectUndownloaded}
                disabled={batchBusy || undownloadedCount === 0}
              >
                未ダウンロードを選択
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={clearSelection}
                disabled={batchBusy || selectedRecords.length === 0}
              >
                一括解除
              </button>
            </div>
          </div>

          <div className="record-list">
            {records.map((record) => (
              <article
                key={record.id}
                className={`record-item${selectedIds.has(record.id) ? ' selected' : ''}${
                  record.analyzed_at ? ' record-item--analyzed' : ''
                }`}
              >
                <label className="record-select">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(record.id)}
                    disabled={batchBusy}
                    onChange={() => toggleRecord(record.id)}
                    aria-label={`${record.filename}を選択`}
                  />
                  <span>選択</span>
                </label>
                <div className="record-content">
                  <strong>{record.student_name}</strong>
                  <p>
                    {record.grade} / {record.class} / {record.filename}
                  </p>
                  <p className="record-date">登録: {formatDateTime(record.created_at)}</p>
                  <p className={`download-status${record.downloaded_at ? ' downloaded' : ''}`}>
                    {record.downloaded_at
                      ? `最終DL: ${formatDateTime(record.downloaded_at)}`
                      : '未ダウンロード'}
                  </p>
                  <p className="record-badges">
                    <span
                      className={`status-badge${record.analyzed_at ? ' status-badge--analyzed' : ' status-badge--pending'}`}
                    >
                      {record.analyzed_at ? '分析済み' : '未分析'}
                    </span>
                    {record.analyzed_at ? (
                      <span className="analysis-status analyzed">
                        {formatDateTime(record.analyzed_at)}
                      </span>
                    ) : null}
                  </p>
                </div>
                <div className="record-actions">
                  {record.analyzed_at ? (
                    <>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void handleViewAnalysis(record)}
                        disabled={batchBusy}
                      >
                        分析結果を見る
                      </button>
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => void handleReanalyze(record)}
                        disabled={batchBusy}
                      >
                        再分析
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void handleRunAnalysis(record)}
                      disabled={batchBusy}
                    >
                      AI分析を実行
                    </button>
                  )}
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void handleDownloadRecord(record)}
                    disabled={batchBusy}
                  >
                    文字起こし
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => handleDelete(record.id)}
                    disabled={batchBusy}
                  >
                    削除
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : null}

      {school && !loading && records.length === 0 && !listError ? (
        <p className="field-hint">このスクールの記録はまだありません。</p>
      ) : null}
        </div>
      ) : null}

      {activeTab === 'admin' ? (
        <div id="download-panel-admin" role="tabpanel" aria-labelledby="download-tab-admin">
      {adminLoading ? <p className="field-hint">管理データを読み込み中...</p> : null}

      <section className="usage-panel" aria-live="polite">
        <div className="history-header">
          <h3>月別 推定利用料金（目安）</h3>
          {monthlyUsage ? <span>為替目安: 1USD = {monthlyUsage.usdJpyRate}円</span> : null}
        </div>
        {monthlyUsage ? (
          <>
            <p className="field-hint">{monthlyUsage.disclaimer}</p>
            {monthlyUsage.months.length > 0 ? (
              <table className="usage-table">
                <thead>
                  <tr>
                    <th>月</th>
                    <th>文字起こし</th>
                    <th>AI分析</th>
                    <th>合計(円)</th>
                    <th>合計(USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyUsage.months.map((row) => (
                    <tr key={row.month}>
                      <td>{formatMonthLabel(row.month)}</td>
                      <td>{formatYen(row.transcribeUsd * monthlyUsage.usdJpyRate)}</td>
                      <td>{formatYen(row.analyzeUsd * monthlyUsage.usdJpyRate)}</td>
                      <td>{formatYen(row.totalJpy)}</td>
                      <td>{formatUsd(row.totalUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="field-hint">まだ集計データがありません。</p>
            )}
          </>
        ) : (
          <p className="field-hint">利用料金を読み込み中...</p>
        )}
        {usageError ? <p className="field-error">{usageError}</p> : null}
      </section>

      {uploadMonitor ? (
        <section className="upload-monitor" aria-live="polite">
          <div className="history-header">
            <h3>アップロード監視</h3>
            <span>{uploadMonitor.alerts.length > 0 ? '異常検知あり' : '正常'}</span>
          </div>
          <div className="monitor-grid">
            <p>
              <strong>{uploadMonitor.summary.totalCount}</strong>
              <span>24時間の総数</span>
            </p>
            <p>
              <strong>{uploadMonitor.summary.rejectedCount}</strong>
              <span>遮断</span>
            </p>
            <p>
              <strong>{formatBytes(uploadMonitor.limits.maxFileBytes)}</strong>
              <span>ファイル上限</span>
            </p>
            {uploadMonitor.analysisToday ? (
              <p>
                <strong>{uploadMonitor.analysisToday.count}</strong>
                <span>
                  本日の分析（約{formatYen(uploadMonitor.analysisToday.estimatedJpy)}）
                </span>
              </p>
            ) : null}
          </div>
          {uploadMonitor.analysisLimits ? (
            <p className="field-hint">
              AI分析の上限: 1時間あたり {uploadMonitor.analysisLimits.maxPerIpHour}件 / 1日全体{' '}
              {uploadMonitor.analysisLimits.maxGlobalDay}件
            </p>
          ) : null}
          {uploadMonitor.alerts.length > 0 ? (
            <ol className="monitor-alerts">
              {uploadMonitor.alerts.slice(0, 3).map((alert) => (
                <li key={alert.id}>
                  <span>{formatDateTime(alert.created_at)}</span>
                  {alert.detail.school ? `${alert.detail.school} / ` : ''}
                  {alert.detail.filename ?? alert.kind}
                </li>
              ))}
            </ol>
          ) : (
            <p className="field-hint">直近の異常アップロードはありません。</p>
          )}
        </section>
      ) : null}
      {monitorError ? <p className="field-error">{monitorError}</p> : null}
        </div>
      ) : null}

      <BlockingProgressOverlay
        open={batchProgress.active}
        message={batchProgress.message}
        percent={batchProgress.percent}
        note={batchProgress.note}
      />

      <AnalysisModal
        open={analysisModal.open}
        title={analysisModal.title}
        content={analysisModal.content}
        loading={analysisModal.loading}
        cached={analysisModal.cached}
        mode={analysisModal.mode}
        onClose={() =>
          setAnalysisModal((current) => ({
            ...current,
            open: false,
            loading: false,
          }))
        }
        onCopy={() => void handleCopyAnalysis()}
        onDownload={handleDownloadAnalysis}
        onReanalyze={
          analysisModal.recordId
            ? () => {
                const record = records.find((item) => item.id === analysisModal.recordId);
                if (record) void handleReanalyze(record);
              }
            : undefined
        }
      />
    </section>
  );
}
