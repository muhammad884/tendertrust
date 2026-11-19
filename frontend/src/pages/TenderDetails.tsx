import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageShell from "../components/PageShell";
import { loadTender } from "../lib/load";
import type { Bid } from "../lib/load";
import { STATUS, STATUS_COLOR, fmt, short, explorerAddr } from "../lib/format";
import { metaOf } from "../lib/meta";

type Data = { tender: any; status: number; bids: Bid[] };

export default function TenderDetails() {
  const { id } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    setData(null);
    setErr("");
    loadTender(Number(id))
      .then(setData)
      .catch((e: any) => setErr(e?.shortMessage ?? e?.message ?? "Failed to load"));
  }, [id]);

  const title = "Tender #" + id;
  if (err) return <PageShell title={title}><div className="card text-red-300">Could not load: {err}</div></PageShell>;
  if (!data) return <PageShell title={title}><div className="card text-ink-300">Loading from chain…</div></PageShell>;

  const t = data.tender;
  const m = metaOf(t.metadataURI);
  const weights: [string, number][] = [["Technical quality", 40], ["Relevant experience", 30], ["Delivery capability", 20], ["Price competitiveness", 10]];

  return (
    <PageShell title={title} subtitle={m.title}>
      <div className="flex items-center gap-3">
        <span className={"badge " + STATUS_COLOR[data.status]}>{STATUS[data.status]}</span>
        <Link to={"/verify/" + id} className="text-sm text-trust-400 underline">Verify this result</Link>
      </div>
      {data.status === 0 && <Link to={"/tender/" + id + "/bid"} className="btn-primary mt-4 w-full">Submit a bid</Link>}
      {data.status === 1 && <Link to={"/tender/" + id + "/bid"} className="btn-primary mt-4 w-full">Reveal your bid</Link>}
      {data.status === 2 && <Link to={"/tender/" + id + "/evaluate"} className="btn-ghost mt-4 w-full">Organizer: evaluate bids</Link>}

      <div className="card mt-4">
        <h3 className="font-semibold">Terms</h3>
        <dl className="mt-3 grid grid-cols-2 gap-3 text-sm text-ink-300">
          <div><dt>Budget</dt><dd className="text-ink-100">{t.budget.toString()} units</dd></div>
          <div><dt>Organizer</dt><dd><a className="text-trust-400 underline" href={explorerAddr(t.organizer)} target="_blank" rel="noreferrer">{short(t.organizer)}</a></dd></div>
          <div><dt>Commit by</dt><dd className="text-ink-100">{fmt(t.commitDeadline)}</dd></div>
          <div><dt>Reveal by</dt><dd className="text-ink-100">{fmt(t.revealDeadline)}</dd></div>
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
          Each score is 0–15. Total = 4×Technical + 3×Experience + 2×Delivery + Price score, computed by TapeOut circuit #{t.tapeCircuitId.toString()} on X Layer.
          A bid is eligible only if its documents were verified and its price is within budget.
        </p>
        <p className="mt-2 break-all text-xs text-ink-500">Rules hash: {t.rulesHash}</p>
      </div>

      <h3 className="mt-6 font-semibold">Bids ({data.bids.length})</h3>
      <div className="mt-3 grid gap-3">
        {data.bids.length === 0 && <div className="card text-ink-300">No bids yet.</div>}
        {data.bids.map((b) => {
          const win = t.finalized && b.bidder.toLowerCase() === t.winner.toLowerCase();
          const label = win ? "Winner" : b.evaluated ? (b.eligible ? "Evaluated" : "Not eligible") : b.revealed ? "Revealed" : "Committed";
          return (
            <div key={b.bidder} className={"card " + (win ? "border-trust-500" : "")}>
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm">{short(b.bidder)}</span>
                <span className={"badge " + (win ? "bg-trust-600/20 text-trust-400" : "bg-ink-700 text-ink-300")}>{label}</span>
              </div>
              {b.revealed ? (
                <p className="mt-2 text-sm text-ink-300">Price: <span className="text-ink-100">{b.price.toString()}</span></p>
              ) : (
                <p className="mt-2 text-sm text-ink-300">Price hidden until reveal.</p>
              )}
              {b.evaluated && (
                <p className="mt-1 text-sm text-ink-300">
                  T {b.tech} · E {b.experience} · D {b.delivery} · P {b.priceScore} → total <span className="text-ink-100">{b.total}</span>
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-6 text-xs text-ink-300">
        Documents are reviewed off-chain by the organizer. The chain proves the scoring was computed correctly, not that a supplier’s claims are true.
      </p>
    </PageShell>
  );
}
