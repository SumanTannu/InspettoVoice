import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#172026",
        steel: "#64727d",
        signal: "#0f766e",
        caution: "#b45309",
        danger: "#b42318"
      }
    }
  },
  plugins: []
};

export default config;
