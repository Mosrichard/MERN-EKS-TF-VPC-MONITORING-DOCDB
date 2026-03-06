FROM node:18-alpine AS build
WORKDIR /app

# Copy package files (package-lock.json if exists) first for caching
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm install

# Copy rest of the app
COPY . .

# Build the app
RUN npm run build

FROM nginx:alpine

# Copy built app
COPY --from=build /app/build /usr/share/nginx/html

# Copy custom nginx config
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
