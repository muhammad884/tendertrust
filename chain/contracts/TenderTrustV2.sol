// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface ITapeOutCircuits {
    function eval(uint256 id, bytes calldata inputs) external view returns (bytes memory outputs);
    function circuitInfo(uint256 id) external view returns (uint32 nIn, uint32 nOut, uint32 nState, uint32 gateCount);
}

/// TenderTrust V2: commit-reveal bids, scores computed by a TapeOut NAND circuit via eval().
contract TenderTrustV2 {
    uint8 public constant MAX_SCORE = 15;
    uint256 public constant MAX_BIDDERS = 50;
    uint32 public constant CIRCUIT_N_IN = 17;  // tech4 exp4 delivery4 price4 eligible1
    uint32 public constant CIRCUIT_N_OUT = 8;  // weighted total

    enum Status { Commit, Reveal, Evaluation, Finalized }

    struct Tender {
        address organizer;
        string metadataURI;
        bytes32 rulesHash;
        uint256 budget;
        uint64 commitDeadline;
        uint64 revealDeadline;
        address tapeProcessor;
        uint256 tapeCircuitId;
        bool finalized;
        address winner;
        uint16 winnerScore;
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
    }

    uint256 public tenderCount;
    mapping(uint256 => Tender) private tenders;
    mapping(uint256 => address[]) private bidders;
    mapping(uint256 => mapping(address => Bid)) private bids;
    mapping(uint256 => uint256) private revealedCount;
    mapping(uint256 => uint256) private evaluatedCount;

    event TenderCreated(uint256 indexed id, address indexed organizer, bytes32 rulesHash, string metadataURI, uint256 budget, uint64 commitDeadline, uint64 revealDeadline, address tapeProcessor, uint256 tapeCircuitId);
    event BidCommitted(uint256 indexed id, address indexed bidder, bytes32 commitment);
    event BidRevealed(uint256 indexed id, address indexed bidder, uint256 price, bytes32 proposalHash);
    event BidEvaluated(uint256 indexed id, address indexed bidder, bool eligible, uint8 tech, uint8 experience, uint8 delivery, uint8 priceScore, uint16 total);
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

    /// Bit i of the circuit input is bit i of this little-endian integer.
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

    // ---------- Tender lifecycle ----------

    function createTender(
        string calldata metadataURI,
        bytes32 rulesHash,
        uint256 budget,
        uint64 commitDeadline,
        uint64 revealDeadline,
        address tapeProcessor,
        uint256 tapeCircuitId
    ) external returns (uint256 id) {
        require(bytes(metadataURI).length > 0, "Missing metadata");
        require(rulesHash != bytes32(0), "Missing rules hash");
        require(budget > 0 && budget <= type(uint128).max, "Bad budget");
        require(commitDeadline > block.timestamp, "Commit deadline passed");
        require(revealDeadline > commitDeadline, "Reveal must follow commit");
        require(tapeProcessor.code.length > 0, "Processor not a contract");
        (uint32 nIn, uint32 nOut, uint32 nState, ) = ITapeOutCircuits(tapeProcessor).circuitInfo(tapeCircuitId);
        require(nIn == CIRCUIT_N_IN && nOut == CIRCUIT_N_OUT && nState == 0, "Circuit spec mismatch");

        id = ++tenderCount;
        tenders[id] = Tender({
            organizer: msg.sender,
            metadataURI: metadataURI,
            rulesHash: rulesHash,
            budget: budget,
            commitDeadline: commitDeadline,
            revealDeadline: revealDeadline,
            tapeProcessor: tapeProcessor,
            tapeCircuitId: tapeCircuitId,
            finalized: false,
            winner: address(0),
            winnerScore: 0
        });
        emit TenderCreated(id, msg.sender, rulesHash, metadataURI, budget, commitDeadline, revealDeadline, tapeProcessor, tapeCircuitId);
    }

    function commitBid(uint256 id, bytes32 commitment) external exists(id) {
        Tender storage t = tenders[id];
        require(block.timestamp < t.commitDeadline, "Commit phase over");
        require(commitment != bytes32(0), "Empty commitment");
        require(msg.sender != t.organizer, "Organizer cannot bid");
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
        revealedCount[id]++;
        emit BidRevealed(id, msg.sender, price, proposalHash);
    }

    /// Organizer records human-reviewed scores (0-15) and the document check result.
    /// The total comes from the TapeOut circuit, not from the caller.
    function evaluate(
        uint256 id,
        address bidder,
        uint8 tech,
        uint8 experience,
        uint8 delivery,
        bool docsVerified
    ) external exists(id) {
        Tender storage t = tenders[id];
        require(msg.sender == t.organizer, "Only organizer");
        require(block.timestamp >= t.revealDeadline, "Reveal phase not over");
        require(!t.finalized, "Finalized");
        Bid storage b = bids[id][bidder];
        require(b.revealed, "Bid not revealed");
        require(!b.evaluated, "Already evaluated");
        require(tech <= MAX_SCORE && experience <= MAX_SCORE && delivery <= MAX_SCORE, "Score too high");

        bool eligible = docsVerified && b.price > 0 && b.price <= t.budget;
        (uint16 total, uint8 ps) = _circuitTotal(t, tech, experience, delivery, b.price, eligible);

        b.evaluated = true;
        b.eligible = eligible;
        b.tech = tech;
        b.experience = experience;
        b.delivery = delivery;
        b.priceScore = ps;
        b.total = total;
        evaluatedCount[id]++;
        emit BidEvaluated(id, bidder, eligible, tech, experience, delivery, ps, total);
    }

    /// Anyone can finalize once every revealed bid is evaluated. Ties go to the earliest committer.
    function finalize(uint256 id) external exists(id) {
        Tender storage t = tenders[id];
        require(block.timestamp >= t.revealDeadline, "Reveal phase not over");
        require(!t.finalized, "Already finalized");
        require(evaluatedCount[id] == revealedCount[id], "Evaluation incomplete");

        address best = address(0);
        uint16 bestScore = 0;
        address[] storage list = bidders[id];
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

    /// Recompute a score with the tender's published circuit (anyone can call).
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
}
