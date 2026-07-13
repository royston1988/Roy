import { useState } from "react";
import { StoreProvider, useStore } from "./store";
import { isOverdue } from "./ui";
import { Assistant } from "./components/Assistant";
import { Today } from "./pages/Today";
import { Inbox } from "./pages/Inbox";
import { Priorities } from "./pages/Priorities";
import { Calendar } from "./pages/Calendar";
import { Decisions } from "./pages/Decisions";
import { Delegation } from "./pages/Delegation";
import { Review } from "./pages/Review";

type Page =
  | "today"
  | "inbox"
  | "priorities"
  | "calendar"
  | "decisions"
  | "delegation"
  | "review";

const NAV: { id: Page; label: string; icon: string }[] = [
  { id: "today", label: "Today", icon: "◎" },
  { id: "inbox", label: "Inbox", icon: "⤵" },
  { id: "priorities", label: "Priorities", icon: "▤" },
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "decisions", label: "Decisions", icon: "✓" },
  { id: "delegation", label: "Delegation", icon: "⇢" },
  { id: "review", label: "Review", icon: "∿" },
];

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}

function Shell() {
  const [page, setPage] = useState<Page>("today");
  const [assistantOpen, setAssistantOpen] = useState(false);
  const store = useStore();

  const badges: Partial<Record<Page, number>> = {
    inbox: store.inbox.length,
    decisions: store.decisions.filter((d) => d.status === "pending").length,
    delegation: store.delegations.filter(
      (d) => d.status !== "done" && (d.status === "delayed" || isOverdue(d.deadline)),
    ).length,
  };

  const go = (p: string) => setPage(p as Page);

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">R</span>
          <div>
            <div className="brand-name">Roy</div>
            <div className="brand-sub">attention management</div>
          </div>
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <button
              key={n.id}
              className={`nav-item ${page === n.id ? "active" : ""}`}
              onClick={() => setPage(n.id)}
            >
              <span className="nav-icon">{n.icon}</span>
              <span className="nav-label">{n.label}</span>
              {badges[n.id] ? <span className="nav-badge">{badges[n.id]}</span> : null}
            </button>
          ))}
        </nav>
        <button
          className="assistant-toggle"
          onClick={() => setAssistantOpen((o) => !o)}
        >
          ✨ Chief of Staff
        </button>
      </aside>

      <main className="main">
        <header className="topbar">
          <h1 className="page-title">{NAV.find((n) => n.id === page)?.label}</h1>
          <div className="topbar-right">
            {store.error && <span className="error-badge">⚠ {store.error}</span>}
            {!store.aiEnabled && (
              <span className="ai-off" title="Set ANTHROPIC_API_KEY to enable AI">
                AI offline
              </span>
            )}
            <button
              className="assistant-toggle mobile"
              onClick={() => setAssistantOpen((o) => !o)}
            >
              ✨
            </button>
          </div>
        </header>

        <div className="content">
          {store.loading ? (
            <div className="loading">Loading…</div>
          ) : (
            <>
              {page === "today" && <Today go={go} />}
              {page === "inbox" && <Inbox />}
              {page === "priorities" && <Priorities />}
              {page === "calendar" && <Calendar />}
              {page === "decisions" && <Decisions />}
              {page === "delegation" && <Delegation />}
              {page === "review" && <Review />}
            </>
          )}
        </div>
      </main>

      <Assistant open={assistantOpen} onClose={() => setAssistantOpen(false)} />
    </div>
  );
}
