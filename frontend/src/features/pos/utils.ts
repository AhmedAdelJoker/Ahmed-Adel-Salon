import confetti from "canvas-confetti";

export const triggerSuccessEffect = (): void => {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: ["#6366f1", "#38bdf8", "#10b981"],
  });
};
