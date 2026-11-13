import { configDefaults, defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'app',
            environment: 'jsdom',
            include: ['src/**/*.spec.ts'],
            exclude: [...configDefaults.exclude, 'e2e/**', 'src/pdf/**'],
          },
        },
        {
          extends: true,
          test: {
            name: 'pdf',
            environment: 'node',
            include: ['src/pdf/**/*.spec.ts'],
            setupFiles: ['src/pdf/__tests__/setup.ts'],
          },
        },
        {
          test: {
            name: 'scripts',
            environment: 'node',
            include: ['scripts/**/*.spec.ts'],
          },
        },
      ],
    },
  }),
)
