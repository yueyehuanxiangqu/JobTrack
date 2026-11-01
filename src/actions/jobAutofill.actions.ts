"use server";
import prisma from "@/lib/db";
import { requireUser } from "./shared";
import { autofillConfigSchema } from "@/models/jobAutofill.schema";
import { AiProvider } from "@/models/ai.model";
import { updateAiSettings } from "./userSettings.actions";
export async function saveAutofillConfiguration(input: unknown) {
  try {
    const user = await requireUser(), config = autofillConfigSchema.parse(input);
    if (config.provider === "custom" && !config.baseUrl) return { success: false, message: "Enter a Base URL for the custom provider." };
    const row = await prisma.userSettings.findUnique({ where: { userId: user.id } });
    const previous = row ? JSON.parse(row.settings).ai : {};
    return await updateAiSettings({ provider: config.provider as AiProvider, model: config.model, baseUrl: config.baseUrl,
      profiles: { ...previous?.profiles, [config.provider]: { model: config.model, baseUrl: config.baseUrl } } });
  } catch { return { success: false, message: "Could not save AI configuration. Check Provider, Model and Base URL." }; }
}
