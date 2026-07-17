FROM node:20-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:20-slim
WORKDIR /app

# Use the existing node user
USER node
ENV HOME=/home/node \
    PATH=/home/node/.local/bin:$PATH

WORKDIR $HOME/app

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/package*.json ./
RUN npm install --only=production
COPY --chown=node:node server.cjs ./

EXPOSE 7860
CMD ["node", "server.cjs"]
