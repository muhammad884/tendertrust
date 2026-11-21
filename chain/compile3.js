const solc = require("solc");
const fs = require("fs");

const src = fs.readFileSync("contracts/TenderTrustV3.sol", "utf8");
const input = {
  language: "Solidity",
  sources: { "TenderTrustV3.sol": { content: src } },
  settings: {
    evmVersion: "paris",
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const out = JSON.parse(solc.compile(JSON.stringify(input)));
const errs = out.errors || [];
errs.forEach((e) => console.log(e.formattedMessage));
if (errs.some((e) => e.severity === "error")) process.exit(1);

const c = out.contracts["TenderTrustV3.sol"].TenderTrustV3;
fs.mkdirSync("build", { recursive: true });
fs.writeFileSync(
  "build/TenderTrustV3.json",
  JSON.stringify({ abi: c.abi, bytecode: "0x" + c.evm.bytecode.object }, null, 2)
);
console.log("OK. Contract size (bytes):", c.evm.bytecode.object.length / 2);
