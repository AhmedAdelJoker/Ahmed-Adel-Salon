import api from "./api";
import toast from "react-hot-toast";

export const cleanParams = (params = {}) => {
  const cleaned = {};

  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== "") {
      cleaned[key] = value;
    }
  });

  return cleaned;
};

/**
 * Create and trigger browser download from blob response.
 */
const downloadBlob = (blobData, filename, mediaType) => {
  const blob = new Blob([blobData], {
    type: mediaType || "application/octet-stream",
  });

  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.setAttribute("download", filename);

  document.body.appendChild(link);
  link.click();
  link.remove();

  window.URL.revokeObjectURL(url);
};

/**
 * Generic download handler.
 */
const handleDownload = async (endpoint, filename, params = {}, mediaType) => {
  const toastId = toast.loading("جاري تحضير الملف...");

  try {
    const response = await api.get(endpoint, {
      params: cleanParams(params),
      responseType: "blob",
    });

    const isEmpty = response.headers?.["x-export-empty"] === "1";

    if (isEmpty) {
      toast.dismiss(toastId);
      toast.error("لا توجد بيانات مطابقة للفلاتر المختارة");
      return false;
    }

    downloadBlob(response.data, filename, mediaType);

    toast.dismiss(toastId);
    toast.success("تم تحميل الملف بنجاح");

    return true;
  } catch (error) {
    console.error("Export Error:", error);

    toast.dismiss(toastId);
    toast.error(
      error?.response?.data?.detail || "فشل تحميل الملف، يرجى المحاولة لاحقاً",
    );

    return false;
  }
};

const ensureExtension = (filename, extension) => {
  if (!filename) {
    return `export_${Date.now()}.${extension}`;
  }

  return filename.endsWith(`.${extension}`)
    ? filename
    : `${filename}.${extension}`;
};

export const exportService = {
  downloadExcel: (endpoint, filename, params = {}) => {
    return handleDownload(
      endpoint,
      ensureExtension(filename, "xlsx"),
      params,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  },

  downloadCsv: (endpoint, filename, params = {}) => {
    return handleDownload(
      endpoint,
      ensureExtension(filename, "csv"),
      params,
      "text/csv;charset=utf-8",
    );
  },

  downloadPdf: (endpoint, filename, params = {}) => {
    return handleDownload(
      endpoint,
      ensureExtension(filename, "pdf"),
      params,
      "application/pdf",
    );
  },
};

export default exportService;
