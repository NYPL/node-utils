import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/index.ts',
  external: [
    '@aws-sdk/client-kms',
    'fs',
    'node:assert',
    'winston',
    'yaml'
  ],
  output: [
    {
      dir: 'dist/esm',
      format: 'esm',
      entryFileNames: '[name].mjs'
    },
    {
      dir: 'dist/cjs',
      format: 'cjs',
      entryFileNames: '[name].cjs'
    }
  ],
  plugins: [
    typescript({
      tsconfig: './tsconfig.json'
    })
  ]
}
