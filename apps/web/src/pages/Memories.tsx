import MemoryPanel from "../components/MemoryPanel";

export default function Memories() {
  return (
    <div>
      <header className="page-head">
        <h1>记忆管理</h1>
        <p>长期记忆只保存稳定、重复、对未来有帮助的信息；所有推断记忆都可以查看和删除。</p>
      </header>
      <MemoryPanel />
    </div>
  );
}
