export type CredentialType = "api-key" | "base-url";
export type ProviderCategory = "cloud" | "local";

export interface ProviderRegistryEntry {
  id: string;
  displayName: string;
  credentialType: CredentialType;
  category: ProviderCategory;
  envVar?: string;
  defaultCredential?: string;
  modelsEndpoint?: string;
  parseModelsResponse?: (data: any) => string[];
  requiresRunningCheck: boolean;
  supportsKeepAlive: boolean;
  defaultBaseUrl?: string;
  keyConfig: {
    placeholder: string;
    inputType: "password" | "text";
    description: string;
    sensitive: boolean;
  };
}

export const PROVIDER_REGISTRY: Record<string, ProviderRegistryEntry> = {
  ollama: {
    defaultBaseUrl: "http://127.0.0.1:11434",
    id: "ollama",
    displayName: "Ollama",
    credentialType: "base-url",
    category: "local",
    envVar: "OLLAMA_BASE_URL",
    defaultCredential: "http://127.0.0.1:11434",
    modelsEndpoint: "ollama/tags",
    parseModelsResponse: (data) => data.models?.map((m: any) => m.name) ?? [],
    requiresRunningCheck: false,
    supportsKeepAlive: true,
    keyConfig: {
      placeholder: "http://127.0.0.1:11434",
      inputType: "text",
      description: "Base URL for your Ollama instance",
      sensitive: false,
    },
  },

  openai: {
    defaultBaseUrl: "https://api.openai.com/v1",
    id: "openai",
    displayName: "OpenAI",
    credentialType: "api-key",
    category: "cloud",
    envVar: "OPENAI_API_KEY",
    modelsEndpoint: "openai/models",
    parseModelsResponse: (data) =>
      (data.data?.map((m: any) => m.id) ?? [])
        .filter((id: string) => id.startsWith("gpt-") || id.startsWith("o"))
        .sort(),
    requiresRunningCheck: false,
    supportsKeepAlive: false,
    keyConfig: {
      placeholder: "sk-...",
      inputType: "password",
      description: "Used for OpenAI models in job autofill",
      sensitive: true,
    },
  },

  deepseek: {
    defaultBaseUrl: "https://api.deepseek.com",
    id: "deepseek",
    displayName: "DeepSeek",
    credentialType: "api-key",
    category: "cloud",
    envVar: "DEEPSEEK_API_KEY",
    modelsEndpoint: "deepseek/models",
    parseModelsResponse: (data) => data.data?.map((m: any) => m.id) ?? [],
    requiresRunningCheck: false,
    supportsKeepAlive: false,
    keyConfig: {
      placeholder: "sk-...",
      inputType: "password",
      description: "Used for DeepSeek models in job autofill",
      sensitive: true,
    },
  },
  openrouter: {
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    id: "openrouter",
    displayName: "OpenRouter",
    credentialType: "api-key",
    category: "cloud",
    envVar: "OPENROUTER_API_KEY",
    modelsEndpoint: "openrouter/models",
    parseModelsResponse: (data) =>
      (data.data?.map((m: any) => m.id) ?? []).sort(),
    requiresRunningCheck: false,
    supportsKeepAlive: false,
    keyConfig: {
      placeholder: "sk-or-...",
      inputType: "password",
      description: "Access 200+ models from multiple providers via OpenRouter",
      sensitive: true,
    },
  },

  gemini: {
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    id: "gemini",
    displayName: "Google Gemini",
    credentialType: "api-key",
    category: "cloud",
    envVar: "GEMINI_API_KEY",
    modelsEndpoint: "gemini/models",
    parseModelsResponse: (data) =>
      data.models?.map((m: any) => m.name?.replace("models/", "")) ?? [],
    requiresRunningCheck: false,
    supportsKeepAlive: false,
    keyConfig: {
      placeholder: "AIza...",
      inputType: "password",
      description: "Used for Gemini models in job autofill",
      sensitive: true,
    },
  },
  custom: {
    id: "custom", displayName: "Custom / OpenAI-compatible API",
    credentialType: "api-key", category: "cloud", requiresRunningCheck: false, supportsKeepAlive: false,
    keyConfig: { placeholder: "API key", inputType: "password", description: "Key for the configured OpenAI-compatible endpoint", sensitive: true },
  },
};

export const AI_PROVIDERS = ["ollama", "openai", "deepseek", "openrouter", "gemini", "custom"] as const;
export type AiProviderId = (typeof AI_PROVIDERS)[number];

export function getAiProviders(): ProviderRegistryEntry[] {
  return AI_PROVIDERS.map((id) => PROVIDER_REGISTRY[id]);
}
