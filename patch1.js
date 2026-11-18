const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const P = "frontend/src/";
rep(P + "components/Layout.tsx", "X Layer Testnet", "X Layer Mainnet");
rep(P + "pages/Explore.tsx", 'import { STATUS, STATUS_COLOR, fmt, short } from "../lib/format";', 'import { STATUS, STATUS_COLOR, fmt, short } from "../lib/format";\nimport { titleOf } from "../lib/meta";');
rep(P + "pages/Explore.tsx", "{r.uri}", "{titleOf(r.uri)}");
rep(P + "pages/TenderDetails.tsx", 'import { STATUS, STATUS_COLOR, fmt, short, explorerAddr } from "../lib/format";', 'import { STATUS, STATUS_COLOR, fmt, short, explorerAddr } from "../lib/format";\nimport { metaOf } from "../lib/meta";');
rep(P + "pages/TenderDetails.tsx", "const t = data.tender;", "const t = data.tender;\n  const m = metaOf(t.metadataURI);");
rep(P + "pages/TenderDetails.tsx", "subtitle={t.metadataURI}", "subtitle={m.title}");
const about = [
  "      {(m.description || m.eligibility) && (",
  '        <div className="card mt-4">',
  '          <h3 className="font-semibold">About this tender</h3>',
  '          {m.description && <p className="mt-2 whitespace-pre-line text-sm text-ink-300">{m.description}</p>}',
  "          {m.eligibility && (",
  "            <>",
  '              <h4 className="mt-3 text-sm font-semibold">Minimum eligibility</h4>',
  '              <p className="mt-1 whitespace-pre-line text-sm text-ink-300">{m.eligibility}</p>',
  "            </>",
  "          )}",
  "        </div>",
  "      )}",
  "",
  "",
].join("\n");
const anchor = '      <div className="card mt-4">\n        <h3 className="font-semibold">Evaluation rules</h3>';
rep(P + "pages/TenderDetails.tsx", anchor, about + anchor);
console.log("Patched OK");
