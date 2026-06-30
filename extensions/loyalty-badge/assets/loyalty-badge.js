(() => {
  const REF_COOKIE = "lp_ref";
  const TRACK_BASE = "/apps/loyalty-pulse/track";

  function readConfig() {
    const el = document.getElementById("lp-config-json");
    if (!el) return null;
    try {
      return JSON.parse(el.textContent || "null");
    } catch {
      return null;
    }
  }

  function setRefCookie() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    if (!ref) return;
    const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${REF_COOKIE}=${encodeURIComponent(ref)}; path=/; expires=${expires}`;
    const body = new FormData();
    body.set("eventType", "ref_landing");
    body.set("refCode", ref);
    fetch(TRACK_BASE, { method: "POST", body }).catch(() => {});
  }

  function renderBadge() {
    const root = document.querySelector("[data-lp-badge]");
    const label = document.querySelector("[data-lp-label]");
    if (!root || !label) return;

    const config = readConfig();
    if (!config?.enabled) {
      root.style.display = "none";
      return;
    }

    const price = parseFloat(root.dataset.price || "0");
    const rate = Number(config.pointsPerCurrency || 10);
    const bonus = Number(config.bonusMultiplier || 1);
    const points = Math.floor(price * rate * bonus);
    const name = config.pointsName || "积分";

    label.textContent = `购买可得 ${points} ${name}`;
    const body = new FormData();
    body.set("eventType", "badge_view");
    fetch(TRACK_BASE, { method: "POST", body }).catch(() => {});
  }

  setRefCookie();
  renderBadge();
})();
