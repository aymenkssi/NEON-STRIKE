import { useCallback, useEffect, useState } from "react";
import { storage } from "@/src/utils/storage";

// "unset": first launch, the welcome screen asks; "guest": everything stays on this phone;
// "account": signed in, progress synced online and scores on the world leaderboard.
export type AccountMode = "unset" | "guest" | "account";
export type AccountState = { mode: AccountMode; username: string | null };

const KEY = "np_account";
const INITIAL: AccountState = { mode: "unset", username: null };

export function useAccount() {
  const [account, setAccount] = useState<AccountState>(INITIAL);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const raw = await storage.getItem(KEY, null as string | null);
      try {
        if (typeof raw === "string") setAccount({ ...INITIAL, ...JSON.parse(raw) });
      } catch {}
      setLoaded(true);
    })();
  }, []);

  const save = useCallback((next: AccountState) => {
    setAccount(next);
    storage.setItem(KEY, JSON.stringify(next));
  }, []);

  const playAsGuest = useCallback(() => save({ mode: "guest", username: null }), [save]);
  const signedIn = useCallback((username: string) => save({ mode: "account", username }), [save]);
  const signedOut = useCallback(() => save(INITIAL), [save]);

  return { account, loaded, playAsGuest, signedIn, signedOut };
}
