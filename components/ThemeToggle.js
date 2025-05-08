"use client";

import { useTheme } from "@/lib/theme-provider";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  // Initialize with null to avoid rendering any icon initially
  const [initialTheme, setInitialTheme] = useState(null);

  // Check document class on first render
  useEffect(() => {
    // Directly check the document class
    const isDark = document.documentElement.classList.contains("dark");
    setInitialTheme(isDark ? "dark" : "light");
  }, []);

  // If initialTheme is null, we haven't checked the document class yet
  // This prevents any icon from showing until we know the correct theme
  if (initialTheme === null) {
    return (
      <button
        className={`rounded border border-solid border-black/[.08] dark:border-white/[.145] flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] text-base h-8 w-8 cursor-pointer ${className}`}
      >
        <span className="h-5 w-5"></span>
      </button>
    );
  }

  // Use the theme from context for subsequent renders
  // But use initialTheme for the first render
  const displayTheme = theme || initialTheme;

  return (
    <button
      onClick={toggleTheme}
      className={`rounded border border-solid border-black/[.08] dark:border-white/[.145] flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] text-base h-8 w-8 cursor-pointer ${className}`}
      aria-label={`Switch to ${displayTheme === "light" ? "dark" : "light"} theme`}
    >
      {displayTheme === "light" ? (
        <Moon className="h-5 w-5" />
      ) : (
        <Sun className="h-5 w-5" />
      )}
    </button>
  );
}
