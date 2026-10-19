import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import AppRouter from "@/app/router";
import { AppearanceProvider } from "@/context/AppearanceContext";
import { AuthProvider } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { SalonProvider } from "@/context/SalonContext";
import { SocketProvider } from "@/context/SocketContext";
import { UIProvider } from "@/context/UIContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";
import { useAutoRefresh } from "@/hooks/useAutoRefresh";

// 60s: the WS layer already invalidates the affected queries live on every
// event, so this sweep is only a periodic safety net. A full-refetch burst
// every 30s was pure overhead — and it re-triggered chart entry animations
// whenever any number changed.
const AUTO_REFRESH_MS = 60_000;

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // Matches AUTO_REFRESH_MS on purpose: a query is refetched at most once
      // per cycle, so the timer never doubles up on the in-flight request.
      staleTime: AUTO_REFRESH_MS,
    },
  },
});

/**
 * Refetches every mounted query on a fixed interval.
 *
 * `refetchType: "active"` skips queries whose components are unmounted, and
 * `invalidateQueries` (rather than `refetchQueries`) means a query that is
 * already in flight is marked stale and refetched once when it settles,
 * instead of a second request being fired alongside it.
 */
function AutoRefresh() {
  const queryClient = useQueryClient();
  const refreshAll = useCallback(() => {
    void queryClient.invalidateQueries({ refetchType: "active" });
  }, [queryClient]);

  useAutoRefresh(refreshAll, AUTO_REFRESH_MS);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AutoRefresh />
      {/* Appearance sits outermost: it only writes attributes on <html>, and it
          must be able to re-theme the tree regardless of auth or socket state.
          Auth sits above Socket so the WebSocket always has a token to send. */}
      <AppearanceProvider>
        <AuthProvider>
          <SocketProvider>
            <PreferencesProvider>
              <SalonProvider>
                <UIProvider>
                  <TooltipProvider delayDuration={400}>
                    <AppRouter />
                    <Toaster
                      position="top-center"
                      toastOptions={{
                        duration: 4000,
                        style: {
                          borderRadius: "16px",
                          background: "var(--surface-overlay)",
                          color: "var(--content-primary)",
                          border: "1px solid var(--line-default)",
                          boxShadow: "var(--elevation-3)",
                          fontFamily: "var(--font-sans)",
                          fontWeight: 600,
                          fontSize: "14px",
                          padding: "14px 20px",
                        },
                        success: {
                          iconTheme: {
                            primary: "var(--status-success)",
                            secondary: "var(--surface-overlay)",
                          },
                        },
                        error: {
                          iconTheme: {
                            primary: "var(--status-danger)",
                            secondary: "var(--surface-overlay)",
                          },
                        },
                      }}
                    />
                  </TooltipProvider>
                </UIProvider>
              </SalonProvider>
            </PreferencesProvider>
          </SocketProvider>
        </AuthProvider>
      </AppearanceProvider>
    </QueryClientProvider>
  );
}
