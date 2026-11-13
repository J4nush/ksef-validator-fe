# ksef-pdf-generator

Copy of the invoice visualisation generator published by the Polish Ministry of Finance.

| | |
|---|---|
| Repository | https://github.com/CIRFMF/ksef-pdf-generator |
| Release | 1.1.48 |
| Commit | `d766b7b79486ed401cd40fac27402ffecd672bd7` (2026-11-06) |
| Imported | 2026-11-12 |
| License | MIT, see `LICENSE` |

## What is copied

`src/lib-public` and `src/shared` from the commit above, without the `*.spec.ts` files. The demo application in `src/app-public` is left out.

`package.json` is not the upstream file. It keeps only the name and version, because `src/shared/utils/generate-info.ts` and `src/shared/generators/common/functions.ts` import the version from it.

The application imports only `lib-public/FA3-generator.ts`, `lib-public/i18n/i18n-init.ts` and `shared/XML-parser.ts`, so the other generators are not part of the build. The directory is excluded from the project lint and type check.

## Runtime dependencies

`pdfmake`, `i18next` and `xml-js` come from the application `package.json`. Upstream pins `pdfmake` 0.3.11 and `i18next` ^25.8.4; the application uses newer releases after checking that every test invoice produces the same PDF text, links and metadata with both sets. `i18next-http-backend` and `i18next-browser-languagedetector` are not installed, because the generator never imports them.

The Roboto fonts embedded in the PDF come from `pdfmake/build/vfs_fonts` and are licensed under the SIL Open Font License 1.1, see `LICENSE-Roboto.txt`.

## Local changes

1. `src/lib-public/generators/FA3/Platnosc.ts`: `LinkDoPlatnosci` is always printed as text, and becomes a link only when it parses as a URL with the `https:` scheme and contains no whitespace. Upstream passes the formatted text object as the link target, so the annotation pointed to `[object Object]`, and any scheme from the invoice file would be clickable.
2. `src/lib-public/generators/common/Stopka.ts`: without a KSeF number the caption under the verification QR code uses the translation key `invoice.qr1.withoutNumber` instead of staying empty. The application provides the text for this key.

## Updating

1. Check out the new upstream commit and copy `src/lib-public` and `src/shared` again, without `*.spec.ts`.
2. Set the version in `package.json`.
3. Apply the local changes above again, or drop the ones upstream has fixed.
4. Compare the dependency versions in the upstream `package.json` with the application ones.
5. Run the unit tests of `src/pdf` and the end to end tests, then update this file.
