import { Link } from "react-router-dom";
import PageShell from "../components/PageShell";

export default function NotFound() {
  return (
    <PageShell title="Page not found" subtitle="This address does not exist.">
      <div className="card space-y-3 text-sm">
        <Link to="/" className="block text-trust-400 underline">Home</Link>
        <Link to="/tenders" className="block text-trust-400 underline">Explore tenders</Link>
        <Link to="/security" className="block text-trust-400 underline">Trust and limits</Link>
      </div>
    </PageShell>
  );
}
