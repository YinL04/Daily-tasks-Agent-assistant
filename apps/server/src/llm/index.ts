import { MockProvider, OpenAICompatibleProvider } from "./openaiProvider.js";
import type { LLMConnectionStatus, LLMProvider } from "./provider.js";

export type { LLMConnectionStatus };

let cachedProvider: LLMProvider | null = null;

export function createLLMProvider(): LLMProvider {
  if (!cachedProvider) {
    const provider = new OpenAICompatibleProvider();
    cachedProvider = provider.enabled ? provider : new MockProvider();
  }
  return cachedProvider;
}

export async function testLLMConnection(): Promise<LLMConnectionStatus & { provider: string }> {
  const provider = createLLMProvider();
  const status = await provider.testConnection();
  return { ...status, provider: provider.modelInfo.configured ? "openai_compatible" : "mock" };
}
