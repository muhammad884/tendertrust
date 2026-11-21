const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 80));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const T = "frontend/src/components/TxDetails.tsx";
rep(T, 'import { publicClient, tenderTrustAbi } from "../lib/chain";', 'import { publicClient, tenderTrustAbi } from "../lib/chain";\nimport { tenderTrustAbi as abi3 } from "../lib/TenderTrustV3.abi";');
rep(T, "method = decodeFunctionData({ abi: tenderTrustAbi, data: tx.input }).functionName;", [
  "try {",
  "          method = decodeFunctionData({ abi: tenderTrustAbi, data: tx.input }).functionName;",
  "        } catch {",
  "          method = decodeFunctionData({ abi: abi3, data: tx.input }).functionName;",
  "        }",
].join("\n"));
console.log("Patched OK");
