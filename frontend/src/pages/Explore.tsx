import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import { publicClient, TENDER_TRUST as V2, tenderTrustAbi as abi2 } from "../lib/chain";
import { TENDER_TRUST as V3, tenderTrustAbi as abi3 } from "../lib/chain3";
import { STATUS, STATUS_COLOR, fmt, short } from "../lib/format";
import { metaOf } from "../lib/meta";

type Row = {
  id: number;
  link: string;
  title: string;
  budget: bigint;
  commitDeadline: bigint;
  revealDeadline: bigint;
  status: number;
  winner: string;
  winnerScore: number;
};

async function scan(address: `0x${string}`, abi: any, base: string): Promise<Row[]> {
  const call = (functionName: string, args: any[] = []): Promise<any> =>
    publicClient.readContract({ address, abi, functionName, args } as any);
  const count = Number(await call("tenderCount"));
  const out: Row[] = [];
  for (let id = count; id >= 1 && id > count - 20; id--) {
    const t: any = await call("getTender", [BigInt(id)]);
    const s: any = await call("status", [BigInt(id)]);
    out.push({
      id,
      link: base + id,
      title: metaOf(t.metadataURI).title,
      budget: t.budget,
      commitDeadline: t.commitDeadline,
      revealDeadline: t.revealDeadline,
      status: Number(s),
      winner: t.winner,
      winnerScore: Number(t.winnerScore),
    });
  }
  return out;
}

function Card({ r }: { r: Row }) {
  return (
    <Link to={r.link} className="card block hover:border-trust-500">
      <div className="flex items-center justify-between">
        <span className="font-semibold">Tender #{r.id}</span>
        <span className={"badge " + STATUS_COLOR[r.status]}>{STATUS[r.status]}</span>
      </div>
      <p className="mt-1 break-all text-sm text-ink-300">{r.title}</p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-ink-300">
        <div><dt>Budget</dt><dd className="text-ink-100">{r.budget.toString()} units</dd></div>
        <div><dt>Commit by</dt><dd className="text-ink-100">{fmt(r.commitDeadline)}</dd></div>
        <div className="col-span-2"><dt>Reveal by</dt><dd className="text-ink-100">{fmt(r.revealDeadline)}</dd></div>
      </dl>
      {r.status === 3 && <p className="mt-3 text-xs text-trust-400">Winner {short(r.winner)} with score {r.winnerScore}</p>}
    </Link>
  );
}

export default function Explore() {
  const [v3, setV3] = useState<Row[]>([]);
  const [v2, setV2] = useState<Row[]>([]);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [err, setErr] = useState("");

  useEffect(() => {
    (async () => {
      try {
        setV3(await scan(V3, abi3, "/p/tender/"));
        setV2(await scan(V2, abi2, "/tender/"));
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
      {state === "ok" && (
        <>
          <h3 className="font-semibold">Panel tenders (3 evaluators, median scores)</h3>
          <div className="mt-3 grid gap-4">
            {v3.length === 0 && <div className="card text-ink-300">No panel tenders yet.</div>}
            {v3.map((r) => <Card key={"3-" + r.id} r={r} />)}
          </div>
          <h3 className="mt-8 font-semibold">Earlier tenders (single evaluator)</h3>
          <div className="mt-3 grid gap-4">
            {v2.map((r) => <Card key={"2-" + r.id} r={r} />)}
          </div>
        </>
      )}
    </PageShell>
  );
}
