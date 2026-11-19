import { useState } from "react";
import { Link } from "react-router-dom";
import { isAddress } from "viem";
import PageShell from "../components/PageShell";
import { publicClient, TENDER_TRUST, tenderTrustAbi } from "../lib/chain";
import { connect, explainWalletError } from "../lib/wallet";
import { STATUS, STATUS_COLOR, short } from "../lib/format";
import { metaOf } from "../lib/meta";

const read = (functionName: string, args: any[] = []): Promise<any> =>
  publicClient.readContract({ address: TENDER_TRUST, abi: tenderTrustAbi, functionName, args } as any);

type Mine = { id: number; title: string; status: number; bidders: number };
type MyBid = { id: number; title: string; status: number; state: string; total: number; won: boolean };
type DashData = { tenders: Mine[]; bids: MyBid[]; count: number };

async function scan(addr: string): Promise<DashData> {
  const count = Number(await read("tenderCount"));
  const tenders: Mine[] = [];
  const bids: MyBid[] = [];
  const me = addr.toLowerCase();
  for (let id = count; id >= 1 && id > count - 40; id--) {
    const n = BigInt(id);
    const t: any = await read("getTender", [n]);
    const status = Number(await read("status", [n]));
    const list: string[] = await read("getBidders", [n]);
    const title = metaOf(t.metadataURI).title;
    if (String(t.organizer).toLowerCase() === me) tenders.push({ id, title, status, bidders: list.length });
    if (list.some((a) => a.toLowerCase() === me)) {
      const b: any = await read("getBid", [n, addr]);
      const won = Boolean(t.finalized) && String(t.winner).toLowerCase() === me;
      const state = won ? "Winner" : b.evaluated ? (b.eligible ? "Evaluated" : "Not eligible") : b.revealed ? "Revealed" : "Committed";
      bids.push({ id, title, status, state, total: Number(b.total), won });
    }
  }
  return { tenders, bids, count };
}

export default function Dashboard() {
  const [addr, setAddr] = useState("");
  const [input, setInput] = useState("");
  const [data, setData] = useState<DashData | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run(a: string) {
    setErr("");
    setBusy(true);
    setData(null);
    try {
      setAddr(a);
      setData(await scan(a));
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
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="card text-center"><div className="text-2xl font-bold">{data.tenders.length}</div><div className="text-xs text-ink-300">Tenders</div></div>
            <div className="card text-center"><div className="text-2xl font-bold">{data.bids.length}</div><div className="text-xs text-ink-300">Bids</div></div>
            <div className="card text-center"><div className="text-2xl font-bold">{wins}</div><div className="text-xs text-ink-300">Wins</div></div>
          </div>

          <h3 className="mt-6 font-semibold">My tenders</h3>
          <div className="mt-3 grid gap-3">
            {data.tenders.length === 0 && <div className="card text-sm text-ink-300">No tenders created by this address.</div>}
            {data.tenders.map((t) => (
              <div key={t.id} className="card">
                <div className="flex items-center justify-between">
                  <Link to={"/tender/" + t.id} className="font-semibold text-trust-400 underline">#{t.id} {t.title}</Link>
                  <span className={"badge " + STATUS_COLOR[t.status]}>{STATUS[t.status]}</span>
                </div>
                <p className="mt-1 text-xs text-ink-300">{t.bidders} bid(s)</p>
                {t.status === 2 && <Link to={"/tender/" + t.id + "/evaluate"} className="btn-ghost mt-3 w-full">Evaluate bids</Link>}
              </div>
            ))}
          </div>

          <h3 className="mt-6 font-semibold">My bids</h3>
          <div className="mt-3 grid gap-3">
            {data.bids.length === 0 && <div className="card text-sm text-ink-300">No bids placed by this address.</div>}
            {data.bids.map((b) => (
              <div key={b.id} className={"card " + (b.won ? "border-trust-500" : "")}>
                <div className="flex items-center justify-between">
                  <Link to={"/tender/" + b.id} className="font-semibold text-trust-400 underline">#{b.id} {b.title}</Link>
                  <span className={"badge " + (b.won ? "bg-trust-600/20 text-trust-400" : "bg-ink-700 text-ink-300")}>{b.state}</span>
                </div>
                <p className="mt-1 text-xs text-ink-300">Tender status: {STATUS[b.status]}{b.state === "Evaluated" || b.won ? " · score " + b.total : ""}</p>
                {b.status === 1 && b.state === "Committed" && <Link to={"/tender/" + b.id + "/bid"} className="btn-primary mt-3 w-full">Reveal your bid</Link>}
              </div>
            ))}
          </div>
        </>
      )}
    </PageShell>
  );
}
