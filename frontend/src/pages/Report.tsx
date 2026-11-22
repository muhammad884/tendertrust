import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { loadTender as loadV2, previewScore as prevV2, formula } from "../lib/load";
import { loadTender as loadV3, loadPanel, previewScore as prevV3 } from "../lib/load3";
import type { Bid, PanelScore } from "../lib/load3";
import { TENDER_TRUST as C2 } from "../lib/chain";
import { TENDER_TRUST as C3 } from "../lib/chain3";
import { deployment as d2, evidenceByTender as e2 } from "../lib/deployment";
import { deployment as d3, evidenceByTender as e3 } from "../lib/deployment3";
import { STATUS, fmt, short } from "../lib/format";
import { metaOf } from "../lib/meta";

type Check = { bidder: string; recorded: number; circuit: number | null; formula: number };

const Row = ({ k, v }: { k: string; v: string }) => (
  <div className="mt-1 break-all"><span className="text-slate-600">{k}: </span>{v}</div>
);

export default function Report() {
  const { ver = "v3", id = "" } = useParams();
  const v3 = ver === "v3";
  const [data, setData] = useState<any>(null);
  const [checks, setChecks] = useState<Check[]>([]);
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const n = Number(id);
        const d: any = await (v3 ? loadV3(n) : loadV2(n));
        let panel: any = null;
        if (v3) panel = await loadPanel(n, d.bids.map((b: Bid) => b.bidder));
        setData({ ...d, panel });
        const out: Check[] = [];
        for (const b of d.bids as Bid[]) {
          if (!b.evaluated) continue;
          let circuit: number | null = null;
          try { circuit = await (v3 ? prevV3(n, b) : prevV2(n, b)); } catch { circuit = null; }
          out.push({ bidder: b.bidder, recorded: b.total, circuit, formula: formula(b.tech, b.experience, b.delivery, b.priceScore, b.eligible) });
        }
        setChecks(out);
      } catch (e: any) {
        setErr(e?.shortMessage ?? e?.message ?? "Failed to load");
      }
    })();
  }, [id, v3]);

  if (err) return <div className="card text-red-300">Could not load: {err}</div>;
  if (!data) return <div className="card text-ink-300">Building the report from the chain…</div>;

  const t = data.tender;
  const m = metaOf(t.metadataURI);
  const dep: any = v3 ? d3 : d2;
  const ev: any = ((v3 ? e3 : e2) as any)[String(id)];
  const stamp = new Date().toLocaleString();
  const finished = Boolean(t.finalized);

  return (
    <div>
      <div className="no-print mb-3">
        <button className="btn-primary w-full" onClick={() => window.print()}>Print or save as PDF</button>
      </div>
      <article className="rounded-2xl bg-white p-5 text-sm text-slate-900">
        <h1 className="text-xl font-bold">TenderTrust audit report</h1>
        <p className="mt-1 text-slate-600">Tender #{id} · {m.title}</p>
        <p className="text-xs text-slate-600">
          Read live from X Layer mainnet (chain ID 196) on {stamp}. {v3 ? "Panel of 3 evaluators, median scores." : "Single evaluator (the organizer)."}
        </p>

        <h2 className="mt-4 font-bold">1. Tender</h2>
        <Row k="Contract" v={v3 ? C3 : C2} />
        <Row k="Status" v={STATUS[data.status]} />
        <Row k="Organizer" v={t.organizer} />
        <Row k="Budget" v={t.budget.toString() + " units"} />
        <Row k="Commit deadline" v={fmt(t.commitDeadline)} />
        <Row k="Reveal deadline" v={fmt(t.revealDeadline)} />
        {v3 && <Row k="Scoring deadline" v={fmt(t.evalDeadline)} />}
        {m.description && <Row k="Description" v={m.description} />}
        {m.eligibility && <Row k="Eligibility" v={m.eligibility} />}

        <h2 className="mt-4 font-bold">2. Rules and circuit</h2>
        <Row k="Weights" v="Technical 40%, Experience 30%, Delivery 20%, Price 10%" />
        <Row k="Formula" v="4 x Technical + 3 x Experience + 2 x Delivery + Price score; 0 if not eligible" />
        <Row k="Rules hash" v={t.rulesHash} />
        <Row k="TapeOut processor" v={t.tapeProcessor} />
        <Row k="Circuit ID" v={t.tapeCircuitId.toString()} />

        {v3 && (
          <>
            <h2 className="mt-4 font-bold">3. Evaluator panel</h2>
            {data.panel.evaluators.map((a: string, i: number) => <Row key={a} k={"Evaluator " + (i + 1)} v={a} />)}
          </>
        )}

        <h2 className="mt-4 font-bold">{v3 ? "4" : "3"}. Bids ({data.bids.length})</h2>
        {data.bids.map((b: Bid) => {
          const sc: PanelScore[] = v3 ? (data.panel.scores[b.bidder] ?? []).filter((s: PanelScore) => s.submitted) : [];
          return (
            <div key={b.bidder} className="mt-3 rounded-lg border border-slate-300 p-3">
              <Row k="Bidder" v={b.bidder} />
              <Row k="Commitment" v={b.commitment} />
              {b.revealed && <Row k="Proposal hash" v={b.proposalHash} />}
              <Row k="Price" v={b.revealed ? b.price.toString() : "not revealed"} />
              {sc.map((s) => (
                <Row
                  key={s.evaluator}
                  k={"Evaluator " + short(s.evaluator)}
                  v={`T ${s.tech}, E ${s.experience}, D ${s.delivery}, documents ${s.docsVerified ? "verified" : "not verified"}, rationale hash ${s.justification}`}
                />
              ))}
              {b.evaluated && (
                <Row
                  k={v3 ? "Median scores and total" : "Scores and total"}
                  v={`T ${b.tech}, E ${b.experience}, D ${b.delivery}, price score ${b.priceScore}, total ${b.total}, ${b.eligible ? "eligible" : "not eligible"}`}
                />
              )}
            </div>
          );
        })}

        <h2 className="mt-4 font-bold">{v3 ? "5" : "4"}. Recalculation</h2>
        {checks.length === 0 && <div className="mt-1 text-slate-600">No evaluated bids yet.</div>}
        {checks.map((c) => {
          const ok = c.circuit !== null && c.circuit === c.recorded && c.formula === c.recorded;
          return (
            <Row key={c.bidder} k={short(c.bidder)} v={`recorded ${c.recorded}, circuit ${c.circuit === null ? "n/a" : c.circuit}, formula ${c.formula} → ${ok ? "MATCH" : "CHECK"}`} />
          );
        })}

        <h2 className="mt-4 font-bold">{v3 ? "6" : "5"}. Result</h2>
        <Row k="Winner" v={finished ? t.winner + " with score " + Number(t.winnerScore) : "not finalized yet"} />

        {ev && (
          <>
            <h2 className="mt-4 font-bold">{v3 ? "7" : "6"}. Transactions</h2>
            {Object.entries(ev.txs as Record<string, string>).map(([k, h]) => <Row key={k} k={k} v={h} />)}
            <Row k="Circuit tapeout" v={dep.tapeoutTx} />
          </>
        )}

        <p className="mt-5 text-xs text-slate-600">
          How to verify: read the contract and the circuit from X Layer, recompute each total with previewScore or with eval on the TapeOut processor, and compare with the recorded value. The circuit proves the scoring formula ran on the given inputs. It cannot prove that documents or claims are true; evaluators review evidence off-chain. This is an unaudited MVP and the demo data was created with test wallets.
        </p>
      </article>
    </div>
  );
}
