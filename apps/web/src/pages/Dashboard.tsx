import { useEffect, useState } from "react";
import CalendarView from "../components/CalendarView";
import PlanFilePanel from "../components/PlanFilePanel";
import TaskInput from "../components/TaskInput";
import TaskList from "../components/TaskList";
import UrlList from "../components/UrlList";
import { runAgent, testLLMConnection, type AgentResult, type LLMConnectionTest } from "../lib/api";

export default function Dashboard() {
  const [input, setInput] = useState("");
  const [result, setResult] = useState<AgentResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [llmTest, setLlmTest] = useState<LLMConnectionTest | null>(null);
  const [llmTesting, setLlmTesting] = useState(false);

  async function checkLLM() {
    setLlmTesting(true);
    try {
      setLlmTest(await testLLMConnection());
    } catch {
      setLlmTest({ ok: false, model: "unknown", latencyMs: 0, error: "无法连接后端", provider: "unknown" });
    } finally {
      setLlmTesting(false);
    }
  }

  useEffect(() => { checkLLM(); }, []);

  async function submit() {
    setLoading(true);
    setError("");
    try {
      setResult(await runAgent(input));
    } catch (err) {
      setError(err instanceof Error ? err.message : "运行失败");
    } finally {
      setLoading(false);
    }
  }

  const llmSteps = result?.steps.filter(s => s.usedLLM) ?? [];
  const fallbackSteps = result?.steps.filter(s => s.usedLLM === false) ?? [];

  return (
    <div className="dashboard">
      <header className="page-head">
        <h1>工作台</h1>
        <p>输入事务、目标、待办、链接或文件需求，Agent 会拆解任务、安排日历并生成计划文件。</p>
      </header>

      {/* LLM Connection Status Panel */}
      <section className="panel llm-status-panel">
        <div className="llm-status-header">
          <h2>LLM 连接状态</h2>
          <button className="icon-button" onClick={checkLLM} disabled={llmTesting} title="重新测试">
            {llmTesting ? "..." : "↻"}
          </button>
        </div>
        {llmTest ? (
          <div className="llm-status-content">
            <div className="llm-status-row">
              <span className={`llm-dot ${llmTest.ok ? "connected" : "disconnected"}`} />
              <span className="llm-label">{llmTest.ok ? "已连接" : "未连接"}</span>
              <span className="llm-model">{llmTest.model}</span>
              {llmTest.ok && <span className="llm-latency">{llmTest.latencyMs}ms</span>}
            </div>
            {llmTest.error && <p className="llm-error">{llmTest.error}</p>}
            {!llmTest.ok && (
              <p className="llm-hint">
                LLM 未连接，Agent 将使用本地规则生成结果（非 AI 智能分析）。请在 <code>.env</code> 中配置 <code>LLM_API_KEY</code>、<code>LLM_BASE_URL</code> 和 <code>LLM_MODEL_ID</code>。
              </p>
            )}
          </div>
        ) : (
          <p className="llm-testing">正在测试 LLM 连接...</p>
        )}
      </section>

      <TaskInput value={input} loading={loading} onChange={setInput} onSubmit={submit} />
      {error && <p className="error">{error}</p>}
      <CalendarView refreshKey={result?.runId} />
      {result && (
        <>
          {/* LLM Usage Report from this run */}
          {result.llmStatus && (
            <section className="panel llm-usage-panel">
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
                  <span className="llm-usage-value">{llmSteps.length} / {result.steps.length}</span>
                </div>
                <div className="llm-usage-item">
                  <span className="llm-usage-label">本地步骤</span>
                  <span className="llm-usage-value">{fallbackSteps.length} / {result.steps.length}</span>
                </div>
                {result.llmStatus.latencyMs != null && result.llmStatus.connected && (
                  <div className="llm-usage-item">
                    <span className="llm-usage-label">响应延迟</span>
                    <span className="llm-usage-value">{result.llmStatus.latencyMs}ms</span>
                  </div>
                )}
              </div>
              {!result.llmStatus.connected && (
                <p className="llm-warn">本次运行未使用 AI 模型，结果由本地规则生成。</p>
              )}
            </section>
          )}

          <section className="panel summary">
            <h2>执行结果</h2>
            <p>{result.finalAnswer}</p>
            <div className="recommendations">
              {result.recommendations.map((item) => <span key={item}>{item}</span>)}
            </div>
          </section>
          <div className="two-column">
            <TaskList tasks={result.tasks} />
            <UrlList urls={result.urls} />
          </div>
          <div className="two-column">
            <PlanFilePanel files={result.files} />
            <section className="panel">
              <h2>执行日志</h2>
              <details open>
                <summary>Agent steps</summary>
                <div className="step-list">
                  {result.steps.map((step) => (
                    <div className={`step-row ${step.usedLLM ? "step-llm" : "step-local"}`} key={step.id}>
                      <div className="step-info">
                        <strong>{step.name}</strong>
                        <span>{step.skillName}</span>
                      </div>
                      <div className="step-meta">
                        <span className={`step-badge ${step.usedLLM ? "badge-ai" : "badge-local"}`}>
                          {step.usedLLM ? "AI" : "本地"}
                        </span>
                        <small>{step.outputSummary}</small>
                      </div>
                    </div>
                  ))}
                </div>
              </details>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
