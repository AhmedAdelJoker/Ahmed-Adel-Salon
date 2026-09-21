export const formatTime = (timestamp) => {
  if (!timestamp) return "--:--";
  return new Date(timestamp).toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const formatDateTime = (timestamp) => {
  if (!timestamp) return "--";
  return new Date(timestamp).toLocaleString("ar-EG", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
};
