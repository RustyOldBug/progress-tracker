import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' makes every asset path relative, so the same build works on
// https://<user>.github.io/<repo>/ and on a custom domain without changes.
export default defineConfig({
  base: './',
  plugins: [react()],
});
