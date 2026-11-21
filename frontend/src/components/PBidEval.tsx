import { useState } from "react";
import type { ChangeEvent } from "react";
import { keccak256, toHex } from "viem";
import type { Bid } from "../lib/load3";
import { explainWalletError, writeTender } from "../lib/wallet3";
import { hashFile, hashPackage } from "../lib/pkg";
import type { DocEntry } from "../lib/pkg";
import { short } from "../lib/format";

const field = "w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-ink-100";
const SCORES = Array.from({ length: 16 }, (_, i) => i);

function Pick({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs text-ink-300">{label}</label>
      <select className={field} value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {SCORES.map((s) => <option key={s} value={s}>{s}</option>)}
      </select>
    </div>
  );
}

export default function PBidEval({ id, bid, onDone }: { id: string; bid: Bid; onDone: () => void }) {
  const [tech, setTech] = useState(0);
  const [exp, setExp] = useState(0);
  const [del, setDel] = useState(0);
  const [docs, setDocs] = useState(false);
  const [why, setWhy] = useState("");
  const [pasted, setPasted] = useState("");
  const [docHashes, setDocHashes] = useState<DocEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const hashOk = pasted.trim().length > 0 && hashPackage(pasted.trim()) === bid.proposalHash;
  let listed: DocEntry[] = [];
  try {
    const j = JSON.parse(pasted.trim());
    if (Array.isArray(j.files)) listed = j.files;
  } catch {
    /* plain text proposal */
  }

  async function onPkgFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f && f.size < 200000) {
      try { setPasted(await f.text()); } catch { setPasted(""); }
    }
    e.target.value = "";
  }
  async function onDocs(e: ChangeEvent<HTMLInputElement>) {
    const out: DocEntry[] = [];
    for (const f of Array.from(e.target.files ?? []).slice(0, 10)) {
      if (f.size > 25 * 1024 * 1024) continue;
      try { out.push(await hashFile(f)); } catch { /* skip unreadable file */ }
    }
    setDocHashes(out);
    e.target.value = "";
  }
  async function onSubmit() {
    setErr("");
    if (why.trim().length < 10) {
      setErr("Write a short rationale (at least 10 characters). Only its hash is recorded on-chain, so keep a copy.");
      return;
    }
    setBusy(true);
    try {
      await writeTender("submitScores", [BigInt(id), bid.bidder, tech, exp, del, docs, keccak256(toHex(why.trim()))]);
      onDone();
    } catch (e: any) {
      setErr(explainWalletError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card mt-3">
      <div className="font-mono text-sm">{short(bid.bidder)}</div>
      <p className="mt-1 text-sm text-ink-300">Revealed price: <span className="text-ink-100">{bid.price.toString()}</span></p>
      <label className="mt-3 block text-xs text-ink-300">Bid package sent by the supplier (optional check)</label>
      <textarea className={field} rows={2} value={pasted} onChange={(e) => setPasted(e.target.value)} />
      <label className="btn-ghost mt-2 w-full cursor-pointer">
        Choose package file
        <input type="file" className="hidden" onChange={onPkgFile} />
      </label>
      {pasted.trim().length > 0 && (
        <p className={"mt-1 text-xs " + (hashOk ? "text-trust-400" : "text-red-300")}>
          {hashOk ? "MATCH: this is exactly what the bid committed to." : "NO MATCH: this differs from the committed proposal."}
        </p>
      )}
      {listed.length > 0 && hashOk && (
        <div className="mt-3">
          <label className="block text-xs text-ink-300">Select the documents you received ({listed.length} listed)</label>
          <label className="btn-ghost mt-1 w-full cursor-pointer">
            Choose documents
            <input type="file" multiple className="hidden" onChange={onDocs} />
          </label>
          {listed.map((f) => (
            <p key={f.hash} className={"mt-1 break-all text-xs " + (docHashes.some((d) => d.hash === f.hash) ? "text-trust-400" : "text-ink-300")}>
              {docHashes.some((d) => d.hash === f.hash) ? "VERIFIED " : "waiting "}{f.name}
            </p>
          ))}
          {docHashes.filter((d) => !listed.some((f) => f.hash === d.hash)).map((d) => (
            <p key={d.hash} className="mt-1 break-all text-xs text-red-300">NOT IN PACKAGE {d.name}</p>
          ))}
        </div>
      )}
      <div className="mt-3 grid grid-cols-3 gap-2">
        <Pick label="Technical" value={tech} onChange={setTech} />
        <Pick label="Experience" value={exp} onChange={setExp} />
        <Pick label="Delivery" value={del} onChange={setDel} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink-300">
        <input type="checkbox" checked={docs} onChange={(e) => setDocs(e.target.checked)} />
        I reviewed the documents and they are verified
      </label>
      <label className="mt-3 block text-xs text-ink-300">Your written rationale (required; its hash is recorded)</label>
      <textarea className={field} rows={2} value={why} onChange={(e) => setWhy(e.target.value)} />
      <button className="btn-primary mt-3 w-full disabled:opacity-50" disabled={busy} onClick={onSubmit}>
        {busy ? "Working…" : "Submit my scores"}
      </button>
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </div>
  );
}
