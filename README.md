# ksef-validator-fe

Web interface of a tool that checks Polish KSeF FA(3) e-invoice XML files before they are sent to KSeF. Pages are prerendered to static HTML and served by nginx. The validation API lives in a separate repository.

> **Work in progress.** The page layout and theme switch are in place. The upload and the result view are not built yet.

## Stack

Vue 3 with TypeScript, prerendered by vite-ssg. Plain CSS with design tokens, no CSS framework. Vitest for unit tests, Playwright with axe for end-to-end tests. Served by nginx with a strict Content Security Policy, so the code has no inline scripts or styles.

## Development

Requires Node.js 22.12 or newer.

```bash
npm ci
npm run dev
```

| Command | What it does |
|---|---|
| `npm run build` | Type check and prerender to `dist/` |
| `npm run preview` | Serve `dist/` with the production security headers |
| `npm run typecheck` | Type check only |
| `npm run lint` | ESLint |
| `npm test` | Unit tests |
| `npm run test:e2e` | Playwright against `npm run preview`, or against `E2E_BASE_URL` when set |
| `npm run check:head` | Every built page has a title and a meta description |
| `npm run check:inline` | No built page has an inline script, style or event handler |
| `npm run sync:contract` | Copy the OpenAPI contract from `../backend` into `contract/openapi.json` |
| `npm run check:contract` | Fail when `contract/openapi.json` differs from `../backend` (skipped without it) |
| `npm run gen:api` | Generate API types from `contract/openapi.json` |

## Docker

```bash
cp .env.example .env
docker compose up --build
```

The site is then on `http://127.0.0.1:${WEB_PORT}`. The image runs nginx as a non-root user on port 8080. `docker/nginx/dev-api.conf` forwards `/api` to the API container in a local full stack and is never copied into the image.

## Structure

| Path | Contents |
|---|---|
| `src/app` | Layout, header, footer, theme and styles |
| `src/features` | Feature code, one directory per feature |
| `public/theme.js` | Restores the saved theme before the first paint |
| `scripts` | Build checks and contract sync |
| `docker/nginx` | nginx configuration and security headers |

## License

MIT, see [LICENSE](LICENSE). Geist and Geist Mono fonts are under the SIL Open Font License, see `src/assets/fonts`.
