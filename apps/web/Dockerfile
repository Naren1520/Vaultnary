# Stage 1: Build the Vite SPA
FROM node:22-alpine AS builder

WORKDIR /build

COPY apps/web/package.json apps/web/package-lock.json* ./
RUN npm ci

COPY apps/web/ ./
RUN npm run build

# Stage 2: nginx serving dist/ with security headers and API proxy
FROM nginx:1.27-alpine AS runtime

RUN rm /etc/nginx/conf.d/default.conf

COPY deploy/nginx.conf /etc/nginx/conf.d/vaultnary.conf
COPY --from=builder /build/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
