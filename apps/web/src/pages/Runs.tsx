import { useEffect, useState } from "react";
import CalendarView from "../components/CalendarView";
import PlanFilePanel from "../components/PlanFilePanel";
import TaskList from "../components/TaskList";
import UrlList from "../components/UrlList";
import { runsApi, type AgentResult, type RunHistorySummary } from "../lib/api";

export default function Runs() {
  const [runs, setRuns] = useState<RunHistorySummary[]>([]);
  const [selected, setSelected] = useState<(AgentResult & { input: string; createdAt: string }) | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    runsApi
      .list()
      .then(setRuns)
      .catch((err) => setError(err instanceof Error ? err.message : "加载失败"));
  }, []);

  async function openRun(runId: string) {
    setSelected(await runsApi.get(runId));
  }

  return (
    <div>
      <header className="page-head">
        <h1>历史记录</h1>
        <p>每次运行 Agent 都会保存输入、结果、任务、日历事件和生成文件。</p>
      </header>
      {error && <p className="error">{error}</p>}
      <section className="panel">
        <h2>运行列表</h2>
        <div className="history-list">
          {runs.map((run) => (
            <button className="history-row" key={run.runId} onClick={() => openRun(run.runId)}>
              <div>
                <strong>{run.input}</strong>
                <p>{run.finalAnswer}</p>
                <small>
                  {new Date(run.createdAt).toLocaleString()} · {run.taskCount} 个任务 · {run.eventCount} 个日历事件 ·{" "}
                  {run.fileCount} 个文件
                </small>
              </div>
            </button>
          ))}
        </div>
      </section>
      {selected && (
        <>
          <section className="panel summary">
            <h2>记录详情</h2>
            <p>{selected.finalAnswer}</p>
          </section>
          <div className="two-column">
            <TaskList tasks={selected.tasks} />
            <UrlList urls={selected.urls} />
          </div>
          <CalendarView events={selected.calendarEvents} />
          <PlanFilePanel files={selected.files} />
        </>
      )}
    </div>
  );
}
