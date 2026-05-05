import { createContext, useContext, useEffect, useState, ReactNode } from "react";

export type Theme = "dark" | "light" | "liquid-glass" | "midnight-glass" | "sunset";

export const THEMES: { value: Theme; label: string; description: string }[] = [
  { value: "dark", label: "Neon Dark", description: "Tema escuro com acentos neon" },
  { value: "light", label: "Light", description: "Tema claro padrão" },
  { value: "liquid-glass", label: "Liquid Glass", description: "Aparência translúcida estilo Apple" },
  { value: "midnight-glass", label: "Midnight Glass", description: "Vidro escuro com profundidade" },
  { value: "sunset", label: "Sunset", description: "Gradiente quente roxo/laranja" },
];

interface ThemeContextType {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: "dark",
  setTheme: () => {},
  toggleTheme: () => {},
});

const DARK_THEMES: Theme[] = ["dark", "midnight-glass", "sunset"];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem("crm-theme") as Theme | null;
    if (stored && THEMES.some((t) => t.value === stored)) return stored;
    return "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    if (DARK_THEMES.includes(theme)) root.classList.add("dark");
    else root.classList.remove("dark");
    root.setAttribute("data-theme", theme);
    localStorage.setItem("crm-theme", theme);
  }, [theme]);

  const setTheme = (t: Theme) => setThemeState(t);
  const toggleTheme = () =>
    setThemeState((prev) => {
      const idx = THEMES.findIndex((t) => t.value === prev);
      return THEMES[(idx + 1) % THEMES.length].value;
    });

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
