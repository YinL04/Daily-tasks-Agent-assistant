export interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
}

export interface LLMConnectionStatus {
  ok: boolean;
  model: string;
  latencyMs: number;
  error?: string;
}

export interface LLMProvider {
  generateText(prompt: string, options?: LLMOptions): Promise<string>;
  generateJSON<T>(prompt: string, schemaHint: string, options?: LLMOptions): Promise<T>;
  testConnection(): Promise<LLMConnectionStatus>;
  readonly modelInfo: { model: string; baseUrl: string; configured: boolean };
}
