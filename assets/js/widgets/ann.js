// Vector search with an IVF index in 2-D: k-means cells, probe the nearest cells only, compare with exact search. Mirrors IVF in rag_np.py.
export function kmeans(pts, nlist, rnd, iters = 12) {
  const C = []; const used = new Set(); while (C.length < nlist) { const i = Math.floor(rnd() * pts.length); if (!used.has(i)) { used.add(i); C.push([...pts[i]]); } }
  let a = new Array(pts.length).fill(0);
  for (let it = 0; it < iters; it++) { a = pts.map((p) => { let b = 0, bd = 1e18; C.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; if (d < bd) { bd = d; b = j; } }); return b; }); for (let j = 0; j < nlist; j++) { const m = pts.filter((_, i) => a[i] === j); if (m.length) { C[j][0] = m.reduce((s, p) => s + p[0], 0) / m.length; C[j][1] = m.reduce((s, p) => s + p[1], 0) / m.length; } } }
  a = pts.map((p) => { let b = 0, bd = 1e18; C.forEach((c, j) => { const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2; if (d < bd) { bd = d; b = j; } }); return b; });
  return { C, a };
}
export function ivfSearch(pts, C, a, q, k, nprobe) {
  const cells = C.map((c, j) => [(q[0] - c[0]) ** 2 + (q[1] - c[1]) ** 2, j]).sort((x, y) => x[0] - y[0]).slice(0, nprobe).map((x) => x[1]), set = new Set(cells);
  const cand = []; pts.forEach((p, i) => { if (set.has(a[i])) cand.push(i); });
  const ids = cand.sort((i, j) => ((pts[i][0] - q[0]) ** 2 + (pts[i][1] - q[1]) ** 2) - ((pts[j][0] - q[0]) ** 2 + (pts[j][1] - q[1]) ** 2) || i - j).slice(0, k);
  return { ids, cells: set, cost: C.length + [...a].filter((x) => set.has(x)).length };
}
const gen = (n, shape, rnd) => { const nrm = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd()), P = [];
  if (shape === "uniform") for (let i = 0; i < n; i++) P.push([rnd() * 10, rnd() * 10]);
  else { const cs = []; for (let c = 0; c < 8; c++) cs.push([1.5 + rnd() * 7, 1.5 + rnd() * 7]); for (let i = 0; i < n; i++) { const c = cs[i % 8]; P.push([c[0] + 0.55 * nrm(), c[1] + 0.55 * nrm()]); } }
  return P; };
