/* Loads BEFORE app.js. In NIGHTWAY mode every campaign key is stored under an "nw_" prefix,
   so Nightway characters/libraries/enemies/etc. never mix with LOST data. */
(() => {
  let m = "lost";
  try { m = localStorage.getItem("lost_mode") || "lost"; } catch (e) {}
  if (m !== "nightway") return;
  const real = localStorage,
    P = /^(lost_chars_v4|lost_libraries|lost_active_library|lost_enemies|lost_battle|lost_loot|lost_pend|lost_workspace_view|lost_hidden_scene_characters|lost_main_party_migrated|lost_prejoin_backup|lost_p2p_players)$/,
    mk = (k) => (P.test(k) ? "nw_" + k : k);
  const px = new Proxy(real, {
    get(t, k) {
      if (typeof k !== "string") return undefined;
      if (k === "getItem") return (x) => t.getItem(mk(x));
      if (k === "setItem") return (x, v) => t.setItem(mk(x), v);
      if (k === "removeItem") return (x) => t.removeItem(mk(x));
      if (k === "length") return t.length;
      if (k === "key" || k === "clear") return t[k].bind(t);
      const v = t.getItem(mk(k));
      return v === null ? undefined : v;
    },
    set(t, k, v) { t.setItem(mk(k), v); return true; },
    deleteProperty(t, k) { t.removeItem(mk(k)); return true; },
    has(t, k) { return t.getItem(mk(k)) !== null; },
  });
  try { Object.defineProperty(window, "localStorage", { get: () => px, configurable: true }); } catch (e) { console.warn("Nightway storage isolation unavailable", e); }
})();
