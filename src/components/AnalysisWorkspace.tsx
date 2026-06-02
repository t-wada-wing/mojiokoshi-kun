import { useId, useState } from 'react';
import { MAX_BULK_ANALYZE } from '../constants';
import type { RecordItem } from '../lib/api';

export type ListFilter = 'all' | 'unanalyzed' | 'analyzed';

export type DetailState = {
  recordId: number | null;
  content: string;
  loading: boolean;
  cached: boolean;
  error: string;
};

export const IDLE_DETAIL: DetailState = {
  recordId: null,
  content: '',
  loading: false,
  cached: false,
  error: '',
};

type Props = {
  records: RecordItem[];
  filteredRecords: RecordItem[];
  listFilter: ListFilter;
  onListFilterChange: (filter: ListFilter) => void;
  selectedIds: Set<number>;
  selectedDetailId: number | null;
  selectedDetailRecord: RecordItem | null;
  detail: DetailState;
  batchBusy: boolean;
  analyzedCount: number;
  unanalyzedCount: number;
  selectedRecordsCount: number;
  selectedUnanalyzedCount: number;
  selectedAnalyzedCount: number;
  allFilteredSelected: boolean;
  onToggleRecord: (id: number) => void;
  onSelectAllFiltered: () => void;
  onClearSelection: () => void;
  onSelectRecord: (record: RecordItem) => void;
  onBackToList: () => void;
  onBulkAnalyzeSelected: () => void;
  onBulkAnalyzeSchool: () => void;
  onDownloadSchoolTranscript: () => void;
  onDownloadSelectedTranscript: () => void;
  onDownloadSchoolAnalysis: () => void;
  onDownloadSelectedAnalysis: () => void;
  onDeleteSelected: () => void;
  onRunAnalysis: (record: RecordItem) => void;
  onReanalyze: (record: RecordItem) => void;
  onCopyAnalysis: () => void;
  onDownloadAnalysisTxt: () => void;
  onDownloadTranscript: (record: RecordItem) => void;
  onDeleteRecord: (id: number) => void;
  formatDateTime: (value: string | null | undefined) => string;
};

