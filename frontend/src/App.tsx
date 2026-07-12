import { useCallback, useEffect, useState } from "react";
import type { Task } from "./api";
import { getTasks } from "./api";
import TasksView from "./components/TasksView";
import ScheduleView from "./components/ScheduleView";
import PlanView from "./components/PlanView";
import ReviewView from "./components/ReviewView";
import ChatView from "./components/ChatView";
import Pomodoro from "./components/Pomodoro";

type Tab = "today" | "schedule" | "plan" | "review" | "chat";

const TABS: { id: Tab; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "schedule", label: "Schedule" },
  { id: "plan", label: "Plan" },
  { id: "review", label: "Review" },
  { id: "chat", label: "Chat" },
];

export default function App() {
  const [tab, setTab] = useState<Tab>("today");
  const [tasks, setTasks] = useState<Task[]>([]);
  const [focusTask, setFocusTask] = useState<Task | null>(null);
  const [reviewKey, setReviewKey] = useState(0);

  const reload = useCallback(() => {
    getTasks().then(setTasks);
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="app">
      <header className="header">
        <span className="logo">R</span>
        <div>
          <h1>Roy</h1>
          <p className="sub">your time-management assistant</p>
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? "active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === "today" && (
          <TasksView
            tasks={tasks}
            reload={reload}
            activeTaskId={focusTask?.id ?? null}
            onFocus={(t) => setFocusTask(t)}
          />
        )}
        {tab === "schedule" && <ScheduleView tasks={tasks} />}
        {tab === "plan" && <PlanView />}
        {tab === "review" && <ReviewView refreshKey={reviewKey} />}
        {tab === "chat" && <ChatView />}
      </main>

      <Pomodoro
        task={focusTask}
        onClear={() => setFocusTask(null)}
        onLogged={() => setReviewKey((k) => k + 1)}
      />
    </div>
  );
}
