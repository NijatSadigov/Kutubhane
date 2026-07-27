import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Dedicated fixed port so the origin is deterministic and matches the
    // backend CORS allow-list. strictPort fails loudly instead of silently
    // drifting to 5174/5175 if the port is taken.
    port: 5180,
    strictPort: true,
  },
})
