import type { LLMOptions, LLMProvider } from "./provider.js";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/+$/, "");
}

export class OpenAICompatibleProvider implements LLMProvider {
  constructor(
    private config = {
      apiKey: process.env.LLM_API_KEY,
      model: process.env.LLM_MODEL_ID || "gpt-4o-mini",
      baseUrl: normalizeBaseUrl(process.env.LLM_BASE_URL || "https://api.openai.com/v1")
    }
  ) {}

  get enabled() {
    return Boolean(this.config.apiKey);
  }

  get modelInfo() {
    return { model: this.config.model, baseUrl: this.config.baseUrl, configured: this.enabled };
  }

  async testConnection(): Promise<{ ok: boolean; model: string; latencyMs: number; error?: string }> {
    if (!this.enabled) return { ok: false, model: this.config.model, latencyMs: 0, error: "API key not configured" };
    const start = Date.now();
    try {
      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify({
          model: this.config.model,
          messages: [{ role: "user", content: "请回复「连接成功」四个字。" }],
          max_tokens: 20
        })
      });
      const latencyMs = Date.now() - start;
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        return {
          ok: false,
          model: this.config.model,
          latencyMs,
          error: `HTTP ${response.status}: ${detail.slice(0, 100)}`
        };
      }
      const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
      const content = data.choices?.[0]?.message?.content ?? "";
      return { ok: true, model: this.config.model, latencyMs, error: content ? undefined : "Empty response" };
    } catch (error) {
      return {
        ok: false,
        model: this.config.model,
        latencyMs: Date.now() - start,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  async generateText(prompt: string, options: LLMOptions = {}) {
    if (!this.enabled) return "";
    const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.config.apiKey}`
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          {
            role: "system",
            content: "你是一个严谨的中文个人事务规划 Agent。请优先返回结构化、可执行、不过度臆测的结果。"
          },
          { role: "user", content: prompt }
        ],
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 1600
      })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`LLM request failed: ${response.status} ${detail.slice(0, 200)}`);
    }
    const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return data.choices?.[0]?.message?.content ?? "";
  }

  private parseJSON<T>(raw: string): T {
    // Strip markdown code fences: ```json ... ``` or ``` ... ```
    let cleaned = raw
      .replace(/```(?:json|JSON)?\s*\n?/g, "")
      .replace(/```\s*$/gm, "")
      .trim();

    // Extract JSON array or object
    const jsonMatch = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error(`No JSON found. Response: ${raw.slice(0, 200)}`);

    let json = jsonMatch[0];
    // Remove trailing commas before ] or } (common LLM mistake)
    json = json.replace(/,\s*([\]}])/g, "$1");

    return JSON.parse(json) as T;
  }

  async generateJSON<T>(prompt: string, schemaHint: string, options?: LLMOptions): Promise<T> {
    const maxRetries = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const text = await this.generateText(
        attempt === 0
          ? `${prompt}

你必须只返回一个合法的 JSON，不要添加任何解释、不要使用 Markdown 代码块。你的回复必须以 [ 或 { 字符开头。

结构参考：
${schemaHint}`
          : `上一次你返回的内容不是合法 JSON，请重试。

${prompt}

你必须只返回一个合法的 JSON，不要添加任何解释、不要使用 Markdown 代码块。你的回复必须以 [ 或 { 字符开头。

结构参考：
${schemaHint}`,
        { ...options, temperature: 0.1 }
      );

      try {
        return this.parseJSON<T>(text);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`JSON parse attempt ${attempt + 1} failed: ${lastError.message}`);
      }
    }

    throw lastError || new Error("LLM did not return valid JSON after retries");
  }
}

export class MockProvider implements LLMProvider {
  get modelInfo() {
    return { model: "mock", baseUrl: "", configured: false };
  }

  async testConnection() {
    return { ok: false, model: "mock", latencyMs: 0, error: "未配置 LLM API Key，使用本地 Mock 模式" };
  }

  async generateText() {
    return "已使用本地 fallback 生成规划。";
  }

  async generateJSON<T>(): Promise<T> {
    return {} as T;
  }
}
