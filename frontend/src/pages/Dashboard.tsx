import { useState } from "react";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import PageShell from "../components/PageShell";
import { publicClient, TENDER_TRUST as C2, tenderTrustAbi as ABI2 } from "../lib/chain";
import { TENDER_TRUST as C3, tenderTrustAbi as ABI3 } from "../lib/chain3";
import { connect, explainWalletError } from "../lib/wallet";
import { STATUS, STATUS_COLOR, short } from "../lib/format";
import { metaOf } from "../lib/meta";

type Ver = "v2" | "v3";
type Mine = { key: string; ver: Ver; id: number; title: string; status: number; bidders: number };
type MyBid = { key: string; ver: Ver; id: number; title: string; status: number; state: string; total: number; won: boolean };
type MyEval = { id: number; title: string; status: number; todo: number };
type Data = { tenders: Mine[]; bids: MyBid[]; evals: MyEval[]; count: number };

const base = (ver: Ver, id: number) => (ver === "v3" ? "/p/tender/" : "/tender/") + id;

async function scanOne(ver: Ver, address: `0x${string}`, abi: any, addr: string, out: Data) {
  const read = (functionName: string, args: any[] = []): Promise<any> =>
    publicClient.readContract({ address, abi, functionName, args } as any);
  const count = Number(await read("tenderCount"));
  out.count += count;
  const me = addr.toLowerCase();
  for (let id = count; id >= 1 && id > count - 30; id--) {
    const n = BigInt(id);
    const t: any = await read("getTender", [n]);
    const status = Number(await read("status", [n]));
    const list: string[] = await read("getBidders", [n]);
    const title = metaOf(t.metadataURI).title;
    if (String(t.organizer).toLowerCase() === me) out.tenders.push({ key: ver + id, ver, id, title, status, bidders: list.length });
    if (list.some((a) => a.toLowerCase() === me)) {
      const b: any = await read("getBid", [n, addr]);
      const won = Boolean(t.finalized) && String(t.winner).toLowerCase() === me;
      const state = won ? "Winner" : b.evaluated ? (b.eligible ? "Evaluated" : "Not eligible") : b.revealed ? "Revealed" : "Committed";
      out.bids.push({ key: ver + id, ver, id, title, status, state, total: Number(b.total), won });
    }
    if (ver === "v3" && (await read("isEvaluator", [n, addr]))) {
      let todo = 0;
      for (const bd of list) {
        const bid: any = await read("getBid", [n, bd]);
        if (!bid.revealed || bid.evaluated) continue;
        const sc: any = await read("getScore", [n, bd, addr]);
        if (!sc.submitted) todo++;
      }
      out.evals.push({ id, title, status, todo });
    }
  }
}

