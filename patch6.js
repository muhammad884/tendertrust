const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const P = "frontend/src/";
rep(P + "lib/chain.ts", 'export const EXPLORER = "https://www.okx.com/web3/explorer/xlayer";', 'export const EXPLORER = "https://www.oklink.com/x-layer";');
rep(P + "lib/wallet.ts", 'blockExplorerUrls: ["https://www.okx.com/web3/explorer/xlayer"],', 'blockExplorerUrls: ["https://www.oklink.com/x-layer"],');
const V = P + "pages/Verify.tsx";
rep(V, 'import PageShell from "../components/PageShell";', 'import PageShell from "../components/PageShell";\nimport TxDetails from "../components/TxDetails";');
rep(V, 'import { explorerAddr, explorerTx, short } from "../lib/format";', 'import { explorerAddr, short } from "../lib/format";');
rep(V, '<li key={k}><a className={link} href={explorerTx(h)} target="_blank" rel="noreferrer">{k}: {short(h)}</a></li>', '<li key={k}><TxDetails label={k} hash={h} /></li>');
rep(V, '<li><a className={link} href={explorerTx(deployment.tapeoutTx)} target="_blank" rel="noreferrer">circuit tapeout: {short(deployment.tapeoutTx)}</a></li>', '<li><TxDetails label="circuit tapeout" hash={deployment.tapeoutTx} /></li>');
console.log("Patched OK");
