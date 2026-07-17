import { defineConfig, build } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, rmSync } from 'fs';

// Build content script separately as a self-contained IIFE (no imports)
let contentScriptBuilt = false;
function buildContentScriptIIFE() {
  return {
    name: 'build-content-script-iife',
    async writeBundle() {
      if (contentScriptBuilt) return;
      contentScriptBuilt = true;

      await build({
        configFile: false,
        build: {
          outDir: 'dist',
          emptyOutDir: false,
          rollupOptions: {
            input: resolve(__dirname, 'src/content/content-script.js'),
            output: {
              format: 'iife',
              entryFileNames: 'content-script.js',
              name: 'Awwdits',
              inlineDynamicImports: true,
            },
          },
        },
      });
    },
  };
}

function copyExtensionFiles() {
  return {
    name: 'copy-extension-files',
    writeBundle() {
      if (!existsSync('dist/icons')) {
        mkdirSync('dist/icons', { recursive: true });
      }

      const files = [
        ['manifest.json', 'dist/manifest.json'],
        ['public/icons/icon-16.png', 'dist/icons/icon-16.png'],
        ['public/icons/icon-48.png', 'dist/icons/icon-48.png'],
        ['public/icons/icon-128.png', 'dist/icons/icon-128.png'],
        ['src/content/content-styles.css', 'dist/content-styles.css'],
        ['dist/src/sidebar/index.html', 'dist/sidebar.html'],
      ];

      files.forEach(([src, dest]) => {
        try { copyFileSync(src, dest); } catch {}
      });

      try { rmSync('dist/src', { recursive: true, force: true }); } catch {}
    },
  };
}

export default defineConfig({
  plugins: [react(), buildContentScriptIIFE(), copyExtensionFiles()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidebar: resolve(__dirname, 'src/sidebar/index.html'),
        'service-worker': resolve(__dirname, 'src/background/service-worker.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'index.css') return 'sidebar.css';
          return '[name].[ext]';
        },
      },
    },
  },
});
