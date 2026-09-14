/** HR feature: employee documents data (moved from HRManagement page, no logic changes). */
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import type { DocumentRecord } from "@/types/employee";
import employeeDocumentService from "@/features/hr/services/employeeDocumentService";

export function useEmployeeDocuments() {
  const [employeeDocs, setEmployeeDocs] = useState<DocumentRecord[]>([]);
  const [expiringDocs, setExpiringDocs] = useState<DocumentRecord[]>([]);
  const [docLoading, setDocLoading] = useState(false);

  const fetchDocuments = useCallback(async (empId: string | number | undefined) => {
    try {
      setDocLoading(true);
      const res = await employeeDocumentService.list(empId);
      setEmployeeDocs(res.items || []);
    } catch (_error) {
      toast.error("فشل تحميل المستندات");
    } finally {
      setDocLoading(false);
    }
  }, []);

  const fetchExpiringDocs = useCallback(async () => {
    try {
      const res = await employeeDocumentService.getExpiring(15);
      setExpiringDocs(res.items || []);
    } catch (_error) {
      console.error("Expiring docs fetch error:", _error);
    }
  }, []);

  useEffect(() => {
    fetchExpiringDocs();
  }, [fetchExpiringDocs]);

  return {
    employeeDocs,
    expiringDocs,
    docLoading,
    setDocLoading,
    fetchDocuments,
    fetchExpiringDocs,
  };
}
