// "Ask the course": real retrieval (BM25 or TF-IDF) over the text of Units 1-4, a port of codes/rag/rag_np (same tokenizer, chunker and scores).
import CORPUS from "./corpus_course.js";
const STOP = new Set("a an and are as at be by for from has have in is it its of on or that the this to was were which with not no do does did how what why when who can".split(" "));
export const tokenize = (t) => (t.toLowerCase().match(/[a-z0-9]+/g) || []).filter((w) => !STOP.has(w));
export function chunkText(text, size, overlap) {
  const out = []; let i = 0; const n = text.length;
  while (i < n) {
    let j = Math.min(i + size, n); while (j < n && text[j] !== " ") j++;
    const c = text.slice(i, j).trim(); if (c) out.push(c);
    if (j >= n) break;
    let nxt = Math.max(i + 1, j - overlap); while (nxt < n && text[nxt] !== " ") nxt++;
    i = nxt > i ? nxt + 1 : j;
  }
  return out;
}
export function chunkCorpus(size, overlap) { const out = []; for (const [doc, t] of Object.entries(CORPUS)) chunkText(t, size, overlap).forEach((text, i) => out.push({ doc, i, text })); return out; }
const counter = (toks) => { const m = new Map(); for (const t of toks) m.set(t, (m.get(t) || 0) + 1); return m; };
export function bm25(docs, k1 = 1.5, b = 0.75) {
  const tf = docs.map((d) => counter(tokenize(d))), dl = tf.map((m) => [...m.values()].reduce((a, c) => a + c, 0)), avg = dl.reduce((a, c) => a + c, 0) / dl.length, df = new Map();
  for (const m of tf) for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length, idf = new Map([...df].map(([t, n]) => [t, Math.log(1 + (N - n + 0.5) / (n + 0.5))]));
  return (q) => { const s = new Array(N).fill(0); for (const t of new Set(tokenize(q))) { if (!idf.has(t)) continue; for (let i = 0; i < N; i++) { const f = tf[i].get(t) || 0; if (f) s[i] += (idf.get(t) * f * (k1 + 1)) / (f + k1 * (1 - b + (b * dl[i]) / avg)); } } return s; };
}
export function tfidf(docs) {
  const toks = docs.map((d) => counter(tokenize(d))), vocab = new Map(); toks.forEach((m) => m.forEach((_, t) => { if (!vocab.has(t)) vocab.set(t, 0); }));
  const df = new Map(); for (const m of toks) for (const t of m.keys()) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length, idf = (t) => Math.log((1 + N) / (1 + df.get(t))) + 1;
  const vec = (m) => { const v = new Map(); let n2 = 0; for (const [t, f] of m) if (df.has(t)) { const w = (1 + Math.log(f)) * idf(t); v.set(t, w); n2 += w * w; } const n = Math.sqrt(n2); if (n) for (const [t, w] of v) v.set(t, w / n); return v; };
  const X = toks.map(vec);
  return (q) => { const qv = vec(counter(tokenize(q))); return X.map((x) => { let s = 0; for (const [t, w] of qv) s += w * (x.get(t) || 0); return s; }); };
}
export const rank = (s) => s.map((v, i) => i).sort((a, b) => s[b] - s[a] || a - b);
export const coverage = (q, text) => { const a = new Set(tokenize(q)), b = new Set(tokenize(text)); let c = 0; for (const t of a) if (b.has(t)) c++; return a.size ? c / a.size : 0; };
const sentences = (t) => t.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
export function bestSentence(q, texts) { const s = texts.flatMap(sentences); if (!s.length) return null; const sc = bm25(s)(q); return s[rank(sc)[0]]; }
const cache = new Map();
const index = (size, ov, method) => { const key = `${size}/${ov}/${method}`; if (!cache.has(key)) { const ch = chunkCorpus(size, ov), T = ch.map((c) => c.text); cache.set(key, { ch, score: method === "bm25" ? bm25(T) : tfidf(T) }); } return cache.get(key); };
const UNIT = { u1: "Unit 1", u2: "Unit 2", u3: "Unit 3", u4: "Unit 4" };
export default {
  id: "askcourse", unit: "u5", group: "Unit 5 · Retrieval (RAG)", title: "Ask the course (retrieval)",
  blurb: "A real retrieval system running in your browser over the text of Units 1 to 4: type a question, see which passages are found and which sentence would be quoted as the answer.",
  what: "Each result is a chunk of the course text, with its unit, rank and score. Words from your question are highlighted. The top banner shows the single best sentence (a crude 'answer') and whether the system would answer or say it does not know.",
  tryit: "Ask 'What is the optimal GAN discriminator?' Then ask something the course does not cover ('How does LoRA work?') and watch the 'words found' number drop. Try chunk size 150 versus 1200: small chunks are precise but cut answers apart; big chunks bring in lots of unrelated text.",
  params: [
    { key: "q", label: "Your question", type: "text", value: "What is the optimal GAN discriminator?", help: "Plain words work best: retrieval matches words, not meaning (this demo has no neural embeddings)." },
    { key: "size", label: "Chunk size", type: "select", value: "600", options: [["150", "150 characters"], ["300", "300 characters"], ["600", "600 characters"], ["1200", "1,200 characters"]], help: "How big each searchable piece is." },
    { key: "ov", label: "Overlap between chunks", type: "select", value: "20", options: [["0", "None"], ["20", "20% of the chunk"]], help: "Shared text between neighbouring chunks, so answers are not cut at a boundary." },
    { key: "method", label: "Search method", type: "select", value: "bm25", options: [["bm25", "BM25 (word statistics)"], ["tfidf", "TF-IDF + cosine"]], help: "Two classical scoring rules; both match words, not meaning." },
    { key: "k", label: "Passages to retrieve (k)", type: "range", min: 1, max: 6, step: 1, value: 3, unit: "passages", help: "How many top chunks to show and to search for the answer sentence." },
    { key: "min", label: "Say 'I don't know' below", type: "range", min: 0, max: 1, step: 0.05, value: 0.4, help: "Share of your question's words that the best passage must contain. 0 = always answer." },
  ],
  presets: [["GAN discriminator", { q: "What is the optimal GAN discriminator?" }], ["Majority vote", { q: "When does majority voting over several samples improve accuracy?" }], ["Not in the course", { q: "How does LoRA reduce the number of trainable parameters?" }], ["Tiny chunks", { size: "150", ov: "0" }]],
  draw(ctx, p, S) {
    const q = p.q.trim(); ctx.textAlign = "left";
    if (!tokenize(q).length) { ctx.fillStyle = S.muted; ctx.fillText("Type a question with at least one content word.", 16, 30); return; }
    const size = +p.size, ov = Math.round((size * +p.ov) / 100), { ch, score } = index(size, ov, p.method), sc = score(q), order = rank(sc), k = Math.round(p.k), top = order.slice(0, k);
    const cov = coverage(q, ch[top[0]].text), answer = cov >= p.min ? bestSentence(q, top.map((i) => ch[i].text)) : null;
    const terms = new Set(tokenize(q)); let y = 24;
    ctx.font = "600 13px system-ui"; ctx.fillStyle = cov >= p.min ? S.good : S.bad; ctx.fillText(cov >= p.min ? `Would answer · ${Math.round(cov * 100)}% of your words found in the best passage` : `Says "I don't know" · only ${Math.round(cov * 100)}% of your words found (limit ${Math.round(p.min * 100)}%)`, 16, y);
    y += 22; ctx.font = "13px system-ui"; ctx.fillStyle = S.ink;
    if (answer) { ctx.fillStyle = S.muted; ctx.fillText("Best sentence (quoted from the passages):", 16, y); y += 16; ctx.fillStyle = S.ink; y = S.wrap(answer.length > 260 ? answer.slice(0, 257) + "…" : answer, 16, y, S.w - 32, 16) + 4; }
    else { ctx.fillStyle = S.muted; y = S.wrap("No sentence is shown because the best passage barely matches the question.", 16, y, S.w - 32, 16) + 4; }
    ctx.strokeStyle = S.line; ctx.beginPath(); ctx.moveTo(16, y - 6); ctx.lineTo(S.w - 16, y - 6); ctx.stroke(); y += 8;
    for (let r = 0; r < top.length; r++) {
      if (y > S.h - 20) break; const c = ch[top[r]];
      ctx.font = "600 12px system-ui"; ctx.fillStyle = S.accent; ctx.fillText(`#${r + 1} · ${UNIT[c.doc]} · score ${sc[top[r]].toFixed(2)}`, 16, y); y += 15; ctx.font = "12px system-ui";
      const words = c.text.split(" "); let first = words.findIndex((w) => terms.has(w.toLowerCase().replace(/[^a-z0-9]/g, ""))); first = Math.max(0, first - 6); const snip = words.slice(first, first + 26);
      let x = 16, lines = 0; for (const w of snip) { const hit = terms.has(w.toLowerCase().replace(/[^a-z0-9]/g, "")); ctx.font = (hit ? "600 " : "") + "12px system-ui"; const wd = ctx.measureText(w + " ").width; if (x + wd > S.w - 16) { x = 16; y += 15; lines++; if (lines > 2) break; } ctx.fillStyle = hit ? S.c[3] : S.ink; ctx.fillText(w + " ", x, y); x += wd; }
      y += 22;
    }
  },
};
