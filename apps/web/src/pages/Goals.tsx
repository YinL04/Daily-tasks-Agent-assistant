import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { goalsApi, reviewsApi, type LongTermGoal, type PeriodicReview } from "../lib/api";

function nextWeek() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString();
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<LongTermGoal[]>([]);
  const [reviews, setReviews] = useState<PeriodicReview[]>([]);
  const [goalDraft, setGoalDraft] = useState({ title: "", description: "" });
  const [reviewDraft, setReviewDraft] = useState({ title: "", summary: "" });

  async function load() {
    setGoals(await goalsApi.list());
    setReviews(await reviewsApi.list());
  }

  useEffect(() => {
    void load();
  }, []);

  async function createGoal() {
    if (!goalDraft.title.trim()) return;
    await goalsApi.create({
      title: goalDraft.title.trim(),
      description: goalDraft.description.trim(),
      horizon: "quarterly",
      status: "active",
      tags: [],
      reviewCycle: "weekly",
      nextReviewAt: nextWeek()
    });
    setGoalDraft({ title: "", description: "" });
    await load();
  }

  async function createReview() {
    if (!reviewDraft.title.trim()) return;
    await reviewsApi.create({
      title: reviewDraft.title.trim(),
      summary: reviewDraft.summary.trim(),
      wins: [],
      blockers: [],
      nextActions: []
    });
    setReviewDraft({ title: "", summary: "" });
    await load();
  }

  return (
    <div className="tool-page">
      <header className="page-head">
        <h1>长期目标与复盘</h1>
        <p>把跨周目标和周期复盘沉淀下来，作为后续规划的上层参照。</p>
      </header>
      <div className="two-column">
        <section className="panel compact-panel">
          <h2>长期目标</h2>
          <div className="inline-form vertical">
            <input
              placeholder="目标标题"
              value={goalDraft.title}
              onChange={(event) => setGoalDraft({ ...goalDraft, title: event.target.value })}
            />
            <textarea
              placeholder="目标说明"
              value={goalDraft.description}
              onChange={(event) => setGoalDraft({ ...goalDraft, description: event.target.value })}
            />
            <button className="primary-button compact" onClick={() => void createGoal()}>
              <Plus size={16} /> 新增目标
            </button>
          </div>
          <div className="stack-list">
            {goals.map((goal) => (
              <article className="mini-row" key={goal.id}>
                <div>
                  <strong>{goal.title}</strong>
                  <small>
                    {goal.status} · 下次复盘 {new Date(goal.nextReviewAt).toLocaleDateString()}
                  </small>
                </div>
                <button className="icon-button" onClick={() => void goalsApi.delete(goal.id).then(load)} title="删除">
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>
        <section className="panel compact-panel">
          <h2>周期复盘</h2>
          <div className="inline-form vertical">
            <input
              placeholder="复盘标题"
              value={reviewDraft.title}
              onChange={(event) => setReviewDraft({ ...reviewDraft, title: event.target.value })}
            />
            <textarea
              placeholder="本周期总结"
              value={reviewDraft.summary}
              onChange={(event) => setReviewDraft({ ...reviewDraft, summary: event.target.value })}
            />
            <button className="primary-button compact" onClick={() => void createReview()}>
              <Plus size={16} /> 新增复盘
            </button>
          </div>
          <div className="stack-list">
            {reviews.map((review) => (
              <article className="mini-row" key={review.id}>
                <div>
                  <strong>{review.title}</strong>
                  <small>{review.summary || "暂无总结"}</small>
                </div>
                <button
                  className="icon-button"
                  onClick={() => void reviewsApi.delete(review.id).then(load)}
                  title="删除"
                >
                  <Trash2 size={15} />
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
