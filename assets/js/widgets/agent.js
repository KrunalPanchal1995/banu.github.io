// ReAct agent with a scripted policy and injected faults: a JavaScript port of codes/agents/agents_np (same texts, tools, parser and guards).
import { chunkCorpus, bm25, rank } from "./askcourse.js";
const OPS = ["+5", "*3", "-4", "*2", "+9", "-1", "*5", "+2"];
export function calc(expr) {                       // integers with + - * // / and parentheses; rejects everything else (like safe_calc)
  if (!/^[0-9+\-*/(). ]+$/.test(expr) || expr.includes("**") || expr.length > 200) throw new Error("only short arithmetic without ** is allowed");
  const tk = expr.match(/\d+|\/\/|[-+*/()]/g); let i = 0;
  const prim = () => { const t = tk[i++]; if (t === "(") { const v = add(); i++; return v; } if (t === "-") return -prim(); return Number(t); };
  const mul = () => { let v = prim(); while (tk[i] === "*" || tk[i] === "//" || tk[i] === "/") { const o = tk[i++], r = prim(); v = o === "*" ? v * r : o === "//" ? Math.floor(v / r) : v / r; } return v; };
  const add = () => { let v = mul(); while (tk[i] === "+" || tk[i] === "-") { const o = tk[i++], r = mul(); v = o === "+" ? v + r : v - r; } return v; };
  return add();
}
export function makeTask(kind, p) {
  if (kind === "chain") { const k = p.k, plan = []; let v = 7; for (let j = 0; j < k; j++) { const op = OPS[j]; plan.push(j === 0 ? ["calculator", `7${op}`] : ["calculator", (o) => `${o}${op}`]); v = calc(`${v}${op}`); } return { plan, answer: String(v), question: `Start from 7 and apply ${k} operations: ${OPS.slice(0, k).join(", ")} in order.` }; }
  if (kind === "tokens") { const n = Math.floor(p.S / p.P) ** 2; return { plan: [["calculator", `(${p.S}//${p.P})*(${p.S}//${p.P})`], ["calculator", (o) => `${o}*${o}`]], answer: String(n * n), question: `How many tokens is a ${p.S}-pixel image with ${p.P}-pixel patches, and that number squared?` }; }
  const d = p.d; return { plan: [["search", "parameters of one Transformer block 12d^2 13d"], ["calculator", `12*${d}*${d}+13*${d}`]], answer: String(12 * d * d + 13 * d), question: `Find in the course how many parameters one Transformer block has, and compute it for d = ${d}.` };
}
let SEARCH = null;
const search = (q) => { if (!SEARCH) { const ch = chunkCorpus(600, 120); SEARCH = { ch, bm: bm25(ch.map((c) => c.text)) }; } return SEARCH.ch[rank(SEARCH.bm(q))[0]].text; };
const callTool = (name, arg) => { if (name === "calculator") { try { return String(Math.trunc(calc(arg))); } catch (e) { return "error: " + e.message; } } if (name === "search") return search(arg); if (name === "finish") return arg; return "error: unknown tool " + name; };
export const parseAction = (t) => { const m = t.trim().match(/Action:\s*(\w+)\[(.*)\]\s*$/s); return m ? [m[1], m[2]] : null; };
export function scriptedRun(kind, params, failAt, retry, verify) {
  const task = makeTask(kind, params), plan = task.plan, ideal = []; let o = null;
  for (const [tool, arg] of plan) { o = callTool(tool, typeof arg === "function" ? arg(o) : arg); ideal.push(o); }
  let step = 0, attempts = 0, last = null, obs = null, calls = 0; const trace = [];
  for (let n = 0; n < 20; n++) {
    let text;
    if (step >= plan.length) text = `Thought: I have the result.\nAction: finish[${last}]`;
    else { let [tool, arg] = plan[step]; arg = typeof arg === "function" ? arg(last) : arg; let kind2 = null; if (failAt && failAt[0] === step && attempts === 0) kind2 = failAt[1]; attempts++;
      if (kind2 === "malformed") text = `Thought: use ${tool}.\nAction ${tool} (${arg})`; else { if (kind2 === "wrong") arg = tool === "calculator" ? `(${arg})+1` : arg + " wrong"; text = `Thought: I should use ${tool}.\nAction: ${tool}[${arg}]`; } }
    calls++; const act = parseAction(text);
    if (!act) { obs = "error: could not parse an action; use 'Action: tool[argument]'"; trace.push([text, obs]); if (!retry) return { trace, success: false, calls }; continue; }
    const [tool, arg] = act; if (tool === "finish") { trace.push([text, arg]); return { trace, success: arg.trim() === task.answer, calls }; }
    obs = callTool(tool, arg); trace.push([text, obs]);
    if (verify && step < plan.length && obs !== ideal[step]) { obs = "error: check failed, redo this step"; trace[trace.length - 1] = [text, obs]; continue; }
    step++; attempts = 0; last = obs;
  }
  return { trace, success: false, calls };
}
export default {
  id: "agent", unit: "u8", group: "Unit 8 · Agents", title: "Agent loop (Thought, Action, Observation)",
  blurb: "Watch an agent work step by step with real tools (a calculator and a search over the course text). Inject a mistake and see which safeguards save the task.",
  what: "Each step shows what the 'model' wrote (Thought and Action) and what the tool returned (Observation). The model here is a script that knows the right plan: it only lets you test the loop, the tools and the safeguards. Green = right final answer, red = wrong or none.",
  tryit: "Pick the chain task and inject a 'silent wrong result' at step 2 with no safeguards: the agent finishes confidently with a wrong answer. Turn on 'verify' and it is caught and redone. Inject a 'broken format' instead and turn retry off: the run dies.",
  params: [
    { key: "task", label: "Task", type: "select", value: "chain", options: [["chain", "Chain of calculator steps"], ["tokens", "Image tokens, then squared"], ["lookup", "Look up a formula in the course, then compute"]], help: "Each task uses real tools." },
    { key: "k", label: "Steps in the chain task", type: "range", min: 2, max: 8, step: 1, value: 4, unit: "steps", help: "Only for the chain task." },
    { key: "fail", label: "Which step goes wrong", type: "select", value: "1", options: [["-1", "None (no mistake)"], ["0", "Step 1"], ["1", "Step 2"], ["2", "Step 3"]], help: "The model makes one mistake on its first attempt at this step." },
    { key: "kind", label: "Kind of mistake", type: "select", value: "wrong", options: [["wrong", "Silent wrong result"], ["malformed", "Broken action format"]], help: "Silent = well-formed but wrong, nothing complains. Broken = the parser rejects it." },
    { key: "retry", label: "Retry when the format is broken", type: "select", value: "yes", options: [["yes", "Yes: tell the model and ask again"], ["no", "No: give up"]], help: "A safeguard against format errors." },
    { key: "verify", label: "Verify each result independently", type: "select", value: "no", options: [["no", "No"], ["yes", "Yes: compare with an independent check"]], help: "A safeguard against silent wrong results (needs a checker you trust)." },
  ],
  presets: [["No mistakes", { fail: "-1" }], ["Silent error, unguarded", { fail: "1", kind: "wrong", verify: "no" }], ["Silent error, verified", { fail: "1", kind: "wrong", verify: "yes" }], ["Broken format, no retry", { fail: "1", kind: "malformed", retry: "no" }]],
  draw(ctx, p, S) {
    const params = p.task === "chain" ? { k: Math.round(p.k) } : p.task === "tokens" ? { S: 224, P: 16 } : { d: 64 }, nPlan = makeTask(p.task, params).plan.length, fa = +p.fail >= 0 && +p.fail < nPlan ? [+p.fail, p.kind] : null;
    const task = makeTask(p.task, params), r = scriptedRun(p.task, params, fa, p.retry === "yes", p.verify === "yes"), final = r.trace[r.trace.length - 1];
    ctx.textAlign = "left"; ctx.font = "600 13px system-ui"; ctx.fillStyle = S.ink; let y = S.wrap(task.question, 14, 22, S.w - 28, 17); ctx.fillStyle = r.success ? S.good : S.bad; ctx.fillText(r.success ? `Correct answer: ${task.answer}  (${r.calls} model calls)` : `FAILED: ${final && r.trace.length && final[0].includes("finish[") ? "confidently wrong answer " + final[1] : "no answer"}  (correct: ${task.answer}; ${r.calls} model calls)`, 14, y + 4); y += 26;
    ctx.font = "11.5px ui-monospace, Menlo, monospace"; for (let i = 0; i < r.trace.length; i++) { if (y > S.h - 16) break; const [a, o] = r.trace[i]; ctx.fillStyle = S.accent; y = S.wrap(`${i + 1}. ${a.replace(/\n/g, " | ")}`, 14, y, S.w - 28, 14); ctx.fillStyle = o.startsWith("error") ? S.bad : S.muted; y = S.wrap(`   → ${o.length > 110 ? o.slice(0, 107) + "…" : o}`, 14, y, S.w - 28, 14) + 3; }
  },
};
