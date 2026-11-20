const fs = require("fs");
const files = {};
const load = (f) => (files[f] !== undefined ? files[f] : (files[f] = fs.readFileSync(f, "utf8")));
function rep(f, from, to) {
  const s = load(f);
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(f + ": expected 1 match, found " + n + " for: " + from.slice(0, 80));
  files[f] = s.replace(from, () => to);
}
const B = "frontend/src/pages/Bid.tsx";
const E = "frontend/src/pages/Evaluate.tsx";

// ---------- Bid.tsx ----------
rep(B, 'import { useEffect, useState } from "react";', 'import { useEffect, useState } from "react";\nimport type { ChangeEvent } from "react";');
rep(B, 'import { formatEther, keccak256, toHex } from "viem";', 'import { formatEther, toHex } from "viem";');
rep(B, 'import { metaOf } from "../lib/meta";', 'import { metaOf } from "../lib/meta";\nimport { buildPackage, hashFile, hashPackage } from "../lib/pkg";\nimport type { DocEntry } from "../lib/pkg";');
rep(B, "salt: string; commitTx?: string };", "salt: string; commitTx?: string; pkg?: string };");
rep(B, 'const [proposal, setProposal] = useState("");', 'const [proposal, setProposal] = useState("");\n  const [docs, setDocs] = useState<DocEntry[]>([]);');
rep(B, "async function onCommit() {", [
  "async function onFiles(e: ChangeEvent<HTMLInputElement>) {",
  "    setErr(\"\");",
  "    const out: DocEntry[] = [];",
  "    for (const f of Array.from(e.target.files ?? []).slice(0, 10)) {",
  "      if (f.size > 25 * 1024 * 1024) { setErr(f.name + \" is larger than 25 MB.\"); continue; }",
  "      out.push(await hashFile(f));",
  "    }",
  "    setDocs(out);",
  "  }",
  "",
  "  async function onCommit() {",
].join("\n"));
rep(B, "const proposalHash = keccak256(toHex(proposal.trim()));", "const pkg = buildPackage(id, account, price, proposal.trim(), docs);\n      const proposalHash = hashPackage(pkg);");
rep(B, "const rec: Saved = { price, proposal: proposal.trim(), proposalHash, salt };", "const rec: Saved = { price, proposal: proposal.trim(), proposalHash, salt, pkg };");
rep(B, "onChange={(e) => setProposal(e.target.value)} />\n          </div>", [
  "onChange={(e) => setProposal(e.target.value)} />",
  "          </div>",
  "          <div>",
  "            <label className={lbl}>Supporting documents (optional)</label>",
  '            <input type="file" multiple className="block w-full text-sm text-ink-300" onChange={onFiles} />',
  "            {docs.map((d) => (",
  '              <p key={d.hash} className="mt-1 break-all text-xs text-ink-300">{d.name} · {Math.round(d.size / 1024)} KB · {d.hash.slice(0, 14)}…</p>',
  "            ))}",
  '            <p className="mt-1 text-xs text-ink-300">Files never leave your device. Only their hashes are bound into your commitment.</p>',
  "          </div>",
].join("\n"));
rep(B, "async function copyBackup() {", [
  "function downloadPackage() {",
  "    if (!saved?.pkg) return;",
  '    const blob = new Blob([saved.pkg], { type: "application/json" });',
  "    const url = URL.createObjectURL(blob);",
  '    const a = document.createElement("a");',
  "    a.href = url;",
  '    a.download = "tendertrust-bid-" + id + ".json";',
  "    a.click();",
  "    URL.revokeObjectURL(url);",
  "  }",
  "",
  "  async function copyBackup() {",
].join("\n"));
rep(B, '<button className="btn-ghost mt-3 w-full" onClick={copyBackup}>Copy backup (keep private)</button>', [
  "{saved.pkg && (",
  '            <button className="btn-primary mt-3 w-full" onClick={downloadPackage}>Download bid package (send it to the organizer)</button>',
  "          )}",
  '          <button className="btn-ghost mt-3 w-full" onClick={copyBackup}>Copy backup (keep private)</button>',
].join("\n"));

// ---------- Evaluate.tsx ----------
rep(E, 'import { keccak256, toHex } from "viem";', 'import type { ChangeEvent } from "react";\nimport { hashFile, hashPackage } from "../lib/pkg";\nimport type { DocEntry } from "../lib/pkg";');
rep(E, 'const [pasted, setPasted] = useState("");', 'const [pasted, setPasted] = useState("");\n  const [docHashes, setDocHashes] = useState<DocEntry[]>([]);');
rep(E, "const hashOk = pasted.trim().length > 0 && keccak256(toHex(pasted.trim())) === bid.proposalHash;", [
  "const hashOk = pasted.trim().length > 0 && hashPackage(pasted.trim()) === bid.proposalHash;",
  "  let listed: DocEntry[] = [];",
  "  try {",
  "    const j = JSON.parse(pasted.trim());",
  "    if (Array.isArray(j.files)) listed = j.files;",
  "  } catch {",
  "    /* plain text proposal */",
  "  }",
  "  async function onDocs(e: ChangeEvent<HTMLInputElement>) {",
  "    const out: DocEntry[] = [];",
  "    for (const f of Array.from(e.target.files ?? []).slice(0, 10)) {",
  "      if (f.size <= 25 * 1024 * 1024) out.push(await hashFile(f));",
  "    }",
  "    setDocHashes(out);",
  "  }",
  "  async function onPkgFile(e: ChangeEvent<HTMLInputElement>) {",
  "    const f = e.target.files?.[0];",
  "    if (f && f.size < 200000) setPasted(await f.text());",
  "  }",
].join("\n"));
rep(E, "Paste the proposal text the supplier sent you (optional check)", "Paste the bid package (or proposal text) the supplier sent you (optional check)");
rep(E, '<div className="mt-3 grid grid-cols-3 gap-2">', [
  '<label className="mt-2 block text-xs text-ink-300">or load the package file</label>',
  '      <input type="file" accept=".json,application/json" className="block w-full text-sm text-ink-300" onChange={onPkgFile} />',
  "      {listed.length > 0 && hashOk && (",
  '        <div className="mt-3">',
  '          <label className="block text-xs text-ink-300">Select the documents the supplier sent you ({listed.length} listed in the package)</label>',
  '          <input type="file" multiple className="block w-full text-sm text-ink-300" onChange={onDocs} />',
  "          {listed.map((f) => (",
  '            <p key={f.hash} className={"mt-1 break-all text-xs " + (docHashes.some((d) => d.hash === f.hash) ? "text-trust-400" : "text-ink-300")}>',
  '              {docHashes.some((d) => d.hash === f.hash) ? "VERIFIED " : "waiting "}{f.name}',
  "            </p>",
  "          ))}",
  "          {docHashes.filter((d) => !listed.some((f) => f.hash === d.hash)).map((d) => (",
  '            <p key={d.hash} className="mt-1 break-all text-xs text-red-300">NOT IN PACKAGE {d.name}</p>',
  "          ))}",
  "        </div>",
  "      )}",
  '      <div className="mt-3 grid grid-cols-3 gap-2">',
].join("\n"));

for (const [f, s] of Object.entries(files)) fs.writeFileSync(f, s);
console.log("Patched OK");
