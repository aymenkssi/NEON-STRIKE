// Suggestions from signed-in players, read in the admin page (backend/suggestions.py).
import { ApiError, authed, backendConfigured } from "./client";

export type SuggestionCategory = "idea" | "bug" | "other";
export type SuggestionResult = "sent" | "limit" | "invalid" | "account" | "network";

export async function sendSuggestion(category: SuggestionCategory, message: string): Promise<SuggestionResult> {
  if (!backendConfigured) return "network";
  try {
    await authed("/suggestions", { method: "POST", body: JSON.stringify({ category, message: message.trim() }) });
    return "sent";
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 429) return "limit";
      if (e.status === 422) return "invalid";
      if (e.status === 403) return "account";
    }
    return "network";
  }
}
