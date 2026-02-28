FROM node:20-bookworm
WORKDIR /app
RUN apt-get update && apt-get install -y git xvfb libgtk-3-0 libnss3 libatk-bridge2.0-0 libdrm2 libgbm1 libasound2 libx11-xcb1 libxcb-dri3-0
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3004
CMD ["npm", "start"]