FROM node:20-bookworm-slim

ARG INSTALL_CHROMIUM=true

WORKDIR /usr/src/app

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    && if [ "$INSTALL_CHROMIUM" = "true" ]; then \
      apt-get install -y --no-install-recommends \
        chromium \
        fonts-liberation \
        fonts-dejavu-core; \
    fi \
    && rm -rf /var/lib/apt/lists/*

COPY --chown=node:node package*.json ./
RUN npm ci --omit=dev

COPY --chown=node:node server ./server
COPY --chown=node:node public ./public
COPY --chown=node:node views ./views
COPY --chown=node:node server.js ./server.js
COPY --chown=node:node note-templates.json ./note-templates.json
RUN mkdir -p /usr/src/app/knowledge_base /usr/src/app/sessions \
    && chown node:node /usr/src/app/knowledge_base /usr/src/app/sessions

USER node
EXPOSE 3000
CMD ["npm", "start"]
