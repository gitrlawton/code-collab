"use client";

import { useTheme } from "@/lib/theme-provider";
import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Set mounted to true after component mounts
  useEffect(() => {
    setMounted(true);
  }, []);

  // Basic button styles that don't depend on JavaScript
  const buttonClasses = `rounded border border-solid border-black/[.08] dark:border-white/[.145] flex items-center justify-center hover:bg-[#f2f2f2] dark:hover:bg-[#1a1a1a] text-base h-8 w-8 cursor-pointer ${className}`;

  return (
    <button
      onClick={mounted ? toggleTheme : undefined}
      className={buttonClasses}
      aria-label="Toggle theme"
    >
      {/* 
        These classes are defined in layout.js <style> tag
        and will show/hide based on the dark class on <html>
        that's set by the preload script before any JS loads
      */}
      <Moon className={`h-5 w-5 theme-toggle-icon-light`} />
      <Sun className={`h-5 w-5 theme-toggle-icon-dark`} />
    </button>
  );
}
