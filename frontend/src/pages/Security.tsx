import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import { TENDER_TRUST as V2 } from "../lib/chain";
import { TENDER_TRUST as V3 } from "../lib/chain3";
import { deployment } from "../lib/deployment3";

const list = "mt-3 list-disc space-y-2 pl-5 text-sm text-ink-300";

export default function Security() {
  return (
    <PageShell title="Trust and limits" subtitle="What the chain proves, what it does not, and what is still missing.">
      <div className="card">
        <h3 className="font-semibold">Verified on-chain</h3>
        <ul className={list}>
          <li>The tender terms and the rules hash, fixed at publication, including the three evaluator addresses.</li>
          <li>Sealed bids: only a commitment is recorded, and the contract enforces the commit and reveal deadlines.</li>
          <li>Every evaluator’s scores are recorded with the hash of a written rationale, so nothing is hidden or rewritten.</li>
          <li>The contract takes the median of each criterion, so one outlier evaluator cannot swing the result.</li>
          <li>The weighted total is computed by a TapeOut circuit inside the settlement transaction, not typed in by anyone.</li>
          <li>Anyone can settle bids and finalize once the conditions are met, so the organizer cannot stall the result forever.</li>
          <li>Anyone can recompute the result in their browser (Verify page) and rebuild the circuit itself from the chain (Inspect the circuit).</li>
        </ul>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Not proven by the chain</h3>
        <ul className={list}>
          <li>Whether a supplier’s documents and claims are true. Evaluators check them off-chain. The document hashes only prove that the files an evaluator received are exactly the files the supplier committed to.</li>
          <li>Whether the evaluators are independent. The organizer chooses the panel and the addresses are public, but nothing stops an organizer from picking friends. Donors and bidders should look at who is on the panel.</li>
          <li>Whether the scoring rubric is fair. The weights are fixed (40/30/20/10) and visible, but each evaluator still applies their own judgment.</li>
        </ul>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Known limitations</h3>
        <ul className={list}>
          <li>Evaluator scores become public as soon as they are submitted, so a later evaluator can see earlier ones. A commit-reveal step for scores is a possible improvement.</li>
          <li>Commit-reveal hides bids until the reveal phase. After that they are public. It is not encryption.</li>
          <li>If an evaluator never scores, a bid can still be settled after the evaluation deadline with two evaluations, and the tender can be finalized after a one-day grace period. This path is in the contract but has not yet been exercised on mainnet. The other paths were tested with 39 automated checks.</li>
          <li>The contracts are an unaudited MVP. The platform holds no funds and has no escrow.</li>
          <li>The scoring circuit lives on a third-party TapeOut processor. TapeOut’s contracts can be upgraded by their team, and we rely on them.</li>
          <li>Titles, descriptions and evaluator addresses are stored publicly on-chain. Do not enter confidential information.</li>
          <li>Tenders on the first contract (earlier tenders) use a single evaluator and are kept as history.</li>
          <li>The demo tenders were created with our own test wallets. No organization is using the product yet.</li>
        </ul>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Addresses (X Layer mainnet)</h3>
        <p className="mt-2 break-all text-xs text-ink-300">Panel contract (current): {V3}</p>
        <p className="mt-1 break-all text-xs text-ink-300">First contract (earlier tenders): {V2}</p>
        <p className="mt-1 break-all text-xs text-ink-300">TapeOut processor: {deployment.processor}</p>
        <p className="mt-1 text-xs text-ink-300">Circuit ID: {deployment.circuitId}</p>
      </div>
      <p className="mt-4 text-sm">
        <Link to="/circuit" className="text-trust-400 underline">Inspect the circuit</Link>
        {" · "}
        <Link to="/p/verify/2" className="text-trust-400 underline">See a verified panel tender</Link>
      </p>
    </PageShell>
  );
}
