/**
 * After a deploy, an open tab still references the previous build's chunk files, which no longer
 * exist, so the next lazy route fails to load. Vite fires `vite:preloadError` then; reloading
 * fetches the new index.html. A timestamp in sessionStorage stops a reload loop when the chunk is
 * genuinely broken.
 */
const KEY = 'app.preload-reload-at';
const MIN_INTERVAL_MS = 10_000;

export function shouldReload(lastReloadAt: number | null, now: number): boolean {
  return lastReloadAt === null || now - lastReloadAt > MIN_INTERVAL_MS;
}

export function installPreloadRecovery(): void {
  window.addEventListener('vite:preloadError', (event) => {
    const last = Number(sessionStorage.getItem(KEY)) || null;
    const now = Date.now();
    if (!shouldReload(last, now)) return; // Let the error reach the route's error component.
    event.preventDefault();
    sessionStorage.setItem(KEY, String(now));
    window.location.reload();
  });
}
