import api from "@/services/api";
import toast from "react-hot-toast";

export const importService = {
  /**
   * Import customers from CSV/Excel
   */
  importCustomers: async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);

    const toastId = toast.loading("جاري استيراد العملاء...");
    try {
      const response = await api.post("/imports/customers", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.dismiss(toastId);
      toast.success(response.data.message || "تم الاستيراد بنجاح");

      if (response.data.errors && response.data.errors.length > 0) {
        console.warn("Import errors:", response.data.errors);
        toast.error("تم الاستيراد مع وجود بعض الأخطاء، راجع الكونسول.");
      }

      return response.data;
    } catch (error) {
      toast.dismiss(toastId);
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "فشل استيراد الملف";
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

    const toastId = toast.loading("جاري استيراد المنتجات...");
    try {
      const response = await api.post("/imports/products", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      toast.dismiss(toastId);
      toast.success(response.data.message || "تم الاستيراد بنجاح");

      if (response.data.errors && response.data.errors.length > 0) {
        console.warn("Import errors:", response.data.errors);
        toast.error("تم الاستيراد مع وجود بعض الأخطاء.");
      }

      return response.data;
    } catch (error) {
      toast.dismiss(toastId);
      const detail = (error as { response?: { data?: { detail?: string } } })?.response?.data?.detail || "فشل استيراد الملف";
      toast.error(detail);
      throw error;
    }
  },
};

export default importService;
