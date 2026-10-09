// Generative classifier: two Gaussian classes, Bayes' rule, the posterior map, sampled data, and a probe point.
const gauss2 = (x, y, mx, my, s) => Math.exp(-((x - mx) ** 2 + (y - my) ** 2) / (2 * s * s)) / (2 * Math.PI * s * s);
export default {
  id: "bayes", unit: "u1", group: "Unit 1 · Foundations", title: "Generative classifier",
  blurb: "A generative model learns what each class looks like. Bayes' rule then turns that into 'which class is this point?'. Move the classes and the probe point and see the probabilities change.",
  what: "Background colour = probability the point belongs to class B (blue = class A, orange = class B, white = 50/50). Dots are example data drawn from the two classes. The black cross is your probe point; the panel lists the numbers Bayes' rule uses for it.",
  tryit: "Pull 'Distance between classes' towards 0: the classes overlap and nothing can be classified well. Raise the prior of B: the white (50/50) line moves towards class A. Turn on 'new points' to see that a generative model can also invent fresh examples.",
  params: [
    { key: "sep", label: "Distance between the classes", type: "range", min: 0, max: 5, step: 0.1, value: 2.5, help: "How far apart the two class centres are." },
    { key: "sd", label: "Spread of each class", type: "range", min: 0.3, max: 2.5, step: 0.1, value: 1, help: "Wider spread = more overlap = harder to tell apart." },
    { key: "prior", label: "How common is class B", type: "range", min: 0.05, max: 0.95, step: 0.05, value: 0.5, help: "The prior probability of B before looking at the point (0.5 = equally common)." },
    { key: "px", label: "Probe point: left to right", type: "range", min: -4, max: 4, step: 0.1, value: 0.5, help: "Horizontal position of the black cross." },
    { key: "py", label: "Probe point: down to up", type: "range", min: -3, max: 3, step: 0.1, value: 0.5, help: "Vertical position of the black cross." },
    { key: "npts", label: "Example points", type: "range", min: 0, max: 300, step: 10, value: 100, unit: "points", help: "How many data points to draw from the two classes." },
    { key: "gen", label: "Also draw NEW points", type: "select", value: "no", options: [["no", "No"], ["yes", "Yes: 30 brand-new points from the model"]], help: "Only generative models can do this. Shown as black × marks." },
  ],
  presets: [["Easy: far apart", { sep: 4, sd: 0.8 }], ["Hard: overlapping", { sep: 1, sd: 1.5 }], ["Rare class B", { prior: 0.1 }], ["Probe at the centre", { px: 0, py: 0 }]],
  draw(ctx, p, S) {
    const ax = -p.sep / 2, bx = p.sep / 2, W = Math.min(S.w * 0.62, S.w - 220), H = S.h - 24, x0 = 12, y0 = 12, X = (v) => x0 + ((v + 5) / 10) * W, Y = (v) => y0 + H - ((v + 4) / 8) * H;
    const post = (x, y) => { const a = (1 - p.prior) * gauss2(x, y, ax, 0, p.sd), b = p.prior * gauss2(x, y, bx, 0, p.sd); return b / (a + b + 1e-300); };
    const cells = 70, cw = W / cells, ch = H / Math.round(cells * 0.8);
    for (let i = 0; i < cells; i++) for (let j = 0; j < Math.round(cells * 0.8); j++) { const v = -5 + ((i + 0.5) / cells) * 10, u = 4 - ((j + 0.5) / Math.round(cells * 0.8)) * 8, q = post(v, u);
      ctx.fillStyle = S.mix(q < 0.5 ? S.c[0] : S.c[1], Math.min(0.75, Math.abs(q - 0.5) * 1.5)); ctx.fillRect(Math.floor(x0 + i * cw), Math.floor(y0 + j * ch), Math.ceil(cw) + 1, Math.ceil(ch) + 1); }
    ctx.strokeStyle = S.line; ctx.strokeRect(x0, y0, W, H);
    const rnd = S.rng(11), nrm = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    let right = 0;
    for (let i = 0; i < p.npts; i++) { const isB = rnd() < p.prior, x = (isB ? bx : ax) + p.sd * nrm(), y = p.sd * nrm(); const pred = post(x, y) > 0.5; if (pred === isB) right++;
      ctx.fillStyle = isB ? S.c[1] : S.c[0]; ctx.strokeStyle = S.ink; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.arc(X(x), Y(y), 3.6, 0, 7); ctx.fill(); ctx.stroke(); }
    if (p.gen === "yes") { ctx.strokeStyle = S.ink; ctx.lineWidth = 1.6; const r2 = S.rng(23), n2 = () => Math.sqrt(-2 * Math.log(r2() + 1e-12)) * Math.cos(2 * Math.PI * r2()); for (let i = 0; i < 30; i++) { const isB = r2() < p.prior, x = (isB ? bx : ax) + p.sd * n2(), y = p.sd * n2(); ctx.beginPath(); ctx.moveTo(X(x) - 4, Y(y) - 4); ctx.lineTo(X(x) + 4, Y(y) + 4); ctx.moveTo(X(x) + 4, Y(y) - 4); ctx.lineTo(X(x) - 4, Y(y) + 4); ctx.stroke(); } }
    ctx.strokeStyle = S.ink; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(p.px) - 8, Y(p.py)); ctx.lineTo(X(p.px) + 8, Y(p.py)); ctx.moveTo(X(p.px), Y(p.py) - 8); ctx.lineTo(X(p.px), Y(p.py) + 8); ctx.stroke(); ctx.lineWidth = 1;
    // numbers panel
    const tx = x0 + W + 16; if (S.w - tx < 150) return;
    const pa = gauss2(p.px, p.py, ax, 0, p.sd), pb = gauss2(p.px, p.py, bx, 0, p.sd), q = post(p.px, p.py);
    ctx.textAlign = "left"; ctx.fillStyle = S.ink; ctx.font = "600 13px system-ui"; ctx.fillText("Bayes' rule at the probe", tx, 28);
    ctx.font = "12.5px system-ui"; const L = [["how likely is this point", ""], ["  if it were A:", pa.toFixed(4)], ["  if it were B:", pb.toFixed(4)], ["prior of A / B:", `${(1 - p.prior).toFixed(2)} / ${p.prior.toFixed(2)}`], ["", ""], ["P(B | point) =", `${(q * 100).toFixed(1)}%`], ["P(A | point) =", `${((1 - q) * 100).toFixed(1)}%`]];
    L.forEach(([a, b], i) => { ctx.fillStyle = i >= 5 ? S.ink : S.muted; ctx.fillText(a, tx, 50 + i * 20); ctx.textAlign = "right"; ctx.fillText(b, S.w - 12, 50 + i * 20); ctx.textAlign = "left"; });
    ctx.fillStyle = S.muted; if (p.npts > 0) S.wrap(`The rule labels ${(100 * right / p.npts).toFixed(0)}% of the dots correctly.`, tx, 50 + L.length * 20 + 12, S.w - tx - 12, 16);
    ctx.fillText("blue = A, orange = B", tx, S.h - 14);
  },
};
