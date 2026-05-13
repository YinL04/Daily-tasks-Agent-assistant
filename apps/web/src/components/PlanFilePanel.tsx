import { Download } from "lucide-react";
import type { GeneratedFile } from "../lib/api";

export default function PlanFilePanel({ files }: { files: GeneratedFile[] }) {
  return (
    <section className="panel">
      <h2>生成文件</h2>
      <div className="file-list">
        {files.map((file) => (
          <a className="file-row" href={file.downloadUrl} key={file.filename}>
            <Download size={16} />
            <span>{file.filename}</span>
            <small>{file.type}</small>
          </a>
        ))}
      </div>
    </section>
  );
}
