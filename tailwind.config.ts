import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2c6975",
        primaryDark: "#1c474f",
        accent: "#f4dd3d",
        border: "#dfe3ea",
        surface: {
          DEFAULT: "#ffffff",
          subtle: "#f4f6f9",
        },
        ink: {
          900: "#1f2733",
          700: "#3c4657",
          500: "#65707d",
          400: "#8a94a6",
          300: "#b7bfc9",
        },
        success: "#1f8a4c",
        danger: "#c0392b",
        warning: "#b9770e",
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,24,40,.05)",
        panel: "0 1px 3px rgba(16,24,40,.08)",
      },
      spacing: {
        sidebar: "260px",
        "sidebar-collapsed": "72px",
      },
    },
  },
  plugins: [],
};

export default config;
