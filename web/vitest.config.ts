import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config.ts';

// Two projects by file name, so pure logic runs fast in Node and only component tests pay for a DOM:
//   *.test.ts       unit: no DOM
//   *.dom.test.tsx  dom:  happy-dom + Testing Library + the fake API (src/test/setup.ts)
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      restoreMocks: true,
      coverage: {
        provider: 'v8',
        include: ['src/**/*.{ts,tsx}'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/lib/api/schema.gen.ts', 'src/components/icons/svg.ts'],
      },
      projects: [
        {
          extends: true,
          test: { name: 'unit', environment: 'node', include: ['src/**/*.test.ts'] },
        },
        {
          extends: true,
          test: {
            name: 'dom',
            environment: 'happy-dom',
            include: ['src/**/*.dom.test.tsx'],
            setupFiles: ['src/test/setup.ts'],
          },
        },
      ],
    },
  }),
);
