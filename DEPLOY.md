# Ruta Verde - Guía de Deploy

## Configuración en GitHub

Para que el CI/CD funcione correctamente, necesitas agregar los siguientes **Secrets** en tu repositorio de GitHub:

1. Ve a: **Settings → Secrets and variables → Actions**
2. Agrega los siguientes secrets:

```
SERVER_IP: 72.60.52.112
SERVER_USER: christian_asprilla
SERVER_PASSWORD: Qe7!xZp9@Lr2
SERVER_PORT: 22
```

## Deploy Automático (GitHub Actions)

El workflow se ejecutará automáticamente cuando hagas push a la rama `main`:

```bash
git add .
git commit -m "Update: message"
git push origin main
```

El workflow hará:
1. Checkout del código
2. Instalación de dependencias
3. Build de Angular
4. Deploy al servidor vía SSH
5. Reinicio del servicio

## Deploy Manual en el Servidor

### Opción 1: Con Docker (Recomendado)

```bash
ssh christian_asprilla@72.60.52.112
cd /home/christian_asprilla/ruta-verde
docker-compose up -d
```

### Opción 2: Manual sin Docker

```bash
bash deploy.sh
```

## Estructura de Deploy

```
/home/christian_asprilla/ruta-verde/
├── src/
├── dist/                 # Archivos compilados
├── node_modules/
├── package.json
├── Dockerfile
├── docker-compose.yml
└── deploy.sh
```

## Requisitos en el Servidor

- Node.js 20+
- npm o yarn
- Docker (opcional pero recomendado)
- Acceso SSH habilitado

## Puertos Disponibles

- SSH: 22
- HTTP: 80
- HTTPS: 443

## Monitoreo del Deploy

### Ver logs en Docker
```bash
docker-compose logs -f ruta-verde
```

### Ver logs del proceso serve
```bash
tail -f /tmp/ruta-verde.log
```

### Verificar estado del servicio
```bash
docker-compose ps
# o
ps aux | grep serve
```

## Troubleshooting

### El deploy falla en GitHub Actions
- Verifica que los secrets estén configurados correctamente
- Comprueba la conectividad SSH: `ssh -p 22 christian_asprilla@72.60.52.112`

### La aplicación no inicia en Docker
```bash
docker-compose logs ruta-verde
docker-compose restart ruta-verde
```

### Puerto en uso
```bash
lsof -i :3000
kill -9 <PID>
```

## Variables de Entorno

Crea un archivo `.env` en el servidor (opcional):

```
NODE_ENV=production
SUPABASE_URL=tu_url_supabase
SUPABASE_KEY=tu_key_supabase
API_URL=tu_api_url
```

## Rollback (Volver a versión anterior)

```bash
cd /home/christian_asprilla/ruta-verde
git log --oneline
git checkout <commit-hash>
npm run build
docker-compose restart
```
