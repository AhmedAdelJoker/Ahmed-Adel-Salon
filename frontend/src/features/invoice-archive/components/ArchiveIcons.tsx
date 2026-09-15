export function CheckIcon() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      className="text-emerald-500"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m5 13 4 4L19 7" />
    </svg>
  );
}

export function Loader({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v1.5M12 16.5V18M5.25 12H6.75M17.25 12h.75M8.4 8.4l.6.6m4.8 4.8.6.6M15.6 8.4l-.6.6M10.2 13.2l-.6.6"
      />
    </svg>
  );
}
