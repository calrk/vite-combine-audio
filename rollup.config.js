import typescript from '@rollup/plugin-typescript';
import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import dts from 'rollup-plugin-dts';

export default [
  // Build the main plugin (ESM and CJS)
  {
    input: 'src/index.ts', // Entry point
    output: [
      {
        file: 'dist/index.mjs', // ESM output
        format: 'esm',
        sourcemap: true,
      },
      {
        file: 'dist/index.js', // CommonJS output
        format: 'cjs',
        sourcemap: true,
      },
    ],
    plugins: [
      resolve(), // Resolve Node.js modules
      commonjs(), // Convert CommonJS modules to ESM
      typescript({ tsconfig: './tsconfig.json' }), // Use TypeScript
    ],
    external: ['vite', 'fs-extra', 'path', 'child_process', 'ffmpeg-static', 'node:fs'], // Mark Node.js modules as external
  },

  // Generate type declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es',
    },
    plugins: [dts()],
  },
];