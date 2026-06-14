import { useEffect, useRef, useState } from "react";
import PlanFilePanel from "../components/PlanFilePanel";
import TaskInput from "../components/TaskInput";
import TaskList from "../components/TaskList";
import UrlList from "../components/UrlList";
import {
  conversationsApi,
  runAgentStream,
  type AgentResult,
  type AgentRunEvent,
  type AgentStepLog,
  type Conversation,
  type Message
} from "../lib/api";

interface Props {
  conversationId?: string;
  initialInput?: string;
  onConversationCreated: (id: string) => void;
  onConversationUpdated: () => void;
}

function ExecutionLog({ steps }: { steps: AgentStepLog[] }) {
  if (steps.length === 0) return null;
  return (
    <section className="panel compact-panel">
      <h2>执行日志</h2>
      <div className="step-list">
        {steps.map((step) => (
          <div
            className={`step-row ${step.status === "error" ? "step-error" : step.usedLLM ? "step-llm" : "step-local"}`}
            key={step.id}
          >
            <div className="step-info">
              <strong>{step.name}</strong>
              <span>{step.skillName || step.action}</span>
              {step.thought && (
                <small>
                  <b>Thought</b>：{step.thought}
                </small>
              )}
              {step.action && (
                <small>
                  <b>Action</b>：{step.action}
                </small>
              )}
            </div>
            <div className="step-meta">
              <span
                className={`step-badge ${step.status === "running" ? "badge-running" : step.usedLLM ? "badge-ai" : "badge-local"}`}
              >
                {step.status === "running" ? "运行中" : step.usedLLM ? "AI" : "本地"}
              </span>
              <small>
                <b>Observation</b>：{step.observation || step.outputSummary || "等待结果"}
              </small>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultBlock({ result }: { result: AgentResult }) {
  const llmSteps = result.steps.filter((step) => step.usedLLM);
  const localSteps = result.steps.filter((step) => step.usedLLM === false);

  return (
    <div className="result-block">
      {result.llmStatus && (
        <section className="panel compact-panel llm-usage-panel">
          <h2>AI 分析报告</h2>
          <div className="llm-usage-grid">
            <div className="llm-usage-item">
              <span className="llm-usage-label">AI 引擎</span>
              <span className={`llm-usage-value ${result.llmStatus.connected ? "ai" : "local"}`}>
                {result.llmStatus.connected ? result.llmStatus.model : "本地规则"}
              </span>
            </div>
            <div className="llm-usage-item">
              <span className="llm-usage-label">AI 步骤</span>
              <span className="llm-usage-value">
                {llmSteps.length} / {result.steps.length}
              </span>
            </div>
            <div className="llm-usage-item">
              <span className="llm-usage-label">本地步骤</span>
              <span className="llm-usage-value">
                {localSteps.length} / {result.steps.length}
              </span>
            </div>
          </div>
        </section>
      )}

      {result.finalAnswer && (
        <section className="panel compact-panel summary">
          <h2>执行结果</h2>
          <p>{result.finalAnswer}</p>
          <div className="recommendations">
            {result.recommendations.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>
      )}

      <div className="two-column">
        {result.tasks.length > 0 && <TaskList tasks={result.tasks} />}
        {result.urls.length > 0 && <UrlList urls={result.urls} />}
      </div>
      <div className="two-column">
        {result.files.length > 0 && <PlanFilePanel files={result.files} />}
        <ExecutionLog steps={result.steps} />
      </div>
    </div>
  );
}

function PendingResult({ steps, partial }: { steps: AgentStepLog[]; partial: Partial<AgentResult> }) {
  const result = partial as AgentResult;
  return (
    <div className="result-block">
      <section className="panel compact-panel running-panel">
        <h2>正在执行</h2>
        <p>Agent 正在读取上下文并逐步调用工具。</p>
      </section>
      <div className="two-column">
        {result.tasks?.length ? <TaskList tasks={result.tasks} /> : null}
        {result.urls?.length ? <UrlList urls={result.urls} /> : null}
      </div>
      <ExecutionLog steps={steps} />
    </div>
  );
}

export default function Dashboard({
  conversationId,
  initialInput,
  onConversationCreated,
  onConversationUpdated
}: Props) {
  const [input, setInput] = useState("");
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [liveSteps, setLiveSteps] = useState<AgentStepLog[]>([]);
  const [partialResult, setPartialResult] = useState<Partial<AgentResult>>({});
  const controllerRef = useRef<AbortController | null>(null);

  async function loadConversation(id?: string) {
    if (!id) {
      setConversation(null);
      setMessages([]);
      return;
    }
    try {
      const next = await conversationsApi.get(id);
      setConversation(next);
      setMessages(next.messages);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "会话加载失败");
    }
  }

  useEffect(() => {
    void loadConversation(conversationId);
  }, [conversationId]);

  useEffect(() => {
    if (initialInput) setInput(initialInput);
  }, [initialInput]);

  const title = conversation?.title || "新对话";

  async function ensureConversation() {
    if (conversationId) return conversationId;
    const created = await conversationsApi.create();
    onConversationCreated(created.id);
    setConversation(created);
    return created.id;
  }

  function upsertLiveStep(step: AgentStepLog) {
    setLiveSteps((current) => {
      const index = current.findIndex((item) => item.id === step.id);
      if (index === -1) return [...current, step];
      const next = [...current];
      next[index] = step;
      return next;
    });
  }

  async function submit() {
    const text = input.trim();
    if (!text || loading) return;
    setLoading(true);
    setError("");
    setInput("");
    setLiveSteps([]);
    setPartialResult({});

    try {
      const id = await ensureConversation();
      const now = new Date().toISOString();
      setMessages((current) => [
        ...current,
        { id: `local-user-${now}`, role: "user", content: text, createdAt: now },
        { id: `local-agent-${now}`, role: "assistant", content: "正在运行...", createdAt: now }
      ]);

      controllerRef.current = runAgentStream(text, id, {
        onEvent(event: AgentRunEvent) {
          if (event.type === "step" || event.type === "observation") upsertLiveStep(event.step);
          if (event.type === "partial") setPartialResult(event.result);
        },
        async onDone() {
          setLoading(false);
          controllerRef.current = null;
          await loadConversation(id);
          onConversationUpdated();
        },
        onError(message) {
          setError(message);
          setLoading(false);
          controllerRef.current = null;
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "运行失败");
      setLoading(false);
    }
  }

  function stopRun() {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setLoading(false);
    setError("已停止当前运行。");
  }

  return (
    <div className="dashboard chat-dashboard">
      <header className="page-head">
        <h1>{title}</h1>
        <p>在同一会话里逐步细化计划，Agent 会引用最近上下文并实时回传执行步骤。</p>
      </header>

      <section className="message-stream">
        {messages.length === 0 && (
          <div className="empty-chat">
            <h2>开始一个规划主题</h2>
            <p>例如学习计划、旅行准备、周报整理，后续可以直接说“预算改一下”或“换成下周”。</p>
          </div>
        )}
        {messages.map((message, index) => {
          const isPendingAssistant =
            loading && index === messages.length - 1 && message.role === "assistant" && !message.runResult;
          return (
            <article className={`message ${message.role}`} key={message.id}>
              <div className="message-head">
                <strong>{message.role === "user" ? "你" : "Agent"}</strong>
                <small>{new Date(message.createdAt).toLocaleString()}</small>
              </div>
              <p>{message.content}</p>
              {message.runResult && <ResultBlock result={message.runResult} />}
              {isPendingAssistant && <PendingResult steps={liveSteps} partial={partialResult} />}
            </article>
          );
        })}
      </section>

      {error && <p className="error">{error}</p>}
      <TaskInput value={input} loading={loading} onChange={setInput} onSubmit={submit} onStop={stopRun} />
    </div>
  );
}
