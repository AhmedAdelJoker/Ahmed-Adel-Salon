import { useEffect, useRef, useState } from "react";
import { ImagePlus, Trash2 } from "lucide-react";

import api from "@/services/api";
import { staticURL } from "@/services/api";
import { validateImageSize } from "@/lib/media/upload";
import { Button } from "@/components/ui/button";

export interface ImagePickerProps {
  /** Stored path (`/uploads/business/<uuid>.jpg`) or an absolute URL. */
  value?: string | null;
  onChange: (url: string) => void;
  label?: string;
  /** Endpoint that accepts multipart `file` and answers `{url}`. */
  endpoint?: string;
  /** Preview aspect ratio; services are wide, employees are square. */
  shape?: "square" | "wide";
  className?: string;
}

/**
 * Pick an image, upload it, and store the path the server returns.
 *
 * The upload itself is one of several `/upload-image` endpoints that all share
 * the same contract: multipart `file`, `{url}` back, no `response_model` on the
 * route so the shape is whatever the handler returns. This component is the one
 * place that contract is written down for the admin app, instead of the seven
 * hand-rolled copies that each rediscovered it.
 *
 * A stored path that no longer resolves is the normal case here — the column
 * outlives the file — so the preview falls back to the empty slot rather than
 * showing a broken image.
 */
export function ImagePicker({
  value,
  onChange,
  label = "صورة",
  endpoint = "/services/upload-image",
  shape = "square",
  className,
}: ImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [failed, setFailed] = useState(false);

  // A new value means the old failure is no longer relevant.
  useEffect(() => setFailed(false), [value]);

  const isAbsolute = (raw: string) => /^(https?:|blob:|data:)/i.test(raw);
  const src = value ? (isAbsolute(value) ? value : `${staticURL}${value}`) : null;
  const showPreview = Boolean(src) && !failed;

  const handlePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!validateImageSize(file)) {
      event.target.value = "";
      return;
    }

    // Instant local preview so the choice is visible before the upload lands.
    const local = URL.createObjectURL(file);
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const url = res.data?.url;
      if (!url) throw new Error("لم يتم إرجاع رابط الصورة من الخادم");
      onChange(url);
    } catch (err: unknown) {
      const apiErr = err as { response?: { data?: { detail?: unknown } }; message?: string };
      const msg = apiErr?.response?.data?.detail || apiErr?.message || "فشل رفع الصورة";
      window.alert(String(msg));
      onChange("");
    } finally {
      setUploading(false);
      URL.revokeObjectURL(local);
      // Reset so picking the same file again still fires a change event.
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const aspect = shape === "square" ? "aspect-square" : "aspect-video";

  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <label className="text-xs font-black text-main">{label}</label>
      <div className="flex items-center gap-4">
        <div
          className={`relative ${aspect} w-28 shrink-0 overflow-hidden rounded-2xl border border-border bg-soft`}
        >
          {showPreview ? (
            <img
              src={src as string}
              alt=""
              className="h-full w-full object-cover"
              onError={() => setFailed(true)}
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-muted">
              <ImagePlus size={22} aria-hidden="true" />
            </div>
          )}
          {uploading && (
            <div className="absolute inset-0 grid place-items-center bg-black/50 text-[10px] font-black text-white">
              جاري الرفع…
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 rounded-xl font-bold text-[11px]"
              loading={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {value ? "تغيير الصورة" : "اختر صورة"}
            </Button>
            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="إزالة الصورة"
                className="h-9 w-9 rounded-xl text-muted hover:text-rose-500"
                onClick={() => {
                  onChange("");
                  setFailed(false);
                }}
              >
                <Trash2 size={14} />
              </Button>
            ) : null}
          </div>
          <p className="text-[10px] font-bold leading-relaxed text-muted">
            PNG أو JPG أو WEBP، بحد أقصى 5 ميجابايت.
          </p>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={handlePick}
      />
    </div>
  );
}

export default ImagePicker;
