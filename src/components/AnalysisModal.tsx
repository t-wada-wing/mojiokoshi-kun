export type AnalysisModalMode = 'run' | 'view';

interface Props {
  open: boolean;
  title: string;
  content: string;
  loading?: boolean;
  cached?: boolean;
  mode?: AnalysisModalMode;
  onClose: () => void;
  onCopy: () => void;
  onDownload: () => void;
  onReanalyze?: () => void;
}

export default function AnalysisModal({
  open,
  title,
  content,
  loading = false,
  cached = false,
  mode = 'run',
  onClose,
  onCopy,
  onDownload,
  onReanalyze,
}: Props) {
  if (!open) return null;

  const cachedHint =
    mode === 'view'
      ? '保存済みの分析結果を表示しています。'
      : 'キャッシュ済みの分析結果を表示しています。';
  const loadingHint =
    mode === 'view' ? '分析結果を読み込んでいます...' : 'AI分析を実行しています...';

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="analysis-title">
      <div className="modal-card analysis-modal">
        <h2 id="analysis-title">{title}</h2>
        {cached && !loading ? <p className="field-hint">{cachedHint}</p> : null}
        {loading ? (
          <p className="field-hint">{loadingHint}</p>
        ) : (
          <pre className="analysis-content">{content}</pre>
        )}
        <div className="analysis-actions">
          <button type="button" className="secondary-button" onClick={onCopy} disabled={loading || !content}>
            コピー
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onDownload}
            disabled={loading || !content}
          >
            txt保存
          </button>
          {onReanalyze ? (
            <button type="button" className="secondary-button" onClick={onReanalyze} disabled={loading}>
              再分析
            </button>
          ) : null}
          <button type="button" className="primary-button" onClick={onClose}>
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
