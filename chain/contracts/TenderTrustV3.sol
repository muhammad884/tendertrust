// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITapeOutCircuits {
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory outputs);
    function circuitInfo(uint256 id) external view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount);
}

/// TenderTrust V3: commit-reveal bids, a panel of 3 evaluators (median scores),
/// and a TapeOut NAND circuit that computes the weighted total via eval().
contract TenderTrustV3 {
    uint8 public constant MAX_SCORE = 15;
    uint256 public constant MAX_BIDDERS = 20;
    uint256 public constant NUM_EVALUATORS = 3;
    uint8 public constant MIN_SUBMISSIONS = 2;
    uint32 public constant CIRCUIT_N_IN = 17;
    uint32 public constant CIRCUIT_N_OUT = 8;
    uint64 public constant FINALIZE_GRACE = 1 days;

    enum Status { Commit, Reveal, Evaluation, Finalized }

    struct NewTender {
        string metadataURI;
        bytes32 rulesHash;
        uint256 budget;
        uint64 commitDeadline;
        uint64 revealDeadline;
        uint64 evalDeadline;
        address tapeProcessor;
        uint256 tapeCircuitId;
        address[3] evaluators;
    }

    struct Tender {
        address organizer;
        string metadataURI;
        bytes32 rulesHash;
        uint256 budget;
        uint64 commitDeadline;
        uint64 revealDeadline;
        uint64 evalDeadline;
        address tapeProcessor;
        uint256 tapeCircuitId;
        bool finalized;
        address winner;
        uint16 winnerScore;
    }

    struct Score {
        bool submitted;
        uint8 tech;
        uint8 experience;
        uint8 delivery;
        bool docsVerified;
        bytes32 justification;
    }

    struct Bid {
        bytes32 commitment;
        uint256 price;
        bytes32 proposalHash;
        bool revealed;
        bool evaluated;
        bool eligible;
        uint8 tech;
        uint8 experience;
        uint8 delivery;
        uint8 priceScore;
        uint16 total;
        uint8 submissions;
    }

    struct Agg {
        uint8 tech;
        uint8 experience;
        uint8 delivery;
        bool docsOk;
        uint8 n;
    }

    uint256 public tenderCount;
    mapping(uint256 => Tender) private tenders;
    mapping(uint256 => address[]) private bidders;
    mapping(uint256 => mapping(address => Bid)) private bids;
    mapping(uint256 => address[3]) private evaluators;
    mapping(uint256 => mapping(address => bool)) public isEvaluator;
    mapping(uint256 => mapping(address => mapping(address => Score))) private scores;

    event TenderCreated(uint256 indexed id, address indexed organizer, bytes32 rulesHash, string metadataURI, uint256 budget);
    event TenderSchedule(uint256 indexed id, uint64 commitDeadline, uint64 revealDeadline, uint64 evalDeadline);
    event TenderCircuit(uint256 indexed id, address tapeProcessor, uint256 tapeCircuitId);
    event EvaluatorsSet(uint256 indexed id, address e0, address e1, address e2);
    event BidCommitted(uint256 indexed id, address indexed bidder, bytes32 commitment);
    event BidRevealed(uint256 indexed id, address indexed bidder, uint256 price, bytes32 proposalHash);
    event ScoreSubmitted(uint256 indexed id, address indexed bidder, address indexed evaluator, bytes32 justification);
    event BidSettled(uint256 indexed id, address indexed bidder, bool eligible, uint16 total);
    event TenderFinalized(uint256 indexed id, address indexed winner, uint16 winnerScore);

    modifier exists(uint256 id) {
        require(id >= 1 && id <= tenderCount, "Tender not found");
        _;
    }

    // ---------- Pure helpers (anyone can recompute) ----------

    function scoreForPrice(uint256 price, uint256 budget) public pure returns (uint8) {
        if (price == 0 || price > budget) return 0;
        return uint8(((budget - price) * MAX_SCORE) / budget);
    }

    function weightedScore(uint8 tech, uint8 exp, uint8 delivery, uint8 priceScore) public pure returns (uint16) {
        return uint16(tech) * 4 + uint16(exp) * 3 + uint16(delivery) * 2 + uint16(priceScore);
    }

    function packInputs(uint8 tech, uint8 exp, uint8 delivery, uint8 priceScore, bool eligible) public pure returns (bytes memory) {
        uint24 x = uint24(tech & 15)
            | (uint24(exp & 15) << 4)
            | (uint24(delivery & 15) << 8)
            | (uint24(priceScore & 15) << 12)
            | (eligible ? (uint24(1) << 16) : uint24(0));
        return abi.encodePacked(bytes1(uint8(x)), bytes1(uint8(x >> 8)), bytes1(uint8(x >> 16)));
    }

    function computeCommitment(uint256 id, address bidder, uint256 price, bytes32 proposalHash, bytes32 salt) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), id, bidder, price, proposalHash, salt));
    }

    function _circuitTotal(Tender storage t, uint8 tech, uint8 exp, uint8 delivery, uint256 price, bool eligible)
        internal view returns (uint16 total, uint8 ps)
    {
        ps = scoreForPrice(price, t.budget);
        bytes memory out = ITapeOutCircuits(t.tapeProcessor).eval(t.tapeCircuitId, packInputs(tech, exp, delivery, ps, eligible));
        require(out.length >= 1, "Bad circuit output");
        total = uint16(uint8(out[0]));
    }

    /// Median of three, or the lower value when only two evaluators scored.
    function _mid(uint8[3] memory a, uint8 n) internal pure returns (uint8) {
        if (n == 3) {
            (uint8 x, uint8 y, uint8 z) = (a[0], a[1], a[2]);
            if (x > y) (x, y) = (y, x);
            if (y > z) (y, z) = (z, y);
            if (x > y) (x, y) = (y, x);
            return y;
        }
        return a[0] < a[1] ? a[0] : a[1];
    }

    function _aggregate(uint256 id, address bidder) internal view returns (Agg memory a) {
        uint8[3] memory ts;
        uint8[3] memory es;
        uint8[3] memory ds;
        uint8 verified;
        for (uint256 i = 0; i < 3; i++) {
            Score storage s = scores[id][bidder][evaluators[id][i]];
            if (!s.submitted) continue;
            ts[a.n] = s.tech;
            es[a.n] = s.experience;
            ds[a.n] = s.delivery;
            if (s.docsVerified) verified++;
            a.n++;
        }
        a.tech = _mid(ts, a.n);
        a.experience = _mid(es, a.n);
        a.delivery = _mid(ds, a.n);
        a.docsOk = uint256(verified) * 2 > a.n;
    }

    function _checkEvaluators(address[3] calldata ev) internal pure {
        for (uint256 i = 0; i < 3; i++) require(ev[i] != address(0), "Zero evaluator");
        require(ev[0] != ev[1] && ev[0] != ev[2] && ev[1] != ev[2], "Duplicate evaluator");
    }

    // ---------- Tender lifecycle ----------

    function createTender(NewTender calldata p) external returns (uint256 id) {
        require(bytes(p.metadataURI).length > 0, "Missing metadata");
        require(p.rulesHash != bytes32(0), "Missing rules hash");
        require(p.budget > 0 && p.budget <= type(uint128).max, "Bad budget");
        require(p.commitDeadline > block.timestamp, "Commit deadline passed");
        require(p.revealDeadline > p.commitDeadline, "Reveal must follow commit");
        require(p.evalDeadline > p.revealDeadline && p.evalDeadline <= p.revealDeadline + 30 days, "Bad evaluation deadline");
        require(p.tapeProcessor.code.length > 0, "Processor not a contract");
        (uint32 nIn, uint32 nOut, uint32 nState, ) = ITapeOutCircuits(p.tapeProcessor).circuitInfo(p.tapeCircuitId);
        require(nIn == CIRCUIT_N_IN && nOut == CIRCUIT_N_OUT && nState == 0, "Circuit spec mismatch");
        _checkEvaluators(p.evaluators);

        id = ++tenderCount;
        Tender storage t = tenders[id];
        t.organizer = msg.sender;
        t.metadataURI = p.metadataURI;
        t.rulesHash = p.rulesHash;
        t.budget = p.budget;
        t.commitDeadline = p.commitDeadline;
        t.revealDeadline = p.revealDeadline;
        t.evalDeadline = p.evalDeadline;
        t.tapeProcessor = p.tapeProcessor;
        t.tapeCircuitId = p.tapeCircuitId;
        for (uint256 i = 0; i < 3; i++) {
            evaluators[id][i] = p.evaluators[i];
            isEvaluator[id][p.evaluators[i]] = true;
        }
        emit TenderCreated(id, msg.sender, p.rulesHash, p.metadataURI, p.budget);
        emit TenderSchedule(id, p.commitDeadline, p.revealDeadline, p.evalDeadline);
        emit TenderCircuit(id, p.tapeProcessor, p.tapeCircuitId);
        emit EvaluatorsSet(id, p.evaluators[0], p.evaluators[1], p.evaluators[2]);
    }

    function commitBid(uint256 id, bytes32 commitment) external exists(id) {
        Tender storage t = tenders[id];
        require(block.timestamp < t.commitDeadline, "Commit phase over");
        require(commitment != bytes32(0), "Empty commitment");
        require(msg.sender != t.organizer, "Organizer cannot bid");
        require(!isEvaluator[id][msg.sender], "Evaluator cannot bid");
        require(bids[id][msg.sender].commitment == bytes32(0), "Already committed");
        require(bidders[id].length < MAX_BIDDERS, "Too many bidders");

        bids[id][msg.sender].commitment = commitment;
        bidders[id].push(msg.sender);
        emit BidCommitted(id, msg.sender, commitment);
    }

    function revealBid(uint256 id, uint256 price, bytes32 proposalHash, bytes32 salt) external exists(id) {
        Tender storage t = tenders[id];
        require(block.timestamp >= t.commitDeadline && block.timestamp < t.revealDeadline, "Not reveal phase");
        Bid storage b = bids[id][msg.sender];
        require(b.commitment != bytes32(0), "No commitment");
        require(!b.revealed, "Already revealed");
        require(computeCommitment(id, msg.sender, price, proposalHash, salt) == b.commitment, "Commitment mismatch");

        b.revealed = true;
        b.price = price;
        b.proposalHash = proposalHash;
        emit BidRevealed(id, msg.sender, price, proposalHash);
    }

    /// One of the three evaluators scores a revealed bid (0-15) and states whether the
    /// documents were verified. The justification hash (of a written rationale) is required.
    function submitScores(
        uint256 id,
        address bidder,
        uint8 tech,
        uint8 experience,
        uint8 delivery,
        bool docsVerified,
        bytes32 justification
    ) external exists(id) {
        require(isEvaluator[id][msg.sender], "Only evaluator");
        require(block.timestamp >= tenders[id].revealDeadline && block.timestamp < tenders[id].evalDeadline, "Not evaluation phase");
        require(!tenders[id].finalized, "Finalized");
        Bid storage b = bids[id][bidder];
        require(b.revealed, "Bid not revealed");
        require(!b.evaluated, "Already settled");
        Score storage s = scores[id][bidder][msg.sender];
        require(!s.submitted, "Already scored");
        require(tech <= MAX_SCORE && experience <= MAX_SCORE && delivery <= MAX_SCORE, "Score too high");
        require(justification != bytes32(0), "Missing justification");

        s.submitted = true;
        s.tech = tech;
        s.experience = experience;
        s.delivery = delivery;
        s.docsVerified = docsVerified;
        s.justification = justification;
        b.submissions++;
        emit ScoreSubmitted(id, bidder, msg.sender, justification);
    }

    /// Anyone can settle a bid once all 3 evaluators scored it, or after the evaluation
    /// deadline if at least 2 did. The median scores go through the TapeOut circuit.
    function settleBid(uint256 id, address bidder) external exists(id) {
        require(block.timestamp >= tenders[id].revealDeadline, "Reveal phase not over");
        require(!tenders[id].finalized, "Finalized");
        Bid storage b = bids[id][bidder];
        require(b.revealed, "Bid not revealed");
        require(!b.evaluated, "Already settled");
        require(
            b.submissions == NUM_EVALUATORS || (block.timestamp >= tenders[id].evalDeadline && b.submissions >= MIN_SUBMISSIONS),
            "Not enough evaluations"
        );

        Agg memory a = _aggregate(id, bidder);
        bool eligible = a.docsOk && b.price > 0 && b.price <= tenders[id].budget;
        (uint16 total, uint8 ps) = _circuitTotal(tenders[id], a.tech, a.experience, a.delivery, b.price, eligible);

        b.evaluated = true;
        b.eligible = eligible;
        b.tech = a.tech;
        b.experience = a.experience;
        b.delivery = a.delivery;
        b.priceScore = ps;
        b.total = total;
        emit BidSettled(id, bidder, eligible, total);
    }

    /// Anyone can finalize. Every revealed bid must be settled, except bids that got fewer
    /// than 2 evaluations once the 1-day grace period after the evaluation deadline has passed.
    function finalize(uint256 id) external exists(id) {
        Tender storage t = tenders[id];
        require(block.timestamp >= t.revealDeadline, "Reveal phase not over");
        require(!t.finalized, "Already finalized");

        address[] storage list = bidders[id];
        bool graceOver = block.timestamp >= uint256(t.evalDeadline) + FINALIZE_GRACE;
        for (uint256 i = 0; i < list.length; i++) {
            Bid storage pending = bids[id][list[i]];
            if (pending.revealed && !pending.evaluated) {
                require(graceOver, "Evaluation incomplete");
                require(pending.submissions < MIN_SUBMISSIONS, "Settle pending bids first");
            }
        }

        address best = address(0);
        uint16 bestScore = 0;
        for (uint256 i = 0; i < list.length; i++) {
            Bid storage b = bids[id][list[i]];
            if (b.eligible && b.total > bestScore) {
                best = list[i];
                bestScore = b.total;
            }
        }
        t.finalized = true;
        t.winner = best;
        t.winnerScore = bestScore;
        emit TenderFinalized(id, best, bestScore);
    }

    // ---------- Views ----------

    function previewScore(uint256 id, uint8 tech, uint8 experience, uint8 delivery, uint256 price, bool eligible)
        external view exists(id) returns (uint16 total, uint8 priceScore)
    {
        return _circuitTotal(tenders[id], tech, experience, delivery, price, eligible);
    }

    function status(uint256 id) external view exists(id) returns (Status) {
        Tender storage t = tenders[id];
        if (t.finalized) return Status.Finalized;
        if (block.timestamp < t.commitDeadline) return Status.Commit;
        if (block.timestamp < t.revealDeadline) return Status.Reveal;
        return Status.Evaluation;
    }

    function getTender(uint256 id) external view exists(id) returns (Tender memory) {
        return tenders[id];
    }

    function getBid(uint256 id, address bidder) external view exists(id) returns (Bid memory) {
        return bids[id][bidder];
    }

    function getBidders(uint256 id) external view exists(id) returns (address[] memory) {
        return bidders[id];
    }

    function getEvaluators(uint256 id) external view exists(id) returns (address[3] memory) {
        return evaluators[id];
    }

    function getScore(uint256 id, address bidder, address evaluator) external view exists(id) returns (Score memory) {
        return scores[id][bidder][evaluator];
    }
}
