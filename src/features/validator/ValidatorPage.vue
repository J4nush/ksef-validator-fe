<script setup lang="ts">
import { useHead } from '@unhead/vue'

useHead({
  title: 'Walidator XML faktur KSeF: sprawdź plik FA(3) bez konta',
  meta: [
    {
      name: 'description',
      content:
        'Wgraj plik XML faktury FA(3) i zobacz po polsku, co jest nie tak, w którym polu i co zmienić w programie do faktur. Bez konta i bez dostępu do KSeF.',
    },
  ],
})
</script>

<template>
  <div class="first">
    <div class="wrap">
      <h1>Walidator XML faktur KSeF: sprawdź plik FA(3) bez konta</h1>
      <p class="lead">
        Zobaczysz po polsku, co jest nie tak, w którym polu i co zmienić w programie do faktur. Nie
        logujesz się do KSeF i nie podajesz tokena.
      </p>
      <section id="sprawdz" class="tool" aria-labelledby="tool-h">
        <div class="tool__head">
          <h2 id="tool-h">Sprawdź plik</h2>
          <span class="mono muted">FA(3), schemat 1-0E</span>
        </div>
        <div class="tool__body"></div>
        <p class="tool__foot">
          <strong>Co dzieje się z plikiem:</strong> wysyłamy go na nasz serwer tylko do sprawdzenia.
          Sprawdzamy go w pamięci, nie zapisujemy, a jego treść nie trafia do logów. Podgląd, PDF i
          link powstają w Twojej przeglądarce. Nic nie trafia do KSeF.
          <a class="link" href="/polityka-prywatnosci#plik">Szczegóły</a>
        </p>
      </section>
    </div>
  </div>
</template>
