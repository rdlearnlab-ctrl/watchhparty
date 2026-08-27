import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        bgBase: "#f4f0ea", 
        primary: "#ff6b6b", 
        secondary: "#4ecdc4", 
        accent: "#ffe66d", 
        dark: "#1a1a1a", 
      },
      boxShadow: {
        'neo': '4px 4px 0px 0px rgba(26, 26, 26, 1)',
        'neo-lg': '8px 8px 0px 0px rgba(26, 26, 26, 1)',
        'neo-pressed': '1px 1px 0px 0px rgba(26, 26, 26, 1)',
      },
      borderRadius: {
        'neo': '12px',
      }
    },
  },
  plugins: [],
};
export default config;