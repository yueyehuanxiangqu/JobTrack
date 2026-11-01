import { AiProvider } from "./ai.model";

export interface AiSettings {
  provider: AiProvider;
  model: string | undefined;
  baseUrl?: string;
  profiles?: Partial<Record<AiProvider, { model?: string; baseUrl?: string }>>;
}

export interface DisplaySettings {
  theme: "light" | "dark" | "system";
}

export interface UserSettingsData {
  ai: AiSettings;
  display: DisplaySettings;

}

export interface UserSettings {
  userId: string;
  settings: UserSettingsData;
}

export const defaultUserSettings: UserSettingsData = {
  ai: {
    provider: AiProvider.OLLAMA,
    model: undefined,
  },
  display: {
    theme: "system",
  },
};
