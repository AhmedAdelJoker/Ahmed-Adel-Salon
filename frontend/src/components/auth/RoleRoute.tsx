import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function RoleRoute({
  allowedRoles = [],
  children,
}: {
  allowedRoles?: string[];
  children?: React.ReactNode;
}) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center" dir="rtl">
        <div className="card p-8 rounded-3xl text-center shadow-soft border border-border bg-card">
          <div className="w-10 h-10 mx-auto mb-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm font-black text-muted">
            جارٍ التحقق من الصلاحيات...
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  if (!allowedRoles.includes(user.role ?? "")) {
    return <Navigate to="/" replace />;
  }

  return children;
}
