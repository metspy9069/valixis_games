const base = import.meta.env.VITE_API_BASE || "/api/soul-ember";
export async function api(action, body) {
  const response = await fetch(`${base}?action=${action}`, {
    method: body ? "POST" : "GET",
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok)
    throw new Error(
      response.status === 503
        ? "Online challenges are not configured yet. Solo play is available."
        : "The online service is unavailable. Try again later.",
    );
  return response.json();
}
export function metric(event) {
  if (!import.meta.env.VITE_ENABLE_METRICS) return;
  api("metric", { event }).catch(() => {});
}
// An integrator must install this adapter only after obtaining any required consent.
export const ads = {
  available() {
    return Boolean(
      window.soulEmberAds?.consented && window.soulEmberAds?.rewarded,
    );
  },
  async reward() {
    if (!this.available()) return false;
    try {
      return (await window.soulEmberAds.rewarded()) === true;
    } catch {
      return false;
    }
  },
  async interstitial(seconds, victory) {
    if (!window.soulEmberAds?.consented || (!victory && seconds < 480)) return;
    try {
      await window.soulEmberAds.interstitial?.();
    } catch {
      /* A failed ad must never block play. */
    }
  },
};
