import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Camera, Image as ImageIcon, Sparkles, Upload, X, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value: string | null | undefined;
  onChange: (url: string | null) => void;
  productName?: string;
  bucket?: string;
  folder?: string;
}

const MAX_BYTES = 4 * 1024 * 1024; // 4MB

async function fileToResizedWebp(file: File | Blob, maxSize = 1024): Promise<Blob> {
  const dataUrl: string = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("Could not load image"));
    i.src = dataUrl;
  });
  const ratio = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Could not encode image"))),
      "image/webp",
      0.85,
    );
  });
}

export function ImageUploader({ value, onChange, productName, bucket = "product-images", folder }: Props) {
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"upload" | "camera" | "ai">("upload");
  const [drag, setDrag] = useState(false);
  const [aiPreview, setAiPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  const upload = async (blob: Blob) => {
    setBusy(true);
    try {
      const id = crypto.randomUUID();
      const path = `${folder ?? "items"}/${id}.webp`;
      const { error } = await supabase.storage.from(bucket).upload(path, blob, {
        contentType: "image/webp",
        upsert: true,
      });
      if (error) throw error;
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      onChange(data.publicUrl);
      toast.success("Image saved");
    } catch (e) {
      toast.error((e as Error).message ?? "Upload failed");
    } finally {
      setBusy(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > MAX_BYTES) {
      toast.error("Image must be 4MB or smaller");
      return;
    }
    try {
      const webp = await fileToResizedWebp(file);
      await upload(webp);
    } catch (e) {
      toast.error((e as Error).message ?? "Could not process image");
    }
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraReady(false);
  };

  const startCamera = async () => {
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (e) {
      toast.error("Camera not available — try uploading a file instead");
    }
  };

  const captureFrame = async () => {
    const video = videoRef.current;
    if (!video || !cameraReady) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", 0.85));
    if (!blob) return toast.error("Could not capture frame");
    const resized = await fileToResizedWebp(blob);
    await upload(resized);
    stopCamera();
  };

  useEffect(() => {
    if (tab === "camera") startCamera();
    else stopCamera();
    return stopCamera;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const aiSuggest = async () => {
    if (!productName?.trim()) {
      toast.error("Enter a product name first");
      return;
    }
    setBusy(true);
    setAiPreview(null);
    try {
      const { data, error } = await supabase.functions.invoke("suggest-product-image", {
        body: { name: productName.trim() },
      });
      if (error) throw error;
      const result = data as { image_url?: string; error?: string; fallback?: boolean };
      if (result?.fallback || !result?.image_url) {
        toast.error(result?.error || "Could not find an image. Try uploading one instead.");
        return;
      }
      setAiPreview(result.image_url);
    } catch (e) {
      toast.error((e as Error).message ?? "AI lookup failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative w-full overflow-hidden rounded-xl border bg-muted">
          <img src={value} alt="Product" className="aspect-square w-full object-cover" />
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className="absolute right-2 top-2 h-8 w-8"
            onClick={() => onChange(null)}
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex aspect-square w-full items-center justify-center rounded-xl border border-dashed bg-muted/40 text-muted-foreground">
          <ImageIcon className="h-10 w-10 opacity-50" />
        </div>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload"><Upload className="mr-1.5 h-3.5 w-3.5" />Upload</TabsTrigger>
          <TabsTrigger value="camera"><Camera className="mr-1.5 h-3.5 w-3.5" />Camera</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="mr-1.5 h-3.5 w-3.5" />AI</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="mt-3">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              const f = e.dataTransfer.files?.[0];
              if (f) handleFile(f);
            }}
            className={`flex flex-col items-center gap-2 rounded-lg border-2 border-dashed p-4 text-center text-xs transition-colors ${drag ? "border-primary bg-primary/5" : "border-border"}`}
          >
            <Upload className="h-5 w-5 text-muted-foreground" />
            <div>Drag &amp; drop or</div>
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => fileRef.current?.click()}>
              {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Choose file
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = "";
              }}
            />
            <div className="text-[10px] text-muted-foreground">PNG, JPG, WebP up to 4MB</div>
          </div>
        </TabsContent>

        <TabsContent value="camera" className="mt-3 space-y-2">
          <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={startCamera} disabled={busy}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />Restart
            </Button>
            <Button type="button" size="sm" className="flex-1" disabled={busy || !cameraReady} onClick={captureFrame}>
              {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Camera className="mr-1.5 h-3.5 w-3.5" />}
              Capture
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="ai" className="mt-3 space-y-2">
          {aiPreview && (
            <div className="overflow-hidden rounded-lg border">
              <img src={aiPreview} alt="AI suggestion" className="aspect-square w-full object-cover" />
            </div>
          )}
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" className="flex-1" disabled={busy} onClick={aiSuggest}>
              {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
              {aiPreview ? "Try again" : "Suggest image"}
            </Button>
            {aiPreview && (
              <Button type="button" size="sm" className="flex-1" disabled={busy} onClick={() => { onChange(aiPreview); setAiPreview(null); toast.success("Image saved"); }}>
                Use this
              </Button>
            )}
          </div>
          <div className="text-[10px] text-muted-foreground">
            AI looks up an image based on the product name. Quality varies — preview before saving.
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
