import { useState } from "react";
import { decodeFunctionData } from "viem";
import { publicClient, tenderTrustAbi } from "../lib/chain";
import { tenderTrustAbi as abi3 } from "../lib/TenderTrustV3.abi";
import { explorerTx, short } from "../lib/format";

type Info = { method: string; from: string; to: string; block: string; time: string; status: string; gas: string };

export default function TxDetails({ label, hash }: { label: string; hash: string }) {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<Info | null>(null);
  const [err, setErr] = useState("");

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next || info) return;
    setErr("");
    try {
      const h = hash as `0x${string}`;
      const tx: any = await publicClient.getTransaction({ hash: h });
      const rc: any = await publicClient.getTransactionReceipt({ hash: h });
      const blk: any = await publicClient.getBlock({ blockNumber: rc.blockNumber });
      let method = "contract call";
      try {
        try {
          method = decodeFunctionData({ abi: tenderTrustAbi, data: tx.input }).functionName;
        } catch {
          method = decodeFunctionData({ abi: abi3, data: tx.input }).functionName;
        }
      } catch {
        /* not a TenderTrust function */
      }
      setInfo({
        method,
        from: tx.from,
        to: tx.to ?? "",
        block: rc.blockNumber.toString(),
        time: new Date(Number(blk.timestamp) * 1000).toLocaleString(),
        status: rc.status,
        gas: rc.gasUsed.toString(),
      });
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Could not load this transaction");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <span>{label}: <span className="font-mono text-ink-300">{short(hash)}</span></span>
        <button className="text-xs text-trust-400 underline" onClick={toggle}>{open ? "Hide" : "Details"}</button>
      </div>
      {open && (
        <div className="mt-2 rounded-xl border border-ink-700 p-3 text-xs text-ink-300">
          {err && <p className="text-red-300">{err}</p>}
          {!info && !err && <p>Reading from the chain…</p>}
          {info && (
            <div className="space-y-1">
              <div>Function: <span className="text-ink-100">{info.method}</span></div>
              <div>Status: <span className={info.status === "success" ? "text-trust-400" : "text-red-300"}>{info.status}</span></div>
              <div>Block: <span className="text-ink-100">{info.block}</span> · {info.time}</div>
              <div className="break-all">From: {info.from}</div>
              <div className="break-all">To: {info.to}</div>
              <div>Gas used: {info.gas}</div>
            </div>
          )}
          <p className="mt-2 break-all">Hash: {hash}</p>
          <a className="mt-1 inline-block text-trust-400 underline" href={explorerTx(hash)} target="_blank" rel="noreferrer">Open in explorer</a>
        </div>
      )}
    </div>
  );
}
