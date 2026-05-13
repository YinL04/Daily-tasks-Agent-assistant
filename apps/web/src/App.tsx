import { useState } from "react";
import { CalendarDays, History } from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Runs from "./pages/Runs";

export default function App() {
  const [page, setPage] = useState<"dashboard" | "runs">("dashboard");
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">日常事务 Agent</div>
        <button className={page === "dashboard" ? "nav active" : "nav"} onClick={() => setPage("dashboard")}>
          <CalendarDays size={18} /> 工作台
        </button>
        <button className={page === "runs" ? "nav active" : "nav"} onClick={() => setPage("runs")}>
          <History size={18} /> 历史记录
        </button>
      </aside>
      <main className="main">
        {page === "dashboard" && <Dashboard />}
        {page === "runs" && <Runs />}
      </main>
    </div>
  );
}
