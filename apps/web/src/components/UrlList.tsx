import { ExternalLink } from "lucide-react";
import type { UrlReference } from "../lib/api";

export default function UrlList({ urls }: { urls: UrlReference[] }) {
  return (
    <section className="panel">
      <h2>相关网址</h2>
      <div className="url-list">
        {urls.map((item) => (
          <a key={`${item.title}-${item.url}`} href={item.url === "about:blank" ? undefined : item.url} target="_blank" rel="noreferrer" className="url-row">
            <ExternalLink size={16} />
            <div>
              <strong>{item.title}</strong>
              <p>{item.reason}</p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