export default {
  id: "ann", unit: "u5", group: "Unit 5 · Retrieval (RAG)", title: "Vector search (IVF index)",
  blurb: "A vector database avoids comparing your query with every stored vector. It groups the vectors into cells and searches only the nearest cells, trading a little accuracy for a lot of speed.",
  what: "Dots are stored vectors (here in 2-D; real ones have hundreds of dimensions), coloured by cell. The black cross is your query. Ringed dots are the true nearest neighbours; filled ones were FOUND by the index; a ringed dot that is not filled was MISSED because its cell was not searched.",
  tryit: "Set cells searched to 1: fast but you miss neighbours near a cell border. Raise it step by step and watch recall rise while the work grows. Move the query to a cell border to see why misses happen. Set cells searched equal to the number of cells: exact, but no saving.",
  params: [
    { key: "n", label: "Stored vectors", type: "range", min: 200, max: 2000, step: 100, value: 800, unit: "vectors", help: "Size of the database." },
    { key: "shape", label: "Shape of the data", type: "select", value: "blobs", options: [["blobs", "Clusters (like topics)"], ["uniform", "Spread evenly"]], help: "Real embeddings are clumpy, which is why IVF works." },
    { key: "nlist", label: "Number of cells", type: "range", min: 4, max: 64, step: 2, value: 16, unit: "cells", help: "How many groups the vectors are split into." },
    { key: "nprobe", label: "Cells searched per query", type: "range", min: 1, max: 64, step: 1, value: 2, unit: "cells", help: "More cells = more accurate and slower." },
    { key: "k", label: "Neighbours wanted (k)", type: "range", min: 1, max: 20, step: 1, value: 10, help: "How many nearest vectors to return." },
    { key: "qx", label: "Query: left to right", type: "range", min: 0, max: 10, step: 0.1, value: 4.2, help: "Horizontal position of the query." },
    { key: "qy", label: "Query: down to up", type: "range", min: 0, max: 10, step: 0.1, value: 5.1, help: "Vertical position of the query." },
  ],
  presets: [["Fast, sloppy", { nprobe: 1 }], ["Balanced", { nprobe: 4 }], ["Exact (no saving)", { nprobe: 64 }], ["Big database", { n: 2000, nlist: 44, nprobe: 4 }]],
  draw(ctx, p, S) {
    const n = Math.round(p.n), nl = Math.round(p.nlist), np = Math.min(Math.round(p.nprobe), nl), k = Math.min(Math.round(p.k), n), rnd = S.rng(3), P = gen(n, p.shape, rnd), { C, a } = kmeans(P, nl, S.rng(9));
    const q = [p.qx, p.qy], r = ivfSearch(P, C, a, q, k, np), exact = P.map((x, i) => [i, (x[0] - q[0]) ** 2 + (x[1] - q[1]) ** 2]).sort((u, v) => u[1] - v[1] || u[0] - v[0]).slice(0, k).map((x) => x[0]), found = new Set(r.ids), recall = exact.filter((i) => found.has(i)).length / k;
    const side = Math.min(S.w - 20, S.h - 96), x0 = 10, y0 = 84, X = (v) => x0 + (v / 10) * side, Y = (v) => y0 + side - (v / 10) * side;
    ctx.textAlign = "left"; ctx.font = "600 14px system-ui"; ctx.fillStyle = S.ink; ctx.fillText(`Found ${Math.round(recall * k)} of the ${k} true nearest neighbours (recall ${(recall * 100).toFixed(0)}%)`, 12, 24);
    ctx.font = "13px system-ui"; ctx.fillStyle = S.muted; S.wrap(`Work: ${r.cost} distance computations instead of ${n} for an exact search (${(100 * r.cost / n).toFixed(0)}%). ${r.cost > n ? "More than exact: the index only pays off for large databases." : ""}`, 12, 44, S.w - 24, 16);
    ctx.strokeStyle = S.line; ctx.strokeRect(x0, y0, side, side);
    P.forEach((pt, i) => { const probed = r.cells.has(a[i]); ctx.fillStyle = S.c[a[i] % 5]; ctx.globalAlpha = probed ? 0.95 : 0.22; ctx.beginPath(); ctx.arc(X(pt[0]), Y(pt[1]), probed ? 3 : 2.4, 0, 7); ctx.fill(); }); ctx.globalAlpha = 1;
    C.forEach((c) => { ctx.strokeStyle = S.ink; ctx.lineWidth = 1; ctx.strokeRect(X(c[0]) - 3, Y(c[1]) - 3, 6, 6); });
    ctx.lineWidth = 2; for (const i of exact) { ctx.strokeStyle = found.has(i) ? S.good : S.bad; ctx.beginPath(); ctx.arc(X(P[i][0]), Y(P[i][1]), 7, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = S.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(q[0]) - 9, Y(q[1])); ctx.lineTo(X(q[0]) + 9, Y(q[1])); ctx.moveTo(X(q[0]), Y(q[1]) - 9); ctx.lineTo(X(q[0]), Y(q[1]) + 9); ctx.stroke(); ctx.lineWidth = 1;
    const tx = x0 + side + 12; if (S.w - tx > 120) { ctx.fillStyle = S.good; ctx.fillText("green ring = found", tx, y0 + 16); ctx.fillStyle = S.bad; ctx.fillText("red ring = missed", tx, y0 + 34); ctx.fillStyle = S.muted; ctx.fillText("bright = searched cells", tx, y0 + 52); ctx.fillText("small squares = cell centres", tx, y0 + 70); }
  },
};
