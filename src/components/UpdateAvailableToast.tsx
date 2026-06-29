interface Props {
  updating: boolean;
  onUpdate: () => void;
}

export default function UpdateAvailableToast({ updating, onUpdate }: Props) {
  return (
    <aside className="update-toast" role="status" aria-live="polite">
      <div>
        <strong>新しいバージョンがあります</strong>
        <span>更新して最新版を読み込みます。</span>
      </div>
      <button type="button" className="update-button" onClick={onUpdate} disabled={updating}>
        {updating ? '更新中...' : '更新'}
      </button>
    </aside>
  );
}
