import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";
import { TENDER_TRUST } from "../lib/chain";
import { deployment } from "../lib/deployment";

const list = "mt-3 list-disc space-y-2 pl-5 text-sm text-ink-300";

export default function Security() {
  return (
    <PageShell title="Trust and limits" subtitle="What the chain proves, what it does not, and what is still missing.">
      <div className="card">
        <h3 className="font-semibold">Verified on-chain</h3>
        <ul className={list}>
          <li>The tender terms and the rules hash, fixed at publication.</li>
          <li>Sealed bids: only a commitment is recorded, and the contract enforces the commit and reveal deadlines.</li>
          <li>Every score total is computed by the TapeOut circuit inside the evaluation transaction, not typed in by anyone.</li>
          <li>The winner rule: the highest eligible total wins, and ties go to the earliest committer.</li>
        </ul>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Not proven by the chain</h3>
        <ul className={list}>
          <li>Whether a supplier’s documents and claims are true. The organizer reviews evidence off-chain; the hash of the committed proposal lets them check that what they received matches the bid.</li>
          <li>Whether the technical, experience and delivery scores are fair. Today the organizer enters them. A panel of evaluators with median scores is planned.</li>
        </ul>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Known limitations</h3>
        <ul className={list}>
          <li>Commit-reveal hides bids until the reveal phase. After that they are public. It is not encryption.</li>
          <li>The contracts are an unaudited MVP. The platform holds no funds and has no escrow.</li>
          <li>The scoring circuit lives on a third-party TapeOut processor. TapeOut’s contracts can be upgraded by their team, and we rely on them.</li>
          <li>Tender titles and descriptions are stored publicly on-chain. Do not enter confidential information.</li>
          <li>The demo tenders were created with our own test wallets. No organization is using the product yet.</li>
          <li>A wallet may show a security warning for this new domain. Check that the contract address below matches what the wallet asks you to call.</li>
        </ul>
      </div>

      <div className="card mt-4">
        <h3 className="font-semibold">Addresses (X Layer mainnet)</h3>
        <p className="mt-2 break-all text-xs text-ink-300">TenderTrust contract: {TENDER_TRUST}</p>
        <p className="mt-1 break-all text-xs text-ink-300">TapeOut processor: {deployment.processor}</p>
        <p className="mt-1 text-xs text-ink-300">Circuit ID: {deployment.circuitId}</p>
      </div>
      <p className="mt-4 text-sm"><Link to="/verify/1" className="text-trust-400 underline">See a verified example</Link></p>
    </PageShell>
  );
}
