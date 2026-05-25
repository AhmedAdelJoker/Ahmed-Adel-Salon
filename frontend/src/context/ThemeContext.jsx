import { useEffect } from 'react';
import { usePreferences } from "./PreferencesContext";

/**
 * Legacy ThemeContext shim.
 * Redirects to the unified PreferencesContext.
 */
export const useTheme = () => {
  const { darkMode, theme, setTheme, toggleTheme } = usePreferences();
  return { darkMode, theme, setTheme, toggleTheme };
};

// Provider no longer needed as it's merged into PreferencesProvider
export const ThemeProvider = ({ children }) => children;


