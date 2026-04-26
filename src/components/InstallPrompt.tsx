import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Share } from "lucide-react";
import { cn } from "@/lib/utils";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "pwa-install-dismissed-at";
const DISMISS_DAYS = 7;

function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isIosUa = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as Mac with touch
  const isIpadDesktop = /Macintosh/.test(ua) && (navigator as any).maxTouchPoints > 1;
  return isIosUa || isIpadDesktop;
}

function recentlyDismissed() {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [show, setShow] = useState(false);
  const [iosHint, setIosHint] = useState(false);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return;

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", onBIP);

    const onInstalled = () => {
      setShow(false);
      setDeferred(null);
    };
    window.addEventListener("appinstalled", onInstalled);

    // iOS doesn't fire beforeinstallprompt — show manual hint after a delay
    const t = setTimeout(() => {
      if (isIos() && !isStandalone()) {
        setIosHint(true);
        setShow(true);
      }
    }, 1500);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(t);
    };
  }, []);

  if (!show) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === "accepted") setShow(false);
      else dismiss();
    } catch {
      dismiss();
    } finally {
      setDeferred(null);
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Install Perepiri Food Mart"
      className={cn(
        "fixed inset-x-3 bottom-20 z-50 mx-auto max-w-md rounded-2xl border border-border/60 bg-background/95 p-3 shadow-2xl backdrop-blur",
        "lg:bottom-4"
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl">
          <img src="/icon-192.png" alt="" width={40} height={40} loading="lazy" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">Install Perepiri Food Mart</div>
          {iosHint && !deferred ? (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap <Share className="mx-0.5 inline h-3 w-3" /> Share, then{" "}
              <span className="font-medium">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">
              Faster checkout, full-screen and works offline-friendly.
            </p>
          )}
          {deferred && (
            <div className="mt-2 flex gap-2">
              <Button size="sm" onClick={install} className="h-8 gap-1.5">
                <Download className="h-3.5 w-3.5" /> Install
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="h-8">
                Not now
              </Button>
            </div>
          )}
        </div>
        <Button
          size="icon"
          variant="ghost"
          className="-mr-1 -mt-1 h-7 w-7"
          onClick={dismiss}
          aria-label="Dismiss install prompt"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
