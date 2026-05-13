import { useEffect, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { memoryApi, type MemoryItem } from "../lib/api";

const emptyForm = {
  type: "preference" as MemoryItem["type"],
  key: "",
  value: "",
  confidence: 0.8,
  source: "user_explicit" as MemoryItem["source"]
};

export default function MemoryPanel() {
  const [items, setItems] = useState<MemoryItem[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

  async function load() {
    setItems(await memoryApi.list());
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    try {
      setError("");
      await memoryApi.create(form);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function remove(id: string) {
    await memoryApi.delete(id);
    await load();
  }

  async function update(id: string, patch: Partial<MemoryItem>) {
    await memoryApi.update(id, patch);
    await load();
  }

  return (
    <section className="panel memory-panel">
      <h2>长期记忆</h2>
      <div className="memory-form">
        <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as MemoryItem["type"] })}>
          <option value="preference">偏好</option>
          <option value="habit">习惯</option>
          <option value="constraint">约束</option>
          <option value="profile">档案</option>
          <option value="project">项目</option>
          <option value="other">其他</option>
        </select>
        <input value={form.key} onChange={(event) => setForm({ ...form, key: event.target.value })} placeholder="key" />
        <input value={form.value} onChange={(event) => setForm({ ...form, value: event.target.value })} placeholder="value" />
        <button className="icon-button" onClick={create} title="新增记忆"><Plus size={18} /></button>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="memory-list">
        {items.map((item) => (
          <article className="memory-row" key={item.id}>
            <div>
              <strong>{item.key}</strong>
              <input value={item.value} onChange={(event) => update(item.id, { value: event.target.value })} />
              <small>{item.type} · confidence {item.confidence.toFixed(2)} · {item.source}</small>
            </div>
            <button className="icon-button" title="保存变更" onClick={() => update(item.id, item)}><Save size={16} /></button>
            <button className="icon-button danger" title="删除记忆" onClick={() => remove(item.id)}><Trash2 size={16} /></button>
          </article>
        ))}
      </div>
    </section>
  );
}
