# TenderTrust

**Verifiable procurement on X Layer. Every tender has clear rules, every bid is traceable, every result can be rechecked by anyone.**

- Live app: https://tendertrust.vercel.app (English and Hausa, dark and eye-care light themes)
- Network: X Layer mainnet (chain ID 196)
- Built for the OKX X Layer TapeOut Accelerate hackathon, entirely from an Android phone (Termux).

## The problem

Public and NGO procurement is often disputed: evaluation rules get changed quietly, bids get altered or leaked, one person decides, and nobody outside can check how the winner was chosen. Donors and auditors ask for proof of a fair selection, and today that proof is a pile of documents and a verbal explanation.

## What TenderTrust does

1. **Publish the rules.** The organizer publishes the tender (title, budget, eligibility, deadlines) and names a panel of three evaluators. The rules hash is recorded on-chain and cannot be changed silently.
2. **Sealed bids.** Suppliers commit a hash of their price and proposal, then reveal it after the deadline. They can bind supporting documents to the commitment: files are hashed in the browser and never leave the device. The contract enforces both deadlines.
3. **Panel scoring.** Each evaluator scores every revealed bid (0 to 15 for technical quality, experience and delivery), states whether the documents were verified, and records the hash of a written rationale. The contract takes the **median** of each criterion, so one outlier cannot swing the result.
4. **Circuit-computed total.** A **TapeOut NAND circuit** on X Layer computes the weighted total (40/30/20/10) inside the settlement transaction. Anyone can settle bids and finalize, so the organizer cannot stall the result.
5. **Public verification.** The Verify page re-runs the circuit from the browser and compares it with the recorded result and the formula. A printable audit report and in-app transaction details are included.

## How TapeOut is used

- The scoring formula `4*Technical + 3*Experience + 2*Delivery + PriceScore` (0 if the bid is not eligible) is a circuit of **170 NAND gates** (17 inputs, 8 outputs), taped out on X Layer mainnet.
- Processor (TapeOut circuits contract): `0x7335a50819d44402e3D5E00239bBB80A13E7308F` (CPU #180), **circuit ID 5**. The circuit NFT is owned by the project wallet. We reuse an existing processor.
- Interface: `eval(uint256 id, bytes inputs) returns (bytes outputs)`, called from the contract during `settleBid` and `previewScore`.
- Input layout (17 bits, bit i of a little-endian integer): technical bits 0-3, experience 4-7, delivery 8-11, price score 12-15, eligible flag bit 16. Output: 8-bit total.
- **Inspect the circuit yourself:** `/circuit` rebuilds the circuit from the netlist bytes stored on-chain, compares them with the netlist file in this repository, and tests all 131,072 possible inputs against the published formula in your browser.
- The generator and an exhaustive test are in `circuit/`. A live on-chain check (20 of 20 results matched the formula) was also run. `eval` costs about 447k gas.

## Deployed contracts (X Layer mainnet)

| Item | Address |
|---|---|
| TenderTrustV3 (panel of 3, current) | `0x9f87c8b20a2d5d63e1d5c96f98f13c12ead08cfe` |
| TenderTrustV2 (single evaluator, earlier tenders) | `0xb6b9c3ca3cb5c2ad02c06eaf1d860e52a96a0543` |
| TapeOut processor | `0x7335a50819d44402e3D5E00239bBB80A13E7308F` |
| Circuit ID | 5 |

## Evidence

- **V3 automated test:** 39 checks passed on mainnet (`chain/test_v3.js`, results in `chain/v3_test_results.json`): median ignores an outlier, evaluators and organizer cannot bid, no double scoring, no early settlement, deadline checks, an unrevealed bid does not block finalization.
- **V3 demo through the website:** panel tender #2 with an organizer, three evaluators and two bidders (`chain/evidence_v3_tender_2.json`). The Verify page shows MATCH between the recorded totals, the live circuit and the formula.
- **Earlier tenders (first contract):** #1 (three bidders; the cheapest bidder with top scores was excluded because documents were not verified), #4, and #6 (documents bound to bids). See `chain/mainnet_e2e_evidence.json`, `chain/evidence_tender_4.json`, `chain/evidence_tender_6.json`.
- All demo tenders were created with our own test wallets. **No organization is using the product yet.**

## Measured cost

| Tender | Transactions | Gas | Fee paid |
|---|---|---|---|
| First contract #4 (wallet default fee) | 8 | 2,266,324 | 0.0024037 OKB |
| First contract #6 (low-fee suggestion) | 8 | 2,105,517 | 0.0000421 OKB |
| Panel tender #2 (3 evaluators, 2 bidders) | 14 | 2,940,735 | 0.0000588 OKB |

A panel tender with two bidders costs a fraction of a cent on chain.

## Trust and limits

- **Proven on-chain:** terms, rules hash and evaluator addresses; sealed commitments and deadlines; every evaluator score with a rationale hash; the median; the circuit-computed total; the winner rule.
- **Not proven:** that a supplier's documents are true (evaluators check them off-chain; hashes only prove the files are unchanged), that evaluators are independent (the organizer picks them, and the addresses are public), or that the rubric is fair.
- Scores are public as soon as submitted, so a later evaluator can see earlier ones. Commit-reveal hides bids until reveal; it is not encryption.
- The path where an evaluator never scores (settle after the deadline with two evaluations, finalize after a one-day grace period) is in the contract; see the status note below.
- Unaudited MVP. The platform holds no funds and has no escrow. The scoring circuit lives on a third-party TapeOut processor whose contracts can be upgraded by their team.
- Titles, descriptions and evaluator addresses are public on-chain.

## Early feedback

In three informal conversations (a school, an NGO and a small company), all three said purchasing decisions rest with one person or a monthly meeting. The NGO, which selects among several suppliers, reported complaints from suppliers who were not selected or were paid late, and described explaining purchases to donors orally and in writing. The school and the NGO keep receipts for donors. We did not yet test willingness to use or pay.

## Repository

- `frontend/`: React, Vite, TypeScript, Tailwind, viem. Pages: Home, Explore, Create, Tender, Bid, Panel scoring, Verify, Audit report, Circuit inspector, Dashboard, Trust and limits.
- `chain/contracts/`: `TenderTrust.sol` (testnet prototype), `TenderTrustV2.sol`, `TenderTrustV3.sol` (current).
- `chain/`: compile (solc-js), deploy and test scripts (viem). Hardhat does not run on Android, so tests are plain scripts against mainnet, where gas is cheap.
- `circuit/`: NAND circuit generator, netlist builder and exhaustive test.

Run the frontend locally: `cd frontend && npm install && npm run dev`.
Re-run the circuit test: `cd circuit && node build_circuit.js`.

## Roadmap

Commit-reveal for evaluator scores, per-tender weights and thresholds inside the circuit, a Dashboard for panel tenders, and a pilot with a real organization.

## License

MIT
