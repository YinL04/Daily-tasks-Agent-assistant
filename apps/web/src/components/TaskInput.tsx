import { Play } from "lucide-react";

interface Props {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function TaskInput({ value, loading, onChange, onSubmit }: Props) {
  return (
    <section className="panel input-panel">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="例如：帮我规划下周的学习安排。我想每天学 2 小时 TypeScript，还想周三前完成一个 React 小项目，并生成一个计划文档。"
      />
      <button className="primary-button" disabled={loading} onClick={onSubmit} title="运行 Agent">
        <Play size={18} /> {loading ? "运行中" : "运行 Agent"}
      </button>
    </section>
  );
}
