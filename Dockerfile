FROM node:22-alpine AS build

WORKDIR /app
COPY package.json ./
RUN npm install
COPY tailwind.config.js index.html app.js ./
COPY src/ ./src/
RUN npm run build:css

FROM nginx:1.27-alpine

RUN rm -rf /usr/share/nginx/html/*

COPY nginx/nginx.conf /etc/nginx/nginx.conf
COPY nginx/snippets/ /etc/nginx/snippets/
COPY index.html style.css app.js core.mjs i18n.mjs tts.mjs storage.mjs sw.js manifest.json LICENSE /usr/share/nginx/html/
COPY --from=build /app/tailwind.css /usr/share/nginx/html/tailwind.css
COPY assets/ /usr/share/nginx/html/assets/

EXPOSE 80 443