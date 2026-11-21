const fs = require("fs");
const files = {};
const load = (f) => (files[f] !== undefined ? files[f] : (files[f] = fs.readFileSync(f, "utf8")));
function rep(f, from, to) {
  const s = load(f);
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(f + ": expected 1 match, found " + n + " for: " + from.slice(0, 80));
  files[f] = s.replace(from, () => to);
}
const B = "frontend/src/pages/Bid.tsx";
const E = "frontend/src/pages/Evaluate.tsx";

// ---------- Bid.tsx ----------
rep(B, "const [docs, setDocs] = useState<DocEntry[]>([]);", "const [docs, setDocs] = useState<DocEntry[]>([]);\n  const [docBusy, setDocBusy] = useState(false);");
rep(B, "out.push(await hashFile(f));", [
  "setDocBusy(true);",
  "      try {",
  "        out.push(await hashFile(f));",
  "      } catch {",
  '        setErr("Could not read " + f.name + ". Pick the file from Downloads or Images instead.");',
  "      }",
].join("\n"));
rep(B, "setDocs(out);", 'setDocs(out);\n    setDocBusy(false);\n    e.target.value = "";');
rep(B, '<input type="file" multiple className="block w-full text-sm text-ink-300" onChange={onFiles} />', [
  '<label className="btn-ghost w-full cursor-pointer">',
  "              Choose files",
  '              <input type="file" multiple accept="image/*,application/pdf,text/plain" className="hidden" onChange={onFiles} />',
  "            </label>",
  '            {docBusy && <p className="mt-1 text-xs text-ink-300">Reading files…</p>}',
  '            {docs.length > 0 && <p className="mt-1 text-xs text-trust-400">{docs.length} file(s) ready</p>}',
].join("\n"));

// ---------- Evaluate.tsx ----------
rep(E, '<input type="file" accept=".json,application/json" className="block w-full text-sm text-ink-300" onChange={onPkgFile} />', [
  '<label className="btn-ghost mt-1 w-full cursor-pointer">',
  "        Choose package file",
  '        <input type="file" className="hidden" onChange={onPkgFile} />',
  "      </label>",
].join("\n"));
rep(E, "if (f && f.size < 200000) setPasted(await f.text());", [
  "if (f && f.size < 200000) {",
  "      try {",
  "        setPasted(await f.text());",
  "      } catch {",
  '        setPasted("");',
  "      }",
  "    }",
  '    e.target.value = "";',
].join("\n"));
rep(E, '<input type="file" multiple className="block w-full text-sm text-ink-300" onChange={onDocs} />', [
  '<label className="btn-ghost mt-1 w-full cursor-pointer">',
  "            Choose documents",
  '            <input type="file" multiple className="hidden" onChange={onDocs} />',
  "          </label>",
].join("\n"));
rep(E, "if (f.size <= 25 * 1024 * 1024) out.push(await hashFile(f));", "if (f.size <= 25 * 1024 * 1024) {\n        try {\n          out.push(await hashFile(f));\n        } catch {\n          /* skip an unreadable file */\n        }\n      }");
rep(E, "setDocHashes(out);", 'setDocHashes(out);\n    e.target.value = "";');

for (const [f, s] of Object.entries(files)) fs.writeFileSync(f, s);
console.log("Patched OK");
