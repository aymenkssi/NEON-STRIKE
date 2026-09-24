import { useCallback, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";
import type { RemoteMessage } from "@/src/api/config";

const SEEN_KEY = "np_seen_messages";

// Messages from the admin page that this player has not dismissed yet (each is shown once).
export function useMessageQueue(messages: RemoteMessage[]) {
  const [seen, setSeen] = useState<string[] | null>(null);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(SEEN_KEY, null as string | null);
      try {
        setSeen(typeof raw === "string" ? JSON.parse(raw) : []);
      } catch {
        setSeen([]);
      }
    })();
  }, []);

  const next = seen ? messages.find((m) => !seen.includes(m.id)) ?? null : null;

  const dismiss = useCallback((id: string) => {
    setSeen((prev) => {
      const list = [...(prev ?? []), id].slice(-100);
      storage.setItem(SEEN_KEY, JSON.stringify(list));
      return list;
    });
  }, []);

  return { next, dismiss };
}
