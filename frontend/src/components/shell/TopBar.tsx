import type { ReactNode } from "react";
import { hrefFor, useRoute, type Route } from "../../lib/router";
import { useDocuments } from "../../state/documents";
import { Lockup } from "../brand/Logo";
import { IconAlert, IconBeaker, IconBook, IconGauge } from "../icons";
import { useHoverPopover } from "../ui/Popover";
import { ThemeToggle } from "../ui/ThemeToggle";

const NAV: { route: Route; label: string; icon: ReactNode; devOnly?: boolean }[] = [
  { route: "workspace", label: "Workspace", icon: <IconBook size={16} /> },
  { route: "eval", label: "Evals", icon: <IconGauge size={16} /> },
  { route: "lab", label: "Lab", icon: <IconBeaker size={16} />, devOnly: true },
];

/** App header: logo, primary nav, backend status, theme switch. `start`/`end` slot extra buttons. */
export function TopBar({ start, end }: { start?: ReactNode; end?: ReactNode }) {
  const route = useRoute();
  return (
    <header className="topbar">
      <div className="topbar-left">
        {start}
        <a href={hrefFor("home")} className="topbar-logo" aria-label="Verity home">
          <Lockup size={24} />
        </a>
      </div>
      <nav className="topbar-nav" aria-label="Primary">
        {NAV.filter((n) => !n.devOnly || import.meta.env.DEV).map((n) => (
          <a key={n.route} href={hrefFor(n.route)} className="nav-link" aria-current={route === n.route ? "page" : undefined}>
            {n.icon}
            <span>{n.label}</span>
          </a>
        ))}
      </nav>
      <div className="topbar-right">
        <BackendPill />
        <ThemeToggle />
        {end}
      </div>
    </header>
  );
}

/** Subtle indicator of backend mode: mock answers, live provider, or offline. */
export function BackendPill() {
  const { backend, health } = useDocuments();
  const pop = useHoverPopover<HTMLSpanElement>();
  if (backend === "loading") return null;

  if (backend === "offline") {
    return (
      <>
        <span ref={pop.ref} tabIndex={0} className="backend-pill is-offline" {...pop.triggerProps}>
          <IconAlert size={13} /> <span className="backend-pill-text">Offline</span>
        </span>
        {pop.render(
          <div className="pill-pop">
            <strong>Backend unreachable</strong>
            <p>
              Start the API with <code>make api</code> (port 8000). The Design Lab still works without it.
            </p>
          </div>,
        )}
      </>
    );
  }

  const mock = health?.llm_provider === "mock";
  return (
    <>
      <span ref={pop.ref} tabIndex={0} className={`backend-pill ${mock ? "is-mock" : "is-live"}`} {...pop.triggerProps}>
        <span className="backend-dot" aria-hidden="true" />
        <span className="backend-pill-text">{mock ? "Mock mode" : "Live"}</span>
      </span>
      {pop.render(
        <div className="pill-pop">
          <strong>{mock ? "Mock mode: canned answers" : `Live: ${health?.llm_provider}`}</strong>
          <p>
            {mock
              ? "Answers come from an offline mock model, so they are placeholders, but retrieval, citations and quote checks are real."
              : "Answers come from a real language model."}
          </p>
          {health && (
            <dl className="pill-dl">
              <dt>store</dt>
              <dd>{health.store}</dd>
              <dt>retriever</dt>
              <dd>{health.retriever}</dd>
              <dt>ingestor</dt>
              <dd>{health.ingestor}</dd>
              <dt>llm</dt>
              <dd>{health.llm_provider}</dd>
            </dl>
          )}
        </div>,
      )}
    </>
  );
}
