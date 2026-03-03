import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
/*for vite to load tailwind css*/
import tailwindcss from "@tailwindcss/vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
})
