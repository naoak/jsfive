import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';

module.exports = {
  input: 'src/high-level.ts',
  output: {
    file: 'dist/hdf5.js',
    format: 'umd',
    name: 'hdf5',
    sourcemap: true
  },
  plugins: [
    resolve(),
    commonjs({include: /node_modules/}),
    typescript({noEmitOnError: false}),
    terser()
  ]
};
