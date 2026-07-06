import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Custom plugin to replace API_URL at compile time for Electron compatibility
const electronApiUrlPlugin = () => {
  return {
    name: 'electron-api-url-replace',
    transform(code, id) {
      if (id.includes('/src/') && (id.endsWith('.js') || id.endsWith('.jsx') || id.endsWith('.ts') || id.endsWith('.tsx'))) {
        const target = "const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);";
        
        const replacement = "const API_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.navigator.userAgent.includes('Electron')) ? 'http://localhost:5000' : (import.meta.env.VITE_API_URL && !import.meta.env.VITE_API_URL.includes('localhost') ? import.meta.env.VITE_API_URL : window.location.origin);";
        
        if (code.includes(target)) {
          return {
            code: code.replaceAll(target, replacement),
            map: null
          };
        }
      }
      return null;
    }
  };
};

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    electronApiUrlPlugin()
  ],
})
