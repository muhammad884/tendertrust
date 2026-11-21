import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import PageShell from "../components/PageShell";
import PBidEval from "../components/PBidEval";
import { loadPanel, loadTender } from "../lib/load3";
import type { Bid, PanelScore } from "../lib/load3";
import { connect, explainWalletError, writeTender } from "../lib/wallet3";
import { STATUS, STATUS_COLOR, short } from "../lib/format";
import { metaOf } from "../lib/meta";

type Data = { tender: any; status: number; bids: Bid[]; evaluators: string[]; scores: Record<string, PanelScore[]> };

export default function PEvaluate() {
  const { id = "" } = useParams();
  const [data, setData] = useState<Data | null>(null);
  const [account, setAccount] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
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
  useEffect(() => { load(); }, [load]);
  const later = () => { setTimeout(load, 3500); };

  async function onConnect() {
    setErr("");
    try { setAccount(await connect()); } catch (e: any) { setErr(explainWalletError(e)); }
  }
  async function act(fn: string, args: any[]) {
    setErr("");
    setBusy(true);
    try {
      await writeTender(fn, args);
      later();
    } catch (e: any) {
      setErr(explainWalletError(e));
    } finally {
      setBusy(false);
    }
  }

  const title = "Panel scoring · tender #" + id;
  if (!data) {
    return <PageShell title={title}>{err ? <div className="card text-red-300">Could not load: {err}</div> : <div className="card text-ink-300">Loading from chain…</div>}</PageShell>;
  }

  const t = data.tender;
  const me = account.toLowerCase();
  const isEval = account !== "" && data.evaluators.some((a) => a.toLowerCase() === me);
  const nowSec = Math.floor(Date.now() / 1000);
  const afterEval = nowSec >= Number(t.evalDeadline);
  const graceOver = nowSec >= Number(t.evalDeadline) + 86400;
  const revealed = data.bids.filter((b) => b.revealed);
  const unsettled = revealed.filter((b) => !b.evaluated);
  const list = (b: Bid) => data.scores[b.bidder] ?? [];
  const count = (b: Bid) => list(b).filter((s) => s.submitted).length;
  const mine = (b: Bid) => list(b).some((s) => s.submitted && s.evaluator.toLowerCase() === me);
  const canSettle = (b: Bid) => !b.evaluated && (count(b) === 3 || (afterEval && count(b) >= 2));
  const canFinalize = data.status === 2 && revealed.length > 0 && (unsettled.length === 0 || graceOver);

  return (
    <PageShell title={title} subtitle={metaOf(t.metadataURI).title}>
      <div className="flex items-center gap-3">
        <span className={"badge " + STATUS_COLOR[data.status]}>{STATUS[data.status]}</span>
        <Link to={"/p/tender/" + id} className="text-sm text-trust-400 underline">Tender details</Link>
      </div>

      <div className="card mt-4">
        {account ? (
          <p className="text-sm">Connected: <span className="font-mono text-trust-400">{short(account)}</span>{isEval ? " (evaluator)" : ""}</p>
        ) : (
          <button className="btn-primary w-full" onClick={onConnect}>Connect evaluator wallet</button>
        )}
        {account && !isEval && <p className="mt-2 text-sm text-ink-300">This wallet is not on the panel. You can still settle bids and finalize when they are ready.</p>}
        <p className="mt-2 text-xs text-ink-300">Panel: {data.evaluators.map((a) => short(a)).join(" · ")}</p>
      </div>

      {data.status < 2 && <div className="card mt-4 text-ink-300">Scoring opens after the reveal deadline.</div>}

      {data.status >= 2 && isEval && unsettled.map((b) => (
        mine(b)
          ? <div key={b.bidder} className="card mt-3 text-sm text-ink-300"><span className="font-mono">{short(b.bidder)}</span> · you already scored this bid ✓</div>
          : <PBidEval key={b.bidder} id={id} bid={b} onDone={later} />
      ))}

      {data.status >= 2 && revealed.map((b) => (
        <div key={"s-" + b.bidder} className="card mt-3 text-sm text-ink-300">
          <span className="font-mono">{short(b.bidder)}</span> · evaluations {count(b)} of 3 · {b.evaluated ? "settled, total " + b.total : "not settled"}
          {canSettle(b) && (
            <button className="btn-ghost mt-2 w-full disabled:opacity-50" disabled={busy || !account} onClick={() => act("settleBid", [BigInt(id), b.bidder])}>
              Settle this bid (circuit computes the total)
            </button>
          )}
        </div>
      ))}

      {canFinalize && (
        <button className="btn-primary mt-4 w-full disabled:opacity-50" disabled={busy || !account} onClick={() => act("finalize", [BigInt(id)])}>
          {busy ? "Working…" : "Finalize and pick the winner"}
        </button>
      )}
      {data.status === 3 && (
        <p className="mt-4 text-sm">
          Winner: <span className="font-mono text-trust-400">{short(t.winner)}</span> with score {Number(t.winnerScore)} ·{" "}
          <Link to={"/p/verify/" + id} className="text-trust-400 underline">Verify</Link>
        </p>
      )}
      {err && <div className="card mt-4 text-sm text-red-300">{err}</div>}
      <button className="btn-ghost mt-4 w-full" onClick={load}>Refresh</button>
    </PageShell>
  );
}
