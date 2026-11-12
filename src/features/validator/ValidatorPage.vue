<script setup lang="ts">
import { useHead } from '@unhead/vue'
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import ResultView from './ResultView.vue'
import UploadForm from './UploadForm.vue'
import { useValidator } from './useValidator'
import { failureMessage, headline } from './wording'

const RESULT_MARK = 'validatorResult'
const VERIFIED_ON = { iso: '2026-11-11', text: '11 listopada 2026 r.' }

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

const { state, exampleError, submitFile, submitExample, retry, reset } = useValidator()
const upload = useTemplateRef<InstanceType<typeof UploadForm>>('upload')
const result = useTemplateRef<InstanceType<typeof ResultView>>('result')
const announcement = ref('')

const isResultEntry = (entry: unknown) => (entry as Record<string, unknown> | null)?.[RESULT_MARK] === true

watch(state, async (current, previous) => {
  if (current.status === 'result' && previous.status !== 'result') {
    announcement.value = headline(current.report)
    history.pushState({ ...(history.state as object | null), [RESULT_MARK]: true }, '')
    await nextTick()
    result.value?.focusHeading()
  } else if (current.status === 'failure') {
    announcement.value = failureMessage(current.failure)
  } else if (current.status === 'sending') {
    announcement.value = `Sprawdzamy plik ${current.file.name}.`
  }
})

async function backToForm() {
  reset()
  announcement.value = ''
  await nextTick()
  upload.value?.focus()
}

function onPopState(event: PopStateEvent) {
  if (state.value.status === 'result' && !isResultEntry(event.state)) void backToForm()
}

function newFile() {
  if (isResultEntry(history.state)) history.back()
  else void backToForm()
}

onMounted(() => window.addEventListener('popstate', onPopState))
onBeforeUnmount(() => window.removeEventListener('popstate', onPopState))
</script>

<template>
  <p class="vh announce" role="status">{{ announcement }}</p>
  <ResultView
    v-if="state.status === 'result'"
    ref="result"
    :report="state.report"
    :file="state.file"
    :hash="state.hash"
    @new-file="newFile"
  />
  <template v-else>
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
          <UploadForm
            ref="upload"
            :state="state"
            :example-error="exampleError"
            @file="submitFile"
            @example="submitExample"
            @retry="retry"
          />
          <p class="tool__foot">
            <strong>Co dzieje się z plikiem:</strong> wysyłamy go na nasz serwer tylko do sprawdzenia.
            Sprawdzamy go w pamięci, nie zapisujemy, a jego treść nie trafia do logów. Podgląd, PDF i
            link powstają w Twojej przeglądarce. Nic nie trafia do KSeF.
            <a class="link" href="/polityka-prywatnosci#plik">Szczegóły</a>
          </p>
        </section>
      </div>
    </div>
    <div class="docs">
      <div class="wrap">
        <div class="docs__grid">
          <section id="co-z-plikiem" class="entry">
            <h2>Co dzieje się z plikiem</h2>
            <p>
              Plik trafia na nasz serwer na czas kontroli, przez szyfrowane połączenie. Sprawdzamy go w pamięci,
              nie zapisujemy go na dysku i nie zapisujemy raportu. Jego treść nie trafia do logów. Po zakończeniu
              sprawdzenia nie mamy już ani pliku, ani wyniku.
            </p>
            <p>Podgląd faktury, PDF, link weryfikacyjny i kod QR liczy Twoja przeglądarka. Te dane nie są do nas wysyłane.</p>
            <p>
              Jeśli w pliku są dane innych osób, na przykład kontrahentów, upewnij się, że możesz go przekazać do
              sprawdzenia. Jeśli chcesz sprawdzić tylko format, użyj danych testowych albo
              <a href="#przyklad">pliku przykładowego</a>.
            </p>
            <p>
              Serwer zapisuje w logach adres IP i czas wizyty, bez treści pliku, i usuwa je po 14 dniach.
              Szczegóły są w <a class="link" href="/polityka-prywatnosci">polityce prywatności</a>.
            </p>
          </section>
          <section class="entry">
            <h2>Czego walidator nie sprawdza</h2>
            <p>
              Działa bez połączenia z KSeF, dlatego nie widzi uprawnień, duplikatów ani odpowiedzi systemu. Dobry
              wynik nie gwarantuje przyjęcia faktury, a narzędzie nie doradza podatkowo.
            </p>
            <p>
              Kwoty na korektach, zaliczkach i marży nie są liczone. W takim wyniku zobaczysz „nie sprawdzono”, a nie
              zgadywane „bez uwag”.
            </p>
          </section>
        </div>
        <p class="docs__stamp">
          Reguły i schemat zweryfikowane <time :datetime="VERIFIED_ON.iso">{{ VERIFIED_ON.text }}</time>, FA(3) w wersji 1-0E.
        </p>
      </div>
    </div>
  </template>
</template>
