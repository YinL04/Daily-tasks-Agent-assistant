import type { AgentContext, Skill, UrlReference } from "../agent/types.js";
import { createLLMProvider } from "../llm/index.js";

const urlRegex = /https?:\/\/[^\s"'<>]+/g;

export const urlCollectorSkill: Skill<AgentContext, UrlReference[]> = {
  name: "url_collector",
  description: "提取用户 URL 并根据具体任务场景推荐相关参考链接。",
  async execute(context) {
    // Extract user-provided URLs
    const urls: UrlReference[] = [...context.input.matchAll(urlRegex)].map((match) => ({
      title: match[0],
      url: match[0],
      reason: "用户输入中提供的链接。",
      category: "user_provided" as const
    }));

    // Use LLM to suggest relevant URLs based on the actual input
    const provider = createLLMProvider();
    try {
      const suggested = await provider.generateJSON<Array<{ title: string; url: string; reason: string }>>(
        `根据用户输入的具体内容，推荐 3-5 个真正有帮助的参考链接。

要求：
- 链接必须与用户描述的具体事务直接相关
- 推荐真实的、常用的网站或工具
- 说明推荐理由，要结合用户的具体场景
- 不要推荐与用户输入无关的通用网站

用户输入：
${context.input}

已提取的用户链接（不要重复）：
${urls.map((u) => u.url).join("\n") || "无"}`,
        `[{"title": "网站名称", "url": "https://...", "reason": "推荐理由"}]`,
        { temperature: 0.3, maxTokens: 600 }
      );
      if (Array.isArray(suggested)) {
        for (const item of suggested) {
          if (item.url && item.title) {
            urls.push({
              title: item.title,
              url: item.url,
              reason: item.reason || "AI 推荐。",
              category: "suggested"
            });
          }
        }
      }
    } catch (error) {
      console.warn("LLM URL suggestion failed:", error instanceof Error ? error.message : error);
    }

    return urls;
  }
};
