FROM node:latest

WORKDIR /app

COPY package.json .
COPY package-lock.json .

RUN yarn

COPY . .

CMD ["npm", "start"]
