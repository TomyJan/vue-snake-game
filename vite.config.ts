import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  base: '/vue-snake-game/',
  server: {
    port: 2333,
    host: '0.0.0.0',
  },
})
