import { useEffect, useState } from "react";
import { CalendarDays, History, MessageSquare, MessageSquarePlus, RefreshCw } from "lucide-react";
import CalendarView from "./components/CalendarView";
import Dashboard from "./pages/Dashboard";
import Runs from "./pages/Runs";
import { conversationsApi, testLLMConnection, type ConversationSummary, type LLMConnectionTest } from "./lib/api";

function LLMStatusMini() {
  const [llmTest, setLlmTest] = useState<LLMConnectionTest | null>(null);
  const [loading, setLoading] = useState(false);

  async function checkLLM() {
    setLoading(true);
    try {
      setLlmTest(await testLLMConnection());
    } catch {
      setLlmTest({ ok: false, model: "unknown", latencyMs: 0, error: "无法连接后端", provider: "unknown" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void checkLLM();
  }, []);

  return (
    <section className="sidebar-status">
      <div className="sidebar-status-head">
        <span>LLM 连接</span>
        <button className="sidebar-icon-button" onClick={checkLLM} disabled={loading} title="重新检测">
          <RefreshCw size={14} />
        </button>
      </div>
      {llmTest ? (
        <>
          <div className="sidebar-status-row">
            <span className={`llm-dot ${llmTest.ok ? "connected" : "disconnected"}`} />
            <strong>{llmTest.ok ? "已连接" : "未连接"}</strong>
            {llmTest.ok && <small>{llmTest.latencyMs}ms</small>}
          </div>
          <div className="sidebar-model" title={llmTest.model}>{llmTest.model}</div>
          {llmTest.error && <small className="sidebar-status-error">{llmTest.error}</small>}
        </>
      ) : (
        <small className="sidebar-status-muted">检测中...</small>
      )}
    </section>
  );
}

export default function App() {
  const [page, setPage] = useState<"dashboard" | "calendar" | "runs">("dashboard");
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [conversationError, setConversationError] = useState("");

  async function refreshConversations(selectId?: string) {
    try {
      const list = await conversationsApi.list();
      setConversations(list);
      if (selectId) {
        setSelectedConversationId(selectId);
      } else if (!selectedConversationId && list[0]) {
        setSelectedConversationId(list[0].id);
      }
      setConversationError("");
    } catch (error) {
      setConversationError(error instanceof Error ? error.message : "会话加载失败");
    }
  }

  async function createConversation() {
    try {
      const conversation = await conversationsApi.create();
      setSelectedConversationId(conversation.id);
      setPage("dashboard");
      await refreshConversations(conversation.id);
    } catch (error) {
      setConversationError(error instanceof Error ? error.message : "创建会话失败");
    }
  }

  useEffect(() => {
    void refreshConversations();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">日常事务 Agent</div>
        <LLMStatusMini />
        <button className="nav new-chat" onClick={createConversation}>
          <MessageSquarePlus size={18} /> 新对话
        </button>
        <div className="conversation-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={conversation.id === selectedConversationId && page === "dashboard" ? "conversation-item active" : "conversation-item"}
              onClick={() => {
                setSelectedConversationId(conversation.id);
                setPage("dashboard");
              }}
              title={conversation.lastMessage || conversation.title}
            >
              <span>{conversation.title}</span>
              <small>{conversation.messageCount} 条消息</small>
            </button>
          ))}
          {conversationError && <small className="sidebar-error">{conversationError}</small>}
        </div>
        <button className={page === "dashboard" || page === "calendar" ? "nav active" : "nav"} onClick={() => setPage("dashboard")}>
          <MessageSquare size={18} /> 工作台
        </button>
        <div className="subnav">
          <button className={page === "dashboard" ? "subnav-item active" : "subnav-item"} onClick={() => setPage("dashboard")}>
            对话
          </button>
          <button className={page === "calendar" ? "subnav-item active" : "subnav-item"} onClick={() => setPage("calendar")}>
            <CalendarDays size={15} /> 日历
          </button>
        </div>
        <button className={page === "runs" ? "nav active" : "nav"} onClick={() => setPage("runs")}>
          <History size={18} /> 历史记录
        </button>
      </aside>
      <main className="main">
        {page === "dashboard" && (
          <Dashboard
            conversationId={selectedConversationId}
            onConversationCreated={(id) => {
              setSelectedConversationId(id);
              void refreshConversations(id);
            }}
            onConversationUpdated={() => void refreshConversations(selectedConversationId)}
          />
        )}
        {page === "calendar" && (
          <div className="calendar-page">
            <header className="page-head">
              <h1>日历</h1>
              <p>Agent 生成的安排和手动新增的日程都集中在这里。</p>
            </header>
            <CalendarView />
          </div>
        )}
        {page === "runs" && <Runs />}
      </main>
    </div>
  );
}
