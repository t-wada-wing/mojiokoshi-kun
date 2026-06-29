import { registerSW } from 'virtual:pwa-register';

type UpdateListener = (available: boolean) => void;

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null;
let updateAvailable = false;
let updateCheckScheduled = false;
const listeners = new Set<UpdateListener>();

function notifyUpdateListeners() {
  listeners.forEach((listener) => listener(updateAvailable));
}

function markUpdateAvailable() {
  updateAvailable = true;
  notifyUpdateListeners();
}

export function subscribeToPwaUpdates(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(updateAvailable);
  return () => {
    listeners.delete(listener);
  };
}

export function registerPwaUpdateListener(): void {
  if (updateSW) return;

  updateSW = registerSW({
    immediate: true,
    onNeedRefresh: markUpdateAvailable,
    onNeedReload: markUpdateAvailable,
    onRegisteredSW(_swScriptUrl, registration) {
      if (!registration || updateCheckScheduled) return;

      const checkForUpdate = () => {
        if (document.visibilityState === 'visible') {
          void registration.update();
        }
      };

      updateCheckScheduled = true;
      checkForUpdate();
      window.setInterval(checkForUpdate, 5 * 60 * 1000);
      window.addEventListener('focus', checkForUpdate);
      document.addEventListener('visibilitychange', checkForUpdate);
    },
    onRegisterError(error) {
      console.error('Service worker registration failed:', error);
    },
  });
}

export async function applyPwaUpdate(): Promise<void> {
  if (!updateSW) {
    window.location.reload();
    return;
  }

  await updateSW(true);
}
