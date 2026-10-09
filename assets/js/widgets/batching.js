// Serving simulator: static versus continuous batching on one replica of the real Qwen2.5-0.5B (bf16, 500-token contexts, illustrative 1 TB/s and 100 TFLOP/s).
import { params, kvBytes, wBytes, stepTime, simulate } from "./serving.js";
const C = { d: 896, ff: 4864, L: 24, h: 14, kv: 2, V: 151936, tied: true, bias: true }, N = params(C), W = wBytes(N, "bf16"), KV = kvBytes(C) * 500, step = (b) => stepTime(W, KV, N, b, 1e12, 1e14);
export default {
  id: "batching", unit: "u10", group: "Unit 10 · Deployment", title: "Serving simulator: batching",
  blurb: "Requests arrive at random and each needs a different number of tokens. Compare waiting to fill a batch (static) with letting requests join and leave every step (continuous).",
  what: "Three numbers per policy: the typical wait (median), the bad-day wait (95th percentile) and the total tokens produced per second. Static batching runs a batch until its longest request finishes, so short requests wait; continuous batching frees a slot as soon as a request ends.",
  tryit: "Start at 20 requests per second: both are fine. Raise the load to 160: static batching's 95th-percentile wait jumps by a factor of 20 and its throughput stops growing, while continuous batching stays almost flat. Lower the maximum batch to 4 and see both degrade.",
  params: [
    { key: "rate", label: "Requests arriving per second", type: "range", min: 5, max: 500, step: 5, value: 160, unit: "req/s", help: "Average arrival rate (random, Poisson)." },
    { key: "maxb", label: "Largest batch the GPU runs", type: "range", min: 1, max: 64, step: 1, value: 32, unit: "requests", help: "Limited by memory (KV cache)." },
    { key: "mean", label: "Average reply length", type: "range", min: 10, max: 300, step: 10, value: 60, unit: "tokens", help: "Reply lengths vary a lot around this average." },
    { key: "n", label: "Requests simulated", type: "range", min: 300, max: 3000, step: 100, value: 1000, unit: "requests", help: "More = steadier numbers, slower to compute." },
    { key: "seed", label: "Random seed", type: "range", min: 1, max: 20, step: 1, value: 3, help: "Different random arrivals." },
  ],
  presets: [["Light load", { rate: 20 }], ["Heavy load", { rate: 160 }], ["Small batches", { rate: 80, maxb: 4 }], ["Long replies", { mean: 200, rate: 40 }]],
  draw(ctx, p, S) {
    const r = S.rng(p.seed * 17 + 1), n = Math.round(p.n); let t = 0; const arr = [], out = []; for (let i = 0; i < n; i++) { t += -Math.log(1 - r()) / p.rate; arr.push(t); out.push(1 + Math.floor(Math.log(1 - r()) / Math.log(1 - 1 / p.mean))); }
    const res = {}; for (const pol of ["static", "continuous"]) { const s = simulate(pol, arr, out, Math.round(p.maxb), step), l = [...s.lat].sort((a, b) => a - b); res[pol] = { p50: l[Math.floor(0.5 * l.length)], p95: l[Math.floor(0.95 * l.length)], tp: s.tput, mb: s.meanBatch }; }
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; ctx.fillText("Waiting time per request, and throughput", 14, 24); const x0 = 150, bw = S.w - x0 - 70, mx = Math.max(res.static.p95, res.continuous.p95, 0.05);
    let y = 48; ctx.font = "12.5px system-ui";
    for (const [k, name] of [["p50", "typical wait (median)"], ["p95", "bad-day wait (95th pct)"]]) for (const [pol, col] of [["static", S.c[3]], ["continuous", S.c[0]]]) { const v = res[pol][k]; ctx.fillStyle = S.muted; ctx.textAlign = "right"; ctx.fillText(`${pol}: ${name.split(" ")[0]}`, x0 - 8, y + 14); ctx.fillStyle = S.line; ctx.fillRect(x0, y, bw, 20); ctx.fillStyle = col; ctx.fillRect(x0, y, Math.max(2, (bw * v) / mx), 20); ctx.fillStyle = S.ink; ctx.textAlign = "left"; ctx.fillText(v < 1 ? (v * 1000).toFixed(0) + " ms" : v.toFixed(2) + " s", x0 + bw + 6, y + 14); y += 26; }
    ctx.textAlign = "left"; ctx.font = "13px system-ui"; ctx.fillStyle = S.ink; y += 8; ctx.fillText(`Throughput: static ${Math.round(res.static.tp).toLocaleString()} tokens/s (avg batch ${res.static.mb.toFixed(1)})`, 14, y); ctx.fillText(`continuous ${Math.round(res.continuous.tp).toLocaleString()} tokens/s (avg batch ${res.continuous.mb.toFixed(1)})`, 14, y + 19);
    ctx.fillStyle = S.muted; S.wrap("Illustrative: Qwen2.5-0.5B in 16-bit on a GPU with 1 TB/s memory and 100 TFLOP/s, 500-token contexts. No prefill or memory limits are simulated.", 14, y + 46, S.w - 28, 16);
  },
};
