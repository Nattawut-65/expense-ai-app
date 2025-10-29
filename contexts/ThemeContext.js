"use client";
import { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState("light");
  const [loading, setLoading] = useState(true);

  // โหลดธีมจาก localStorage เมื่อเริ่มต้น
  useEffect(() => {
    const savedTheme = localStorage.getItem("appTheme") || "light";
    setTheme(savedTheme);
    document.documentElement.classList.toggle("dark", savedTheme === "dark");
    setLoading(false);
  }, []);

  // บันทึกธีมเมื่อเปลี่ยน
  const toggleTheme = (newTheme) => {
    setTheme(newTheme);
    localStorage.setItem("appTheme", newTheme);
    document.documentElement.classList.toggle("dark", newTheme === "dark");
  };

  if (loading) {
    return null; // หรือแสดง loading screen
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within ThemeProvider");
  }
  return context;
}
