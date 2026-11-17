import { Link } from "react-router-dom";

const steps = [
  { n: "1", t: "Publish rules", d: "Organizations publish tender rules and scoring weights on X Layer. Rules cannot be silently changed." },
  { n: "2", t: "Commit bids", d: "Suppliers submit hashed bid commitments before the deadline, then reveal them after." },
  { n: "3", t: "Verify the winner", d: "A TapeOut circuit scores each bid by the published rules. Anyone can recheck the result." },
];

export default function Home() {
  return (
    <div>
      <section className="py-6 sm:py-12">
        <span className="badge bg-trust-600/20 text-trust-400">Verifiable procurement</span>
        <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
          Every tender has clear rules.<br />
          Every bid is traceable.<br />
          <span className="text-trust-400">Every result is verifiable.</span>
        </h1>
        <p className="mt-4 max-w-2xl text-ink-300">
          TenderTrust helps NGOs, businesses and institutions run fair supplier
          selection with published evaluation rules, bid commitments and
          circuit-based scoring on X Layer.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/create" className="btn-primary">Create Tender</Link>
          <Link to="/tenders" className="btn-ghost">Explore Tenders</Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {steps.map((s) => (
          <div key={s.n} className="card">
            <div className="text-sm font-bold text-trust-400">Step {s.n}</div>
            <h3 className="mt-1 text-lg font-semibold">{s.t}</h3>
            <p className="mt-2 text-sm text-ink-300">{s.d}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
