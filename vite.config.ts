import path from 'path';
import os from 'os';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    // 將快取目錄移出 Dropbox，避免同步鎖定導致的 EBUSY 錯誤
    cacheDir: path.join(os.tmpdir(), '87boss-vite-cache'),
    server: {
      port: 8767,
      strictPort: true,
      host: true,
      proxy: {
        // 本地 Node.js 后端代理
        '/api': {
          target: 'http://localhost:8766',
          changeOrigin: true,
        },
        // 本地文件服务
        '/files': {
          target: 'http://localhost:8766',
          changeOrigin: true,
        },
        '/input': {
          target: 'http://localhost:8766',
          changeOrigin: true,
        },
        '/output': {
          target: 'http://localhost:8766',
          changeOrigin: true,
        },
      },
    },
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve('.'),
      }
    },
    optimizeDeps: {
      force: false, // 關閉強制重新優化，減少 EBUSY 錯誤機會
      exclude: ['magic_0116', 'magic_0116_exclude'],
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-dev-runtime', 'lucide-react', 'zustand', 'zustand/middleware']
    },
    build: {
      rollupOptions: {
        external: [
          /magic_0116/
        ]
      }
    }
  };
});