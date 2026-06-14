import { useEffect, useState } from "react";
import {
  Brain,
  CalendarDays,
  FileText,
  History,
  MessageSquare,
  MessageSquarePlus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2
} from "lucide-react";
import CalendarView from "./components/CalendarView";
import Dashboard from "./pages/Dashboard";
import FilesPage from "./pages/Files";
import GoalsPage from "./pages/Goals";
import MemoryPage from "./pages/Memory";
import Runs from "./pages/Runs";
import TemplatesPage from "./pages/Templates";
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
          <div className="sidebar-model" title={llmTest.model}>
            {llmTest.model}
          </div>
          {llmTest.error && <small className="sidebar-status-error">{llmTest.error}</small>}
        </>
      ) : (
        <small className="sidebar-status-muted">检测中...</small>
      )}
    </section>
  );
}

export default function App() {
  const [page, setPage] = useState<"dashboard" | "calendar" | "templates" | "memory" | "goals" | "files" | "runs">(
    "dashboard"
  );
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [conversationError, setConversationError] = useState("");
  const [templateInput, setTemplateInput] = useState("");

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

  async function deleteConversation(id: string) {
    const conversation = conversations.find((item) => item.id === id);
    const confirmed = window.confirm(
      `删除对话「${conversation?.title || "未命名对话"}」？此操作不会删除历史运行记录。`
    );
    if (!confirmed) return;
    try {
      await conversationsApi.delete(id);
      const nextList = conversations.filter((item) => item.id !== id);
      setConversations(nextList);
      if (selectedConversationId === id) {
        setSelectedConversationId(nextList[0]?.id);
        setPage("dashboard");
      }
      await refreshConversations(nextList[0]?.id);
    } catch (error) {
      setConversationError(error instanceof Error ? error.message : "删除会话失败");
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
            <div
              key={conversation.id}
              className={
                conversation.id === selectedConversationId && page === "dashboard"
                  ? "conversation-row active"
                  : "conversation-row"
              }
              title={conversation.lastMessage || conversation.title}
            >
              <button
                className="conversation-item"
                onClick={() => {
                  setSelectedConversationId(conversation.id);
                  setPage("dashboard");
                }}
              >
                <span>{conversation.title}</span>
                <small>{conversation.messageCount} 条消息</small>
              </button>
              <button
                className="conversation-delete"
                onClick={() => void deleteConversation(conversation.id)}
                title="删除对话"
                aria-label={`删除对话 ${conversation.title}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {conversationError && <small className="sidebar-error">{conversationError}</small>}
        </div>
        <button className={page !== "runs" ? "nav active" : "nav"} onClick={() => setPage("dashboard")}>
          <MessageSquare size={18} /> 工作台
        </button>
        <div className="subnav">
          <button
            className={page === "dashboard" ? "subnav-item active" : "subnav-item"}
            onClick={() => setPage("dashboard")}
          >
            对话
          </button>
          <button
            className={page === "calendar" ? "subnav-item active" : "subnav-item"}
            onClick={() => setPage("calendar")}
          >
            <CalendarDays size={15} /> 日历
          </button>
          <button
            className={page === "templates" ? "subnav-item active" : "subnav-item"}
            onClick={() => setPage("templates")}
          >
            <Sparkles size={15} /> 模板
          </button>
          <button
            className={page === "memory" ? "subnav-item active" : "subnav-item"}
            onClick={() => setPage("memory")}
          >
            <Brain size={15} /> 记忆
          </button>
          <button className={page === "goals" ? "subnav-item active" : "subnav-item"} onClick={() => setPage("goals")}>
            <Target size={15} /> 目标
          </button>
          <button className={page === "files" ? "subnav-item active" : "subnav-item"} onClick={() => setPage("files")}>
            <FileText size={15} /> 文件
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
            initialInput={templateInput}
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
        {page === "templates" && (
          <TemplatesPage
            onUseTemplate={(prompt) => {
              setTemplateInput(prompt);
              setPage("dashboard");
            }}
          />
        )}
        {page === "memory" && <MemoryPage />}
        {page === "goals" && <GoalsPage />}
        {page === "files" && <FilesPage />}
        {page === "runs" && <Runs />}
      </main>
    </div>
  );
}
