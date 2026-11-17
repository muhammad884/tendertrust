import type { ReactNode } from "react";

export default function PageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <section>
      <h1 className="text-2xl font-bold sm:text-3xl">{title}</h1>
      {subtitle && <p className="mt-2 text-ink-300">{subtitle}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}
