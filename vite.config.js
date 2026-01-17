import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/appwrite-proxy': {
        target: 'https://cloud.appwrite.io/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/appwrite-proxy/, ''),
      },
    }
  }
})
