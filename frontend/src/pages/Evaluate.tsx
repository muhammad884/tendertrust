import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ChangeEvent } from "react";
import { hashFile, hashPackage } from "../lib/pkg";
import type { DocEntry } from "../lib/pkg";
import PageShell from "../components/PageShell";
import { loadTender, previewScore } from "../lib/load";
import type { Bid } from "../lib/load";
import { connect, explainWalletError, writeTender } from "../lib/wallet";
import { STATUS, STATUS_COLOR, short } from "../lib/format";
import { metaOf } from "../lib/meta";

const field = "w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 text-ink-100";
const SCORES = Array.from({ length: 16 }, (_, i) => i);

type Data = { tender: any; status: number; bids: Bid[] };

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

function BidEval({ id, bid, budget, onDone }: { id: string; bid: Bid; budget: bigint; onDone: () => void }) {
  const [tech, setTech] = useState(0);
  const [exp, setExp] = useState(0);
  const [del, setDel] = useState(0);
  const [docs, setDocs] = useState(false);
  const [pasted, setPasted] = useState("");
  const [docHashes, setDocHashes] = useState<DocEntry[]>([]);
  const [preview, setPreview] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const eligible = docs && bid.price > 0n && bid.price <= budget;
  const hashOk = pasted.trim().length > 0 && hashPackage(pasted.trim()) === bid.proposalHash;
  let listed: DocEntry[] = [];
  try {
    const j = JSON.parse(pasted.trim());
    if (Array.isArray(j.files)) listed = j.files;
  } catch {
    /* plain text proposal */
  }
  async function onDocs(e: ChangeEvent<HTMLInputElement>) {
    const out: DocEntry[] = [];
    for (const f of Array.from(e.target.files ?? []).slice(0, 10)) {
      if (f.size <= 25 * 1024 * 1024) {
        try {
          out.push(await hashFile(f));
        } catch {
          /* skip an unreadable file */
        }
      }
    }
    setDocHashes(out);
    e.target.value = "";
  }
  async function onPkgFile(e: ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f && f.size < 200000) {
      try {
        setPasted(await f.text());
      } catch {
        setPasted("");
      }
    }
    e.target.value = "";
  }
  const set = (f: (n: number) => void) => (n: number) => { f(n); setPreview(null); };

  async function onPreview() {
    setErr("");
    try {
      setPreview(await previewScore(Number(id), { ...bid, tech, experience: exp, delivery: del, eligible }));
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Preview failed");
    }
  }
  async function onRecord() {
    setErr("");
    setBusy(true);
    try {
      await writeTender("evaluate", [BigInt(id), bid.bidder, tech, exp, del, docs]);
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
      <p className="mt-1 break-all text-xs text-ink-300">Proposal hash: {bid.proposalHash}</p>
      <label className="mt-3 block text-xs text-ink-300">Paste the bid package (or proposal text) the supplier sent you (optional check)</label>
      <textarea className={field} rows={2} value={pasted} onChange={(e) => setPasted(e.target.value)} />
      {pasted.trim().length > 0 && (
        <p className={"mt-1 text-xs " + (hashOk ? "text-trust-400" : "text-red-300")}>
          {hashOk ? "MATCH: this text is exactly what the bid committed to." : "NO MATCH: this text differs from the committed proposal."}
        </p>
      )}
      <label className="mt-2 block text-xs text-ink-300">or load the package file</label>
      <label className="btn-ghost mt-1 w-full cursor-pointer">
        Choose package file
        <input type="file" className="hidden" onChange={onPkgFile} />
      </label>
      {listed.length > 0 && hashOk && (
        <div className="mt-3">
          <label className="block text-xs text-ink-300">Select the documents the supplier sent you ({listed.length} listed in the package)</label>
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
        <Pick label="Technical" value={tech} onChange={set(setTech)} />
        <Pick label="Experience" value={exp} onChange={set(setExp)} />
        <Pick label="Delivery" value={del} onChange={set(setDel)} />
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-ink-300">
        <input type="checkbox" checked={docs} onChange={(e) => { setDocs(e.target.checked); setPreview(null); }} />
        I reviewed the documents and they are verified
      </label>
      <p className="mt-1 text-xs text-ink-300">Eligible: {eligible ? "yes" : "no"} (needs verified documents and a price within budget).</p>
      <div className="mt-3 flex gap-2">
        <button className="btn-ghost w-full" onClick={onPreview}>Preview circuit score</button>
        <button className="btn-primary w-full disabled:opacity-50" disabled={busy} onClick={onRecord}>{busy ? "Working…" : "Record"}</button>
      </div>
      {preview !== null && <p className="mt-2 text-sm text-trust-400">TapeOut circuit says: {preview}</p>}
      {err && <p className="mt-2 text-sm text-red-300">{err}</p>}
    </div>
  );
}

export default function Evaluate() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [account, setAccount] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    loadTender(Number(id))
      .then(setData)
      .catch((e: any) => setErr(e?.shortMessage ?? e?.message ?? "Failed to load"));
  }, [id]);
  useEffect(() => { load(); }, [load]);
  const later = () => { setTimeout(load, 3500); };

  async function onConnect() {
    setErr("");
    try { setAccount(await connect()); } catch (e: any) { setErr(explainWalletError(e)); }
  }
  async function onFinalize() {
    setErr("");
    setBusy(true);
    try {
      await writeTender("finalize", [BigInt(id)]);
      later();
    } catch (e: any) {
      setErr(explainWalletError(e));
    } finally {
      setBusy(false);
    }
  }

  const title = "Evaluate tender #" + id;
  if (!data) {
    return (
      <PageShell title={title}>
        {err ? <div className="card text-red-300">Could not load: {err}</div> : <div className="card text-ink-300">Loading from chain…</div>}
      </PageShell>
    );
  }

  const t = data.tender;
  const m = metaOf(t.metadataURI);
  const isOrganizer = account !== "" && account.toLowerCase() === String(t.organizer).toLowerCase();
  const pending = data.bids.filter((b) => b.revealed && !b.evaluated);
  const done = data.bids.filter((b) => b.evaluated);
  const canFinalize = data.status === 2 && pending.length === 0 && data.bids.some((b) => b.revealed);

  return (
    <PageShell title={title} subtitle={m.title}>
      <div className="flex items-center gap-3">
        <span className={"badge " + STATUS_COLOR[data.status]}>{STATUS[data.status]}</span>
        <Link to={"/tender/" + id} className="text-sm text-trust-400 underline">Tender details</Link>
      </div>

      <div className="card mt-4">
        {account ? (
          <p className="text-sm">
            Connected: <span className="font-mono text-trust-400">{short(account)}</span>
            {isOrganizer ? " (organizer)" : ""}
          </p>
        ) : (
          <button className="btn-primary w-full" onClick={onConnect}>Connect organizer wallet</button>
        )}
        {account && !isOrganizer && (
          <p className="mt-2 text-sm text-red-300">Only the organizer ({short(t.organizer)}) can record evaluations. Switch account in your wallet and reconnect.</p>
        )}
        <p className="mt-2 text-xs text-ink-300">
          Review each supplier’s documents off-chain first. The chain proves the scoring was computed correctly, not that the documents are true.
        </p>
      </div>

      {data.status < 2 && <div className="card mt-4 text-ink-300">Evaluation opens after the reveal deadline.</div>}

      {data.status >= 2 && isOrganizer && pending.map((b) => (
        <BidEval key={b.bidder} id={id} bid={b} budget={BigInt(t.budget)} onDone={later} />
      ))}
      {data.status >= 2 && pending.length === 0 && done.length === 0 && (
        <div className="card mt-4 text-ink-300">No revealed bids to evaluate.</div>
      )}

      {done.length > 0 && (
        <div className="card mt-4">
          <h3 className="font-semibold">Evaluated</h3>
          {done.map((b) => (
            <p key={b.bidder} className="mt-2 text-sm text-ink-300">
              <span className="font-mono">{short(b.bidder)}</span> · {b.eligible ? "eligible" : "not eligible"} · total <span className="text-ink-100">{b.total}</span>
            </p>
          ))}
        </div>
      )}

      {canFinalize && (
        <button className="btn-primary mt-4 w-full disabled:opacity-50" disabled={busy || !account} onClick={onFinalize}>
          {busy ? "Working…" : "Finalize and pick the winner"}
        </button>
      )}
      {data.status === 3 && (
        <p className="mt-4 text-sm">
          Winner: <span className="font-mono text-trust-400">{short(t.winner)}</span> with score {Number(t.winnerScore)} ·{" "}
          <Link to={"/verify/" + id} className="text-trust-400 underline">Verify</Link>
        </p>
      )}
      {err && <div className="card mt-4 text-sm text-red-300">{err}</div>}
      <button className="btn-ghost mt-4 w-full" onClick={load}>Refresh</button>
    </PageShell>
  );
}
