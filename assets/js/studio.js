// LLM Studio engine. Scene contract follows the Math Studio's (params + presets + draw), kept dependency-free.
// A widget is { id, unit, group, title, blurb, what, tryit, params:[...], presets:[[label,{key:val}]], draw(ctx, p, S) }.
// param = { key, label, help, type:'range'|'select'|'text', min, max, step, value, unit, options:[[val,label]], fmt }.
import { WIDGETS } from "./widgets/index.js";

const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) k.startsWith("on") ? n.addEventListener(k.slice(2), v) : n.setAttribute(k, v);
  n.append(...kids.flat().filter((x) => x != null));
  return n;
};
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export function mulberry32(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

let cur = null, vals = {}, canvas, ctx, valEls = {};
const fmtVal = (prm, v) => prm.type === "select" ? (prm.options.find((o) => o[0] === v) || [, v])[1].split(/:| \(/)[0] : (prm.fmt ? prm.fmt(v) : typeof v === "number" ? String(+v.toFixed(3)) : String(v)) + (prm.unit ? " " + prm.unit : "");

function parseHash() {
  const [id, q = ""] = location.hash.replace(/^#/, "").split("?");
  return { id, q: new URLSearchParams(q) };
}
function writeHash() {
  const q = new URLSearchParams();
  for (const prm of cur.params) if (vals[prm.key] !== prm.value) q.set(prm.key, vals[prm.key]);
  history.replaceState(null, "", `#${cur.id}${q.toString() ? "?" + q : ""}`);
}

function select(id, q = new URLSearchParams()) {
  cur = WIDGETS.find((w) => w.id === id) || WIDGETS[0];
  vals = {};
  for (const prm of cur.params) {
    const raw = q.get(prm.key);
    vals[prm.key] = raw == null ? prm.value : prm.type === "range" ? Math.min(prm.max, Math.max(prm.min, +raw)) : raw;
  }
  buildPanel();
  document.querySelectorAll(".pg-list button").forEach((b) => b.setAttribute("aria-current", String(b.dataset.id === cur.id)));
  $("#w-title").textContent = cur.title;
  $("#w-blurb").textContent = cur.blurb;
  $("#w-what").textContent = cur.what;
  $("#w-try").textContent = cur.tryit;
  $("#w-unit").href = `../units/${cur.unit}.html`;
  $("#w-unit").textContent = `Read the lesson for ${cur.unit.toUpperCase().replace("U", "Unit ")}`;
  writeHash(); draw();
}

function buildPanel() {
  const host = $("#controls"); host.replaceChildren(); valEls = {};
  if (cur.presets?.length) {
    host.append(el("div", { class: "presets", role: "group", "aria-label": "Presets" },
      ...cur.presets.map(([label, set]) => el("button", { class: "btn small", type: "button", onclick: () => { Object.assign(vals, set); syncInputs(); writeHash(); draw(); } }, label))));
  }
  for (const prm of cur.params) {
    const id = "p-" + prm.key;
    let input;
    if (prm.type === "range") {
      input = el("input", { type: "range", id, min: prm.min, max: prm.max, step: prm.step ?? "any", value: vals[prm.key], "aria-label": prm.label });
      input.addEventListener("input", () => { vals[prm.key] = +input.value; valEls[prm.key].textContent = fmtVal(prm, vals[prm.key]); writeHash(); draw(); });
    } else if (prm.type === "select") {
      input = el("select", { id }, ...prm.options.map(([v, l]) => el("option", { value: v }, l)));
      input.value = vals[prm.key];
      input.addEventListener("change", () => { vals[prm.key] = input.value; if (prm.onChange) Object.assign(vals, prm.onChange(input.value) || {}); syncInputs(); writeHash(); draw(); });
    } else {
      input = el("input", { type: "text", id, value: vals[prm.key], spellcheck: "false" });
      input.addEventListener("input", () => { vals[prm.key] = input.value; writeHash(); draw(); });
    }
    prm._input = input;
    const v = prm.type === "text" ? null : el("span", { class: prm.type === "select" ? "val sel" : "val" }, fmtVal(prm, vals[prm.key]));
    valEls[prm.key] = v;
    host.append(el("div", { class: "ctl" },
      el("label", { for: id }, el("span", {}, prm.label), v), input,
      prm.type === "range" ? el("div", { class: "ends" }, el("span", {}, `${prm.min}`), el("span", {}, `${prm.max}`)) : null,
      prm.help ? el("div", { class: "help" }, prm.help) : null));
  }
  host.append(el("div", { class: "tools" },
    el("button", { class: "btn small", type: "button", onclick: () => select(cur.id) }, "Reset"),
    el("button", { class: "btn small", type: "button", onclick: () => navigator.clipboard?.writeText(location.href) }, "Copy link"),
    el("button", { class: "btn small", type: "button", onclick: savePng }, "Save PNG")));
}
function syncInputs() {
  for (const prm of cur.params) { prm._input.value = vals[prm.key]; if (prm.type !== "text") valEls[prm.key].textContent = fmtVal(prm, vals[prm.key]); }
}
function savePng() { const a = el("a", { href: canvas.toDataURL("image/png"), download: `${cur.id}.png` }); a.click(); }

function draw() {
  if (!cur || !canvas) return;
  const r = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  const w = Math.max(320, Math.round(r.width)), h = Math.max(200, Math.round(r.height));
  if (canvas.width !== w * dpr || canvas.height !== h * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const S = { w, h, ink: css("--ink"), muted: css("--muted"), line: css("--line"), accent: css("--accent"), bg: css("--bg"), surface: css("--surface"),
    c: [css("--c1"), css("--c2"), css("--c3"), css("--c4"), css("--c5")], grey: css("--grey"), good: css("--good"), bad: css("--bad"), rng: mulberry32 };
  S.wrap = (text, x, y, maxW, lh = 17) => { const words = String(text).split(" "); let line = ""; for (const w of words) { const t = line ? line + " " + w : w; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = w; } else line = t; } ctx.fillText(line, x, y); return y + lh; };
  S.mix = (hex, t) => { const h = (c) => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)), a = h(hex), b = h(S.bg.length === 7 ? S.bg : "#ffffff"); return `rgb(${a.map((v, i) => Math.round(b[i] + (v - b[i]) * t)).join(",")})`; };
  ctx.font = "13px system-ui, sans-serif"; ctx.textBaseline = "alphabetic"; ctx.textAlign = "left";
  cur.draw(ctx, { ...vals }, S);
  canvas.dataset.drawn = String(+(canvas.dataset.drawn || 0) + 1);
}

export function init() {
  canvas = $("#stage"); ctx = canvas.getContext("2d");
  const list = $("#wlist"); let lastUnit = "";
  for (const w of WIDGETS) {
    if (w.group !== lastUnit) { list.append(el("h4", {}, w.group)); lastUnit = w.group; }
    list.append(el("button", { type: "button", "data-id": w.id, onclick: () => select(w.id) }, w.title));
  }
  const h = parseHash(); select(h.id, h.q);
  window.addEventListener("hashchange", () => { const x = parseHash(); if (x.id !== cur.id) select(x.id, x.q); });
  new ResizeObserver(draw).observe(canvas);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", draw);
  document.addEventListener("themechange", draw);
  window.__studio = { get vals() { return vals; }, draw };
}
