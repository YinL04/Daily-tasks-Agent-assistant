import { useEffect, useState } from "react";
import { Archive, Check, Plus, Save, Trash2 } from "lucide-react";
import { memoriesApi, type MemoryItem, type MemoryStats } from "../lib/api";

const memoryTypes = ["preference", "habit", "constraint", "profile", "project", "other"] as const;

export default function MemoryPage() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [status, setStatus] = useState<MemoryItem["status"] | "all">("pending");
  const [draft, setDraft] = useState({ key: "", value: "", type: "preference" as MemoryItem["type"] });
  const [error, setError] = useState("");

  async function load() {
    setItems(await memoriesApi.list());
    setStats(await memoriesApi.stats());
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    if (!draft.key.trim() || !draft.value.trim()) return;
    await memoriesApi.create({
      key: draft.key.trim(),
      value: draft.value.trim(),
      type: draft.type,
      source: "user_explicit",
      status: "active",
      layer: "long",
      confidence: 0.9
    });
    setDraft({ key: "", value: "", type: "preference" });
    await load();
  }

  async function action(fn: () => Promise<unknown>) {
    try {
      setError("");
      await fn();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    }
  }

  const visible = items.filter((item) => status === "all" || item.status === status);

  return (
    <div className="tool-page">
      <header className="page-head">
        <h1>记忆管理</h1>
        <p>Agent 推断记忆默认 pending，确认后才会进入长期上下文。</p>
      </header>
      <section className="panel compact-panel">
        <div className="stats-row">
          <span>全部 {stats?.total ?? 0}</span>
          <span>待确认 {stats?.pending ?? 0}</span>
          <span>生效 {stats?.active ?? 0}</span>
          <span>归档 {stats?.archived ?? 0}</span>
        </div>
        <div className="segmented">
          {(["pending", "active", "archived", "all"] as const).map((item) => (
            <button key={item} className={status === item ? "active" : ""} onClick={() => setStatus(item)}>
              {item === "pending" ? "待确认" : item === "active" ? "生效" : item === "archived" ? "归档" : "全部"}
            </button>
          ))}
        </div>
        <div className="inline-form">
          <select
            value={draft.type}
            onChange={(event) => setDraft({ ...draft, type: event.target.value as MemoryItem["type"] })}
          >
            {memoryTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
          <input
            placeholder="key"
            value={draft.key}
            onChange={(event) => setDraft({ ...draft, key: event.target.value })}
          />
          <input
            placeholder="value"
            value={draft.value}
            onChange={(event) => setDraft({ ...draft, value: event.target.value })}
          />
          <button className="primary-button compact" onClick={() => void action(create)}>
            <Plus size={16} /> 新增
          </button>
        </div>
        {error && <p className="error">{error}</p>}
      </section>
      <section className="item-grid">
        {visible.map((item) => (
          <article className="panel item-card" key={item.id}>
            <div className="item-head">
              <strong>{item.key}</strong>
              <span>{item.status}</span>
            </div>
            <textarea
              value={item.value}
              onChange={(event) =>
                setItems((current) =>
                  current.map((memory) => (memory.id === item.id ? { ...memory, value: event.target.value } : memory))
                )
              }
            />
            <div className="inline-form">
              <select
                value={item.type}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((memory) =>
                      memory.id === item.id ? { ...memory, type: event.target.value as MemoryItem["type"] } : memory
                    )
                  )
                }
              >
                {memoryTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <select
                value={item.layer}
                onChange={(event) =>
                  setItems((current) =>
                    current.map((memory) =>
                      memory.id === item.id ? { ...memory, layer: event.target.value as MemoryItem["layer"] } : memory
                    )
                  )
                }
              >
                <option value="long">长期</option>
                <option value="working">工作记忆</option>
              </select>
            </div>
            <small>
              {item.type} · {item.source} · 命中 {item.hitCount}
            </small>
            <div className="card-actions">
              {item.status !== "active" && (
                <button onClick={() => void action(() => memoriesApi.confirm(item.id))}>
                  <Check size={15} /> 确认
                </button>
              )}
              {item.status !== "archived" && (
                <button onClick={() => void action(() => memoriesApi.archive(item.id))}>
                  <Archive size={15} /> 归档
                </button>
              )}
              <button
                onClick={() =>
                  void action(() =>
                    memoriesApi.update(item.id, { value: item.value, type: item.type, layer: item.layer })
                  )
                }
              >
                <Save size={15} /> 保存
              </button>
              <button className="danger-text" onClick={() => void action(() => memoriesApi.delete(item.id))}>
                <Trash2 size={15} /> 删除
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
