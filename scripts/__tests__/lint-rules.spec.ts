import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

const eslint = new ESLint({ cwd: process.cwd() })

async function rulesFor(code: string, filePath: string) {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((message) => message.ruleId)
}

const component = (template: string) =>
  `<script setup lang="ts">\nconst value = 'a'\n</script>\n\n<template>\n  ${template}\n</template>\n`

describe('lint rules that keep the CSP and the console clean', () => {
  it('rejects v-html', async () => {
    expect(await rulesFor(component('<p v-html="value"></p>'), 'src/ExampleCard.vue')).toContain('vue/no-v-html')
  })

  it('rejects a bound style', async () => {
    expect(await rulesFor(component('<p :style="value"></p>'), 'src/ExampleCard.vue')).toContain(
      'vue/no-restricted-v-bind',
    )
  })

  it('rejects a static style attribute', async () => {
    expect(await rulesFor(component('<p style="color: red">{{ value }}</p>'), 'src/ExampleCard.vue')).toContain(
      'vue/no-restricted-static-attribute',
    )
  })

  it('rejects console calls in application code', async () => {
    expect(await rulesFor("console.log('x')\n", 'src/example.ts')).toContain('no-console')
  })

  it('accepts a plain component', async () => {
    expect(await rulesFor(component('<p class="x">{{ value }}</p>'), 'src/ExampleCard.vue')).toEqual([])
  })
})
