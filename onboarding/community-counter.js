/** Persists and animates the demo “community member” counter via POST /v1/public/onboarding/community-join. */
window.SabzineCommunityCounter = {
  async start(counterEl) {
    if (!counterEl) return null;
    let target = 1622;
    try {
      const res = await fetch('/v1/public/onboarding/community-join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(12000),
      });
      if (res.ok) {
        const data = await res.json();
        const n = Number(data.count);
        if (Number.isFinite(n) && n > 0) target = n;
      }
    } catch {
      /* keep fallback animation */
    }
    const span = Math.min(120, Math.max(24, Math.round(target * 0.04)));
    const start = Math.max(1, target - span);
    counterEl.textContent = start.toLocaleString('fa-IR');
    const began = performance.now();
    let tick = null;
    tick = setInterval(() => {
      const t = Math.min(1, (performance.now() - began) / 1400);
      counterEl.textContent = Math.round(
        start + (target - start) * (1 - Math.pow(1 - t, 3)),
      ).toLocaleString('fa-IR');
      if (t === 1) clearInterval(tick);
    }, 40);
    return tick;
  },
};
