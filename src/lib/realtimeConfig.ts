const STORAGE_KEY = 'stability_mode';

function resolveStabilityMode(): boolean {
  if (import.meta.env.VITE_STABILITY_MODE === 'true') return true;
  if (import.meta.env.VITE_STABILITY_MODE === 'false') return false;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') return true;
    if (stored === 'false') return false;
  } catch {
  }
  return false;
}

let _cached: boolean | null = null;

export function isStabilityMode(): boolean {
  if (_cached === null) _cached = resolveStabilityMode();
  return _cached;
}

export function setStabilityMode(enabled: boolean): void {
  _cached = enabled;
  try {
    localStorage.setItem(STORAGE_KEY, String(enabled));
  } catch {
  }
}

export function clearStabilityModeOverride(): void {
  _cached = null;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  _cached = resolveStabilityMode();
}
