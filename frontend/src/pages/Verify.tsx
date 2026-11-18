import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import PageShell from "../components/PageShell";
import { loadTender, previewScore, formula } from "../lib/load";
import type { Bid } from "../lib/load";
import { TENDER_TRUST } from "../lib/chain";
import { deployment, evidence } from "../lib/deployment";
import { explorerAddr, explorerTx, short } from "../lib/format";

type Check = { bidder: string; recorded: number; circuit: number | null; formula: number };
type Data = { tender: any; status: number; bids: Bid[] };

export default function Verify() {
  const { id } = useParams();
  const nav = useNavigate();
  const [input, setInput] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!id) return;
    setData(null);
    setChecks([]);
    setErr("");
    (async () => {
      try {
        const d = await loadTender(Number(id));
        setData(d);
        const out: Check[] = [];
        for (const b of d.bids) {
          if (!b.evaluated) continue;
          let circuit: number | null = null;
          try { circuit = await previewScore(Number(id), b); } catch { circuit = null; }
          out.push({ bidder: b.bidder, recorded: b.total, circuit, formula: formula(b.tech, b.experience, b.delivery, b.priceScore, b.eligible) });
        }
        setChecks(out);
      } catch (e: any) {
        setErr(e?.shortMessage ?? e?.message ?? "Failed to load");
      }
    })();
  }, [id]);

  if (!id) {
    return (
      <PageShell title="Verify a Result" subtitle="Enter a tender ID to recheck its rules, bids and scores against the chain.">
        <div className="card flex gap-3">
          <input
            className="w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-ink-100"
            inputMode="numeric"
            placeholder="Tender ID, for example 1"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, ""))}
          />
          <button className="btn-primary" onClick={() => input && nav("/verify/" + input)}>Verify</button>
        </div>
      </PageShell>
    );
  }

  const title = "Verify Tender #" + id;
  if (err) return <PageShell title={title}><div className="card text-red-300">Could not load: {err}</div></PageShell>;
  if (!data) return <PageShell title={title}><div className="card text-ink-300">Loading from chain…</div></PageShell>;

  const t = data.tender;
  const link = "text-trust-400 underline break-all";
  const showEvidence = Number(id) === evidence.tenderId;

  return (
    <PageShell title={title} subtitle="Everything below is read live from X Layer mainnet.">
      <div className="card">
        <h3 className="font-semibold">Published record</h3>
        <dl className="mt-3 space-y-2 text-sm text-ink-300">
          <div><dt>TenderTrust contract</dt><dd><a className={link} href={explorerAddr(TENDER_TRUST)} target="_blank" rel="noreferrer">{TENDER_TRUST}</a></dd></div>
          <div><dt>TapeOut processor (circuits contract)</dt><dd><a className={link} href={explorerAddr(t.tapeProcessor)} target="_blank" rel="noreferrer">{t.tapeProcessor}</a></dd></div>
          <div><dt>Circuit ID</dt><dd className="text-ink-100">{t.tapeCircuitId.toString()}</dd></div>
          <div><dt>Rules hash</dt><dd className="break-all text-ink-100">{t.rulesHash}</dd></div>
        </dl>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Recorded bids</h3>
        {data.bids.length === 0 && <p className="mt-2 text-sm text-ink-300">No bids recorded.</p>}
        {data.bids.map((b) => (
          <div key={b.bidder} className="mt-3 border-t border-ink-700 pt-3 text-xs text-ink-300">
            <div className="font-mono text-sm text-ink-100">{short(b.bidder)}</div>
            <div className="mt-1 break-all">Commitment: {b.commitment}</div>
            {b.revealed && <div className="break-all">Proposal hash: {b.proposalHash}</div>}
            {b.revealed && <div>Revealed price: {b.price.toString()}</div>}
          </div>
        ))}
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Recalculation</h3>
        {checks.length === 0 && <p className="mt-2 text-sm text-ink-300">No evaluated bids yet.</p>}
        {checks.map((c) => {
          const ok = c.circuit !== null && c.circuit === c.recorded && c.formula === c.recorded;
          return (
            <div key={c.bidder} className="mt-3 flex items-center justify-between border-t border-ink-700 pt-3 text-sm">
              <div>
                <div className="font-mono">{short(c.bidder)}</div>
                <div className="text-xs text-ink-300">
                  recorded {c.recorded} · circuit {c.circuit === null ? "n/a" : c.circuit} · formula {c.formula}
                </div>
              </div>
              <span className={"badge " + (ok ? "bg-trust-600/20 text-trust-400" : "bg-red-500/20 text-red-300")}>{ok ? "MATCH" : "CHECK"}</span>
            </div>
          );
        })}
        {data.tender.finalized && (
          <p className="mt-4 text-sm">Winner: <span className="font-mono text-trust-400">{short(t.winner)}</span> with score {Number(t.winnerScore)}</p>
        )}
      </div>

      {showEvidence && (
        <div className="card mt-4">
          <h3 className="font-semibold">Transactions for this demo tender</h3>
          <p className="mt-1 text-xs text-ink-300">{evidence.note}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {(Object.entries(evidence.txs) as [string, string][]).map(([k, h]) => (
              <li key={k}><a className={link} href={explorerTx(h)} target="_blank" rel="noreferrer">{k}: {short(h)}</a></li>
            ))}
            <li><a className={link} href={explorerTx(deployment.tapeoutTx)} target="_blank" rel="noreferrer">circuit tapeout: {short(deployment.tapeoutTx)}</a></li>
          </ul>
        </div>
      )}

      <div className="card mt-4">
        <h3 className="font-semibold">How anyone can verify</h3>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-ink-300">
          <li>Open the contract on the explorer and read the tender’s rules hash and circuit ID.</li>
          <li>Read each recorded bid with getBid, and check commitments against the reveal data.</li>
          <li>Call previewScore on the contract, or eval on the TapeOut processor, with the same inputs.</li>
          <li>Compare the result with 4×T + 3×E + 2×D + P and with the recorded total.</li>
        </ol>
        <p className="mt-3 text-xs text-ink-300">
          The circuit proves the scoring formula ran on the given inputs. It cannot prove that documents or claims are true; the organizer reviews evidence off-chain.
        </p>
      </div>
      <p className="mt-4 text-sm"><Link to={"/tender/" + id} className="text-trust-400 underline">Back to tender</Link></p>
    </PageShell>
  );
}
