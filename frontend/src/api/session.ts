// Tells the server the player opened the game (daily / monthly active players in the admin page).
import { authed, backendConfigured } from "./client";

let reported = false;

export async function reportSession() {
  if (!backendConfigured || reported) return;
  reported = true;
  try {
    await authed("/players/session", { method: "POST" });
  } catch {
    reported = false; // try again at the next opportunity
  }
}
