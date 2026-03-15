FROM node:20-alpine
RUN npm install -g npm@latest
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN mkdir -p sessions && \
    chown -R node:node /usr/src/app
USER node
EXPOSE 3000
CMD ["npm", "start"]