import "server-only";

import { createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider-v2";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { APP_CONSTANTS } from "@/lib/constants";

export const PROVIDER_FACTORIES: Record<
  string,
  (credential: string, modelName: string, options?: { baseURL?: string; fetch?: typeof fetch }) => any
> = {
  openai: (apiKey, model, options) => options ? createOpenAI({ apiKey, ...options }).chat(model) : createOpenAI({ apiKey })(model),
  openrouter: (apiKey, model, options) => options
    ? createOpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1", ...options }).chat(model)
    : createOpenAI({ apiKey, baseURL: "https://openrouter.ai/api/v1" })(model),
  custom: (apiKey, model, options) => createOpenAI({ apiKey, ...options }).chat(model),
  deepseek: (apiKey, model, options) => createDeepSeek({ apiKey, ...options })(model),
  ollama: (baseURL, model, options) =>
    createOllama({ baseURL: (options?.baseURL ?? baseURL).replace(/\/+$/, "") + "/api", ...(options?.fetch ? { fetch: options.fetch } : {}) })(model),
  gemini: (apiKey, model, options) => createGoogleGenerativeAI({ apiKey, ...options })(model),
};

export const PROVIDER_VERIFIERS: Record<
  string,
  (key: string) => Promise<{ success: boolean; error?: string }>
> = {
  openai: async (key) => {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(APP_CONSTANTS.AI_VERIFY_TIMEOUT_MS),
    });
    if (!res.ok)
      return {
        success: false,
        error:
          res.status === 401
            ? "Invalid API key"
            : `OpenAI returned ${res.status}`,
      };
    return { success: true };
  },

  // /api/v1/key is the authenticated endpoint. /models is public and answers
  // 200 to any key, so verifying against it passes anything pasted in.
  openrouter: async (key) => {
    const res = await fetch("https://openrouter.ai/api/v1/key", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(APP_CONSTANTS.AI_VERIFY_TIMEOUT_MS),
    });
    if (!res.ok)
      return {
        success: false,
        error:
          res.status === 401
            ? "Invalid API key"
            : `OpenRouter returned ${res.status}`,
      };
    return { success: true };
  },

  deepseek: async (key) => {
    const res = await fetch("https://api.deepseek.com/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(APP_CONSTANTS.AI_VERIFY_TIMEOUT_MS),
    });
    if (!res.ok)
      return {
        success: false,
        error:
          res.status === 401
            ? "Invalid API key"
            : `DeepSeek returned ${res.status}`,
      };
    return { success: true };
  },

  ollama: async (key) => {
    const baseUrl = key.replace(/\/+$/, "");
    try {
      const res = await fetch(`${baseUrl}/api/tags`, {
        signal: AbortSignal.timeout(APP_CONSTANTS.AI_OLLAMA_LIST_TIMEOUT_MS),
      });
      if (!res.ok)
        return {
          success: false,
          error: `Cannot connect to Ollama at ${baseUrl}`,
        };
      return { success: true };
    } catch (error) {
      if (error instanceof Error && error.name === "TimeoutError") {
        return {
          success: false,
          error: `Ollama at ${baseUrl} did not respond in time. Please make sure Ollama is running.`,
        };
      }
      if (
        error instanceof TypeError &&
        /failed to parse url/i.test(error.message)
      ) {
        return {
          success: false,
          error: `Invalid Ollama URL: ${baseUrl}`,
        };
      }
      return {
        success: false,
        error: `Cannot connect to Ollama at ${baseUrl}. Please make sure Ollama is running.`,
      };
    }
  },

  gemini: async (key) => {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${key}`,
      { signal: AbortSignal.timeout(APP_CONSTANTS.AI_VERIFY_TIMEOUT_MS) },
    );
    if (!res.ok)
      return {
        success: false,
        error:
          res.status === 400 || res.status === 403
            ? "Invalid API key"
            : `Gemini returned ${res.status}`,
      };
    return { success: true };
  },
};
