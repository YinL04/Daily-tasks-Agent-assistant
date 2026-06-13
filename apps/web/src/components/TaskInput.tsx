import { Play, Square } from "lucide-react";

interface Props {
  value: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onStop?: () => void;
}

export default function TaskInput({ value, loading, onChange, onSubmit, onStop }: Props) {
  return (
    <section className="panel input-panel">
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="例如：帮我规划下周的学习安排。我想每天学 2 小时 TypeScript，还想周三前完成一个 React 小项目，并生成一个计划文档。"
        disabled={loading}
      />
      <div className="input-actions">
        <button className="primary-button" disabled={loading || !value.trim()} onClick={onSubmit} title="发送消息">
          <Play size={18} /> 发送
        </button>
        {loading && (
          <button className="danger-button stop-button" onClick={onStop} title="停止运行">
            <Square size={16} /> 停止
          </button>
        )}
      </div>
    </section>
  );
}
