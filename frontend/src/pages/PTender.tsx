import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageShell from "../components/PageShell";
import { loadTender, loadPanel } from "../lib/load3";
import type { Bid, PanelScore } from "../lib/load3";
import { STATUS, STATUS_COLOR, explorerAddr, fmt, short } from "../lib/format";
import { metaOf } from "../lib/meta";

type Data = { tender: any; status: number; bids: Bid[]; evaluators: string[]; scores: Record<string, PanelScore[]> };

export default function PTender() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null);
    setErr("");
    (async () => {
      try {
        const d = await loadTender(Number(id));
        const p = await loadPanel(Number(id), d.bids.map((b) => b.bidder));
        setData({ ...d, ...p });
      } catch (e: any) {
        setErr(e?.shortMessage ?? e?.message ?? "Failed to load");
      }
    })();
  }, [id]);

  const title = "Tender #" + id;
  if (err) return <PageShell title={title}><div className="card text-red-300">Could not load: {err}</div></PageShell>;
  if (!data) return <PageShell title={title}><div className="card text-ink-300">Loading from chain…</div></PageShell>;

  const t = data.tender;
  const m = metaOf(t.metadataURI);
  const weights: [string, number][] = [["Technical quality", 40], ["Relevant experience", 30], ["Delivery capability", 20], ["Price competitiveness", 10]];

  return (
    <PageShell title={title} subtitle={m.title}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={"badge " + STATUS_COLOR[data.status]}>{STATUS[data.status]}</span>
        <span className="badge bg-ink-700 text-ink-300">Panel of 3 evaluators</span>
        <Link to={"/p/verify/" + id} className="text-sm text-trust-400 underline">Verify this result</Link>
      </div>
      {data.status === 0 && <Link to={"/p/tender/" + id + "/bid"} className="btn-primary mt-4 w-full">Submit a bid</Link>}
      {data.status === 1 && <Link to={"/p/tender/" + id + "/bid"} className="btn-primary mt-4 w-full">Reveal your bid</Link>}
      {data.status === 2 && <Link to={"/p/tender/" + id + "/evaluate"} className="btn-ghost mt-4 w-full">Panel: score, settle and finalize</Link>}

      <div className="card mt-4">
        <h3 className="font-semibold">Terms</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-ink-300">
          <div><dt>Budget</dt><dd className="text-ink-100">{t.budget.toString()} units</dd></div>
          <div><dt>Organizer</dt><dd><a className="text-trust-400 underline" href={explorerAddr(t.organizer)} target="_blank" rel="noreferrer">{short(t.organizer)}</a></dd></div>
          <div><dt>Commit by</dt><dd className="text-ink-100">{fmt(t.commitDeadline)}</dd></div>
          <div><dt>Reveal by</dt><dd className="text-ink-100">{fmt(t.revealDeadline)}</dd></div>
          <div className="col-span-2"><dt>Scoring open until</dt><dd className="text-ink-100">{fmt(t.evalDeadline)}</dd></div>
        </dl>
      </div>

      {(m.description || m.eligibility) && (
        <div className="card mt-4">
          <h3 className="font-semibold">About this tender</h3>
          {m.description && <p className="mt-2 whitespace-pre-line text-sm text-ink-300">{m.description}</p>}
          {m.eligibility && (
            <>
              <h4 className="mt-3 text-sm font-semibold">Minimum eligibility</h4>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-300">{m.eligibility}</p>
            </>
          )}
        </div>
      )}

      <div className="card mt-4">
        <h3 className="font-semibold">Evaluation rules</h3>
        <ul className="mt-3 space-y-1 text-sm text-ink-300">
          {weights.map(([n, w]) => (
            <li key={n} className="flex justify-between"><span>{n}</span><span className="text-ink-100">{w}%</span></li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-300">
          Three evaluators each score every revealed bid from 0 to 15 and record a rationale hash. The median of each criterion is used (the lower value if only two scored). TapeOut circuit #{t.tapeCircuitId.toString()} then computes 4×Technical + 3×Experience + 2×Delivery + Price score. A bid is eligible only if most evaluators verified its documents and its price is within budget.
        </p>
        <p className="mt-2 break-all text-xs text-ink-500">Rules hash: {t.rulesHash}</p>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Evaluator panel</h3>
        {data.evaluators.map((a, i) => (
          <p key={a} className="mt-2 text-sm text-ink-300">
            Evaluator {i + 1}: <a className="font-mono text-trust-400 underline" href={explorerAddr(a)} target="_blank" rel="noreferrer">{short(a)}</a>
          </p>
        ))}
      </div>

      <h3 className="mt-6 font-semibold">Bids ({data.bids.length})</h3>
      <div className="mt-3 grid gap-3">
        {data.bids.length === 0 && <div className="card text-ink-300">No bids yet.</div>}
        {data.bids.map((b) => {
          const sc = (data.scores[b.bidder] ?? []).filter((s) => s.submitted);
          const win = t.finalized && b.bidder.toLowerCase() === String(t.winner).toLowerCase();
          const label = win ? "Winner" : b.evaluated ? (b.eligible ? "Settled" : "Not eligible") : b.revealed ? "Revealed" : "Committed";
          return (
            <div key={b.bidder} className={"card " + (win ? "border-trust-500" : "")}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{short(b.bidder)}</span>
                <span className={"badge " + (win ? "bg-trust-600/20 text-trust-400" : "bg-ink-700 text-ink-300")}>{label}</span>
              </div>
              {b.revealed ? (
                <p className="mt-2 text-sm text-ink-300">Price: <span className="text-ink-100">{b.price.toString()}</span></p>
              ) : (
                <p className="mt-2 text-sm text-ink-300">Price hidden (not revealed).</p>
              )}
              {b.revealed && <p className="mt-1 text-xs text-ink-300">Evaluations: {sc.length} of 3</p>}
              {sc.map((s) => (
                <p key={s.evaluator} className="mt-1 text-xs text-ink-300">
                  {short(s.evaluator)} · T {s.tech} · E {s.experience} · D {s.delivery} · documents {s.docsVerified ? "verified" : "not verified"}
                </p>
              ))}
              {b.evaluated && (
                <p className="mt-2 text-sm text-ink-300">
                  Median T {b.tech} · E {b.experience} · D {b.delivery} · P {b.priceScore} → total <span className="text-ink-100">{b.total}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-ink-300">
        Documents are reviewed off-chain by the evaluators. The chain proves the scoring was computed correctly, not that a supplier’s claims are true.
      </p>
    </PageShell>
  );
}
