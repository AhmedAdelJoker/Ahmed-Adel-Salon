import { useEffect } from 'react';
import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { canAccess } from "../../lib/permissions";
import SkeletonCard from "../common/SkeletonCard";

export default function ProtectedRoute({ pageKey, children }) {
  const { currentUser, loading } = useAuth();

  // ---------------------------
  // 1) أثناء تحميل بيانات المستخدم
  // ---------------------------
  if (loading) {
    


return (

      <div className="p-6 space-y-4" dir="rtl">
        <SkeletonCard className="h-32 rounded-3xl" />
        <SkeletonCard className="h-32 rounded-3xl" />
      </div>
    );
  }

  // ---------------------------
  // 2) غير مسجل دخول
  // ---------------------------
  if (!currentUser) {
    return <Navigate to="/" replace />;
  }

  // ---------------------------
  // 3) الصلاحيات — RBAC
  // ---------------------------
  if (!canAccess(currentUser.role, pageKey)) {
    return <Navigate to="/dashboard" replace />;
  }

  // ---------------------------
  // 4) دخول مسموح
  // ---------------------------
  return children;
}


