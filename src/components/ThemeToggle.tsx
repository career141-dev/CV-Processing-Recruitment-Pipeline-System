"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    if (compact) {
      return (
        <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 animate-pulse" />
      );
    }
    return (
      <button className="flex items-center gap-2 py-2 px-3 mb-1 rounded-md w-full cursor-pointer hover:bg-surface-container-low text-text-secondary transition-colors" disabled>
        <div className="w-5 h-5 rounded-full bg-surface-variant animate-pulse" />
        <span className="text-[13px] font-medium opacity-0">Loading</span>
      </button>
    );
  }

  const isDark = theme === "dark";

  if (compact) {
    return (
      <button
        onClick={() => setTheme(isDark ? "light" : "dark")}
        className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
        title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
        aria-label="Toggle theme"
      >
        {isDark ? (
          <Sun size={18} className="text-amber-500 transition-transform hover:rotate-45" />
        ) : (
          <Moon size={18} className="text-slate-600 dark:text-slate-300 transition-transform hover:-rotate-12" />
        )}
      </button>
    );
  }

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center justify-between py-2.5 px-3.5 mb-2 rounded-xl w-full cursor-pointer border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/50 backdrop-blur-md shadow-sm hover:border-slate-300 dark:hover:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/80 transition-all duration-300 group"
    >
      <div className="flex items-center gap-2.5">
        {isDark ? (
          <Sun size={17} className="text-amber-500 transition-transform duration-500 group-hover:rotate-45" />
        ) : (
          <Moon size={17} className="text-indigo-500 transition-transform duration-500 group-hover:-rotate-12" />
        )}
        <span className="text-[13px] font-semibold text-slate-700 dark:text-slate-300">
          {isDark ? "Light Mode" : "Dark Mode"}
        </span>
      </div>
      <div className="w-8 h-5 rounded-full bg-slate-200 dark:bg-slate-800 p-0.5 transition-colors relative flex items-center">
        <div
          className={`w-4 h-4 rounded-full shadow-sm transform transition-transform duration-300 ${
            isDark ? "translate-x-3 bg-amber-500" : "bg-indigo-500"
          }`}
        />
      </div>
    </button>
  );
}
