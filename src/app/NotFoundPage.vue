<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
  title: 'Nie ma takiej strony | Walidator KSeF',
  meta: [
    { name: 'description', content: 'Pod tym adresem nie ma strony. Wróć do walidatora XML faktur KSeF.' },
    { name: 'robots', content: 'noindex' },
  ],
})
</script>

<template>
  <div class="first">
    <div class="wrap">
      <h1>Nie ma takiej strony</h1>
      <p class="lead">
        Adres mógł się zmienić albo zawiera literówkę.
        <RouterLink class="link" to="/">Wróć do walidatora</RouterLink>
      </p>
    </div>
  </div>
</template>
