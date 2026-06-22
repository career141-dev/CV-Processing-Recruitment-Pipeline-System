"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button className="flex items-center gap-2 py-2 px-3 mb-1 rounded-md w-full cursor-pointer hover:bg-surface-container-low text-text-secondary transition-colors" disabled>
        <div className="w-5 h-5 rounded-full bg-surface-variant animate-pulse" />
        <span className="text-[13px] font-medium opacity-0">Loading</span>
      </button>
    );
  }

  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex items-center gap-2 py-2 px-3 mb-1 rounded-md w-full cursor-pointer hover:bg-surface-container-low text-text-secondary hover:text-text-primary transition-colors"
    >
      {isDark ? <Sun size={20} /> : <Moon size={20} />}
      <span className="text-[13px] font-medium">{isDark ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