export default function AnalysisWorkspace({
  records,
  filteredRecords,
  listFilter,
  onListFilterChange,
  selectedIds,
  selectedDetailId,
  selectedDetailRecord,
  detail,
  batchBusy,
  analyzedCount,
  unanalyzedCount,
  selectedRecordsCount,
  selectedUnanalyzedCount,
  selectedAnalyzedCount,
  allFilteredSelected,
  onToggleRecord,
  onSelectAllFiltered,
  onClearSelection,
  onSelectRecord,
  onBackToList,
  onBulkAnalyzeSelected,
  onBulkAnalyzeSchool,
  onDownloadSchoolTranscript,
  onDownloadSelectedTranscript,
  onDownloadSchoolAnalysis,
  onDownloadSelectedAnalysis,
  onDeleteSelected,
  onRunAnalysis,
  onReanalyze,
  onCopyAnalysis,
  onDownloadAnalysisTxt,
  onDownloadTranscript,
  onDeleteRecord,
  formatDateTime,
}: Props) {
  const filterGroupId = useId();
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);

  const closeDownloadMenu = () => setDownloadMenuOpen(false);

  const runDownloadAction = (action: () => void) => {
    closeDownloadMenu();
    action();
  };

  return (
    <div
      className={`analysis-workspace${selectedDetailId ? ' show-detail' : ''}`}
      aria-busy={batchBusy}
    >
      <div className="analysis-list-pane">
        <div className="analysis-bulk-bar">
          <p className="analysis-selection-summary">
            {selectedRecordsCount}件選択中 / 全{records.length}件（分析済 {analyzedCount} / 未分析{' '}
            {unanalyzedCount}）
          </p>
          <div className="analysis-bulk-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => void onBulkAnalyzeSelected()}
              disabled={batchBusy || selectedUnanalyzedCount === 0}
            >
              選択をAI分析
            </button>
            <button
              type="button"
              className="secondary-button"
              onClick={() => void onBulkAnalyzeSchool()}
              disabled={batchBusy || unanalyzedCount === 0}
            >
              スクール一括AI分析
            </button>
            <div className="download-menu">
              <button
                type="button"
                className="secondary-button"
                aria-expanded={downloadMenuOpen}
                aria-haspopup="menu"
                disabled={batchBusy}
                onClick={() => setDownloadMenuOpen((open) => !open)}
              >
                ダウンロード ▾
              </button>
              {downloadMenuOpen ? (
                <div className="download-menu-panel" role="menu">
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedRecordsCount === 0}
                    onClick={() => runDownloadAction(onDownloadSelectedTranscript)}
                  >
                    選択を zip（文字起こし）
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => runDownloadAction(onDownloadSchoolTranscript)}
                  >
                    スクール zip（文字起こし）
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={selectedAnalyzedCount === 0}
                    onClick={() => runDownloadAction(onDownloadSelectedAnalysis)}
                  >
                    選択を zip（分析結果）
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={analyzedCount === 0}
                    onClick={() => runDownloadAction(onDownloadSchoolAnalysis)}
                  >
                    スクール zip（分析結果）
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="danger-button"
              onClick={() => void onDeleteSelected()}
              disabled={batchBusy || selectedRecordsCount === 0}
            >
              削除
            </button>
          </div>
        </div>

        <div className="analysis-filter-row" role="group" aria-labelledby={filterGroupId}>
          <span id={filterGroupId} className="analysis-filter-label">
            表示:
          </span>
          {(
            [
              ['all', 'すべて'],
              ['unanalyzed', '未分析'],
              ['analyzed', '分析済'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className={`filter-chip${listFilter === value ? ' active' : ''}`}
              disabled={batchBusy}
              onClick={() => onListFilterChange(value)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="analysis-list-toolbar">
          <button
            type="button"
            className="secondary-button"
            onClick={onSelectAllFiltered}
            disabled={batchBusy || allFilteredSelected || filteredRecords.length === 0}
          >
            表示分をすべて選択
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={onClearSelection}
            disabled={batchBusy || selectedRecordsCount === 0}
          >
            選択解除
          </button>
        </div>

        <ul className="analysis-compact-list" role="listbox" aria-label="面談一覧">
          {filteredRecords.length === 0 ? (
            <li className="analysis-compact-empty">該当する記録がありません。</li>
          ) : (
            filteredRecords.map((record) => (
              <li key={record.id}>
                <div
                  role="option"
                  aria-selected={selectedDetailId === record.id}
                  className={`analysis-compact-row${
                    selectedDetailId === record.id ? ' active' : ''
                  }`}
                >
                  <label className="analysis-compact-check" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(record.id)}
                      disabled={batchBusy}
                      onChange={() => onToggleRecord(record.id)}
                      aria-label={`${record.student_name}を一括選択`}
                    />
                  </label>
                  <button
                    type="button"
                    className="analysis-compact-main"
                    disabled={batchBusy}
                    onClick={() => void onSelectRecord(record)}
                  >
                    <span className="analysis-compact-name">{record.student_name}</span>
                    <span className="analysis-compact-meta">
                      <span
                        className={`status-badge${
                          record.analyzed_at ? ' status-badge--analyzed' : ' status-badge--pending'
                        }`}
                      >
                        {record.analyzed_at ? '分析済み' : '未分析'}
                      </span>
                      <time>{formatDateTime(record.analyzed_at ?? record.created_at)}</time>
                    </span>
                  </button>
                </div>
              </li>
            ))
          )}
        </ul>

        <p className="field-hint analysis-bulk-hint">
          1回の一括AI分析は最大 {MAX_BULK_ANALYZE} 件。行をクリックすると右に詳細が表示されます（チェックは一括操作用）。
        </p>
      </div>

      <div className="analysis-detail-pane">
        <button
          type="button"
          className="secondary-button analysis-back-button"
          onClick={onBackToList}
        >
          ← 一覧に戻る
        </button>

        {!selectedDetailRecord ? (
          <div className="analysis-detail-empty">
            <h3>面談を選択してください</h3>
            <p className="field-hint">左の一覧から行をクリックすると、分析結果とダウンロード操作が表示されます。</p>
          </div>
        ) : (
          <>
            <header className="analysis-detail-header">
              <h3>分析結果: {selectedDetailRecord.student_name}</h3>
              <dl className="analysis-detail-meta">
                <div>
                  <dt>学年 / クラス</dt>
                  <dd>
                    {selectedDetailRecord.grade} / {selectedDetailRecord.class}
                  </dd>
                </div>
                <div>
                  <dt>ファイル</dt>
                  <dd>{selectedDetailRecord.filename}</dd>
                </div>
                <div>
                  <dt>登録</dt>
                  <dd>{formatDateTime(selectedDetailRecord.created_at)}</dd>
                </div>
                {selectedDetailRecord.analyzed_at ? (
                  <div>
                    <dt>分析</dt>
                    <dd>{formatDateTime(selectedDetailRecord.analyzed_at)}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>文字起こしDL</dt>
                  <dd>
                    {selectedDetailRecord.downloaded_at
                      ? formatDateTime(selectedDetailRecord.downloaded_at)
                      : '未ダウンロード'}
                  </dd>
                </div>
              </dl>
            </header>

            <div className="analysis-detail-actions">
              {selectedDetailRecord.analyzed_at ? (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={onDownloadAnalysisTxt}
                    disabled={batchBusy || detail.loading || !detail.content}
                  >
                    分析結果DL (txt)
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onDownloadTranscript(selectedDetailRecord)}
                    disabled={batchBusy}
                  >
                    文字起こしDL (txt)
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onCopyAnalysis()}
                    disabled={batchBusy || detail.loading || !detail.content}
                  >
                    コピー
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onReanalyze(selectedDetailRecord)}
                    disabled={batchBusy || detail.loading}
                  >
                    再分析
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => onDeleteRecord(selectedDetailRecord.id)}
                    disabled={batchBusy}
                  >
                    削除
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void onRunAnalysis(selectedDetailRecord)}
                    disabled={batchBusy || detail.loading}
                  >
                    AI分析を実行
                  </button>
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => void onDownloadTranscript(selectedDetailRecord)}
                    disabled={batchBusy}
                  >
                    文字起こしDL (txt)
                  </button>
                  <button
                    type="button"
                    className="danger-button"
                    onClick={() => onDeleteRecord(selectedDetailRecord.id)}
                    disabled={batchBusy}
                  >
                    削除
                  </button>
                </>
              )}
            </div>

            {detail.error ? <p className="field-error">{detail.error}</p> : null}

            {detail.loading ? (
              <p className="field-hint">分析結果を読み込んでいます...</p>
            ) : selectedDetailRecord.analyzed_at && detail.content ? (
              <>
                {detail.cached ? (
                  <p className="field-hint">保存済みの分析結果を表示しています。</p>
                ) : null}
                <pre className="analysis-content analysis-detail-body">{detail.content}</pre>
              </>
            ) : !selectedDetailRecord.analyzed_at ? (
              <p className="field-hint">
                まだ分析されていません。「AI分析を実行」で面談レポートを生成できます。
              </p>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
