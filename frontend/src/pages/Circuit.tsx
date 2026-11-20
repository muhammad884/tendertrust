import { useState } from "react";
import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import { deployment } from "../lib/deployment";
import { checkCircuit } from "../lib/circuit";
import type { Report } from "../lib/circuit";

const badge = (ok: boolean) => (
  <span className={"badge " + (ok ? "bg-trust-600/20 text-trust-400" : "bg-red-500/20 text-red-300")}>{ok ? "MATCH" : "CHECK"}</span>
);

export default function Circuit() {
  const [report, setReport] = useState<Report | null>(null);
  const [step, setStep] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setErr("");
    setReport(null);
    setBusy(true);
    try {
      setReport(await checkCircuit(setStep));
    } catch (e: any) {
      setErr(e?.shortMessage ?? e?.message ?? "Check failed");
    } finally {
      setBusy(false);
      setStep("");
    }
  }

  const allOk = !!report && report.allChecked > 0 && report.allMatch === report.allChecked;
  const chainOk = !!report && report.chainChecked > 0 && report.chainMatch === report.chainChecked;

  return (
    <PageShell title="Inspect the circuit" subtitle="Rebuild the scoring circuit from the bytes stored on X Layer and test it yourself.">
      <div className="card">
        <p className="text-sm text-ink-300">
          The score is computed by a circuit made only of NAND gates. This page reads its netlist from the chain, rebuilds it in your browser, and tests every possible input against the published formula:
          total = 4×Technical + 3×Experience + 2×Delivery + Price score, and 0 if the bid is not eligible. You do not have to trust our code.
        </p>
        <p className="mt-3 break-all text-xs text-ink-300">Processor: {deployment.processor} · circuit #{deployment.circuitId}</p>
        <button className="btn-primary mt-4 w-full disabled:opacity-50" disabled={busy} onClick={run}>
          {busy ? step || "Working…" : "Run the check"}
        </button>
      </div>

      {err && <div className="card mt-4 text-sm text-red-300">{err}</div>}

      {report && (
        <div className="card mt-4 space-y-4 text-sm">
          <div>
            <div className="text-ink-300">Rebuilt from the chain</div>
            <div className="text-ink-100">{report.gateCount} NAND gates · {report.nIn} inputs · {report.nOut} outputs · {report.nState} state bits</div>
            <div className="mt-1 break-all text-xs text-ink-300">{report.netlistBytes} bytes · hash {report.netlistHash}</div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-ink-300">Same bytes as the netlist file in our repository</span>
            {badge(report.sameAsRepo)}
          </div>
          {report.note && <p className="text-red-300">{report.note}</p>}
          {report.parsed && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-ink-300">All {report.allChecked.toLocaleString()} inputs vs the formula<br /><span className="text-ink-100">{report.allMatch.toLocaleString()} / {report.allChecked.toLocaleString()}</span></span>
                {badge(allOk)}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-ink-300">Live eval() on-chain vs your browser (random samples)<br /><span className="text-ink-100">{report.chainMatch} / {report.chainChecked}</span></span>
                {badge(chainOk)}
              </div>
              <p className={allOk && chainOk ? "text-trust-400" : "text-red-300"}>
                {allOk && chainOk
                  ? "Verified: the circuit stored on X Layer implements exactly the published scoring formula for every input."
                  : "Something did not match. Run the check again, and report it if it persists."}
              </p>
            </>
          )}
          <p className="text-xs text-ink-300">
            The browser test covers every input. The on-chain comparison uses random samples only: it shows the live processor agrees with your browser, not a proof for all inputs.
          </p>
        </div>
      )}
      <p className="mt-4 text-sm"><Link to="/verify/1" className="text-trust-400 underline">See a verified tender</Link></p>
    </PageShell>
  );
}
