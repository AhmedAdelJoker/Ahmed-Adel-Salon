import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  BrowserRouter,
  HashRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Scissors } from "lucide-react";
import i18n from "@/i18n";

import { getHomePath, getProfilePath, hasRoleAccess } from "@/lib/access/roles";
import {
  APP_ROUTES,
  permissionKeyForPath,
  resolvePageMeta,
  type AppRoute,
} from "@/app/route-registry";
import { useAuth } from "@/context/AuthContext";
import Sidebar from "@/components/layout/Sidebar";
import Header from "@/components/layout/Header";
import MobileNav from "@/components/layout/MobileNav";
import CommandPalette from "@/components/layout/CommandPalette";
import DynamicBackground from "@/components/layout/DynamicBackground";
import { cn } from "@/lib/core/utils";

// Electron يشغّل الواجهة عبر file:// — BrowserRouter يعتمد على history API
// الخاص بالسيرفر ويفشل هناك، لذلك نستخدم HashRouter داخل تطبيق الويندوز.
function isElectronEnv(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if ((window as unknown as { electronAPI?: unknown }).electronAPI) return true;
    if (
      typeof navigator !== "undefined" &&
      navigator.userAgent.includes("Electron")
    )
      return true;
    if (window.location.protocol === "file:") return true;
    const proc = (
      window as unknown as { process?: { versions?: { electron?: string } } }
    ).process;
    if (proc?.versions?.electron) return true;
  } catch {
    /* ignore */
  }
  return false;
}

function RouteLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center animate-fade-in">
      <div className="flex flex-col items-center gap-4 text-accent">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-card shadow-soft">
          <Scissors className="h-8 w-8 animate-pulse" />
        </div>
        <div className="space-y-1 text-center">
          <p className="text-sm font-black text-main">Barber Luxe Pro</p>
          <p className="text-xs font-bold tracking-widest text-muted uppercase">
            جاري تأمين الجلسة...
          </p>
        </div>
      </div>
    </div>
  );
}

function RequireAuth({
  allowedRoles = [],
  children,
}: {
  allowedRoles?: readonly string[];
  children?: React.ReactNode;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <RouteLoader />;

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (user.is_active === false) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ error: "account_disabled", from: location }}
      />
    );
  }

  if (
    allowedRoles?.length &&
    // Resolve the registry pattern first: a per-user override stored under
    // "/customers/:id" must apply to "/customers/42". Looking up the raw
    // pathname silently missed every param route.
    !hasRoleAccess(
      user,
      allowedRoles as string[],
      permissionKeyForPath(location.pathname),
    )
  ) {
    return <Navigate to={getHomePath(user.role)} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

function HomeRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={getHomePath(user.role)} replace />;
}

function ProfileRedirect() {
  const { user, loading } = useAuth();

  if (loading) return <RouteLoader />;
  if (!user) return <Navigate to="/login" replace />;

  return <Navigate to={getProfilePath(user.role)} replace />;
}

/** Renders one registry entry: a redirect, or the page behind a role guard. */
function RegistryRoute({ route }: { route: AppRoute }) {
  if (route.redirectTo) {
    return <Navigate to={route.redirectTo} replace />;
  }

  const Component = route.component;
  if (!Component) return null;

  if (route.public) return <Component />;

  return (
    <RequireAuth allowedRoles={route.roles}>
      <Component />
    </RequireAuth>
  );
}

function TitleUpdater() {
  const location = useLocation();

  useEffect(() => {
    document.title = `${resolvePageMeta(location.pathname).title} | Barber Luxe Pro`;
  }, [location.pathname]);

  return null;
}

function MainLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  const toggleSidebar = useCallback(() => {
    setMobileSidebarOpen((current) => !current);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setMobileSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const meta = resolvePageMeta(location.pathname);

  return (
    <div
      dir={i18n.dir() as "rtl" | "ltr"}
      className="app-shell relative flex h-dvh w-full overflow-hidden bg-slate-100 dark:bg-slate-950"
    >
      <DynamicBackground />

      <aside
        className={cn(
          "app-shell__sidebar-slot relative z-40 hidden lg:flex h-full shrink-0 transition-all duration-500 ease-in-out",
          sidebarCollapsed ? "w-24" : "w-84",
        )}
        onMouseEnter={() => setSidebarCollapsed(false)}
        onMouseLeave={() => setSidebarCollapsed(true)}
      >
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggleCollapsed={() => {}}
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </aside>

      <div className="app-shell__body relative z-20 flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <header className="z-30 shrink-0 border-b border-border/40 bg-white/90 backdrop-blur-xl dark:bg-slate-900/90">
          <Header
            title={meta.title}
            subtitle={meta.subtitle ?? "إدارة ذكية ومتكاملة."}
            onOpenSidebar={toggleSidebar}
          />
        </header>

        <main
          className="app-shell__main mobile-bottom-safe flex-1 min-h-0 relative h-full w-full overflow-y-auto scroll-smooth bg-slate-50/50 dark:bg-transparent"
          id="main-content"
        >
          <div className="app-shell__content min-h-full w-full px-4 py-4 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
            <Suspense fallback={<RouteLoader />}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>

      <MobileNav />
      <CommandPalette />

      <AnimatePresence>
        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-100 lg:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="absolute inset-y-0 right-0 z-101 w-[min(88vw,22rem)] p-3 shadow-2xl"
            >
              <Sidebar
                collapsed={false}
                onToggleCollapsed={() => setMobileSidebarOpen(false)}
                onNavigate={() => setMobileSidebarOpen(false)}
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

const LoginPage = lazy(() => import("@/pages/common/Login"));

export default function AppRouter() {
  const Router = isElectronEnv() ? HashRouter : BrowserRouter;

  return (
    <Router>
      <TitleUpdater />
      <Suspense fallback={<RouteLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<HomeRedirect />} />

          <Route element={<RequireAuth />}>
            <Route element={<MainLayout />}>
              {APP_ROUTES.filter((route) => !route.public).map((route) => (
                <Route
                  key={route.path}
                  path={route.path}
                  element={<RegistryRoute route={route} />}
                />
              ))}
            </Route>
          </Route>

          <Route path="*" element={<HomeRedirect />} />
        </Routes>
      </Suspense>
    </Router>
  );
}
