import { useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, X, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onClose: () => void;
  onDetected: (code: string) => void;
}

/**
 * Camera-based barcode/QR scanner using @zxing/browser.
 * Lazy-loads the library on open to keep the main bundle small.
 */
export function BarcodeScanner({ open, onClose, onDetected }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  // Stop the active stream
  const stop = () => {
    try {
      controlsRef.current?.stop();
    } catch {
      /* noop */
    }
    controlsRef.current = null;
  };

  // Start scanning with the chosen device (or default rear camera)
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      setError(null);
      setStarting(true);
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();

        // Enumerate cameras (after permission is granted by start call below)
        if (devices.length === 0) {
          try {
            const list = await BrowserMultiFormatReader.listVideoInputDevices();
            if (!cancelled) {
              setDevices(list);
              // Prefer rear/back camera on mobile
              const back = list.find((d) => /back|rear|environment/i.test(d.label));
              setDeviceId((cur) => cur ?? back?.deviceId ?? list[0]?.deviceId);
            }
          } catch {
            /* listing may need permission first; ignored */
          }
        }

        if (!videoRef.current || cancelled) return;

        const controls = await reader.decodeFromVideoDevice(
          deviceId,
          videoRef.current,
          (result, _err, ctrl) => {
            if (result) {
              const text = result.getText();
              try { ctrl.stop(); } catch { /* noop */ }
              controlsRef.current = null;
              // Light haptic + audio cue if available
              try { navigator.vibrate?.(60); } catch { /* noop */ }
              onDetected(text);
            }
          }
        );
        if (cancelled) {
          controls.stop();
          return;
        }
        controlsRef.current = controls;

        // Re-list devices now that we have permission (labels become available)
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
            Scan barcode
          </DialogTitle>
          <DialogDescription>
            Point your camera at a product barcode. It will be added to the cart automatically.
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
          {/* Aiming reticle */}
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
        </div>

        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="outline"
            className="h-12 w-full sm:w-auto"
            onClick={switchCamera}
            disabled={devices.length < 2}
          >
            <RefreshCw className="mr-1 h-4 w-4" />
            Switch camera
          </Button>
          <Button
            className="h-12 w-full sm:w-auto"
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
