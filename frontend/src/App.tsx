import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AppRouter from "@/app/router";
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
      <AuthProvider>
        <PreferencesProvider>
          <SalonProvider>
            <SocketProvider>
              <UIProvider>
                <TooltipProvider delayDuration={400}>
                  <AppRouter />
                  <Toaster
                    position="top-center"
                    toastOptions={{
                      duration: 4000,
                      style: {
                        borderRadius: "22px",
                        background: "var(--bg-card)",
                        color: "var(--text-main)",
                        border: "1px solid var(--border)",
                        boxShadow: "var(--shadow-premium)",
                        fontFamily:
                          "Alexandria, IBM Plex Sans Arabic, Cairo, sans-serif",
                        fontWeight: "700",
                        fontSize: "14px",
                        padding: "16px 24px",
                        direction: "rtl",
                      },
                      success: {
                        iconTheme: {
                          primary: "var(--success)",
                          secondary: "var(--bg-card)",
                        },
                      },
                      error: {
                        iconTheme: {
                          primary: "var(--danger)",
                          secondary: "var(--bg-card)",
                        },
                      },
                    }}
                  />
                </TooltipProvider>
              </UIProvider>
            </SocketProvider>
          </SalonProvider>
        </PreferencesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
