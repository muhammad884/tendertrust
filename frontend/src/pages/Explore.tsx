import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import { publicClient, TENDER_TRUST, tenderTrustAbi } from "../lib/chain";
import { STATUS, STATUS_COLOR, fmt, short } from "../lib/format";
import { titleOf } from "../lib/meta";

type Row = {
  id: number;
  uri: string;
  budget: bigint;
  commitDeadline: bigint;
  revealDeadline: bigint;
  status: number;
  winner: string;
  winnerScore: number;
  circuitId: bigint;
};

export default function Explore() {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const count = Number(
          await publicClient.readContract({ address: TENDER_TRUST, abi: tenderTrustAbi, functionName: "tenderCount" }),
        );
        const out: Row[] = [];
        for (let id = count; id >= 1 && id > count - 20; id--) {
          const t: any = await publicClient.readContract({
            address: TENDER_TRUST, abi: tenderTrustAbi, functionName: "getTender", args: [BigInt(id)],
          });
          const s: any = await publicClient.readContract({
            address: TENDER_TRUST, abi: tenderTrustAbi, functionName: "status", args: [BigInt(id)],
          });
          out.push({
            id,
            uri: t.metadataURI,
            budget: t.budget,
            commitDeadline: t.commitDeadline,
            revealDeadline: t.revealDeadline,
            status: Number(s),
            winner: t.winner,
            winnerScore: Number(t.winnerScore),
            circuitId: t.tapeCircuitId,
          });
        }
        setRows(out);
        setState("ok");
      } catch (e: any) {
        setErr(e?.shortMessage ?? e?.message ?? "Failed to load");
        setState("error");
      }
    })();
  }, []);

  return (
    <PageShell title="Explore Tenders" subtitle="Live from X Layer mainnet.">
      {state === "loading" && <div className="card text-ink-300">Loading from chain…</div>}
      {state === "error" && <div className="card text-red-300">Could not load: {err}</div>}
      {state === "ok" && rows.length === 0 && <div className="card text-ink-300">No tenders yet.</div>}
      <div className="grid gap-4">
        {rows.map((r) => (
          <Link key={r.id} to={"/tender/" + r.id} className="card block hover:border-trust-500">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Tender #{r.id}</span>
              <span className={"badge " + STATUS_COLOR[r.status]}>{STATUS[r.status]}</span>
            </div>
            <p className="mt-1 break-all text-sm text-ink-300">{titleOf(r.uri)}</p>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-300">
              <div><dt>Budget</dt><dd className="text-ink-100">{r.budget.toString()} units</dd></div>
              <div><dt>Scoring</dt><dd className="text-ink-100">TapeOut circuit #{r.circuitId.toString()}</dd></div>
              <div><dt>Commit by</dt><dd className="text-ink-100">{fmt(r.commitDeadline)}</dd></div>
              <div><dt>Reveal by</dt><dd className="text-ink-100">{fmt(r.revealDeadline)}</dd></div>
            </dl>
            {r.status === 3 && (
              <p className="mt-3 text-xs text-trust-400">Winner {short(r.winner)} with score {r.winnerScore}</p>
            )}
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
