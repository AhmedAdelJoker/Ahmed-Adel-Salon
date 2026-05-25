import { useEffect } from 'react';
import AppRouter from "./app/router";
import { AuthProvider } from "./context/AuthContext";
import { PreferencesProvider } from "./context/PreferencesContext";
import { SalonProvider } from "./context/SalonContext";
import { SocketProvider } from "./context/SocketContext";
import { TooltipProvider } from "./components/ui/tooltip";
import { Toaster } from "react-hot-toast";

export default function App() {
  


return (

    <AuthProvider>
      <PreferencesProvider>
        <SalonProvider>
          <SocketProvider>
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
          </SocketProvider>
        </SalonProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}


