import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';


// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),

  ],
  server: {
    host: '0.0.0.0', // Explicitly bind to all interfaces
    strictPort: true, // Fail if port 5173 is busy
    cors: true, // Allow CORS
    allowedHosts: true // Allow any host header (New Vite 5.x requirement for some networks)
  }
})
