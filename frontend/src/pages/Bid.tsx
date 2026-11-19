import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { formatEther, keccak256, toHex } from "viem";
import PageShell from "../components/PageShell";
import { publicClient, TENDER_TRUST, tenderTrustAbi } from "../lib/chain";
import { loadTender } from "../lib/load";
import { connect, explainWalletError, writeTender } from "../lib/wallet";
import { STATUS, STATUS_COLOR, explorerTx, fmt, short } from "../lib/format";
import { metaOf } from "../lib/meta";

const field = "w-full rounded-xl border border-ink-600 bg-ink-900 px-4 py-3 text-ink-100";
const lbl = "mb-1 block text-sm text-ink-300";
const ZERO = "0x" + "00".repeat(32);
const keyOf = (id: string, who: string) => "tt:bid:" + TENDER_TRUST.toLowerCase() + ":" + id + ":" + who.toLowerCase();

type Saved = { price: string; proposal: string; proposalHash: string; salt: string; commitTx?: string };

const read = async (functionName: string, args: any[]): Promise<any> => {
  let last: any;
  for (let i = 0; i < 4; i++) {
    try {
      return await publicClient.readContract({ address: TENDER_TRUST, abi: tenderTrustAbi, functionName, args } as any);
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 900));
    }
  }
  throw last;
};

