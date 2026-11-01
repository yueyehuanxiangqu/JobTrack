import { z } from "zod";
import { AI_PROVIDERS, PROVIDER_REGISTRY } from "@/lib/ai/provider-registry";

export const apiKeySaveSchema = z.object({
  provider: z.enum(AI_PROVIDERS),
  key: z.string().trim().min(1, "API key is required").max(8192),
  label: z.string().optional(),
  sensitive: z.boolean().default(true),
}).refine(input => input.sensitive || !PROVIDER_REGISTRY[input.provider].keyConfig.sensitive, "API keys must use encrypted storage");

export type ApiKeySaveInput = z.infer<typeof apiKeySaveSchema>;
