import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { publicClient, TENDER_TRUST, tenderTrustAbi } from "../lib/chain";
import { deployment } from "../lib/deployment";
import { short } from "../lib/format";

const read = (functionName: string, args: any[] = []): Promise<any> =>
  publicClient.readContract({ address: TENDER_TRUST, abi: tenderTrustAbi, functionName, args } as any);

const steps = [
  { n: "1", t: "Publish the rules", d: "The organization publishes the tender and its scoring rules on X Layer. The rules hash is recorded and cannot be changed silently." },
  { n: "2", t: "Sealed bids", d: "Suppliers commit a hash of their price and proposal, then reveal after the deadline. No bid can be changed once the deadline passes." },
  { n: "3", t: "Circuit scoring", d: "Reviewers enter scores and verify documents. A TapeOut circuit on X Layer computes the weighted total inside the transaction." },
  { n: "4", t: "Anyone can verify", d: "Anyone can recompute every score from the chain and compare it with the recorded result." },
];

type Stats = { tenders: number; bids: number; finalized: number };

export default function Home() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const count = Number(await read("tenderCount"));
        let bids = 0;
        let finalized = 0;
        for (let id = 1; id <= count && id <= 60; id++) {
          const n = BigInt(id);
          const list: string[] = await read("getBidders", [n]);
          bids += list.length;
          if (Number(await read("status", [n])) === 3) finalized++;
        }
        setStats({ tenders: count, bids, finalized });
      } catch {
        setStats(null);
      }
    })();
  }, []);

  const num = (v?: number) => (v === undefined ? "–" : String(v));

  return (
    <div>
      <section className="py-6 sm:py-12">
        <span className="badge bg-trust-600/20 text-trust-400">Verifiable procurement</span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
          Every tender has clear rules.<br />
          Every bid is traceable.<br />
          <span className="text-trust-400">Every result is verifiable.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-ink-300">
          TenderTrust helps NGOs, businesses and institutions run fair supplier selection with sealed bids and scores
          computed by a TapeOut circuit on X Layer. Anyone can recheck the result.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/create" className="btn-primary">Create Tender</Link>
          <Link to="/tenders" className="btn-ghost">Explore Tenders</Link>
          <Link to="/verify/1" className="btn-ghost">See a verified example</Link>
        </div>
      </section>

      <section className="grid grid-cols-3 gap-3">
        <div className="card text-center"><div className="text-3xl font-bold">{num(stats?.tenders)}</div><div className="text-xs text-ink-300">Tenders</div></div>
        <div className="card text-center"><div className="text-3xl font-bold">{num(stats?.bids)}</div><div className="text-xs text-ink-300">Sealed bids</div></div>
        <div className="card text-center"><div className="text-3xl font-bold">{num(stats?.finalized)}</div><div className="text-xs text-ink-300">Finalized</div></div>
      </section>
      <p className="mt-2 text-xs text-ink-300">Live from X Layer mainnet. Demo data was created with our own test wallets.</p>

      <h2 className="mt-8 text-xl font-bold">How it works</h2>
      <section className="mt-3 grid gap-4 sm:grid-cols-2">
        {steps.map((s) => (
          <div key={s.n} className="card">
            <div className="text-sm font-bold text-trust-400">Step {s.n}</div>
            <h3 className="mt-1 text-lg font-semibold">{s.t}</h3>
            <p className="mt-2 text-sm text-ink-300">{s.d}</p>
          </div>
        ))}
      </section>

      <section className="card mt-6">
        <h2 className="text-lg font-bold">Powered by a TapeOut circuit</h2>
        <p className="mt-2 text-sm text-ink-300">
          The weighted score is computed by a circuit made only of NAND gates (170 gates, 17 inputs, 8 outputs), taped out on X Layer mainnet. The contract calls it during every evaluation.
        </p>
        <p className="mt-3 break-all text-xs text-ink-300">
          Processor {short(deployment.processor)} · circuit #{deployment.circuitId} · TenderTrust contract {short(TENDER_TRUST)}
        </p>
        <Link to="/circuit" className="mt-3 mr-4 inline-block text-sm text-trust-400 underline">Inspect the circuit yourself</Link>
        <Link to="/security" className="mt-3 inline-block text-sm text-trust-400 underline">Trust and limits: what the chain proves, and what it does not</Link>
      </section>

      <section className="card mt-4">
        <h2 className="text-lg font-bold">Who it is for</h2>
        <p className="mt-2 text-sm text-ink-300">
          NGOs and development agencies that must show donors a fair selection, small businesses and institutions that buy from many suppliers, and suppliers who want proof that the rules were not changed after they bid.
        </p>
      </section>
    </div>
  );
}
