FROM mhart/alpine-node:5

RUN apk add --update git make gcc g++ python openssl

ADD . /app
WORKDIR /app

RUN npm install

RUN apk del git make gcc g++ python openssl

EXPOSE 60000

CMD ["npm", "start"]
