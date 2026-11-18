import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { keccak256, toHex } from "viem";
import PageShell from "../components/PageShell";
import { deployment } from "../lib/deployment";
import { encodeMeta } from "../lib/meta";
import { connect, writeTender } from "../lib/wallet";
import { explorerTx, short } from "../lib/format";

const field = "w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-ink-100";
const label = "mb-1 block text-sm text-ink-300";

export default function Create() {
  const nav = useNavigate();
  const [account, setAccount] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eligibility, setEligibility] = useState("");
  const [budget, setBudget] = useState("1000000");
  const [commitMin, setCommitMin] = useState("10");
  const [revealMin, setRevealMin] = useState("10");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState("");
  const [err, setErr] = useState("");

  async function onConnect() {
    setErr("");
    try { setAccount(await connect()); } catch (e: any) { setErr(e?.shortMessage ?? e?.message ?? "Could not connect"); }
  }

  async function onPublish() {
    setErr(""); setMsg(""); setTx("");
    if (title.trim().length < 3 || title.length > 80) return setErr("Title must be 3 to 80 characters.");
    if (description.length > 400) return setErr("Description is limited to 400 characters.");
    if (eligibility.length > 300) return setErr("Eligibility is limited to 300 characters.");
    if (!/^\d+$/.test(budget) || Number(budget) < 100) return setErr("Budget must be a whole number of at least 100.");
    const c = Number(commitMin), r = Number(revealMin);
    if (!(c >= 3) || !(r >= 3)) return setErr("Commit and reveal windows must be at least 3 minutes.");
    setBusy(true);
    try {
      const meta = {
        v: 1,
        title: title.trim(),
        description: description.trim(),
        eligibility: eligibility.trim(),
        weights: { technical: 40, experience: 30, delivery: 20, price: 10 },
        scoring: "4T+3E+2D+P, each score 0-15",
      };
      const { uri, json } = encodeMeta(meta);
      const rulesHash = keccak256(toHex(json));
      const now = Math.floor(Date.now() / 1000);
      const commitDeadline = BigInt(now + c * 60);
      const revealDeadline = commitDeadline + BigInt(r * 60);
      setMsg("Confirm the transaction in your wallet…");
      const { hash, receipt } = await writeTender(account, "createTender", [
        uri, rulesHash, BigInt(budget), commitDeadline, revealDeadline, deployment.processor, BigInt(deployment.circuitId),
      ]);
      setTx(hash);
      const id = BigInt(receipt.logs[0].topics[1] as string);
      setMsg("Published as tender #" + id.toString());
      setTimeout(() => nav("/tender/" + id.toString()), 1800);
    } catch (e: any) {
      setMsg("");
      setErr(e?.shortMessage ?? e?.message ?? "Transaction failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageShell title="Create Tender" subtitle="Publish a tender and its scoring rules on X Layer mainnet.">
      <div className="card">
        {account ? (
          <p className="text-sm">Connected: <span className="font-mono text-trust-400">{short(account)}</span></p>
        ) : (
          <button className="btn-primary w-full" onClick={onConnect}>Connect wallet</button>
        )}
        <p className="mt-2 text-xs text-ink-300">
          Open this site in the OKX Wallet or MetaMask browser. Publishing costs a tiny amount of OKB for gas.
        </p>
      </div>

      <div className="card mt-4 space-y-4">
        <div>
          <label className={label}>Title</label>
          <input className={field} maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Supply of school furniture" />
        </div>
        <div>
          <label className={label}>Description</label>
          <textarea className={field} rows={4} maxLength={400} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div>
          <label className={label}>Minimum eligibility requirements</label>
          <textarea className={field} rows={3} maxLength={300} value={eligibility} onChange={(e) => setEligibility(e.target.value)} placeholder="Registered company, 2 years of experience…" />
        </div>
        <div>
          <label className={label}>Budget (whole units)</label>
          <input className={field} inputMode="numeric" value={budget} onChange={(e) => setBudget(e.target.value.replace(/\D/g, ""))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Bids open for (min)</label>
            <input className={field} inputMode="numeric" value={commitMin} onChange={(e) => setCommitMin(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={label}>Reveal window (min)</label>
            <input className={field} inputMode="numeric" value={revealMin} onChange={(e) => setRevealMin(e.target.value.replace(/\D/g, ""))} />
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Scoring rules (fixed)</h3>
        <p className="mt-2 text-sm text-ink-300">Technical 40% · Experience 30% · Delivery 20% · Price 10%</p>
        <p className="mt-1 text-xs text-ink-300">Computed by TapeOut circuit #{deployment.circuitId} on X Layer.</p>
        <p className="mt-3 text-xs text-ink-300">
          Title and description are stored publicly on-chain. Do not enter confidential information.
        </p>
      </div>

      {err && <div className="card mt-4 text-sm text-red-300">{err}</div>}
      {msg && <div className="card mt-4 text-sm text-trust-400">{msg}</div>}
      {tx && (
        <p className="mt-3 text-sm">
          <a className="text-trust-400 underline break-all" href={explorerTx(tx)} target="_blank" rel="noreferrer">Transaction {short(tx)}</a>
        </p>
      )}

      <button className="btn-primary mt-4 w-full disabled:opacity-50" disabled={!account || busy} onClick={onPublish}>
        {busy ? "Publishing…" : "Publish tender"}
      </button>
    </PageShell>
  );
}
