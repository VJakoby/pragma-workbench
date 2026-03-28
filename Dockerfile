FROM node:20-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN chown -R node:node /usr/src/app
USER node
EXPOSE 3000
CMD ["npm", "start"]
