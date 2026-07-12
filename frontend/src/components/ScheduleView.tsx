import { useEffect, useState } from "react";
import type { Block, Task } from "../api";
import { addBlock, getBlocks, removeBlock } from "../api";
import { hhmmToMin, minToHHMM, todayISO } from "../util";

const DAY_START = 6; // 06:00
const DAY_END = 22; // 22:00
const PX_PER_MIN = 1.1;

export default function ScheduleView({ tasks }: { tasks: Task[] }) {
  const [date, setDate] = useState(todayISO());
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [title, setTitle] = useState("");
  const [taskId, setTaskId] = useState<string>("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  async function reload() {
    setBlocks(await getBlocks(date));
  }
  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  async function create() {
    const label = taskId
      ? tasks.find((t) => t.id === taskId)?.title ?? title.trim()
      : title.trim();
    if (!label) return;
    const s = hhmmToMin(start);
    const e = hhmmToMin(end);
    if (e <= s) return;
    await addBlock({
      title: label,
      task_id: taskId || null,
      date,
      start_min: s,
      end_min: e,
    });
    setTitle("");
    setTaskId("");
    reload();
  }

  const hours: number[] = [];
  for (let h = DAY_START; h <= DAY_END; h++) hours.push(h);
  const open = tasks.filter((t) => t.status !== "done");

  return (
    <div className="stack">
      <div className="card">
        <div className="composer-row">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <button className="ghost" onClick={() => setDate(todayISO())}>
            Today
          </button>
        </div>
        <div className="composer-row meta-row">
          <select
            className="grow"
            value={taskId}
            onChange={(e) => {
              setTaskId(e.target.value);
              const t = tasks.find((x) => x.id === e.target.value);
              if (t) setTitle(t.title);
            }}
          >
            <option value="">— block from a task —</option>
            {open.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <div className="composer-row meta-row">
          <input
            className="grow"
            placeholder="or type a label (e.g. Lunch, Gym)"
            value={taskId ? "" : title}
            disabled={!!taskId}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
          <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
          <button onClick={create}>Block</button>
        </div>
      </div>

      <div className="card">
        <div className="timeline">
          <div className="ticks">
            {hours.map((h) => (
              <div
                key={h}
                className="tick"
                style={{ height: 60 * PX_PER_MIN }}
              >
                <span>{String(h).padStart(2, "0")}:00</span>
              </div>
            ))}
          </div>
          <div
            className="lanes"
            style={{ height: (DAY_END - DAY_START + 1) * 60 * PX_PER_MIN }}
          >
            {blocks.map((b) => {
              const top = (b.start_min - DAY_START * 60) * PX_PER_MIN;
              const height = Math.max(18, (b.end_min - b.start_min) * PX_PER_MIN);
              return (
                <div
                  key={b.id}
                  className="event"
                  style={{ top, height }}
                  title={`${minToHHMM(b.start_min)}–${minToHHMM(b.end_min)} ${b.title}`}
                >
                  <div className="event-body">
                    <span className="event-title">{b.title}</span>
                    <span className="event-time">
                      {minToHHMM(b.start_min)}–{minToHHMM(b.end_min)}
                    </span>
                  </div>
                  <button
                    className="icon tiny"
                    onClick={async () => (await removeBlock(b.id), reload())}
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