function loadSaved(id: string, who: string): Saved | null {
  try {
    const raw = localStorage.getItem(keyOf(id, who));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function store(id: string, who: string, rec: Saved) {
  try {
    localStorage.setItem(keyOf(id, who), JSON.stringify(rec));
  } catch {
    /* storage unavailable */
  }
}

export default function Bid() {
  const { id = "" } = useParams();
  const [tender, setTender] = useState<any>(null);
  const [status, setStatus] = useState(-1);
  const [loadErr, setLoadErr] = useState("");
  const [account, setAccount] = useState("");
  const [balance, setBalance] = useState("");
  const [onchain, setOnchain] = useState<{ committed: boolean; revealed: boolean } | null>(null);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [price, setPrice] = useState("");
  const [proposal, setProposal] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tx, setTx] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    loadTender(Number(id))
      .then((d) => { setTender(d.tender); setStatus(d.status); })
      .catch((e: any) => setLoadErr(e?.shortMessage ?? e?.message ?? "Failed to load"));
  }, [id]);

  async function refresh(a: string) {
    const b: any = await read("getBid", [BigInt(id), a]);
    setOnchain({ committed: b.commitment !== ZERO, revealed: b.revealed });
    setSaved(loadSaved(id, a));
  }

  async function onConnect() {
    setErr("");
    try {
      const a = await connect();
      setAccount(a);
      setBalance(formatEther(await publicClient.getBalance({ address: a as `0x${string}` })));
      await refresh(a).catch(() => { setSaved(loadSaved(id, a)); });
    } catch (e: any) {
      setErr(explainWalletError(e));
    }
  }

  async function onCommit() {
    setErr(""); setMsg(""); setTx("");
    const budget = BigInt(tender.budget);
    if (!/^\d+$/.test(price) || BigInt(price) < 1n || BigInt(price) > budget) {
      return setErr("Price must be a whole number between 1 and the budget (" + budget.toString() + ").");
    }
    if (proposal.trim().length < 10) return setErr("Describe your proposal (at least 10 characters).");
    setBusy(true);
    try {
      try {
        const existing: any = await read("getBid", [BigInt(id), account]);
        if (existing.commitment !== ZERO) throw new Error("ALREADY");
      } catch (e: any) {
        if (e?.message === "ALREADY") throw new Error("You already have a commitment on-chain for this tender.");
      }
      const salt = toHex(crypto.getRandomValues(new Uint8Array(32)));
      const proposalHash = keccak256(toHex(proposal.trim()));
      const commitment = await read("computeCommitment", [BigInt(id), account, BigInt(price), proposalHash, salt]);
      const rec: Saved = { price, proposal: proposal.trim(), proposalHash, salt };
      store(id, account, rec); // saved before sending, so the salt is never lost
      setMsg("Confirm the transaction in your wallet…");
      const { hash } = await writeTender("commitBid", [BigInt(id), commitment]);
      rec.commitTx = hash;
      store(id, account, rec);
      setSaved(rec);
      setTx(hash);
      setMsg("Bid committed. Keep this browser: you need it to reveal your bid.");
      setTimeout(() => { refresh(account).catch(() => {}); }, 3500);
    } catch (e: any) {
      setMsg("");
      setErr(explainWalletError(e));
    } finally {
      setBusy(false);
    }
  }

  async function onReveal() {
    if (!saved) return;
    setErr(""); setMsg(""); setTx("");
    setBusy(true);
    try {
      setMsg("Confirm the transaction in your wallet…");
      const { hash } = await writeTender("revealBid", [BigInt(id), BigInt(saved.price), saved.proposalHash, saved.salt]);
      setTx(hash);
      setMsg("Bid revealed.");
      setTimeout(() => { refresh(account).catch(() => {}); }, 3500);
    } catch (e: any) {
      setMsg("");
      setErr(explainWalletError(e));
    } finally {
      setBusy(false);
    }
  }

  async function copyBackup() {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ tender: id, contract: TENDER_TRUST, bidder: account, ...saved }, null, 2));
      setMsg("Backup copied. Keep it private until you reveal.");
    } catch {
      setErr("Could not copy.");
    }
  }

  const title = "Bid on tender #" + id;
  if (loadErr) return <PageShell title={title}><div className="card text-red-300">Could not load: {loadErr}</div></PageShell>;
  if (!tender) return <PageShell title={title}><div className="card text-ink-300">Loading from chain…</div></PageShell>;

  const m = metaOf(tender.metadataURI);
  return (
    <PageShell title={title} subtitle={m.title}>
      <div className="flex items-center gap-3">
        <span className={"badge " + STATUS_COLOR[status]}>{STATUS[status]}</span>
        <Link to={"/tender/" + id} className="text-sm text-trust-400 underline">Tender details</Link>
      </div>

      <div className="card mt-4">
        {account ? (
          <p className="text-sm">
            Connected: <span className="font-mono text-trust-400">{short(account)}</span>
            {balance && <span className="text-ink-300"> · {balance} OKB</span>}
          </p>
        ) : (
          <button className="btn-primary w-full" onClick={onConnect}>Connect wallet</button>
        )}
        <p className="mt-2 text-xs text-ink-300">
          Commit by {fmt(tender.commitDeadline)} · Reveal by {fmt(tender.revealDeadline)}. The organizer cannot bid on their own tender.
        </p>
      </div>

      {status === 0 && (
        <div className="card mt-4 space-y-4">
          <h3 className="font-semibold">Submit a sealed bid</h3>
          <div>
            <label className={lbl}>Your price (whole units, budget {tender.budget.toString()})</label>
            <input className={field} inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/\D/g, ""))} />
          </div>
          <div>
            <label className={lbl}>Proposal summary</label>
            <textarea className={field} rows={4} maxLength={500} value={proposal} onChange={(e) => setProposal(e.target.value)} />
          </div>
          <p className="text-xs text-ink-300">
            Only a hash of your price and proposal is recorded now. The text stays on this device. Send your documents to the organizer off-chain so they can review them; the hash lets them check that what you send matches your bid. A commit-reveal bid is hidden until the reveal phase, but it is not encrypted afterwards.
          </p>
          <button className="btn-primary w-full disabled:opacity-50" disabled={!account || busy || !!onchain?.committed} onClick={onCommit}>
            {busy ? "Working…" : onchain?.committed ? "Already committed" : "Commit bid"}
          </button>
        </div>
      )}

      {status === 1 && (
        <div className="card mt-4">
          <h3 className="font-semibold">Reveal your bid</h3>
          {!account && <p className="mt-2 text-sm text-ink-300">Connect the wallet you bid with.</p>}
          {account && !onchain?.committed && <p className="mt-2 text-sm text-ink-300">This wallet has no commitment on this tender.</p>}
          {account && onchain?.committed && onchain.revealed && <p className="mt-2 text-sm text-trust-400">Your bid is already revealed.</p>}
          {account && onchain?.committed && !onchain.revealed && !saved && (
            <p className="mt-2 text-sm text-red-300">No saved bid found in this browser, so it cannot be revealed from here.</p>
          )}
          {account && onchain?.committed && !onchain.revealed && saved && (
            <>
              <p className="mt-2 text-sm text-ink-300">Price {saved.price}. Proposal hash {short(saved.proposalHash)}.</p>
              <button className="btn-primary mt-4 w-full disabled:opacity-50" disabled={busy} onClick={onReveal}>
                {busy ? "Working…" : "Reveal bid"}
              </button>
            </>
          )}
        </div>
      )}

      {status >= 2 && <div className="card mt-4 text-ink-300">Bidding is closed for this tender.</div>}

      {saved && (
        <div className="card mt-4">
          <h3 className="font-semibold">Your bid receipt</h3>
          <p className="mt-2 break-all text-xs text-ink-300">Proposal hash: {saved.proposalHash}</p>
          <button className="btn-ghost mt-3 w-full" onClick={copyBackup}>Copy backup (keep private)</button>
          <p className="mt-2 text-xs text-ink-300">If this browser’s data is cleared, you can no longer reveal your bid. Keep the backup safe.</p>
        </div>
      )}

      {err && <div className="card mt-4 text-sm text-red-300">{err}</div>}
      {msg && <div className="card mt-4 text-sm text-trust-400">{msg}</div>}
      {tx && (
        <p className="mt-3 text-sm">
          <a className="break-all text-trust-400 underline" href={explorerTx(tx)} target="_blank" rel="noreferrer">Transaction {short(tx)}</a>
        </p>
      )}
    </PageShell>
  );
}
