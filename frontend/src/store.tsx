import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api } from "./api";
import type {
  CalendarBlock,
  Day,
  Decision,
  Delegation,
  InboxItem,
  Meeting,
  Task,
} from "./types";

export const todayStr = () => new Date().toISOString().slice(0, 10);

type Store = {
  tasks: Task[];
  inbox: InboxItem[];
  blocks: CalendarBlock[];
  decisions: Decision[];
  delegations: Delegation[];
  meetings: Meeting[];
  day: Day;
  aiEnabled: boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [delegations, setDelegations] = useState<Delegation[]>([]);
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [day, setDay] = useState<Day>({ date: todayStr() });
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      const [t, i, b, d, del, m, dy, h] = await Promise.all([
        api.get<Task[]>("/tasks"),
        api.get<InboxItem[]>("/inbox"),
        api.get<CalendarBlock[]>(`/blocks?date=${todayStr()}`),
        api.get<Decision[]>("/decisions"),
        api.get<Delegation[]>("/delegations"),
        api.get<Meeting[]>("/meetings"),
        api.get<Day>("/day"),
        api.get<{ ai: boolean }>("/health"),
      ]);
      setTasks(t);
      setInbox(i);
      setBlocks(b);
      setDecisions(d);
      setDelegations(del);
      setMeetings(m);
      setDay(dy);
      setAiEnabled(h.ai);
    } catch (err) {
      setError(err instanceof Error ? err.message : "failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <Ctx.Provider
      value={{
        tasks,
        inbox,
        blocks,
        decisions,
        delegations,
        meetings,
        day,
        aiEnabled,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
