import type { UploadProgress } from '../lib/api';

interface Props {
  progress: UploadProgress;
}

export default function UploadOverlay({ progress }: Props) {
  if (progress.stage === 'idle') return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-label="アップロード中">
      <div className="overlay-card">
        <p className="overlay-title">{progress.message}</p>
        <div className="progress-track" aria-hidden="true">
          <div className="progress-bar" style={{ width: `${progress.percent}%` }} />
        </div>
        <p className="overlay-percent">{progress.percent}%</p>
        <p className="overlay-note">アップロード完了まで画面を閉じないでください</p>
      </div>
    </div>
  );
}
