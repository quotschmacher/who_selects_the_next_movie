FROM node:20-alpine as build
WORKDIR /app
COPY frontend/package.json /app/package.json
RUN npm i
COPY frontend /app
ENV NEXT_PUBLIC_BACKEND_URL=/api
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3000
CMD ["npx", "next", "start", "-p", "3000"]
