import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Register the service worker for installability + push.
// Skip inside iframes and Lovable preview hosts so the editor preview
// is never affected by stale caches.
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  const isInIframe = (() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  })();

  const host = window.location.hostname;
  // Only block the editor preview (iframe + id-preview-- host).
  // Published *.lovable.app and custom domains should register the SW.
  const isPreviewHost = host.startsWith("id-preview--");

  if (isInIframe || isPreviewHost) {
    // Clean up any service worker that may have been registered previously
    navigator.serviceWorker.getRegistrations().then((regs) => {
      regs.forEach((r) => r.unregister());
    });
  } else {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* noop */
      });
    });
  }
}
