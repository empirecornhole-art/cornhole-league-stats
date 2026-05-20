import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        league: {
          bg: "#050505",
          card: "#141414",
          gold: "#d6a11f",
          red: "#b91c1c"
        }
      }
    }
  },
  plugins: []
};
export default config;
