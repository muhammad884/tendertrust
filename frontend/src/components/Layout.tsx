import { Link, NavLink, Outlet } from "react-router-dom";
import LangToggle from "./LangToggle";
import ThemeToggle from "./ThemeToggle";

const links = [
  { to: "/tenders", label: "Explore" },
  { to: "/create", label: "Create" },
  { to: "/verify", label: "Verify" },
  { to: "/dashboard", label: "Dashboard" },
];

const linkClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? "text-trust-400" : "text-ink-300 hover:text-ink-100";

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-ink-700 bg-ink-900/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="text-lg font-extrabold tracking-tight">
            Tender<span className="text-trust-400">Trust</span>
          </Link>
          <nav className="hidden gap-6 text-sm font-medium md:flex">
            {links.map((l) => (
              <NavLink key={l.to} to={l.to} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <LangToggle />
            <ThemeToggle />
            <span className="badge bg-ink-700 text-ink-300">X Layer Mainnet</span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 pb-24 md:pb-8">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-ink-700 bg-ink-900 py-3 text-xs font-medium md:hidden">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} className={linkClass}>
            {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
