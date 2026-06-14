import { useEffect, useState } from "react";
import { Download, Trash2 } from "lucide-react";
import { filesApi, type GeneratedFile } from "../lib/api";

export default function FilesPage() {
  const [files, setFiles] = useState<GeneratedFile[]>([]);
  const [days, setDays] = useState(30);
  const [message, setMessage] = useState("");

  async function load() {
    setFiles(await filesApi.list());
  }

  useEffect(() => {
    void load();
  }, []);

  async function cleanup() {
    const result = await filesApi.cleanup(days);
    setMessage(`已清理 ${result.count} 个文件`);
    await load();
  }

  return (
    <div className="tool-page">
      <header className="page-head">
        <h1>生成文件</h1>
        <p>管理 Markdown、JSON、CSV 和 ICS 导出文件。</p>
      </header>
      <section className="panel compact-panel inline-form">
        <input type="number" min={0} value={days} onChange={(event) => setDays(Number(event.target.value))} />
        <button className="primary-button compact" onClick={() => void cleanup()}>
          <Trash2 size={16} /> 清理旧文件
        </button>
        {message && <small>{message}</small>}
      </section>
      <section className="stack-list">
        {files.map((file) => (
          <article className="panel mini-row" key={file.filename}>
            <div>
              <strong>{file.filename}</strong>
              <small>
                {file.type} · {file.size ?? 0} bytes{" "}
                {file.updatedAt ? `· ${new Date(file.updatedAt).toLocaleString()}` : ""}
              </small>
            </div>
            <div className="card-actions">
              <a className="button-link" href={file.downloadUrl}>
                <Download size={15} /> 下载
              </a>
              <button className="danger-text" onClick={() => void filesApi.delete(file.filename).then(load)}>
                <Trash2 size={15} /> 删除
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
