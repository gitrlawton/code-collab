"use client";

import { createContext, useContext, useEffect, useState } from "react";

const ThemeContext = createContext(undefined);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    // Check if dark mode is already applied by the preload script
    const isDarkMode = document.documentElement.classList.contains("dark");
    const initialTheme = isDarkMode ? "dark" : "light";

    // Check for saved theme or system preference
    const savedTheme = localStorage.getItem("theme");
    const systemPreference = window.matchMedia("(prefers-color-scheme: dark)")
      .matches
      ? "dark"
      : "light";

    // Use the theme that's already applied, or fall back to saved/system preference
    const themeToUse = isDarkMode ? "dark" : savedTheme || systemPreference;
    setTheme(themeToUse);

    // Ensure theme is consistently applied
    if (themeToUse === "dark") {
      document.documentElement.classList.add("dark");
      document.body.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      document.body.classList.remove("dark");
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prevTheme) => {
      const newTheme = prevTheme === "light" ? "dark" : "light";

      // Save to localStorage
      localStorage.setItem("theme", newTheme);

      // Apply to document
      if (newTheme === "dark") {
        document.documentElement.classList.add("dark");
        document.body.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
        document.body.classList.remove("dark");
      }

      return newTheme;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
