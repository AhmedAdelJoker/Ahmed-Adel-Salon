import { useEffect, useMemo, useState } from "react";
import { Camera } from "lucide-react";

import { cn } from "@/lib/core/utils";
import { resolveAssetUrl } from "@/lib/media/assetUrl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type EmployeePhotoSize = "sm" | "md" | "lg" | "xl";

/** First letters of the first and last word, for an Arabic or Latin name. */
export function employeeInitials(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_CLASSES: Record<EmployeePhotoSize, string> = {
  sm: "h-9 w-9 text-[10px]",
  md: "h-12 w-12 text-xs",
  lg: "h-16 w-16 text-sm",
  xl: "h-24 w-24 text-xl",
};

const SHAPE_CLASSES = {
  rounded: "rounded-2xl",
  circle: "rounded-full",
} as const;

export interface EmployeePhotoProps {
  imageUrl?: string | null;
  name?: string | null;
  /** Not the job title — shown under the name when the photo is enlarged. */
  role?: string | null;
  size?: EmployeePhotoSize;
  shape?: keyof typeof SHAPE_CLASSES;
  /**
   * Advertise that a photo is missing, rather than showing initials that look
   * like a deliberate choice. Off for table cells, where it reads as noise.
   */
  hintMissing?: boolean;
  /** Allow enlarging the photo. Defaults to true. */
  expandable?: boolean;
  /**
   * What the photo does when it is pressed, for a caller that wants a photo to
   * *do* something other than enlarge -- "open this employee's file".
   *
   * This exists because the alternative was a button around this button: the
   * card grid wrapped the photo in a button that opened the employee file, and
   * the photo inside it was a button too. The browser rejects that markup
   * (`validateDOMNesting: <button> cannot appear as a descendant of <button>`),
   * and the console warning was the only evidence -- the click still worked,
   * so nothing looked broken while the DOM was invalid.
   *
   * With this, the photo *is* the control: one button, one action, no nesting.
   */
  onActivate?: () => void;
  /** The accessible name for `onActivate`; defaults to the file's own name. */
  activateLabel?: string;
  className?: string;
}

/**
 * An employee's photo, in a list.
 *
 * Two things this does that `<EmployeeAvatar>` does not: it is a photo only,
 * with no `flex gap-3` wrapper around it, so it can be dropped into a slot
 * without an extra box; and it can be enlarged, because a 24px thumbnail is
 * not enough to tell whether the right person's photo was uploaded.
 *
 * A stored path whose file is gone is the common case here — the column keeps
 * `/uploads/profiles/<uuid>.jpg` long after the file has been deleted — so a
 * broken URL falls back to initials rather than showing a broken image.
 */
export function EmployeePhoto({
  imageUrl,
  name,
  role,
  size = "md",
  shape = "rounded",
  hintMissing = false,
  expandable = true,
  onActivate,
  activateLabel,
  className,
}: EmployeePhotoProps) {
  const [photoBroken, setPhotoBroken] = useState(false);
  const [enlarged, setEnlarged] = useState(false);

  // Reset when the employee changes, so a later row does not inherit the
  // previous row's broken-image state.
  useEffect(() => setPhotoBroken(false), [imageUrl]);

  const resolved = useMemo(() => resolveAssetUrl(imageUrl), [imageUrl]);

  const hasPhoto = Boolean(resolved) && !photoBroken;
  const canEnlarge = expandable && hasPhoto;
  /*
    One control, one action. When the caller supplied `onActivate` the photo
    opens that instead of the enlarge dialog -- and it stays pressable even
    without a photo, because "open this employee's file" is still a thing the
    owner can do from an initials tile. With nothing to press at all, the
    button is disabled and says so, rather than pretending to be a photo.
  */
  const isActivatable = Boolean(onActivate);
  const isDisabled = !isActivatable && !canEnlarge;
  const frameClass = cn(
    "grid place-items-center overflow-hidden border border-border bg-soft font-black text-accent shadow-sm transition",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
    "disabled:cursor-default disabled:opacity-100",
    SIZE_CLASSES[size],
    SHAPE_CLASSES[size],
    SHAPE_CLASSES[shape],
    canEnlarge && "cursor-zoom-in hover:border-accent/40 hover:opacity-90",
    isActivatable && !canEnlarge && "cursor-pointer hover:border-accent/40",
    !canEnlarge && !isActivatable && "cursor-default",
  );
  const label = isActivatable
    ? (activateLabel ?? `فتح ملف ${name ?? "الموظف"}`)
    : canEnlarge
      ? `تكبير صورة ${name ?? "الموظف"}`
      : `لا توجد صورة لـ ${name ?? "الموظف"}`;
  const content = (
    <>
      {hasPhoto ? (
        <img
          src={resolved as string}
          alt={name ?? ""}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setPhotoBroken(true)}
        />
      ) : (
        <span aria-hidden="true">{employeeInitials(name)}</span>
      )}

      {hintMissing && !hasPhoto && (
        <span className="absolute -bottom-1 -end-1 grid h-4 w-4 place-items-center rounded-full border border-card bg-accent text-white">
          <Camera size={9} aria-hidden="true" />
        </span>
      )}
    </>
  );

  return (
    <>
      <div className={cn("relative shrink-0", className)}>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => {
            if (onActivate) {
              onActivate();
              return;
            }
            if (canEnlarge) setEnlarged(true);
          }}
          aria-label={label}
          aria-haspopup={canEnlarge && !onActivate ? "dialog" : undefined}
          className={frameClass}
        >
          {content}
        </button>
      </div>

      {canEnlarge && !onActivate && (
        <Dialog open={enlarged} onOpenChange={setEnlarged}>
          <DialogContent className="max-w-md rounded-3xl">
            <DialogHeader>
              <DialogTitle className="text-right font-black text-main">
                {name ?? "صورة الموظف"}
              </DialogTitle>
              {role && (
                <p className="text-[11px] font-bold text-muted">{role}</p>
              )}
            </DialogHeader>
            <div
              className={cn(
                "grid aspect-square w-full place-items-center overflow-hidden border border-border bg-soft",
                SHAPE_CLASSES[shape],
              )}
            >
              <img
                src={resolved as string}
                alt={name ?? ""}
                className="h-full w-full object-cover"
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
