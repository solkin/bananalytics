import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true,
      },
      // The MCP endpoint checks Host against BASE_URL, so it must see the
      // address the agent used, as it does behind nginx in production.
      '/mcp': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: false,
      },
    },
  },
})
