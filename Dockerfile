# Etapa 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm ci

# Copiar código fuente
COPY . .

# Build de la aplicación Angular
RUN npm run build

# Etapa 2: Serve
FROM node:20-alpine

WORKDIR /app

# Instalar serve para servir la aplicación
RUN npm install -g serve

# Copiar archivos built desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Exponer puerto
EXPOSE 3000

# Comando para iniciar la aplicación
CMD ["serve", "-s", "dist/ruta-verde", "-l", "3000"]
