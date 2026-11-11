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
            exclude: [...configDefaults.exclude, 'e2e/**'],
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
