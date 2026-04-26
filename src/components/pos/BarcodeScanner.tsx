import { useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, CheckCircle2, X, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
  /** Called when a product is identified by photo (image-recognition path). */
  onIdentified?: (product: Product) => void;
}

/**
 * Camera scanner that does TWO things:
 *  1. Continuous barcode/QR scanning (zxing).
 *  2. Snap a still image and ask Lovable AI to identify the product
 *     against the active catalog when no barcode is on the package.
 */
export function BarcodeScanner({ open, onClose, onDetected, onIdentified }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastHitsRef = useRef<Map<string, number>>(new Map());
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [lastCode, setLastCode] = useState<string | null>(null);
  const [identifying, setIdentifying] = useState(false);
  const [lastMatch, setLastMatch] = useState<{ name: string; image_url: string | null } | null>(
    null
  );

  // Stop the active stream
  const stop = () => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* noop */
    }
    controlsRef.current = null;
  };

  // Start scanning with the chosen device
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setError(null);
      setStarting(true);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();

        if (devices.length === 0) {
          try {
            const list = await BrowserMultiFormatReader.listVideoInputDevices();
            if (!cancelled) {
              setDevices(list);
              const back = list.find((d) => /back|rear|environment/i.test(d.label));
              setDeviceId((cur) => cur ?? back?.deviceId ?? list[0]?.deviceId);
            }
          } catch {
            /* listing may need permission first */
          }
        }

        if (!videoRef.current || cancelled) return;

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result) => {
            if (!result) return;
            const text = result.getText();
            const now = Date.now();
            const last = lastHitsRef.current.get(text) ?? 0;
            if (now - last < 1200) return;
            lastHitsRef.current.set(text, now);
            if (lastHitsRef.current.size > 50) {
              for (const [k, v] of lastHitsRef.current) {
                if (now - v > 5000) lastHitsRef.current.delete(k);
              }
            }
            try { navigator.vibrate?.(60); } catch { /* noop */ }
            setLastCode(text);
            onDetected(text);
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;

        if (devices.length === 0 || devices.every((d) => !d.label)) {
          try {
            const list = await BrowserMultiFormatReader.listVideoInputDevices();
            if (!cancelled) setDevices(list);
          } catch {
            /* noop */
          }
        }
      } catch (err) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Camera unavailable";
          setError(msg);
          toast.error(msg);
        }
      } finally {
        if (!cancelled) setStarting(false);
      }
    })();

    return () => {
      cancelled = true;
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, deviceId]);

  const switchCamera = () => {
    if (devices.length < 2) return;
    const idx = devices.findIndex((d) => d.deviceId === deviceId);
    const next = devices[(idx + 1) % devices.length];
    setDeviceId(next.deviceId);
  };

  /** Capture current frame → ask AI to identify against active catalog. */
  const identifyByPhoto = async () => {
    const video = videoRef.current;
    if (!video || identifying) return;
    setIdentifying(true);
    setLastMatch(null);
    try {
      // Snap frame to canvas
      const canvas = document.createElement("canvas");
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas unavailable");
      ctx.drawImage(video, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

      // Build candidate list (active catalog only)
      const { data: candidates, error: catErr } = await supabase
        .from("products")
        .select("id,name,sku,image_url")
        .eq("active", true)
        .order("name")
        .limit(200);
      if (catErr) throw catErr;
      if (!candidates?.length) {
        toast.error("No products in catalog to match");
        return;
      }

      const { data, error: fnErr } = await supabase.functions.invoke("identify-product", {
        body: {
          image_base64: dataUrl,
          candidates: candidates.map((c) => ({ id: c.id, name: c.name, sku: c.sku })),
        },
      });
      if (fnErr) throw fnErr;
      const result = data as { product_id: string | null; confidence: number; error?: string };
      if (result.error) throw new Error(result.error);

      if (!result.product_id || result.confidence < 0.5) {
        toast.error("Could not identify product. Try another angle.");
        return;
      }

      const match = candidates.find((c) => c.id === result.product_id);
      if (!match) {
        toast.error("Identified product no longer in catalog");
        return;
      }

      // Fetch the full product row for the cart
      const { data: full } = await supabase
        .from("products")
        .select("*")
        .eq("id", match.id)
        .maybeSingle();
      if (!full) {
        toast.error("Product unavailable");
        return;
      }

      try { navigator.vibrate?.(80); } catch { /* noop */ }
      setLastMatch({ name: full.name, image_url: full.image_url });
      onIdentified?.(full as Product);
      toast.success(`Identified: ${full.name}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Identification failed";
      toast.error(msg);
    } finally {
      setIdentifying(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) {
          stop();
          onClose();
        }
      }}
    >
      <DialogContent className="max-w-md gap-3 p-4">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-primary" />
            Scan or identify product
          </DialogTitle>
          <DialogDescription>
            Point at a barcode for instant scan, or snap a photo and let AI identify it.
          </DialogDescription>
        </DialogHeader>

        <div className="relative overflow-hidden rounded-xl bg-black aspect-[3/4] sm:aspect-video">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
            autoPlay
          />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-1/3 w-4/5 rounded-lg border-2 border-primary/80 shadow-[0_0_0_9999px_hsl(0_0%_0%/0.35)]" />
          </div>

          {starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm text-white">
              Starting camera…
            </div>
          )}
          {error && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70 p-4 text-center text-sm text-white">
              <span>{error}</span>
              <span className="text-xs text-white/70">
                Allow camera access in your browser settings, then try again.
              </span>
            </div>
          )}

          {!starting && !error && (
            <div className="pointer-events-none absolute left-2 top-2 rounded-full bg-black/55 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white">
              Auto-scan
            </div>
          )}

          {identifying && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/60 text-sm text-white">
              <Loader2 className="h-5 w-5 animate-spin" />
              Identifying…
            </div>
          )}

          {lastMatch && !error && (
            <div
              key={`m-${lastMatch.name}`}
              className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg bg-primary/90 px-3 py-2 text-xs font-medium text-primary-foreground shadow-elevated animate-in fade-in slide-in-from-bottom-2"
            >
              <Sparkles className="h-4 w-4" />
              <span className="truncate">Identified: {lastMatch.name}</span>
            </div>
          )}
          {!lastMatch && lastCode && !error && (
            <div
              key={lastCode + String(lastHitsRef.current.get(lastCode) ?? "")}
              className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center gap-2 rounded-lg bg-success/90 px-3 py-2 text-xs font-medium text-success-foreground shadow-elevated animate-in fade-in slide-in-from-bottom-2"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span className="truncate">Added: {lastCode}</span>
            </div>
          )}
        </div>

        <DialogFooter className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <Button
            variant="outline"
            className="h-12"
            onClick={switchCamera}
            disabled={devices.length < 2}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Switch
          </Button>
          <Button
            className="h-12"
            onClick={identifyByPhoto}
            disabled={identifying || !!error || starting}
          >
            {identifying ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-1 h-4 w-4" />
            )}
            Snap & identify
          </Button>
          <Button
            className="h-12"
            variant="secondary"
            onClick={() => {
              stop();
              onClose();
            }}
          >
            <X className="mr-1 h-4 w-4" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
