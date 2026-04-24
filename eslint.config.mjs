import coreWebVitals from 'eslint-config-next/core-web-vitals';
import typescriptConfig from 'eslint-config-next/typescript';

const config = [
  {
    ignores: [
      'node_modules/**',
      '.next/**',
      'drizzle/**',
      'next-env.d.ts',
      'tests/server-only-shim.ts',
    ],
  },
  ...coreWebVitals,
  ...typescriptConfig,
];

export default config;
