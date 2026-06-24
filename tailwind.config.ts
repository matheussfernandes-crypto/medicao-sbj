import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "#2c6975",
        primaryDark: "#1c474f",
        accent: "#f4dd3d",
      },
    },
  },
  plugins: [],
};

export default config;
