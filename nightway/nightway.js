/* NIGHTWAY mode — alternate ruleset layered on top of L.O.S.T. (LOST mode is untouched). */
const NW = (() => {
  const ST = [
    ["TRIPAS", "Quanto um indivíduo aguenta fisicamente. Cada ponto dá +2 de vida (base 6). Cada 2 HP = 1 coração (estilo N64 / Majora's Mask)."],
    ["MIOLOS", "Raciocínio e compreensão rápida. Lógica e precisão de ataques críticos."],
    ["CARNE", "Força exercida só com o corpo. Cada ponto dá +1 slot de inventário (base 2)."],
    ["CHEIRO", "Perceber o mundo ao redor. Percepção e intuição."],
    ["SANGUE", "Movimento, destreza e reação. Velocidade, furtividade, iniciativa e ataques à distância."],
    ["STAMINA", "Cada ponto adiciona +1 entalhe à barra de stamina (base 3). Substitui sanidade."],
    ["TEMPERO", "Energias do destino. Sorte e eventos aleatórios no Nightway."],
  ];
  const K = ST.map((x) => x[0]), MIN = -1, MAX = 5, POOL = 7, BASE_STAT = 4;
  const ALIAS = { VIDA: "hpmax", BARRA: "sanmax", DANO: "dmg" };
  const KEY = "lost_mode", CK = "nw_crt";
  let mode = "lost", crt = "on";
  try { mode = localStorage.getItem(KEY) || "lost"; crt = ({ "1": "on", "0": "off" })[localStorage.getItem(CK)] || localStorage.getItem(CK) || "on"; } catch (e) {}
  const on = () => mode === "nightway";
  const eff0 = (b, g) => cl((b || 0) + (g || 0), MIN, MAX);
  const base = (c, k) => {
    const v = c.nw?.st?.[k];
    return v === undefined || v === null ? BASE_STAT : v;
  };
  // Equipment no longer modifies attribute stats — hard-locked to sheet values.
  const eff = (c, k) => eff0(base(c, k), 0);
  const init = (n) => {
    n.nw ??= {};
    const w = n.nw;
    w.st ??= {};
    // Ensure every stat defaults to BASE_STAT (4) when first created
    K.forEach((k) => { if (w.st[k] === undefined || w.st[k] === null) w.st[k] = BASE_STAT; });
    w.info ??= {};
    w.pool ??= POOL;
    // slots are formula-driven (2 + CARNE); keep a stored value only as optional override cache
    w.slots ??= null;
    w.armor ??= [{}, {}, {}];
    w.acc ??= [{}, {}];
    w.weapons ??= [{}, {}];
    w.skills ??= [];      // Ações especiais (custam stamina)
    w.pericias ??= [];    // Perícias (rolagens nomeadas custom)
    while (w.armor.length < 3) w.armor.push({});
    while (w.acc.length < 2) w.acc.push({});
    while (w.weapons.length < 2) w.weapons.push({});
    n.inv ??= [];
    return w;
  };
  const FN = Object.create(null);
  const items = (c) => [...(c.nw?.armor || []), ...(c.nw?.acc || [])];
  const parseMod = (s) => {
    const out = [];
    String(s || "").replace(/([A-ZÀ-Ú]+)\s*([+-]\s*\d+)/gi, (_, k, v) => {
      k = k.toUpperCase();
      // Attribute stats (TRIPAS, CARNE, …) are ignored from gear — hard-locked on the sheet.
      if (K.includes(k)) return;
      const t = ALIAS[k];
      if (t) out.push({ t, v: parseInt(v.replace(/\s/g, ""), 10) });
    });
    return out;
  };
  function mods(c) {
    init(c);
    const m = { roll: 0, hpmax: 0, sanmax: 0, regen: 0, dmg: 0, hpMultiplier: 1, initiativeFirst: false, stat: Object.fromEntries(K.map((k) => [k, 0])) };
    items(c).forEach((p) => {
      if (!p || p.off) return;
      delete p.err;
      parseMod(p.mod).forEach((g) => (g.t.startsWith("stat:") ? (m.stat[g.t.slice(5)] += g.v) : (m[g.t] += g.v)));
      if (p.code)
        try { (FN[p.code] ??= new Function("c", "m", p.code))(J(c), m); } catch (e) { p.err = e.message; }
    });
    // Force attribute stats from gear to zero (code may have tried to set them)
    K.forEach((k) => { m.stat[k] = 0; });
    return m;
  }
  // HP: base 6, +2 per TRIPAS. Min 1.
  const hp = (c, m) => Math.max(1, 6 + 2 * eff0(base(c, "TRIPAS"), 0) + (m?.hpmax || 0));
  // Stamina: base 3, +1 per STAMINA point. Min 1.
  const sta = (c, m) => Math.max(1, 3 + eff0(base(c, "STAMINA"), 0) + (m?.sanmax || 0));
  // Inventory slots: base 2 + CARNE
  const slots = (c) => {
    init(c);
    const fromCarne = 2 + eff(c, "CARNE");
    // If author manually set slots, respect a stored override only when explicitly set via UI
    if (c.nw.slots != null && c.nw._slotsManual) return Math.max(1, c.nw.slots);
    return Math.max(1, fromCarne);
  };
  const dice = (p) => (p >= 1 ? { n: p, best: true } : { n: 2 - p, best: false });
  const lbl = (p) => { const x = dice(p); return x.n === 1 ? "1d20" : `${x.n}d20 ${x.best ? "▲ melhor" : "▼ pior"}`; };
  function rollK(c, k) {
    const p = eff(c, k), { n, best } = dice(p);
    const d = Array.from({ length: n }, () => randomInt(20) + 1);
    const kept = best ? Math.max(...d) : Math.min(...d), sum = d.reduce((a, x) => a + x, 0);
    return { p, n, best, d, kept, sum };
  }
  function ini(c) { const r = rollK(c, "SANGUE"); return { t: r.kept, d: r.d, b: 0 }; }
  function doRoll(c, k, title, extra = []) {
    const r = rollK(c, k), drop = r.sum - r.kept, e = [...extra];
    if (drop) e.push(["dados descartados", -drop]);
    const x = { f: lbl(r.p), d: r.d, z: 20, s: r.sum, b: 0, t: r.sum, lo: 1 + drop, hi: 20 + drop, k: 1 };
    show(c.name, `${title || k} (${lbl(r.p)})`, x, e);
  }
  const mDmg = (c) => c.mod?.dmg || 0;
  const setPath = (o, path, v) => {
    const p = path.split(".");
    while (p.length > 1) { const k = p.shift(); o = o[k] ??= /^\d+$/.test(p[0]) ? [] : {}; }
    o[p[0]] = v;
  };
  const canEdit = () => admin;
  const inp = (path, v, ph = "", cls = "") => canEdit() ? `<input data-nw="${path}" value="${esc(v ?? "")}" placeholder="${esc(ph)}" class="${cls}">` : `<b>${esc(v || "—")}</b>`;
  const area = (path, v, ph = "", rows = 3) => canEdit() ? `<textarea data-nw="${path}" rows="${rows}" placeholder="${esc(ph)}">${esc(v ?? "")}</textarea>` : `<div class="nwtxt">${esc(v || "—")}</div>`;

  /* ---- N64-style heart containers (2 HP per full heart) + notched stamina bar ---- */
  function heartsHtml(cur, max) {
    const m = Math.max(0, Math.floor(max)), v = Math.max(0, Math.min(m, Math.floor(cur)));
    const nHearts = Math.ceil(m / 2) || 1;
    let h = "";
    for (let i = 0; i < nHearts; i++) {
      const need = i * 2;
      let cls = "empty";
      if (v >= need + 2) cls = "full";
      else if (v >= need + 1) cls = "half";
      h += `<span class="nw-heart ${cls}" aria-hidden="true"><span class="nw-h-l"></span><span class="nw-h-r"></span></span>`;
    }
    return `<div class="nw-vitals"><div class="lb"><span>HEALTH</span><span>${v}/${m} HP</span></div><div class="nw-hearts" title="${v}/${m} HP">${h}</div></div>`;
  }
  function notchesHtml(cur, max) {
    const m = Math.max(0, Math.floor(max)), v = Math.max(0, Math.min(m, Math.floor(cur)));
    let h = "";
    for (let i = 0; i < m; i++) {
      h += `<span class="nw-notch${i < v ? " on" : ""}"></span>`;
    }
    if (!m) h = '<span class="nw-notch"></span>';
    return `<div class="nw-vitals"><div class="lb"><span>STAMINA</span><span>${v}/${m} STA</span></div><div class="nw-sta" title="${v}/${m} STA">${h}</div></div>`;
  }
  function bar(v, m, k) {
    if (k === "hp") return heartsHtml(v, m);
    if (k === "sn" || k === "san") return notchesHtml(v, m);
    // fallback
    return `<div class="lb"><span>${k}</span><span>${v}/${m}</span></div><div class="m ${k}"><i style="width:${m ? cl((v / m) * 100, 0, 100) : 0}%"></i></div>`;
  }

  const itemCard = (c, kind, i, label) => {
    const it = c.nw[kind][i] || {}, p = `nw.${kind}.${i}`, tags = parseMod(it.mod);
    return `<div class="nwslot${it.off ? " off" : ""}"><div class="row sp"><b class="o">${label}</b>${canEdit() && it.n ? `<button class="b s${it.off ? "" : " on"}" data-a="nw" data-op="toggle" data-p="${kind}.${i}">${it.off ? "DESLIGADO" : "ATIVO"}</button>` : ""}</div>
${inp(p + ".n", it.n, "Nome do item")}${area(p + ".d", it.d, "Descrição", 2)}
${canEdit() ? `<label>MODIFICADORES <span class="mt">(apenas VIDA / BARRA / DANO — stats de atributo estão travados na ficha)</span></label>${inp(p + ".mod", it.mod, "VIDA+2, BARRA+1, DANO+1")}<details><summary class="b s">{ } CÓDIGO INLINE</summary><textarea data-nw="${p}.code" rows="2" placeholder="m.hpmax += 2;  // recebe (c, m) — NÃO altere stats de atributo">${esc(it.code || "")}</textarea></details>` : ""}
${tags.map((g) => `<span class="chip o">${esc(g.t.replace("hpmax", "VIDA").replace("sanmax", "BARRA").replace("dmg", "DANO"))} ${sg(g.v)}</span>`).join("")}${it.code && !it.off ? '<span class="chip">{ } código</span>' : ""}${it.err ? `<div class="pz">Erro: ${esc(it.err)}</div>` : ""}</div>`;
  };
  const stats = (c) => {
    const used = K.reduce((a, k) => a + (base(c, k) - BASE_STAT), 0);
    const left = c.nw.pool - used;
    return `<div class="nwhead">STATS</div><div class="mt">Base de cada atributo: <b class="o">${BASE_STAT}</b> · mínimo <b>−1</b> · máximo <b>${MAX}</b>. Equipamentos <b>não</b> alteram atributos (travados na ficha). <b class="${left < 0 ? "pz" : "o"}">Pontos de pool restantes (desvio da base): ${left}</b>${admin ? ` · pool <input type="number" data-nw="nw.pool" value="${c.nw.pool}" style="width:54px;display:inline-block">` : ""}</div>` +
      ST.map(([k, d]) => {
        const b = base(c, k), e = eff(c, k);
        return `<div class="nwstat"><div class="nwsn"><b>${k}</b><span class="mt">${d}</span></div><div class="nwsc">${admin ? `<button class="b s" data-a="nw" data-op="st" data-k="${k}" data-d="-1">−</button>` : ""}<span class="nwv ${b < 0 ? "neg" : ""}">${b}</span>${admin ? `<button class="b s" data-a="nw" data-op="st" data-k="${k}" data-d="1">+</button>` : ""}</div><div class="nwsd"><span class="chip">${lbl(e)}</span>${canRollCharacter(c) ? `<button class="b s am" data-a="nw" data-op="roll" data-k="${k}">ROLAR</button>` : ""}</div></div>`;
      }).join("");
  };
  const weapons = (c) => (c.nw?.weapons || [{}, {}]).map((w, i) => {
    w = w || {};
    const p = `nw.weapons.${i}`, canR = typeof canRollCharacter === "function" && canRollCharacter(c);
    return `<div class="nwslot"><b class="o">ARMA ${i + 1}</b>${inp(p + ".n", w.n, "Nome da arma")}
${admin ? `<div class="r3"><div><label>STAT DE ACERTO</label><select data-nw="${p}.stat">${opts([["", "CARNE"], ...K.map((k) => [k, k])], w.stat || "")}</select></div><div><label>DANO (NdS+B)</label><input data-nw="${p}.f" value="${esc(w.f || "")}" placeholder="1d8+2"></div></div>` : `<div class="mt">Acerto: ${esc(w.stat || "CARNE")} · Dano: ${esc(w.f || "—")}${mDmg(c) ? ` ${sg(mDmg(c))} equip` : ""}</div>`}
${area(p + ".d", w.d, "Notas / efeitos", 2)}${w.n && canR ? `<div class="row"><button class="b am" data-a="nw" data-op="hit" data-i="${i}">ACERTAR</button>${w.f ? `<button class="b rd" data-a="nw" data-op="dmg" data-i="${i}">DANO</button>` : ""}</div>` : ""}</div>`;
  }).join("");

  /* Perícias = named custom rolls (no stamina cost) */
  const pericias = (c) => {
    const list = c.nw?.pericias || [];
    if (!list.length) return '<div class="mt">— nenhuma perícia —</div>';
    return list.map((s, i) => {
      s = s || {};
      const p = `nw.pericias.${i}`;
      return `<div class="nwslot"><div class="row sp"><b class="o">${admin ? "" : esc(s.n || "Perícia")}</b><span class="row">${typeof canRollCharacter === "function" && canRollCharacter(c) && s.n ? `<button class="b s am" data-a="nw" data-op="pericia" data-i="${i}">ROLAR</button>` : ""}${admin ? `<button class="b s rd" data-a="nw" data-op="delpericia" data-i="${i}">✕</button>` : ""}</span></div>
${admin ? `<div class="row"><input data-nw="${p}.n" value="${esc(s.n || "")}" placeholder="Nome da perícia" style="flex:2"><select data-nw="${p}.stat" style="flex:1">${opts([["", "sem rolagem"], ...K.map((k) => [k, k])], s.stat || "")}</select></div>` : `<div class="mt">${s.stat ? "Rola " + esc(s.stat) : "Sem rolagem"}</div>`}${area(p + ".d", s.d, "Descrição / efeito", 2)}</div>`;
    }).join("");
  };

  /* Ações especiais = stamina-consuming abilities (former Perícias) */
  const acoes = (c) => {
    const list = c.nw?.skills || [];
    if (!list.length) return '<div class="mt">— nenhuma ação especial —</div>';
    return list.map((s, i) => {
      s = s || {};
      const p = `nw.skills.${i}`;
      return `<div class="nwslot"><div class="row sp"><b class="o">${admin ? "" : esc(s.n || "Ação")}</b><span class="row"><span class="chip o">${num(s.cost)} STA</span>${typeof canRollCharacter === "function" && canRollCharacter(c) && s.n ? `<button class="b s am" data-a="nw" data-op="skill" data-i="${i}">USAR</button>` : ""}${admin ? `<button class="b s rd" data-a="nw" data-op="delskill" data-i="${i}">✕</button>` : ""}</span></div>
${admin ? `<div class="row"><input data-nw="${p}.n" value="${esc(s.n || "")}" placeholder="Nome da ação" style="flex:2"><input type="number" data-nw="${p}.cost" value="${num(s.cost)}" placeholder="Custo STA" style="flex:1"><select data-nw="${p}.stat" style="flex:1">${opts([["", "sem rolagem"], ...K.map((k) => [k, k])], s.stat || "")}</select></div>` : `<div class="mt">${s.stat ? "Rola " + esc(s.stat) : "Sem rolagem"} · Custo ${num(s.cost)} STA</div>`}${area(p + ".d", s.d, "Descrição / efeito", 2)}</div>`;
    }).join("");
  };

  function view(c) {
    if (!c) return;
    try {
      init(c);
      if (typeof mth === "function") mth(c);
      const w = c.nw,
        i = w.info || {},
        [h, s] = [c.hp || [0, 0], c.san || [0, 0]];
      const weaponsList = w.weapons || [{}, {}],
        armorList = w.armor || [{}, {}, {}],
        accList = w.acc || [{}, {}];
      const tab = (typeof TAB !== "undefined" && TAB === "imp") ? "imp" : "main",
        used = (c.inv || []).length,
        slotCount = slots(c);
      const inv = Array.from({ length: Math.max(slotCount, used) }, (_, j) =>
        j < used
          ? `<div class="sl${j >= slotCount ? " ov" : ""}"><span>${esc(c.inv[j])}</span>${admin ? `<button class="b s rd" data-a="nw" data-op="rmi" data-i="${j}">✕</button>` : ""}</div>`
          : '<div class="sl e">vazio</div>',
      ).join("");
      const body =
        tab === "imp"
          ? `<div class="nwhead">ARMADURA</div><div class="mt">Armaduras e acessórios <b>não</b> modificam atributos da ficha (TRIPAS, CARNE, etc. ficam travados). Podem afetar apenas VIDA, BARRA (stamina) e DANO.</div><div class="nwgrid">${["TOPO", "MEIO", "BAIXO"].map((l, j) => itemCard(c, "armor", j, l)).join("")}</div><div class="nwhead">ACESSÓRIOS</div><div class="nwgrid">${["ACESSÓRIO 1", "ACESSÓRIO 2"].map((l, j) => itemCard(c, "acc", j, l)).join("")}</div>`
          : `<div class="nwhead">VOCÊ.</div><div class="nwid"><div><label>Seu Nome</label>${inp("name", c.name)}</div><div><label>Seu Gênero</label>${inp("nw.info.gender", i.gender)}</div><div><label>Sua Idade</label>${inp("nw.info.age", i.age)}</div><div><label>Sua "Classe" (Guerreiro, mago, etc.)</label>${inp("nw.info.cls", i.cls)}</div></div>
<div class="mt">Equipamentos: ${weaponsList.filter((x) => x && x.n).length}/2 armas · ${armorList.filter((x) => x && x.n).length}/3 armaduras · ${accList.filter((x) => x && x.n).length}/2 acessórios · Inventário base 2 + CARNE</div>
<label>Sua história <span class="mt">(Não mencione o lorde das sombras. Mas você sabe que uma hora ele apareceu, e ele é seu objetivo.)</span></label>${area("nw.info.story", i.story, "⚿> …", 4)}
${stats(c)}<div class="nwhead">ARMAS</div><div class="nwgrid">${weapons(c)}</div>
<div class="row sp"><div class="nwhead" style="flex:1">PERÍCIAS <span class="mt">(rolagens nomeadas — sem custo de stamina)</span></div>${admin ? '<button class="b s am" data-a="nw" data-op="addpericia">+ PERÍCIA</button>' : ""}</div><div class="nwgrid">${pericias(c)}</div>
<div class="row sp"><div class="nwhead" style="flex:1">AÇÕES ESPECIAIS <span class="mt">(consomem stamina)</span></div>${admin ? '<button class="b s am" data-a="nw" data-op="addskill">+ AÇÃO</button>' : ""}</div><div class="nwgrid">${acoes(c)}</div>
<div class="row sp"><div class="nwhead" style="flex:1">INVENTÁRIO · <span class="${used > slotCount ? "pz" : "o"}">${used}/${slotCount}</span> <span class="mt">(2 + CARNE)</span></div>${admin ? `<span class="row"><button class="b s" data-a="nw" data-op="slot" data-d="-1">−</button><button class="b s" data-a="nw" data-op="slot" data-d="1">+</button></span>` : ""}</div>
<div class="inv">${inv}</div>${admin ? '<div class="row" style="margin-top:4px"><input id="nwadd" placeholder="Novo item…" style="flex:1"><button class="b am" data-a="nw" data-op="addi">ADICIONAR</button></div>' : ""}`;
      const html = `<div class="tb"><span>▸ ${esc(c.name)}</span><span class="row">${typeof sb === "function" ? sb(c) : ""}<button class="b s" data-a="nwexpchar" title="Baixar só este personagem (.json)">⇧ EXPORTAR</button>${admin ? '<button class="b s" data-a="edit">EDIT</button>' : ""}<button class="b s" data-a="close">FECHAR</button></span></div>
<div class="pd sh nwm"><div><div class="im">${im(c, "SEM IMAGEM")}</div></div><div>
<div class="two nw-two-vitals">${bar(h[0], h[1], "hp")}${bar(s[0], s[1], "sn")}</div>${typeof lostVitalsControls === "function" ? lostVitalsControls(c) : ""}
<div class="row nwtabs">${[["main", "PRINCIPAL"], ["imp", "ARMADURA"]].map(([k, t]) => `<button class="b${tab == k ? " on" : ""}" data-a="tab" data-k="${k}">${t}</button>`).join("")}</div>${body}</div></div>`;
      const el = $("#v");
      if (el) {
        el._h = null;
        setH(el, html);
        el.classList.remove("hid");
      }
      document.body.classList.add("full");
    } catch (err) {
      console.error("Nightway view error", err);
      const el = $("#v");
      if (el) {
        el._h = null;
        el.innerHTML = `<div class="tb"><span>▸ Erro ao abrir personagem</span><button class="b s" data-a="close">FECHAR</button></div><div class="pd"><div class="pz">${esc(err && err.message ? err.message : String(err))}</div><div class="mt">Abra o console (F12) para detalhes. Tente recarregar a página.</div></div>`;
        el.classList.remove("hid");
      }
    }
  }
  function act(t) {
    const d = t.dataset, id = sel, c = cur();
    const e = (fn) => mut((n) => { init(n); fn(n.nw, n); });
    switch (d.op) {
      case "st": return e((w) => (w.st[d.k] = cl(base({ nw: w }, d.k) + +d.d, MIN, MAX)));
      case "roll": return doRoll(c, d.k);
      case "hit": { const x = c.nw.weapons[+d.i]; return doRoll(c, x.stat || "CARNE", "Acerto · " + (x.n || "Arma")); }
      case "dmg": { const x = c.nw.weapons[+d.i], r = R(x.f); return show(c.name, "Dano · " + (x.n || "Arma"), r, mDmg(c) ? [["equip.", mDmg(c)]] : []); }
      case "skill": {
        const s = c.nw.skills[+d.i], cost = Math.max(0, Math.floor(num(s.cost)));
        if (c.san[0] < cost) return alert(`Stamina insuficiente (${c.san[0]}/${cost}).`);
        if (cost) lostUser ? lostAdjustVital(c.id, "san", -cost) : mut((n) => (n.san[0] = cl(n.san[0] - cost, 0, n.san[1])));
        return s.stat ? doRoll(c, s.stat, "Ação · " + s.n) : show(c.name, "Ação · " + s.n, R("1d2"), []);
      }
      case "pericia": {
        const s = c.nw.pericias[+d.i];
        return s.stat ? doRoll(c, s.stat, "Perícia · " + s.n) : show(c.name, "Perícia · " + s.n, R("1d2"), []);
      }
      case "toggle": return e((w) => { const [k, i] = d.p.split("."); w[k][i].off = !w[k][i].off; });
      case "addskill": return e((w) => w.skills.push({ n: "", cost: 1, stat: "", d: "" }));
      case "delskill": return e((w) => w.skills.splice(+d.i, 1));
      case "addpericia": return e((w) => w.pericias.push({ n: "", stat: "", d: "" }));
      case "delpericia": return e((w) => w.pericias.splice(+d.i, 1));
      case "slot": return e((w) => {
        // Manual override of inventory slots
        w._slotsManual = true;
        w.slots = Math.max(1, (w.slots != null ? w.slots : slots({ nw: w })) + +d.d);
      });
      case "rmi": return e((w, n) => n.inv.splice(+d.i, 1));
      case "addi": { const v = $("#nwadd")?.value.trim(); if (v) e((w, n) => n.inv.push(v)); }
    }
  }
  /* ---- single-character JSON export / import (works across sessions) ---- */
  const CHAR_FMT = "L.O.S.T. character";
  const fslug = (v) => String(v || "personagem").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "personagem";
  function exportChar() {
    const c = typeof cur === "function" ? cur() : null;
    if (!c) return;
    const ch = J(c);
    delete ch.libraryId; delete ch.last;
    const pack = { format: CHAR_FMT, mode: "nightway", version: 1, exportedAt: new Date().toISOString(), character: ch };
    const a = document.createElement("a"), u = URL.createObjectURL(new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" }));
    a.href = u;
    a.download = "nightway_char_" + fslug(c.name) + ".json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 1000);
  }
  async function importChar(file) {
    let txt = await file.text();
    if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1);
    const p = JSON.parse(txt);
    let ch = p;
    if (p && Array.isArray(p.characters)) {
      if (p.characters.length !== 1) throw new Error("Este arquivo é uma sessão completa. Use LOAD SESSION JSON para ela.");
      ch = p.characters[0];
    } else if (p && p.character) ch = p.character;
    if (p && p.mode === "lost") throw new Error("Este personagem é do modo LOST, não do NIGHTWAY.");
    if (!ch || typeof ch !== "object" || Array.isArray(ch) || !ch.nw || typeof ch.nw !== "object")
      throw new Error("Este arquivo não é um personagem Nightway.");
    const n = J(ch);
    delete n.libraryId;
    n.name = String(n.name || "Novo Personagem");
    let id = "nw-" + Date.now();
    while (C.some((x) => x.id === id)) id += "x";
    n.id = id;
    n.order = C.length + 1;
    init(n);
    mth(n);
    put(n);
    ed = null;
    editFromLibrary = false;
    sel = n.id;
    location.hash = n.id;
    view(n);
  }
  const saved = () => { try { return localStorage.getItem(KEY) === "nightway" ? "nightway" : "lost"; } catch (e) { return "lost"; } };
  const CRTS = ["on", "warp", "off"];
  function setMode(m, silent, persist) {
    mode = m === "nightway" ? "nightway" : "lost";
    if (persist) try { localStorage.setItem(KEY, mode); } catch (e) {}
    const b = document.body;
    b.classList.toggle("nw", on());
    b.classList.toggle("nw-crt", on() && crt !== "off");
    b.classList.toggle("nw-warp", on() && crt === "warp");
    const mb = $("#nwbtn"), cb = $("#nwcrtbtn");
    const ib = $("#nwimpbtn"); if (ib) ib.classList.toggle("hid", !on());
    if (mb) mb.textContent = "MODE: " + (on() ? "NIGHTWAY" : "LOST");
    if (cb) { cb.classList.toggle("hid", !on()); cb.textContent = "CRT: " + crt.toUpperCase(); }
    document.querySelectorAll("[data-m]").forEach((x) => x.classList.toggle("on", x.dataset.m === mode));
    document.title = on() ? "NIGHTWAY" : "L.O.S.T.";
    const h1 = $("h1"); if (h1) h1.textContent = on() ? "☾ NIGHTWAY" : "◉ L.O.S.T.";
    // Author panel labels: SAN → STA in Nightway
    const sanWord = on() ? "STA" : "SAN";
    document.querySelectorAll('[data-a="max"][data-k="san"]').forEach((el) => { el.textContent = "MAX " + sanWord; });
    document.querySelectorAll('[data-a="zero"][data-k="san"]').forEach((el) => { el.textContent = "ZERO " + sanWord; });
    const ds = document.getElementById("ds");
    if (ds) ds.placeholder = on() ? (ds.dataset.phNw || "STA Drain") : (ds.dataset.phLost || "SAN Drain");
    if (!silent && typeof C !== "undefined") { C.forEach(mth); render(); }
  }
  /* back at the start screen: return to the mode that was picked there */
  function restore() {
    if (mode === saved()) return;
    setMode(saved(), true);
    lostResetSessionMemory(); render();
  }
  function checkImport(p) {
    const m = Array.isArray(p) ? "lost" : p?.mode === "nightway" ? "nightway" : "lost";
    if (m !== mode) throw new Error(`This save is a ${m.toUpperCase()} session. Pick ${m.toUpperCase()} on the start screen first.`);
  }
  function boot() {
    XP.nw = act;
    XP.nwexpchar = exportChar;
    XP.nwimpchar = () => { if (!on() || !admin) return; const f = document.getElementById("nwcf"); if (f) f.click(); };
    XP.nwmode = () => { if (confirm("Voltar à tela inicial para trocar o modo? (sua sessão atual será encerrada; os dados de cada modo ficam salvos)")) lostLeave(); };
    XP.nwcrt = () => { crt = CRTS[(CRTS.indexOf(crt) + 1) % 3]; try { localStorage.setItem(CK, crt); } catch (e) {} setMode(mode, true); };
    XP.nwpick = (t) => { const m = t.dataset.m; if (m === saved()) return; try { localStorage.setItem(KEY, m); } catch (e) {} location.reload(); };
    document.addEventListener("change", async (ev) => {
      const t = ev.target;
      if (t.id !== "nwcf") return;
      try {
        if (!on() || !admin || !t.files?.[0]) return;
        await importChar(t.files[0]);
      } catch (x) {
        console.error(x);
        alert("Não foi possível importar: " + (x instanceof SyntaxError ? "o arquivo não é um JSON válido." : x.message || "arquivo não suportado."));
      } finally { t.value = ""; }
    });
    document.addEventListener("change", (ev) => {
      const t = ev.target, p = t.dataset?.nw;
      if (!p || !on() || !admin) return;
      let v = t.type === "number" ? num(t.value) : t.value;
      if (p === "nw.pool") v = cl(Math.round(v), 0, 99);
      mut((n) => { init(n); if (p === "name") n.name = String(v).trim() || n.name; else setPath(n, p, v); });
    });
    setMode(mode, true);
    if (on()) { C.forEach(mth); render(); }
  }
  return { on, setMode, mods, hp, sta, slots, ini, view, restore, checkImport, boot, bar, STATS: K, MIN, MAX, BASE_STAT };
})();
