import type { PlannedTask } from "../lib/api";

export default function TaskList({ tasks }: { tasks: PlannedTask[] }) {
  return (
    <section className="panel">
      <h2>任务列表</h2>
      <div className="task-list">
        {tasks.map((task) => (
          <article className="task-row" key={task.id}>
            <div>
              <strong>{task.title}</strong>
              <p>{task.description}</p>
              <small>
                {task.estimatedMinutes} 分钟 · 截止 {task.dueDate || "未设置"} · {task.tags.join(", ")}
              </small>
            </div>
            <span className={`badge ${task.priority}`}>{task.priority}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
