import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    cacheDir: './.vite_temp',
    server: {
      port: 8765,
      strictPort: true,
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
      exclude: ['magic_0116', 'magic_0116_exclude'],
      include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-dev-runtime']
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