const fs = require("fs");
function rep(file, from, to) {
  const s = fs.readFileSync(file, "utf8");
  const n = s.split(from).length - 1;
  if (n !== 1) throw new Error(file + ": expected 1 match, found " + n + " for: " + from.slice(0, 70));
  fs.writeFileSync(file, s.replace(from, () => to));
}
const P = "frontend/src/";
rep(P + "App.tsx", 'import TenderDetails from "./pages/TenderDetails";', 'import TenderDetails from "./pages/TenderDetails";\nimport Bid from "./pages/Bid";\nimport Evaluate from "./pages/Evaluate";');
rep(
  P + "App.tsx",
  '<Route path="/tender/:id" element={<TenderDetails />} />',
  '<Route path="/tender/:id" element={<TenderDetails />} />\n        <Route path="/tender/:id/bid" element={<Bid />} />\n        <Route path="/tender/:id/evaluate" element={<Evaluate />} />',
);
const link = '<Link to={"/verify/" + id} className="text-sm text-trust-400 underline">Verify this result</Link>\n      </div>';
const actions = [
  link,
  '      {data.status === 0 && <Link to={"/tender/" + id + "/bid"} className="btn-primary mt-4 w-full">Submit a bid</Link>}',
  '      {data.status === 1 && <Link to={"/tender/" + id + "/bid"} className="btn-primary mt-4 w-full">Reveal your bid</Link>}',
  '      {data.status === 2 && <Link to={"/tender/" + id + "/evaluate"} className="btn-ghost mt-4 w-full">Organizer: evaluate bids</Link>}',
].join("\n");
rep(P + "pages/TenderDetails.tsx", link, actions);
console.log("Patched OK");
