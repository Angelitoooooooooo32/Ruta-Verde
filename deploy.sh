#!/bin/bash

# Script de deploy para Ruta Verde
# Este script debe ejecutarse en el servidor

set -e

echo "=== Iniciando deploy de Ruta Verde ==="

# Definir variables
APP_DIR="/home/christian_asprilla/ruta-verde"
REPO_URL="https://github.com/Angelitoooooooooo32/Ruta-Verde.git"
CONTAINER_NAME="ruta-verde-app"

# Crear directorio si no existe
if [ ! -d "$APP_DIR" ]; then
    echo "Creando directorio de aplicación..."
    mkdir -p "$APP_DIR"
fi

# Entrar al directorio
cd "$APP_DIR"

# Si no existe el repositorio, clonarlo
if [ ! -d ".git" ]; then
    echo "Clonando repositorio..."
    git clone "$REPO_URL" .
else
    echo "Actualizando repositorio..."
    git pull origin main
fi

# Instalar/actualizar dependencias
echo "Instalando dependencias..."
npm ci

# Build de la aplicación
echo "Construyendo aplicación..."
npm run build

# Si Docker está disponible, usar Docker
if command -v docker &> /dev/null; then
    echo "Usando Docker para deploy..."
    
    # Detener y remover contenedor anterior
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm "$CONTAINER_NAME" 2>/dev/null || true
    
    # Build y run del contenedor
    docker-compose up -d
    
    echo "Aplicación deployed en Docker"
else
    echo "Docker no encontrado, usando serve directamente..."
    
    # Instalar serve si no existe
    npm install -g serve
    
    # Matar proceso anterior si existe
    pkill -f "serve -s dist/ruta-verde" || true
    
    # Iniciar la aplicación
    nohup serve -s dist/ruta-verde -l 3000 > /tmp/ruta-verde.log 2>&1 &
    
    echo "Aplicación deployed en puerto 3000"
fi

echo "=== Deploy completado exitosamente ==="
