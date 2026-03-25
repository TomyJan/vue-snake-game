import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { execSync } from 'child_process'

const commitHash = execSync('git rev-parse --short HEAD').toString().trim()

export default defineConfig({
  plugins: [vue()],
  base: '/vue-snake-game/',
  define: {
    __APP_VERSION__: JSON.stringify('1.1.0'),
    __APP_COMMIT__: JSON.stringify(commitHash),
  },
  server: {
    port: 2333,
    host: '0.0.0.0',
  },
})
