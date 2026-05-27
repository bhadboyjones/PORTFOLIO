import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-'))
            return 'recharts-vendor';
          if (id.includes('node_modules/react/') || id.includes('node_modules/react-dom/'))
            return 'react-vendor';
          if (id.includes('node_modules/date-fns') || id.includes('node_modules/axios'))
            return 'utils-vendor';
        },
      },
    },
  },
})
