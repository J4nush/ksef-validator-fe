# syntax=docker/dockerfile:1

FROM node:26.13.0-alpine@sha256:8996bb5821d62a8fd9bb27c1cb07462f3fdce6e47d640c6a881ead0b064ce216 AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build \
    && node scripts/check-head.mjs dist \
    && node scripts/check-inline.mjs dist \
    && rm -rf dist/.vite

FROM nginx:1.30.6-alpine@sha256:583b7f2fce1cdb8da5ad5c39ebd3c33b98b87d493190e548bdee1fa8c619c311
RUN apk upgrade --no-cache \
    && rm -f /etc/nginx/conf.d/default.conf \
    && rm -rf /usr/share/nginx/html/*
COPY docker/nginx/nginx.conf /etc/nginx/nginx.conf
COPY docker/nginx/security-headers.conf /etc/nginx/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
USER nginx
EXPOSE 8080
ENTRYPOINT ["nginx", "-g", "daemon off;"]
