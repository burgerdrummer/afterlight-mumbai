import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
const proxy={'/api/routing':{target:'http://127.0.0.1:8787',rewrite:(path:string)=>path.replace('/api/routing','')}};
export default defineConfig({ plugins: [react()], base: process.env.VITE_BASE_PATH || '/', server:{proxy},preview:{host:'127.0.0.1',port:4173,proxy}, build: { chunkSizeWarningLimit: 1200 } });
