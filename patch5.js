const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const F = "frontend/src/pages/Verify.tsx";
rep(F, 'import { deployment, evidence } from "../lib/deployment";', 'import { deployment, evidenceByTender } from "../lib/deployment";');
rep(F, "const showEvidence = Number(id) === evidence.tenderId;", "const ev: { note: string; txs: Record<string, string> } | undefined = (evidenceByTender as any)[String(id)];\n  const showEvidence = !!ev;");
rep(F, "{evidence.note}", "{ev?.note}");
rep(F, "Object.entries(evidence.txs) as [string, string][]", "Object.entries(ev?.txs ?? {}) as [string, string][]");
console.log("Patched OK");
