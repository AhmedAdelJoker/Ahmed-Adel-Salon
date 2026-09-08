import api from "@/services/api";
import toast from "react-hot-toast";

export const cleanParams = (params: Record<string, unknown> = {}): Record<string, unknown> => {
  const cleaned: Record<string, unknown> = {};

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
const downloadBlob = (blobData: BlobPart, filename: string, mediaType?: string): void => {
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
const handleDownload = async (endpoint: string, filename: string, params: Record<string, unknown> = {}, mediaType?: string): Promise<boolean> => {
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
  } catch (_error) {
    console.error("Export Error:", _error);

    let errorMessage = "فشل تحميل الملف، يرجى المحاولة لاحقاً";
    const apiError = _error as { response?: { data?: unknown; status?: number }; message?: string };

    // If response is a blob, we need to read it as text to see the JSON error
    if (apiError.response?.data instanceof Blob) {
      try {
        const text = await (apiError.response?.data as Blob).text();
        // Check if it's JSON
        if (
          (apiError.response?.data as Blob).type === "application/json" ||
          text.trim().startsWith("{")
        ) {
          const json = JSON.parse(text) as { detail?: string };
          errorMessage = json.detail || errorMessage;
        }
      } catch (_e) {
        console.error("Failed to parse blob error:", _e);
      }
    } else {
      errorMessage =
        (apiError?.response as { data?: { detail?: string } } | undefined)?.data?.detail || apiError.message || errorMessage;
    }

    toast.dismiss(toastId);
    toast.error(errorMessage);

    return false;
  }
};

const ensureExtension = (filename: string, extension: string): string => {
  if (!filename) {
    return `export_${Date.now()}.${extension}`;
  }

  return filename.endsWith(`.${extension}`)
    ? filename
    : `${filename}.${extension}`;
};

export const exportService = {
  downloadExcel: (endpoint: string, filename: string, params: Record<string, unknown> = {}) => {
    return handleDownload(
      endpoint,
      ensureExtension(filename, "xlsx"),
      params,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
  },

  downloadCsv: (endpoint: string, filename: string, params: Record<string, unknown> = {}) => {
    return handleDownload(
      endpoint,
      ensureExtension(filename, "csv"),
      params,
      "text/csv;charset=utf-8",
    );
  },

  downloadPdf: (endpoint: string, filename: string, params: Record<string, unknown> = {}) => {
    return handleDownload(
      endpoint,
      ensureExtension(filename, "pdf"),
      params,
      "application/pdf",
    );
  },
};

export default exportService;
