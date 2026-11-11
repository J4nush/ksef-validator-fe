<script setup lang="ts">
const year = __BUILD_YEAR__

const links = [
  { href: '/polityka-prywatnosci', label: 'Polityka prywatności' },
  { href: '/regulamin', label: 'Regulamin' },
  { href: '/zastrzezenia', label: 'Zastrzeżenia' },
  { href: '/dostepnosc', label: 'Dostępność' },
  { href: '/kontakt', label: 'Kontakt' },
]
</script>

<template>
  <footer class="foot">
    <div class="wrap foot__in">
      <div class="foot__about">
        <p>© {{ year }} <a class="link" href="https://michal-ziolek.dev">Michał Ziółek</a></p>
        <p>Niezależne narzędzie, niezwiązane z Ministerstwem Finansów.</p>
      </div>
      <nav class="foot__nav" aria-label="Stopka">
        <ul>
          <li v-for="link in links" :key="link.href">
            <a class="link" :href="link.href">{{ link.label }}</a>
          </li>
        </ul>
      </nav>
    </div>
  </footer>
</template>
