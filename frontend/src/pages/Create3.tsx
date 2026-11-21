import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { formatEther, isAddress, keccak256, toHex } from "viem";
import PageShell from "../components/PageShell";
import { deployment } from "../lib/deployment3";
import { publicClient } from "../lib/chain3";
import { encodeMeta } from "../lib/meta";
import { connect, explainWalletError, writeTender } from "../lib/wallet3";
import { explorerTx, short } from "../lib/format";

const field = "w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-ink-100";
const label = "mb-1 block text-sm text-ink-300";

export default function Create3() {
  const nav = useNavigate();
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [budget, setBudget] = useState("1000000");
  const [commitMin, setCommitMin] = useState("10");
  const [revealMin, setRevealMin] = useState("8");
  const [evalMin, setEvalMin] = useState("15");
  const [ev, setEv] = useState(["", "", ""]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState("");
  const [err, setErr] = useState("");

  async function onConnect() {
    setErr("");
    try {
      const a = await connect();
      setAccount(a);
      setBalance(formatEther(await publicClient.getBalance({ address: a as `0x${string}` })));
    } catch (e: any) {
      setErr(explainWalletError(e));
    }
  }

  function setOne(i: number, v: string) {
    setEv(ev.map((x, k) => (k === i ? v : x)));
  }

  async function onPublish() {
    setErr(""); setMsg(""); setTx("");
    if (title.trim().length < 3 || title.length > 80) return setErr("Title must be 3 to 80 characters.");
    if (description.length > 400) return setErr("Description is limited to 400 characters.");
    if (eligibility.length > 300) return setErr("Eligibility is limited to 300 characters.");
    if (!/^\d+$/.test(budget) || Number(budget) < 100) return setErr("Budget must be a whole number of at least 100.");
    const c = Number(commitMin), r = Number(revealMin), e = Number(evalMin);
    if (!(c >= 3) || !(r >= 3) || !(e >= 5)) return setErr("Commit and reveal windows need at least 3 minutes, and evaluation at least 5.");
    const evs = ev.map((x) => x.trim().toLowerCase());
    if (!evs.every((x) => isAddress(x))) return setErr("Enter three valid evaluator addresses (0x…).");
    if (new Set(evs).size !== 3) return setErr("The three evaluators must be different addresses.");
    setBusy(true);
    try {
      const meta = {
        v: 3,
        title: title.trim(),
        description: description.trim(),
        eligibility: eligibility.trim(),
        weights: { technical: 40, experience: 30, delivery: 20, price: 10 },
        scoring: "median of 3 evaluators, then 4T+3E+2D+P (each 0-15) computed by a TapeOut circuit",
        evaluators: evs,
      };
      const { uri, json } = encodeMeta(meta);
      const rulesHash = keccak256(toHex(json));
      const now = Math.floor(Date.now() / 1000);
      const commitDeadline = BigInt(now + c * 60);
      const revealDeadline = commitDeadline + BigInt(r * 60);
      const evalDeadline = revealDeadline + BigInt(e * 60);
      setMsg("Confirm the transaction in your wallet…");
      const { hash, receipt } = await writeTender("createTender", [{
        metadataURI: uri,
        rulesHash,
        budget: BigInt(budget),
        commitDeadline,
        revealDeadline,
        evalDeadline,
        tapeProcessor: deployment.processor,
        tapeCircuitId: BigInt(deployment.circuitId),
        evaluators: evs,
      }]);
      setTx(hash);
      const id = BigInt(receipt.logs[0].topics[1] as string);
      setMsg("Published as tender #" + id.toString());
      setTimeout(() => nav("/p/tender/" + id.toString()), 1800);
    } catch (e: any) {
      setMsg("");
      setErr(explainWalletError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Create Tender" subtitle="Publish a tender with a panel of three evaluators on X Layer mainnet.">
      <div className="card">
        {account ? (
          <p className="text-sm">Connected: <span className="font-mono text-trust-400">{short(account)}</span>{balance && <span className="text-ink-300"> · {balance} OKB</span>}</p>
        ) : (
          <button className="btn-primary w-full" onClick={onConnect}>Connect wallet</button>
        )}
        <p className="mt-2 text-xs text-ink-300">Open this site in a browser with MetaMask or OKX Wallet. Publishing costs a tiny amount of OKB for gas.</p>
      </div>

      <div className="card mt-4 space-y-4">
        <div>
          <label className={label}>Title</label>
          <input className={field} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <label className={label}>Description</label>
          <textarea className={field} rows={4} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={label}>Minimum eligibility requirements</label>
          <textarea className={field} rows={3} maxLength={300} value={eligibility} onChange={(e) => setEligibility(e.target.value)} />
        </div>
        <div>
          <label className={label}>Budget (whole units)</label>
          <input className={field} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={label}>Bids (min)</label>
            <input className={field} inputMode="numeric" value={commitMin} onChange={(e) => setCommitMin(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={label}>Reveal (min)</label>
            <input className={field} inputMode="numeric" value={revealMin} onChange={(e) => setRevealMin(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={label}>Scoring (min)</label>
            <input className={field} inputMode="numeric" value={evalMin} onChange={(e) => setEvalMin(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Evaluator panel (3 addresses)</h3>
        <p className="mt-1 text-xs text-ink-300">
          Evaluators score each bid and give a written rationale. The median of each criterion is used. Evaluators cannot bid on this tender, and should be independent of the organizer and of the bidders.
        </p>
        {[0, 1, 2].map((i) => (
          <input
            key={i}
            className={field + " mt-3 font-mono text-sm"}
            placeholder={"Evaluator " + (i + 1) + " address (0x…)"}
            value={ev[i]}
            onChange={(e) => setOne(i, e.target.value)}
          />
        ))}
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Scoring rules (fixed)</h3>
        <p className="mt-2 text-sm text-ink-300">Technical 40% · Experience 30% · Delivery 20% · Price 10%</p>
        <p className="mt-1 text-xs text-ink-300">Totals are computed by TapeOut circuit #{deployment.circuitId} on X Layer. Title, description and evaluator addresses are stored publicly on-chain.</p>
      </div>

      {err && <div className="card mt-4 text-sm text-red-300">{err}</div>}
      {msg && <div className="card mt-4 text-sm text-trust-400">{msg}</div>}
      {tx && (
        <p className="mt-3 text-sm">
          <a className="break-all text-trust-400 underline" href={explorerTx(tx)} target="_blank" rel="noreferrer">Transaction {short(tx)}</a>
        </p>
      )}
      <button className="btn-primary mt-4 w-full disabled:opacity-50" disabled={!account || busy} onClick={onPublish}>
        {busy ? "Publishing…" : "Publish tender"}
      </button>
    </PageShell>
  );
}
