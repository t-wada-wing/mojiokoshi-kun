import { useMemo, useRef, useState } from 'react';
import {
  AUDIO_FILE_ACCEPT,
  CLASSES,
  GRADES,
  LONG_AUDIO_HINT_SECONDS,
  LONG_AUDIO_STATIC_HINT,
  SCHOOLS,
  buildFilename,
  formatDurationMinutes,
  isValidStudentName,
  validateAudioFile,
} from '../constants';
import UploadOverlay from '../components/UploadOverlay';
import ResultModal from '../components/ResultModal';
import { prepareAudioForUpload } from '../lib/audio';
import { uploadTranscription, type UploadProgress } from '../lib/api';

const initialProgress: UploadProgress = {
  stage: 'idle',
  percent: 0,
  message: '',
};

export default function UploadPage() {
  const [school, setSchool] = useState('');
  const [grade, setGrade] = useState('');
  const [className, setClassName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [longAudioHint, setLongAudioHint] = useState('');
  const [nameError, setNameError] = useState('');
  const [progress, setProgress] = useState<UploadProgress>(initialProgress);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalMessage, setModalMessage] = useState('');
  const [modalVariant, setModalVariant] = useState<'success' | 'error'>('success');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const audioFileInputRef = useRef<HTMLInputElement | null>(null);
  const broadFileInputRef = useRef<HTMLInputElement | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const previewFilename = useMemo(() => {
    if (!school || !grade || !className || !studentName) return '';
    return buildFilename(school, grade, className, studentName);
  }, [school, grade, className, studentName]);

  const canUpload =
    Boolean(school && grade && className && studentName && file) &&
    isValidStudentName(studentName) &&
    !fileError &&
    !isSubmitting;

  const handleStudentNameChange = (value: string) => {
    setStudentName(value);
    if (!value) {
      setNameError('');
      return;
    }
    setNameError(isValidStudentName(value) ? '' : '苗字と名前の間に半角スペースを入れてください');
  };

  const handleFileChange = (selected: File | null) => {
    setFile(selected);
    setLongAudioHint('');
    if (!selected) {
      setFileError('');
      return;
    }

    setFileError(validateAudioFile(selected));
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileChange(event.target.files?.[0] ?? null);
    event.target.value = '';
  };

  const resetForm = () => {
    setSchool('');
    setGrade('');
    setClassName('');
    setStudentName('');
    setFile(null);
    setFileError('');
    setLongAudioHint('');
    setNameError('');
  };

  const handleCancel = () => {
    abortControllerRef.current?.abort();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canUpload || !file) return;

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setIsSubmitting(true);
    setProgress({
      stage: 'compressing',
      percent: 5,
      message: '音声を圧縮しています...',
    });

    try {
      const prepared = await prepareAudioForUpload(file, {
        signal: abortController.signal,
        onCompressProgress: (message, percent) => {
          setProgress({
            stage: 'compressing',
            percent,
            message,
          });
        },
      });

      const isLongAudio = prepared.durationSeconds > LONG_AUDIO_HINT_SECONDS;
      if (isLongAudio) {
        const minutes = formatDurationMinutes(prepared.durationSeconds);
        setLongAudioHint(
          `25分を超える録音（約${minutes}分）です。処理に数分かかる場合があります。`,
        );
      }

      setProgress({
        stage: 'uploading',
        percent: 10,
        message: '音声をアップロードしています...',
      });

      const result = await uploadTranscription({
        school,
        grade,
        className,
        studentName,
        audioParts: prepared.items.map((item) => ({
          blob: item.blob,
          filename: item.filename,
        })),
        isLongAudio: isLongAudio || prepared.chunked,
        onProgress: setProgress,
        signal: abortController.signal,
      });

      if (result.cancelled || abortController.signal.aborted) {
        return;
      }

      if (result.ok) {
        setModalVariant('success');
        setModalTitle('完了しました');
        setModalMessage(`保存ファイル名: ${result.filename ?? previewFilename}`);
        setModalOpen(true);
        resetForm();
      } else {
        setModalVariant('error');
        setModalTitle('エラー');
        setModalMessage(result.error ?? 'アップロードに失敗しました');
        setModalOpen(true);
      }
    } catch (error) {
      if (abortController.signal.aborted) {
        return;
      }

      const message = error instanceof Error ? error.message : 'アップロードに失敗しました';
      setProgress({
        stage: 'error',
        percent: 100,
        message,
      });
      setModalVariant('error');
      setModalTitle('エラー');
      setModalMessage(message);
      setModalOpen(true);
    } finally {
      abortControllerRef.current = null;
      setIsSubmitting(false);
      setProgress(initialProgress);
    }
  };

  return (
    <>
      <section className="card">
        <h2>音声アップロード</h2>
        <p className="lead">
          スクール・学年・クラス・生徒氏名を入力し、電話録音ファイルをアップロードしてください。
        </p>
        <p className="field-hint">{LONG_AUDIO_STATIC_HINT}</p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            スクール
            <select value={school} onChange={(e) => setSchool(e.target.value)} disabled={isSubmitting}>
              <option value="">選択してください</option>
              {SCHOOLS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            学年
            <select value={grade} onChange={(e) => setGrade(e.target.value)} disabled={isSubmitting}>
              <option value="">選択してください</option>
              {GRADES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            クラス
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              disabled={isSubmitting}
            >
              <option value="">選択してください</option>
              {CLASSES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            生徒氏名
            <input
              type="text"
              value={studentName}
              onChange={(e) => handleStudentNameChange(e.target.value)}
              placeholder="例: 山田 太郎"
              disabled={isSubmitting}
            />
            {nameError ? <span className="field-error">{nameError}</span> : null}
          </label>

          <div className="form-field">
            <span>音声ファイル</span>
            <input
              ref={audioFileInputRef}
              className="hidden-file-input"
              type="file"
              accept={AUDIO_FILE_ACCEPT}
              onChange={handleFileInputChange}
              disabled={isSubmitting}
            />
            <input
              ref={broadFileInputRef}
              className="hidden-file-input"
              type="file"
              onChange={handleFileInputChange}
              disabled={isSubmitting}
            />
            <div className="file-picker-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => audioFileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                音声から選択
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => broadFileInputRef.current?.click()}
                disabled={isSubmitting}
              >
                ファイルから選択
              </button>
            </div>
            {file ? <span className="field-hint">{file.name}</span> : null}
            {longAudioHint ? <span className="field-hint">{longAudioHint}</span> : null}
            {fileError ? <span className="field-error">{fileError}</span> : null}
          </div>

          {previewFilename ? (
            <p className="filename-preview">保存ファイル名: {previewFilename}</p>
          ) : null}

          <button type="submit" className="primary-button" disabled={!canUpload}>
            アップロード
          </button>
        </form>
      </section>

      <UploadOverlay progress={progress} onCancel={handleCancel} />
      <ResultModal
        open={modalOpen}
        title={modalTitle}
        message={modalMessage}
        variant={modalVariant}
        onClose={() => setModalOpen(false)}
      />
    </>
  );
}
