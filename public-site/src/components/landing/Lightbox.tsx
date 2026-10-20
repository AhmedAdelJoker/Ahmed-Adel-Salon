import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export interface LightboxImage {
  src: string;
  alt: string;
}

/**
 * Gallery lightbox.
 *
 * The portfolio grid rendered every image at thumbnail size with no way to see
 * any of them properly. For a salon, the work *is* the proof, so the grid has to
 * lead somewhere.
 *
 * Accessibility is the whole game here, and each of these was a real failure in
 * a naive implementation:
 *  - focus moves into the dialog and is trapped there, so Tab cannot wander out
 *    to the page behind an overlay;
 *  - Escape closes, and the arrow keys step between images;
 *  - the previous focus is restored on close;
 *  - the trigger keeps its own `aria-label`, and the dialog is labelled by its
 *    own heading rather than by the image;
 *  - background scrolling is locked, without losing the scroll position the way
 *    `overflow: hidden` on <body> does.
 */
export default function Lightbox({
  images,
  index,
  onClose,
  onNavigate,
  labels,
}: {
  images: LightboxImage[];
  index: number;
  onClose: () => void;
  onNavigate: (nextIndex: number) => void;
  labels: { close: string; previous: string; next: string; counter: string };
}) {
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const [current, setCurrent] = useState(index);

  const go = useCallback(
    (delta: number) => {
      if (images.length < 2) return;
      const next = (current + delta + images.length) % images.length;
      setCurrent(next);
      onNavigate(next);
    },
    [current, images.length, onNavigate],
  );

  useEffect(() => setCurrent(index), [index]);

  /* Escape closes; arrows step. Bound on the document so it works regardless of
     which element inside the dialog currently holds focus. */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(-1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(1);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [go, onClose]);

  /* Lock the page behind the overlay, preserving the scroll offset. Setting
     `top` before pinning is what prevents the jump to the top of the document. */
  useEffect(() => {
    const body = document.body;
    const scrollY = window.scrollY;
    const previous = {
      position: body.style.position,
      top: body.style.top,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      body.style.position = previous.position;
      body.style.top = previous.top;
      body.style.width = previous.width;
      body.style.overflow = previous.overflow;
      window.scrollTo(0, scrollY);
    };
  }, []);

  /* Focus in on open, and back to the thumbnail on close. */
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => openerRef.current?.focus?.();
  }, []);

  const image = images[current];
  if (!image) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={labels.counter.replace("{current}", String(current + 1)).replace("{total}", String(images.length))}
      ref={dialogRef}
      tabIndex={-1}
    >
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <p className="numeric text-xs font-bold text-ink/70">
          {current + 1} / {images.length}
        </p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line-strong text-ink transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={labels.close}
        >
          <X size={22} aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pb-6 sm:px-16">
        {images.length > 1 ? (
          <>
            <NavButton side="start" label={labels.previous} onClick={() => go(-1)} />
            <img
              src={image.src}
              alt={image.alt}
              className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <NavButton side="end" label={labels.next} onClick={() => go(1)} />
          </>
        ) : (
          <img
            src={image.src}
            alt={image.alt}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
          />
        )}
      </div>
    </div>
  );
}

function NavButton({
  side,
  label,
  onClick,
}: {
  side: "start" | "end";
  label: string;
  onClick: () => void;
}) {
  const Icon = side === "start" ? ChevronRight : ChevronLeft;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`absolute top-1/2 z-10 flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-2xl border border-line-strong bg-black/50 text-ink transition hover:bg-accent-wash focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
        side === "start" ? "end-3 sm:end-6" : "start-3 sm:start-6"
      }`}
    >
      <Icon size={24} aria-hidden="true" />
    </button>
  );
}