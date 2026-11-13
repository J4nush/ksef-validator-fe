import { globalIgnores } from 'eslint/config'
import { defineConfigWithVueTs, vueTsConfigs } from '@vue/eslint-config-typescript'
import pluginVue from 'eslint-plugin-vue'
import pluginPlaywright from 'eslint-plugin-playwright'
import pluginVitest from '@vitest/eslint-plugin'

const inlineStyle = "CSP allows only style-src 'self', so style through classes."

export default defineConfigWithVueTs(
  {
    name: 'app/files-to-lint',
    files: ['**/*.{vue,ts,mts,tsx,mjs}'],
  },

  globalIgnores(['**/dist/**', 'vendor/**', '**/coverage/**', 'playwright-report/**', 'test-results/**', 'src/api/schema.d.ts']),

  ...pluginVue.configs['flat/essential'],
  vueTsConfigs.recommended,

  {
    name: 'app/csp-and-output',
    files: ['src/**/*.{vue,ts}'],
    rules: {
      'no-console': 'error',
      'vue/no-v-html': 'error',
      'vue/no-v-text-v-html-on-component': 'error',
      'vue/no-restricted-v-bind': ['error', { argument: 'style', message: inlineStyle }],
      'vue/no-restricted-static-attribute': ['error', { key: 'style', message: inlineStyle }],
    },
  },

  {
    ...pluginPlaywright.configs['flat/recommended'],
    files: ['e2e/**/*.ts'],
  },

  {
    ...pluginVitest.configs.recommended,
    files: ['src/**/__tests__/*', 'scripts/**/__tests__/*'],
    rules: {
      ...pluginVitest.configs.recommended.rules,
      'vitest/expect-expect': ['error', { assertFunctionNames: ['expect', 'expectTypeOf'] }],
    },
  },
)
