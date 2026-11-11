<script setup lang="ts">
import { useHead } from '@unhead/vue'
import SiteFooter from '@/app/SiteFooter.vue'
import SiteHeader from '@/app/SiteHeader.vue'

useHead({ htmlAttrs: { lang: 'pl' } })
</script>

<template>
  <a class="skip" href="#tresc">Przejdź do treści</a>
  <SiteHeader />
  <main id="tresc" tabindex="-1">
    <RouterView />
  </main>
  <SiteFooter />
</template>
