/**
 * Hero video helpers for the owner settings panel.
 *
 * The backend stores the clip byte-for-byte (re-encoding a video server-side
 * would cost more than the upload and would strip the metadata the player
 * needs), so the poster frame has to be produced here. Grabbing it client-side
 * also means the owner sees the exact frame the visitor will see before
 * publishing.
 */

/** Mirrors `MAX_HERO_VIDEO_BYTES` in the backend endpoint. */
export const HERO_VIDEO_MAX_SIZE = 25 * 1024 * 1024;

/** Mirrors `_VIDEO_EXTS` in `app/core/upload_security.py`. */
export const HERO_VIDEO_ACCEPT = ".mp4,.webm";

/**
 * Decode a single frame from the clip and return it as a data URL.
 *
 * Seeks to 1s rather than 0: the first frame of a phone recording is often a
 * hand covering the lens or a black frame, and that is exactly what the owner
 * will see as the hero background until the clip starts.
 *
 * Resolves to an empty string when the browser cannot decode the file (a codec
 * it has no decoder for, or a WebM on a platform without WebM). The caller
 * treats that as "no poster" and falls back to the cover image, which is why
 * this never rejects for a decode failure — only for a genuinely unreadable
 * `File`.
 */
export async function grabVideoPoster(file: File, seekToSeconds = 1): Promise<string> {
  const url = URL.createObjectURL(file);

  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "metadata";
    // Safari refuses to decode a video that is not in the document in some
    // versions; the poster grab is the one place where that matters.
    video.style.position = "fixed";
    video.style.opacity = "0";
    video.style.pointerEvents = "none";
    document.body.appendChild(video);

    const cleanup = () => {
      video.removeAttribute("src");
      video.load();
      video.remove();
      URL.revokeObjectURL(url);
    };

    await new Promise<void>((resolve, reject) => {
      const fail = () => reject(new Error("decode-failed"));
      video.addEventListener("error", fail, { once: true });
      video.addEventListener(
        "loadedmetadata",
        () => {
          // Clamp the seek: a 1s clip asking for 1s is still valid, but a seek
          // past the end puts the element in a permanent error state.
          const target = Math.min(seekToSeconds, Math.max(0, video.duration - 0.05));
          video.currentTime = Number.isFinite(target) ? target : 0;
        },
        { once: true },
      );
      video.addEventListener(
        "seeked",
        () => resolve(),
        { once: true },
      );
      video.src = url;
      video.load();
    });

    const canvas = document.createElement("canvas");
    // Cap the poster: a 4K frame would be a ~10 MB data URL stored in a JSON
    // settings column and sent on every settings read.
    const scale = Math.min(1, 1600 / (video.videoWidth || 1600));
    canvas.width = Math.max(1, Math.round((video.videoWidth || 1600) * scale));
    canvas.height = Math.max(1, Math.round((video.videoHeight || 900) * scale));

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      cleanup();
      return "";
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    cleanup();

    return canvas.toDataURL("image/jpeg", 0.72);
  } catch {
    URL.revokeObjectURL(url);
    return "";
  }
}