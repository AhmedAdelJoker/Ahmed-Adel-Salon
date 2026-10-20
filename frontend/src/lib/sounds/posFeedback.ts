/**
 * POS feedback sounds, served locally from /public/sounds.
 *
 * The old implementation streamed previews from assets.mixkit.co on every
 * checkout: an offline salon got silent feedback (the fetch error was
 * swallowed), and every till beep leaked a third-party request from the
 * payment screen. The files now live in the app bundle and the Audio
 * elements are created once and reused — `currentTime = 0` restarts them.
 *
 * Every failure mode is swallowed on purpose: audio must never be able to
 * break a checkout.
 */

let successAudio: HTMLAudioElement | null = null;
let errorAudio: HTMLAudioElement | null = null;

function play(audio: HTMLAudioElement | null, set: () => HTMLAudioElement | null) {
  try {
    audio ??= set();
    if (!audio) return;
    audio.currentTime = 0;
    audio.volume = 0.5;
    void audio.play().catch(() => {});
  } catch {
    /* missing asset / autoplay policy / offline — never fail a checkout */
  }
}

export function playPosSuccess(): void {
  play(successAudio, () => {
    successAudio = new Audio("/sounds/pos-success.mp3");
    return successAudio;
  });
}

export function playPosError(): void {
  play(errorAudio, () => {
    errorAudio = new Audio("/sounds/pos-error.mp3");
    return errorAudio;
  });
}
