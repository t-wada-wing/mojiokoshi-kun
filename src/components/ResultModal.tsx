interface Props {
  open: boolean;
  title: string;
  message: string;
  onClose: () => void;
  variant?: 'success' | 'error' | 'info';
}

export default function ResultModal({
  open,
  title,
  message,
  onClose,
  variant = 'success',
}: Props) {
  if (!open) return null;

  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="result-title">
      <div className={`modal-card ${variant}`}>
        <h2 id="result-title">{title}</h2>
        <p>{message}</p>
        <button type="button" className="primary-button" onClick={onClose}>
          閉じる
        </button>
      </div>
    </div>
  );
}
