class TextFileReader {
  result: string | null = null
  onload: ((event: { target: TextFileReader }) => void) | null = null

  readAsText(blob: Blob, encoding = 'utf-8') {
    void blob.arrayBuffer().then((buffer) => {
      this.result = new TextDecoder(encoding).decode(buffer)
      this.onload?.({ target: this })
    })
  }
}

globalThis.FileReader ??= TextFileReader as unknown as typeof FileReader
