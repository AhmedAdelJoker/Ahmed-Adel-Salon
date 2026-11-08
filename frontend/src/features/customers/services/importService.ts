import api from "@/services/api";
import toast from "react-hot-toast";
import i18n from "@/i18n";

export const importService = {
  /**
   * Import customers from CSV/Excel
   */
  importCustomers: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading(i18n.t("customers:import.loading") as string);
    try {
      const response = await api.post("/imports/customers", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.dismiss(toastId);
      toast.success(response.data.message || (i18n.t("customers:import.success") as string));

      if (response.data.errors && response.data.errors.length > 0) {
        console.warn("Import errors:", response.data.errors);
        toast.error((i18n.t("customers:import.errorsWarn") as string));
      }

      return response.data;
    } catch (error) {
      toast.dismiss(toastId);
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (i18n.t("customers:import.failed") as string);
      toast.error(detail);
      throw error;
    }
  },

  /**
   * Import products from CSV/Excel
   */
  importProducts: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading((i18n.t("customers:import.loadingProducts") as string));
    try {
      const response = await api.post("/imports/products", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.dismiss(toastId);
      toast.success(response.data.message || (i18n.t("customers:import.success") as string));

      if (response.data.errors && response.data.errors.length > 0) {
        console.warn("Import errors:", response.data.errors);
        toast.error((i18n.t("customers:import.errorsWarn") as string));
      }

      return response.data;
    } catch (error) {
      toast.dismiss(toastId);
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || (i18n.t("customers:import.failed") as string);
      toast.error(detail);
      throw error;
    }
  },
};

export default importService;
