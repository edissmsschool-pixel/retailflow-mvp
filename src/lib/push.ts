import { supabase } from "@/integrations/supabase/client";

/** Public VAPID key. Safe to embed client-side per the Web Push spec. */
export const VAPID_PUBLIC_KEY =
  "BJ5CqkOc06gf55DbaEdb8o9iYvyTEHrWWXo2bot5QA9MMKqe0to6IRnJklbP1dwEhspagTjyRpbhbcKe7YplFsU";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error("Push notifications are not supported in this browser");

  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission denied");

  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
  const { error } = await supabase.functions.invoke("register-push", {
    body: {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
      user_agent: navigator.userAgent,
    },
  });
  if (error) throw error;
}

export async function disablePush(): Promise<void> {
  const sub = await getCurrentSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  await supabase.functions.invoke("register-push", {
    body: { endpoint, unsubscribe: true },
  });
}
