import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppRouter from "@/app/router";
import { AppearanceProvider } from "@/context/AppearanceContext";
import { AuthProvider } from "@/context/AuthContext";
import { PreferencesProvider } from "@/context/PreferencesContext";
import { SalonProvider } from "@/context/SalonContext";
import { SocketProvider } from "@/context/SocketContext";
import { UIProvider } from "@/context/UIContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "react-hot-toast";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
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
