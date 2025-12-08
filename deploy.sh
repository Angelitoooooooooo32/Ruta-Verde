
#!/bin/bash

# Script de deploy para Ruta Verde
# Este script debe ejecutarse en el servidor

set -e

echo "=== Iniciando deploy de Ruta Verde ==="

# Definir variables
APP_DIR="/home/christian_asprilla/ruta-verde"
REPO_URL="https://github.com/Angelitoooooooooo32/Ruta-Verde.git"
PORT="4200"

# Entrar al directorio
cd "$APP_DIR"

# Actualizar repositorio
echo "Actualizando repositorio..."
git pull origin main

# Instalar/actualizar dependencias
echo "Instalando dependencias..."
npm ci

# Build de la aplicación
echo "Construyendo aplicación..."
npm run build

# IMPORTANTE: Verificar dónde está realmente la build
echo "Verificando estructura de build..."
if [ -f "dist/ruta-verde/index.html" ]; then
    SERVE_PATH="dist/ruta-verde"
    echo "✅ Build encontrada en: $SERVE_PATH"
elif [ -f "dist/browser/index.html" ]; then
    SERVE_PATH="dist/browser"
    echo "✅ Build encontrada en: $SERVE_PATH"
elif [ -f "dist/index.html" ]; then
    SERVE_PATH="dist"
    echo "✅ Build encontrada en: $SERVE_PATH"
else
    echo "❌ ERROR: No se encontró index.html después del build"
    find dist/ -name "*.html"
    exit 1
fi

# Usar PM2 para manejar el proceso
echo "Configurando PM2..."

# Detener proceso anterior si existe
pm2 delete ruta-verde 2>/dev/null || true

# Iniciar con PM2
pm2 serve "$APP_DIR/$SERVE_PATH" $PORT --spa --name "ruta-verde"

# Configurar para iniciar automáticamente
pm2 save

echo "=== Deploy completado exitosamente ==="
echo "🌐 Aplicación disponible en: http://$(hostname -I | awk '{print $1}'):$PORT"
echo "📊 Ver estado: pm2 status"
echo "📝 Ver logs: pm2 logs ruta-verde"