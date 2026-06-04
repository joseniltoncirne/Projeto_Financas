import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    open: true,
    host: true
  },
  define: {
    __API_BASE__: JSON.stringify(process.env.VITE_API_BASE || ''),
  },
})
