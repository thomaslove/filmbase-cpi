import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],

  // The widget is embedded in a WildApricot HTML snippet, not served as its own
  // page, so the build is a library rather than an app: one classic script and
  // one stylesheet, at names that stay put across builds.
  //
  // IIFE rather than ESM on purpose. A <script type="module"> is refused
  // outright if the host serves the file with a non-JavaScript Content-Type,
  // which is a real risk of uploading into someone else's file manager; a
  // classic script is not. It also gives main.ts a usable document.currentScript.
  build: {
    // One .css file to upload, whatever the components do
    cssCodeSplit: false,
    lib: {
      entry: 'src/main.ts',
      name: 'CpiCalculator',
      formats: ['iife'],
      fileName: () => 'cpi-calculator.js',
    },
    rollupOptions: {
      output: { assetFileNames: 'cpi-calculator.[ext]' },
    },
  },
})
