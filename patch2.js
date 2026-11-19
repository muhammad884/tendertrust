const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const F = "frontend/src/pages/Create.tsx";
rep(F, 'import { keccak256, toHex } from "viem";', 'import { formatEther, keccak256, toHex } from "viem";');
rep(F, 'import { connect, writeTender } from "../lib/wallet";', 'import { connect, explainWalletError, writeTender } from "../lib/wallet";\nimport { publicClient } from "../lib/chain";');
rep(F, 'const [account, setAccount] = useState("");', 'const [account, setAccount] = useState("");\n  const [balance, setBalance] = useState("");');
rep(
  F,
  'try { setAccount(await connect()); } catch (e: any) { setErr(e?.shortMessage ?? e?.message ?? "Could not connect"); }',
  [
    "try {",
    "      const a = await connect();",
    "      setAccount(a);",
    "      const b = await publicClient.getBalance({ address: a as `0x${string}` });",
    "      setBalance(formatEther(b));",
    "    } catch (e: any) { setErr(explainWalletError(e)); }",
  ].join("\n"),
);
rep(F, 'await writeTender(account, "createTender", [', 'await writeTender("createTender", [');
rep(F, 'setErr(e?.shortMessage ?? e?.message ?? "Transaction failed");', "setErr(explainWalletError(e));");
rep(
  F,
  '<p className="text-sm">Connected: <span className="font-mono text-trust-400">{short(account)}</span></p>',
  '<p className="text-sm">Connected: <span className="font-mono text-trust-400">{short(account)}</span>{balance && <span className="text-ink-300"> · {balance} OKB</span>}</p>',
);
console.log("Patched OK");
