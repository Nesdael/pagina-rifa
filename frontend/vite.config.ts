import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // En desarrollo, las llamadas a /api se mandan al backend de Nest
    proxy: { '/api': 'http://localhost:3000' },
  },
})
