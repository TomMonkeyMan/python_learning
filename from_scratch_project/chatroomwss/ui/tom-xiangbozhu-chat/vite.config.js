import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/xbzchat/',
  server: {
    proxy: {
      '/xbzchat/ws': {
        target: 'ws://localhost:8099',
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/xbzchat\/ws/, '/ws'),
      },
      '/xbzchat/v1/last_online_time': {
        target: 'http://localhost:8098',
        ws: true,
        changeOrigin: true,
        //rewrite: (path) => path.replace(/^\/xbzchat\/ws/, '/ws'),
      },
    },
  },
})
