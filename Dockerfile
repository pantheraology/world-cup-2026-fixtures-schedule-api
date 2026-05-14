FROM apify/actor-node:20

COPY package*.json ./
RUN npm --quiet set progress=false \
    && npm install --omit=dev \
    && npm cache clean --force

COPY dist ./dist
COPY .actor ./.actor
COPY README.md ./README.md

CMD ["node", "dist/src/main.js"]
