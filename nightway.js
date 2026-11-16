/* NIGHTWAY mode — alternate ruleset layered on top of L.O.S.T. (LOST mode is untouched). */
const NW = (() => {
  const ST = [
    ["TRIPAS", "Quanto um indivíduo aguenta fisicamente. Cada ponto dá +25 de vida (base 100)."],
    ["MIOLOS", "Raciocínio e compreensão rápida. Lógica e precisão de ataques críticos."],
    ["CARNE", "Força exercida só com o corpo. Carregamento e impacto de ataques corpo-a-corpo."],
    ["CHEIRO", "Perceber o mundo ao redor. Percepção e intuição."],
    ["SANGUE", "Movimento, destreza e reação. Velocidade, furtividade, iniciativa e ataques à distância."],
    ["STAMINA", "Cada ponto adiciona +5 à barra de stamina (com 0, o valor é 15). Substitui sanidade."],
    ["TEMPERO", "Energias do destino. Sorte e eventos aleatórios no Nightway."],
  ];
  const K = ST.map((x) => x[0]), MIN = -3, MAX = 5, POOL = 7;
  const ALIAS = { VIDA: "hpmax", BARRA: "sanmax", DANO: "dmg" };
  const KEY = "lost_mode", CK = "nw_crt";
  let mode = "lost", crt = true;
  try { mode = localStorage.getItem(KEY) || "lost"; crt = localStorage.getItem(CK) !== "0"; } catch (e) {}
  const on = () => mode === "nightway";
  const eff0 = (b, g) => cl((b || 0) + (g || 0), MIN, MAX);
  const base = (c, k) => c.nw?.st?.[k] || 0;
  const eff = (c, k) => eff0(base(c, k), c.mod?.stat?.[k]);
  const init = (n) => {
    n.nw ??= {};
    const w = n.nw;
    w.st ??= {}; w.info ??= {}; w.pool ??= POOL; w.slots ??= 24;
    w.armor ??= [{}, {}, {}]; w.acc ??= [{}, {}]; w.weapons ??= [{}, {}]; w.skills ??= [];
    while (w.armor.length < 3) w.armor.push({});
    while (w.acc.length < 2) w.acc.push({});
    while (w.weapons.length < 2) w.weapons.push({});
    n.inv ??= [];
    return w;
  };
  const items = (c) => [...(c.nw?.armor || []), ...(c.nw?.acc || [])];
  const parseMod = (s) => {
    const out = [];
    String(s || "").replace(/([A-ZÀ-Ú]+)\s*([+-]\s*\d+)/gi, (_, k, v) => {
      k = k.toUpperCase();
      const t = K.includes(k) ? "stat:" + k : ALIAS[k];
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
        try { new Function("c", "m", p.code)(J(c), m); } catch (e) { p.err = e.message; }
    });
    return m;
  }
  const hp = (c, m) => Math.max(10, 100 + 25 * eff0(base(c, "TRIPAS"), m.stat.TRIPAS) + m.hpmax);
  const sta = (c, m) => Math.max(5, 15 + 5 * eff0(base(c, "STAMINA"), m.stat.STAMINA) + m.sanmax);
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
  const itemCard = (c, kind, i, label) => {
    const it = c.nw[kind][i] || {}, p = `nw.${kind}.${i}`, tags = parseMod(it.mod);
    return `<div class="nwslot${it.off ? " off" : ""}"><div class="row sp"><b class="o">${label}</b>${canEdit() && it.n ? `<button class="b s${it.off ? "" : " on"}" data-a="nw" data-op="toggle" data-p="${kind}.${i}">${it.off ? "DESLIGADO" : "ATIVO"}</button>` : ""}</div>
${inp(p + ".n", it.n, "Nome do item")}${area(p + ".d", it.d, "Descrição", 2)}
${canEdit() ? `<label>MODIFICADORES <span class="mt">(ex: CARNE+1, TRIPAS-1, VIDA+10, BARRA+5, DANO+2)</span></label>${inp(p + ".mod", it.mod, "CARNE+1, VIDA+10")}<details><summary class="b s">{ } CÓDIGO INLINE</summary><textarea data-nw="${p}.code" rows="2" placeholder="m.hpmax += 10;  // recebe (c, m)">${esc(it.code || "")}</textarea></details>` : ""}
${tags.map((g) => `<span class="chip o">${esc(g.t.replace("stat:", "").replace("hpmax", "VIDA").replace("sanmax", "BARRA").replace("dmg", "DANO"))} ${sg(g.v)}</span>`).join("")}${it.code && !it.off ? '<span class="chip">{ } código</span>' : ""}${it.err ? `<div class="pz">Erro: ${esc(it.err)}</div>` : ""}</div>`;
  };
  const stats = (c) => {
    const used = K.reduce((a, k) => a + base(c, k), 0), left = c.nw.pool - used;
    return `<div class="nwhead">STATS</div><div class="mt">Você possui ${c.nw.pool} no total · pode negativar até −3 · máximo 5 por stat. Não é recomendado negativar. <b class="${left < 0 ? "pz" : "o"}">Restantes: ${left}</b>${admin ? ` <input type="number" data-nw="nw.pool" value="${c.nw.pool}" style="width:54px;display:inline-block">` : ""}</div>` +
      ST.map(([k, d]) => {
        const b = base(c, k), g = c.mod?.stat?.[k] || 0, e = eff(c, k);
        return `<div class="nwstat"><div class="nwsn"><b>${k}</b><span class="mt">${d}</span></div><div class="nwsc">${admin ? `<button class="b s" data-a="nw" data-op="st" data-k="${k}" data-d="-1">−</button>` : ""}<span class="nwv ${b < 0 ? "neg" : ""}">${b}</span>${admin ? `<button class="b s" data-a="nw" data-op="st" data-k="${k}" data-d="1">+</button>` : ""}${g ? `<span class="chip o">equip ${sg(g)}</span>` : ""}</div><div class="nwsd">${e !== b + g ? `<span class="mt">efetivo ${e}</span> ` : ""}<span class="chip">${lbl(e)}</span>${canRollCharacter(c) ? `<button class="b s am" data-a="nw" data-op="roll" data-k="${k}">ROLAR</button>` : ""}</div></div>`;
      }).join("");
  };
  const weapons = (c) => c.nw.weapons.map((w, i) => {
    const p = `nw.weapons.${i}`, canR = canRollCharacter(c);
    return `<div class="nwslot"><b class="o">ARMA ${i + 1}</b>${inp(p + ".n", w.n, "Nome da arma")}
${admin ? `<div class="r3"><div><label>STAT DE ACERTO</label><select data-nw="${p}.stat">${opts([["", "CARNE"], ...K.map((k) => [k, k])], w.stat || "")}</select></div><div><label>DANO (NdS+B)</label><input data-nw="${p}.f" value="${esc(w.f || "")}" placeholder="1d8+2"></div></div>` : `<div class="mt">Acerto: ${esc(w.stat || "CARNE")} · Dano: ${esc(w.f || "—")}${mDmg(c) ? ` ${sg(mDmg(c))} equip` : ""}</div>`}
${area(p + ".d", w.d, "Notas / efeitos", 2)}${w.n && canR ? `<div class="row"><button class="b am" data-a="nw" data-op="hit" data-i="${i}">ACERTAR</button>${w.f ? `<button class="b rd" data-a="nw" data-op="dmg" data-i="${i}">DANO</button>` : ""}</div>` : ""}</div>`;
  }).join("");
  const skills = (c) => c.nw.skills.map((s, i) => {
    const p = `nw.skills.${i}`;
    return `<div class="nwslot"><div class="row sp"><b class="o">${admin ? "" : esc(s.n || "Perícia")}</b><span class="row"><span class="chip o">${num(s.cost)} STA</span>${canRollCharacter(c) && s.n ? `<button class="b s am" data-a="nw" data-op="skill" data-i="${i}">USAR</button>` : ""}${admin ? `<button class="b s rd" data-a="nw" data-op="delskill" data-i="${i}">✕</button>` : ""}</span></div>
${admin ? `<div class="row"><input data-nw="${p}.n" value="${esc(s.n || "")}" placeholder="Nome da perícia" style="flex:2"><input type="number" data-nw="${p}.cost" value="${num(s.cost)}" placeholder="Custo" style="flex:1"><select data-nw="${p}.stat" style="flex:1">${opts([["", "sem rolagem"], ...K.map((k) => [k, k])], s.stat || "")}</select></div>` : `<div class="mt">${s.stat ? "Rola " + esc(s.stat) : "Sem rolagem"}</div>`}${area(p + ".d", s.d, "Descrição / efeito", 2)}</div>`;
  }).join("") || '<div class="mt">— nenhuma perícia —</div>';
  function view(c) {
    const w = c.nw || {}, i = w.info || {}, [h, s] = [c.hp, c.san], ws = c.weapons ? 0 : 0;
    const tab = TAB === "imp" ? "imp" : "main", used = (c.inv || []).length, slots = slotsOf(c);
    const inv = Array.from({ length: Math.max(slots, used) }, (_, j) => j < used ? `<div class="sl${j >= slots ? " ov" : ""}"><span>${esc(c.inv[j])}</span>${admin ? `<button class="b s rd" data-a="nw" data-op="rmi" data-i="${j}">✕</button>` : ""}</div>` : '<div class="sl e">vazio</div>').join("");
    const body = tab === "imp"
      ? `<div class="nwhead">ARMADURA</div><div class="nwgrid">${["TOPO", "MEIO", "BAIXO"].map((l, j) => itemCard(c, "armor", j, l)).join("")}</div><div class="nwhead">ACESSÓRIOS</div><div class="nwgrid">${["ACESSÓRIO 1", "ACESSÓRIO 2"].map((l, j) => itemCard(c, "acc", j, l)).join("")}</div>`
      : `<div class="nwhead">VOCÊ.</div><div class="nwid"><div><label>Seu Nome</label>${inp("name", c.name)}</div><div><label>Seu Gênero</label>${inp("nw.info.gender", i.gender)}</div><div><label>Sua Idade</label>${inp("nw.info.age", i.age)}</div><div><label>Sua "Classe" (Guerreiro, mago, etc.)</label>${inp("nw.info.cls", i.cls)}</div></div>
<div class="mt">Equipamentos: ${w.weapons.filter((x) => x.n).length}/2 armas · ${w.armor.filter((x) => x.n).length}/3 armaduras · ${w.acc.filter((x) => x.n).length}/2 acessórios</div>
<label>Sua história <span class="mt">(Não mencione o lorde das sombras. Mas você sabe que uma hora ele apareceu, e ele é seu objetivo.)</span></label>${area("nw.info.story", i.story, "⚿> …", 4)}
${stats(c)}<div class="nwhead">ARMAS</div><div class="nwgrid">${weapons(c)}</div>
<div class="row sp"><div class="nwhead" style="flex:1">PERÍCIAS <span class="mt">(custam stamina)</span></div>${admin ? '<button class="b s am" data-a="nw" data-op="addskill">+ PERÍCIA</button>' : ""}</div><div class="nwgrid">${skills(c)}</div>
<div class="row sp"><div class="nwhead" style="flex:1">INVENTÁRIO · <span class="${used > slots ? "pz" : "o"}">${used}/${slots}</span></div>${admin ? `<span class="row"><button class="b s" data-a="nw" data-op="slot" data-d="-1">−</button><button class="b s" data-a="nw" data-op="slot" data-d="1">+</button></span>` : ""}</div>
<div class="inv">${inv}</div>${admin ? '<div class="row" style="margin-top:4px"><input id="nwadd" placeholder="Novo item…" style="flex:1"><button class="b am" data-a="nw" data-op="addi">ADICIONAR</button></div>' : ""}`;
    $("#v").innerHTML = `<div class="tb"><span>▸ ${esc(c.name)}</span><span class="row">${sb(c)}<button class="b s" data-a="close">FECHAR</button></span></div>
<div class="pd sh nwm"><div><div class="im">${im(c, "SEM IMAGEM")}</div></div><div>
<div class="two">${bar(h[0], h[1], "hp")}${bar(s[0], s[1], "sn")}</div>${typeof lostVitalsControls === "function" ? lostVitalsControls(c) : ""}
<div class="row nwtabs">${[["main", "PRINCIPAL"], ["imp", "ARMADURA"]].map(([k, t]) => `<button class="b${tab == k ? " on" : ""}" data-a="tab" data-k="${k}">${t}</button>`).join("")}</div>${body}</div></div>`;
    $("#v").classList.remove("hid");
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
        return s.stat ? doRoll(c, s.stat, "Perícia · " + s.n) : show(c.name, "Perícia · " + s.n, R("1d2"), []);
      }
      case "toggle": return e((w) => { const [k, i] = d.p.split("."); w[k][i].off = !w[k][i].off; });
      case "addskill": return e((w) => w.skills.push({ n: "", cost: 5, stat: "", d: "" }));
      case "delskill": return e((w) => w.skills.splice(+d.i, 1));
      case "slot": return e((w) => (w.slots = Math.max(1, w.slots + +d.d)));
      case "rmi": return e((w, n) => n.inv.splice(+d.i, 1));
      case "addi": { const v = $("#nwadd")?.value.trim(); if (v) e((w, n) => n.inv.push(v)); }
    }
  }
  document.addEventListener("change", (ev) => {
    const t = ev.target, p = t.dataset?.nw;
    if (!p || !on() || !admin) return;
    let v = t.type === "number" ? num(t.value) : t.value;
    if (p === "nw.pool") v = cl(Math.round(v), 0, 99);
    mut((n) => { init(n); if (p === "name") n.name = String(v).trim() || n.name; else setPath(n, p, v); });
  });
  function setMode(m, silent) {
    mode = m === "nightway" ? "nightway" : "lost";
    try { localStorage.setItem(KEY, mode); } catch (e) {}
    document.body.classList.toggle("nw", on());
    document.body.classList.toggle("nw-crt", on() && crt);
    const b = $("#nwbtn"), cb = $("#nwcrtbtn");
    if (b) b.textContent = "⚙ MODE: " + (on() ? "NIGHTWAY" : "LOST");
    if (cb) { cb.classList.toggle("hid", !on()); cb.textContent = "CRT: " + (crt ? "ON" : "OFF"); }
    document.title = on() ? "NIGHTWAY" : "L.O.S.T.";
    const h1 = $("h1"); if (h1) h1.textContent = on() ? "◉ NIGHTWAY" : "◉ L.O.S.T.";
    if (!silent && typeof C !== "undefined") { C.forEach(mth); render(); if (typeof lostQueueBroadcast === "function" && lostHost) lostQueueBroadcast(); }
  }
  XP.nw = act;
  XP.nwmode = () => { if (!admin && lostUser) return alert("Só o autor (host) pode trocar o modo."); setMode(on() ? "lost" : "nightway"); sv(); };
  XP.nwcrt = () => { crt = !crt; try { localStorage.setItem(CK, crt ? "1" : "0"); } catch (e) {} setMode(mode, true); };
  setMode(mode, true);
  if (on() && typeof C !== "undefined") { C.forEach(mth); render(); }
  return { on, setMode, mods, hp, sta, ini, view, STATS: K };
})();
