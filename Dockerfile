FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --include=dev

COPY . .

ENV NODE_ENV=production
EXPOSE 10000

CMD ["npm", "start"]
