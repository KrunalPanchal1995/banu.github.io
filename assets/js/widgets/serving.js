// LLM serving calculator: memory, KV cache, decode speed and cost from a model shape. Mirrors serving_np.py (param_breakdown, kv_bytes_per_token, decode_throughput).
const QWEN = { d: 896, ff: 4864, L: 24, h: 14, kv: 2, V: 151936, tied: true, bias: true };
const SEVEN = { d: 4096, ff: 11008, L: 32, h: 32, kv: 8, V: 32000, tied: false, bias: false };
export function params(c) { const hd = c.d / c.h, attn = c.d * c.h * hd + (c.bias ? c.h * hd : 0) + 2 * (c.d * c.kv * hd + (c.bias ? c.kv * hd : 0)) + c.h * hd * c.d, per = attn + 3 * c.d * c.ff + 2 * c.d; return c.V * c.d * (c.tied ? 1 : 2) + c.L * per + c.d; }
export const kvBytes = (c, dt = 2) => 2 * c.L * c.kv * (c.d / c.h) * dt;
export const wBytes = (n, prec) => (prec === "int4" ? n * (0.5 + 2 / 64) : n * ({ bf16: 2, int8: 1 }[prec]));
export const stepTime = (w, kvSeq, n, b, bw, fl) => Math.max((w + b * kvSeq) / bw, (b * 2 * n) / fl);
export const decodeTput = (n, w, kvSeq, b, bw, fl) => b / stepTime(w, kvSeq, n, b, bw, fl);
export function simulate(policy, arr, out, maxBatch, step, maxWait = 0.05) {   // same algorithm as simulate() in serving_np.py, with injected arrivals and output lengths
  const n = arr.length, done = new Array(n).fill(0); let t = 0, nxt = 0, queue = [], batches = [];
  if (policy === "static") {
    while (nxt < n || queue.length) {
      if (!queue.length) t = Math.max(t, arr[nxt]);
      while (nxt < n && arr[nxt] <= t) queue.push(nxt++);
      const deadline = arr[queue[0]] + maxWait;
      while (queue.length < maxBatch && nxt < n && arr[nxt] <= deadline) { t = Math.max(t, arr[nxt]); queue.push(nxt++); }
      if (queue.length < maxBatch) t = Math.max(t, deadline);
      const batch = queue.slice(0, maxBatch); queue = queue.slice(maxBatch); t += Math.max(...batch.map((i) => out[i])) * step(batch.length); batches.push(batch.length); for (const i of batch) done[i] = t;
    }
  } else {
    const active = new Map();
    while (nxt < n || queue.length || active.size) {
      if (!active.size && !queue.length) t = Math.max(t, arr[nxt]);
      while (nxt < n && arr[nxt] <= t) queue.push(nxt++);
      while (queue.length && active.size < maxBatch) { const i = queue.shift(); active.set(i, out[i]); }
      t += step(active.size); batches.push(active.size);
      for (const [i, r] of [...active]) { if (r - 1 === 0) { done[i] = t; active.delete(i); } else active.set(i, r - 1); }
    }
  }
  const lat = done.map((d, i) => d - arr[i]), maxDone = Math.max(...done), tot = out.reduce((a, b) => a + b, 0);
  return { lat, tput: tot / maxDone, meanBatch: batches.reduce((a, b) => a + b, 0) / batches.length };
}
const fmtB = (b) => (b >= 1e9 ? (b / 1e9).toFixed(2) + " GB" : (b / 1e6).toFixed(0) + " MB");
export default {
  id: "serving", unit: "u10", group: "Unit 10 · Deployment", title: "LLM serving calculator",
  blurb: "How much memory does a model need, how many users fit on one GPU, and how fast and how expensive is each token? Change the model, precision, context and hardware.",
  what: "The bar shows GPU memory: weights (blue), KV cache of all concurrent users (orange), and what is left. If it overflows, that many users do not fit. The numbers give decode speed per user, time to first token, and dollars per million tokens. Hardware and price numbers are illustrative inputs, not product specifications.",
  tryit: "Choose the 6B shape in 16-bit on an 8 GB GPU: the weights alone (about 11.9 GB) do not fit. Switch to 4-bit (about 3.2 GB): it fits, and decoding is about 3.7× faster at one user because decoding is limited by memory reads. Then add users and long contexts and watch the KV cache fill the memory.",
  params: [
    { key: "model", label: "Model", type: "select", value: "qwen", options: [["qwen", "Qwen2.5-0.5B (real config from the hub)"], ["seven", "About 6B parameters (illustrative shape)"]], help: "The Qwen numbers come from its published config.json; the 6B shape is an illustrative round-number design (4096 wide, 32 layers)." },
    { key: "prec", label: "Weight precision", type: "select", value: "bf16", options: [["bf16", "16-bit (bf16)"], ["int8", "8-bit"], ["int4", "4-bit (with scales)"]], help: "Fewer bits = less memory and faster memory-bound decoding." },
    { key: "ctx", label: "Context per user", type: "range", min: 128, max: 32768, step: 128, value: 4096, unit: "tokens", help: "Prompt plus reply length each user keeps in the cache." },
    { key: "users", label: "Users decoded together (batch)", type: "range", min: 1, max: 256, step: 1, value: 8, unit: "users", help: "Concurrent sequences on this GPU." },
    { key: "mem", label: "GPU memory", type: "select", value: "24", options: [["8", "8 GB"], ["24", "24 GB"], ["80", "80 GB"]], help: "Illustrative sizes." },
    { key: "bw", label: "Memory bandwidth", type: "select", value: "1000", options: [["500", "500 GB/s"], ["1000", "1,000 GB/s"], ["2000", "2,000 GB/s"]], help: "Decoding is limited by how fast weights can be read." },
    { key: "price", label: "GPU price", type: "range", min: 0.2, max: 6, step: 0.1, value: 2, unit: "$/hour", help: "Illustrative; compare with your cloud or electricity cost." },
  ],
  presets: [["Real small model", { model: "qwen", prec: "bf16", mem: "8", users: 16 }], ["6B on 8 GB, 16-bit", { model: "seven", prec: "bf16", mem: "8", users: 4 }], ["6B on 8 GB, 4-bit", { model: "seven", prec: "int4", mem: "8", users: 4 }], ["Many users, long context", { users: 64, ctx: 16384 }]],
  draw(ctx, p, S) {
    const c = p.model === "qwen" ? QWEN : SEVEN, n = params(c), w = wBytes(n, p.prec), kv = kvBytes(c) * p.ctx, mem = +p.mem * 1e9, kvAll = kv * p.users, used = w + kvAll, bw = +p.bw * 1e9, FL = 1e14;
    const maxUsers = Math.max(0, Math.floor((mem * 0.9 - w) / kv)), fits = used <= mem * 0.9, tp = decodeTput(n, w, kv, p.users, bw, FL), perUser = tp / p.users, ttft = (2 * n * 1000) / (FL * 0.5), cost = (p.price / (tp * 3600)) * 1e6;
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = fits ? S.good : S.bad; let y = S.wrap(fits ? `Fits: ${p.users} users use ${fmtB(used)} of ${p.mem} GB` : `DOES NOT FIT: needs ${fmtB(used)}, GPU has ${p.mem} GB (about ${maxUsers} users would fit)`, 14, 24, S.w - 28, 18);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; y = S.wrap(`${(n / 1e9).toFixed(2)} billion parameters · weights ${fmtB(w)} · KV cache ${(kvBytes(c) / 1024).toFixed(0)} KiB per token`, 14, y + 2, S.w - 28, 16);
    const bx = 14, bwid = S.w - 28, by = y + 14, bh = 30, sc = bwid / Math.max(mem, used); ctx.fillStyle = S.line; ctx.fillRect(bx, by, mem * sc, bh); ctx.fillStyle = S.c[0]; ctx.fillRect(bx, by, w * sc, bh); ctx.fillStyle = S.c[1]; ctx.fillRect(bx + w * sc, by, kvAll * sc, bh);
    ctx.strokeStyle = S.ink; ctx.lineWidth = 2; ctx.strokeRect(bx, by, mem * sc, bh); ctx.lineWidth = 1; ctx.font = "12px system-ui"; ctx.fillStyle = S.muted; ctx.fillText(`weights (blue) · KV cache of all users (orange) · outline = GPU memory`, bx, by + bh + 16);
    ctx.fillStyle = S.ink; ctx.font = "13px system-ui"; y = by + bh + 40; for (const t of [`Decode speed: ${Math.round(tp).toLocaleString()} tokens/s in total, ${perUser.toFixed(0)} tokens/s per user`, `Time to first token for a 1,000-token prompt: about ${(ttft * 1000).toFixed(0)} ms (compute-bound)`, `Cost at full use: about $${cost.toFixed(3)} per million generated tokens; at 20% busy $${(cost * 5).toFixed(3)}`]) { ctx.fillText(t, 14, y); y += 19; }
  },
};
