import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  open: boolean;
  message: string;
  percent: number;
  note?: string;
}

const DEFAULT_NOTE = '処理が完了するまで画面を操作しないでください';

export default function BlockingProgressOverlay({
  open,
  message,
  percent,
  note = DEFAULT_NOTE,
}: Props) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const blockTouchMove = (event: TouchEvent) => {
      event.preventDefault();
    };

    document.addEventListener('touchmove', blockTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('touchmove', blockTouchMove);
    };
  }, [open]);

  if (!open) return null;

  const clampedPercent = Math.min(100, Math.max(0, Math.round(percent)));

  return createPortal(
    <div
      className="overlay overlay-blocking"
      role="dialog"
      aria-modal="true"
      aria-busy="true"
      aria-label="処理中"
      aria-live="polite"
      onWheel={(event) => event.preventDefault()}
    >
      <div className="overlay-card">
        <p className="overlay-title">{message}</p>
        <div
          className="progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={clampedPercent}
          aria-label="進捗"
        >
          <div className="progress-bar" style={{ width: `${clampedPercent}%` }} />
        </div>
        <p className="overlay-percent">{clampedPercent}%</p>
        <p className="overlay-note">{note}</p>
      </div>
    </div>,
    document.body,
  );
}