export default function Dashboard() {
  const [addr, setAddr] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(a: string) {
    setErr("");
    setBusy(true);
    setData(null);
    setAddr(a);
    try {
      const out: Data = { tenders: [], bids: [], evals: [], count: 0 };
      await scanOne("v3", C3, ABI3, a, out);
      await scanOne("v2", C2, ABI2, a, out);
      setData(out);
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Failed to load");
    } finally {
      setBusy(false);
    }
  }
  async function onConnect() {
    setErr("");
    try {
      await run(await connect());
    } catch (e: any) {
      setErr(explainWalletError(e));
    }
  }
  function onView() {
    if (!isAddress(input.trim())) {
      setErr("Enter a valid 0x address.");
      return;
    }
    run(input.trim());
  }

  const wins = data ? data.bids.filter((b) => b.won).length : 0;
  const tag = (v: Ver) => <span className="badge bg-ink-700 text-ink-300">{v === "v3" ? "Panel" : "First contract"}</span>;

  return (
    <PageShell title="Dashboard" subtitle="Your tenders and bids, read live from X Layer mainnet.">
      <div className="card">
        <button className="btn-primary w-full" onClick={onConnect}>Connect wallet</button>
        <p className="mt-3 text-xs text-ink-300">Or look up any address (read-only, no wallet needed):</p>
        <div className="mt-2 flex gap-2">
          <input
            className="w-full rounded-xl border border-ink-600 bg-ink-900 px-3 py-2 font-mono text-sm text-ink-100"
            placeholder="0x…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button className="btn-ghost" onClick={onView}>View</button>
        </div>
      </div>

      {err && <div className="card mt-4 text-sm text-red-300">{err}</div>}
      {busy && <div className="card mt-4 text-ink-300">Reading the chain…</div>}

      {data && (
        <>
          <p className="mt-4 text-xs text-ink-300">
            Address <span className="font-mono">{short(addr)}</span> · {data.count} tenders on the platform
          </p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="card text-center"><div className="text-2xl font-bold">{data.tenders.length}</div><div className="text-xs text-ink-300">Tenders</div></div>
            <div className="card text-center"><div className="text-2xl font-bold">{data.bids.length}</div><div className="text-xs text-ink-300">Bids</div></div>
            <div className="card text-center"><div className="text-2xl font-bold">{wins}</div><div className="text-xs text-ink-300">Wins</div></div>
            <div className="card text-center"><div className="text-2xl font-bold">{data.evals.length}</div><div className="text-xs text-ink-300">Panels</div></div>
          </div>

          <h3 className="mt-6 font-semibold">My tenders</h3>
          <div className="mt-3 grid gap-3">
            {data.tenders.length === 0 && <div className="card text-sm text-ink-300">No tenders created by this address.</div>}
            {data.tenders.map((t) => (
              <div key={t.key} className="card">
                <div className="flex items-center justify-between gap-2">
                  <Link to={base(t.ver, t.id)} className="font-semibold text-trust-400 underline">#{t.id} {t.title}</Link>
                  <span className={"badge " + STATUS_COLOR[t.status]}>{STATUS[t.status]}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">{tag(t.ver)}<span className="text-xs text-ink-300">{t.bidders} bid(s)</span></div>
                {t.status === 2 && t.ver === "v2" && <Link to={"/tender/" + t.id + "/evaluate"} className="btn-ghost mt-3 w-full">Evaluate bids</Link>}
                {t.status === 2 && t.ver === "v3" && <Link to={"/p/tender/" + t.id + "/evaluate"} className="btn-ghost mt-3 w-full">Panel: score, settle and finalize</Link>}
              </div>
            ))}
          </div>

          <h3 className="mt-6 font-semibold">My bids</h3>
          <div className="mt-3 grid gap-3">
            {data.bids.length === 0 && <div className="card text-sm text-ink-300">No bids placed by this address.</div>}
            {data.bids.map((b) => (
              <div key={b.key} className={"card " + (b.won ? "border-trust-500" : "")}>
                <div className="flex items-center justify-between gap-2">
                  <Link to={base(b.ver, b.id)} className="font-semibold text-trust-400 underline">#{b.id} {b.title}</Link>
                  <span className={"badge " + (b.won ? "bg-trust-600/20 text-trust-400" : "bg-ink-700 text-ink-300")}>{b.state}</span>
                </div>
                <div className="mt-2 flex items-center gap-2">{tag(b.ver)}<span className="text-xs text-ink-300">{STATUS[b.status]}</span></div>
                {b.status === 1 && b.state === "Committed" && <Link to={base(b.ver, b.id) + "/bid"} className="btn-primary mt-3 w-full">Reveal your bid</Link>}
              </div>
            ))}
          </div>

          <h3 className="mt-6 font-semibold">As evaluator</h3>
          <div className="mt-3 grid gap-3">
            {data.evals.length === 0 && <div className="card text-sm text-ink-300">Not on any panel.</div>}
            {data.evals.map((e) => (
              <div key={e.id} className="card">
                <div className="flex items-center justify-between gap-2">
                  <Link to={"/p/tender/" + e.id} className="font-semibold text-trust-400 underline">#{e.id} {e.title}</Link>
                  <span className={"badge " + STATUS_COLOR[e.status]}>{STATUS[e.status]}</span>
                </div>
                <p className="mt-2 text-xs text-ink-300">
                  {e.todo > 0 ? (<><span>{e.todo}</span> bid(s) waiting for your scores</>) : "Nothing waiting for you"}
                </p>
                {e.status >= 2 && e.todo > 0 && <Link to={"/p/tender/" + e.id + "/evaluate"} className="btn-primary mt-3 w-full">Score the bids</Link>}
              </div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
