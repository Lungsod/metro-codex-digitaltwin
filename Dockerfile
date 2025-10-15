# develop container
FROM node:24 AS develop

# build container
FROM node:24 AS build
USER node

COPY --chown=node:node . /app

WORKDIR /app

RUN npm install
RUN yarn gulp release --baseHref="/twin/"

# deploy container
FROM node:24-slim AS deploy

USER node

WORKDIR /app

# Without the chown when copying directories, wwwroot is owned by root:root.
COPY --from=build --chown=node:node /app/wwwroot wwwroot
COPY --from=build --chown=node:node /app/node_modules node_modules
COPY --from=build --chown=node:node /app/scripts scripts
COPY --from=build /app/serverconfig.json serverconfig.json
COPY --from=build /app/index.js index.js
COPY --from=build /app/package.json package.json
COPY --from=build /app/version.js version.js
COPY --from=build /app/server.js server.js

ENV PORT=3001
EXPOSE ${PORT}
ENV NODE_ENV=production
CMD [ "yarn", "start" ]
