export type ApiKeyProvider = import("@/lib/ai/provider-registry").AiProviderId;

export interface ApiKeyRecord {
  id: string;
  userId: string;
  provider: ApiKeyProvider;
  last4: string;
  label: string | null;
  createdAt: Date;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

export interface ApiKeyClientResponse {
  id: string;
  provider: ApiKeyProvider;
  last4: string;
  // Full value for non-sensitive entries (e.g. URLs)
  displayValue?: string;
  label: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}
