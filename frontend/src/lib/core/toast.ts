import toast from "react-hot-toast";

export const notify = {
  success: (message) =>
    toast.success(message, {
      style: {
        borderRadius: "16px",
        padding: "12px 14px",
        fontWeight: "700",
      },
    }),

  error: (message) =>
    toast.error(message, {
      style: {
        borderRadius: "16px",
        padding: "12px 14px",
        fontWeight: "700",
      },
    }),

  loading: (message) =>
    toast.loading(message, {
      style: {
        borderRadius: "16px",
        padding: "12px 14px",
        fontWeight: "700",
      },
    }),

  dismiss: (id) => toast.dismiss(id),
};
