import { useEffect, useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import { templatesApi, type ScenarioTemplate } from "../lib/api";

interface Props {
  onUseTemplate: (prompt: string) => void;
}

export default function TemplatesPage({ onUseTemplate }: Props) {
  const [templates, setTemplates] = useState<ScenarioTemplate[]>([]);
  const [draft, setDraft] = useState({ title: "", prompt: "", category: "custom" as ScenarioTemplate["category"] });
  const [error, setError] = useState("");

  async function load() {
    setTemplates(await templatesApi.list());
  }

  useEffect(() => {
    void load();
  }, []);

  async function create() {
    if (!draft.title.trim() || !draft.prompt.trim()) return;
    await templatesApi.create({
      title: draft.title.trim(),
      prompt: draft.prompt.trim(),
      category: draft.category,
      defaultOptions: { generateFiles: true, generateCalendar: true, useMemory: true }
    });
    setDraft({ title: "", prompt: "", category: "custom" });
    await load();
  }

  async function remove(id: string) {
    try {
      setError("");
      await templatesApi.delete(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "内置模板不可删除");
    }
  }

  return (
    <div className="tool-page">
      <header className="page-head">
        <h1>场景模板</h1>
        <p>选择一个模板即可把提示词带回对话输入框。</p>
      </header>
      <section className="panel compact-panel inline-form">
        <select
          value={draft.category}
          onChange={(event) => setDraft({ ...draft, category: event.target.value as ScenarioTemplate["category"] })}
        >
          {["study", "travel", "project", "health", "review", "custom"].map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
        <input
          placeholder="模板名称"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
        />
        <input
          placeholder="提示词"
          value={draft.prompt}
          onChange={(event) => setDraft({ ...draft, prompt: event.target.value })}
        />
        <button className="primary-button compact" onClick={() => void create()}>
          <Plus size={16} /> 新增
        </button>
      </section>
      {error && <p className="error">{error}</p>}
      <section className="item-grid">
        {templates.map((template) => (
          <article className="panel item-card" key={template.id}>
            <div className="item-head">
              <strong>{template.title}</strong>
              <span>{template.category}</span>
            </div>
            <p>{template.prompt}</p>
            <div className="card-actions">
              <button onClick={() => onUseTemplate(template.prompt)}>
                <Play size={15} /> 使用
              </button>
              <button className="danger-text" onClick={() => void remove(template.id)}>
                <Trash2 size={15} /> 删除
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
