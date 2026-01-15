// electron.vite.config.ts
import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
var __electron_vite_injected_dirname =
  'C:\\Users\\seven\\.gemini\\antigravity\\playground\\orbital-mare'
var electron_vite_config_default = defineConfig({
  main: {},
  preload: {
    build: {
      rollupOptions: {
        input: {
          index: resolve(__electron_vite_injected_dirname, 'src/preload/index.ts'),
          browser: resolve(__electron_vite_injected_dirname, 'src/preload/browser.ts')
        }
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss()]
  }
})
export { electron_vite_config_default as default }
