# Map Geopoligons

Este repositorio contiene herramientas para el mapeo, dibujo y gestión de polígonos geográficos, con conversión automática entre coordenadas GPS (Latitud/Longitud) y UTM.

## Inicio Rápido

Para iniciar tanto el backend como el frontend automáticamente, utiliza el script incluido:

```bash
./start.sh
```

En **Windows**, simplemente ejecuta:

```cmd
start.bat
```

Este script levantará:
- **Backend**: En `http://localhost:8000`
- **Frontend**: En `http://localhost:5173` (o el puerto que asigne Vite)

## Ejecución con Docker

Para una configuración más robusta y aislada, puedes usar Docker:

1.  Asegúrate de tener Docker y Docker Compose instalados.
2.  Ejecuta el siguiente comando en la raíz del proyecto:

```bash
# Build and run
sudo docker compose up --build -d

# Only run
sudo docker compose up -d

```

Esto iniciará los servicios en los mismos puertos que la ejecución manual:
-   **Backend Docs**: `http://localhost:8000/docs`
-   **Frontend**: `http://localhost:5173`

Para detener los servicios:
```bash
sudo docker compose stop
```

## Ejecución Manual

Si prefieres ejecutar los servicios manualmente:

### Backend
```bash
cd backend
# Activar entorno virtual si existe
source .venv/bin/activate
# Iniciar servidor
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd web-wizard
npm install
npm run dev
```

## Estructura del Proyecto

### 1. Web Wizard (Frontend)
Una implementación moderna basada en navegador construida con **React**, **TypeScript** y **Leaflet**.

-   **Ubicación**: [`web-wizard/`](./web-wizard)
-   **Tecnologías**: React, Vite, TypeScript, Leaflet, Proj4.
-   **Características**:
    -   Mapa interactivo completo en el navegador.
    -   Dibujo y edición de formas (Polígonos, Líneas, Puntos).
    -   Guardado/Carga de archivos GeoJSON.
    -   Generación de rutas para minería.

### 2. Backend
Servidor API construido con **FastAPI** para el procesamiento de datos geoespaciales.

-   **Ubicación**: [`backend/`](./backend)
-   **Tecnologías**: Python, FastAPI, GeoPandas, NetworkX.
-   **Funcionalidades**:
    -   Procesamiento de archivos `.hol` y GeoJSON.
    -   Generación de rutas optimizadas.
    -   Conversión de coordenadas.
    - **Transferencia de Archivos**: Capacidad de enviar los resultados generados a un servidor remoto vía SCP/SSH.

## Transferencia de Archivos (SCP/SSH)

La aplicación permite transferir los archivos generados (rutas, mapas, etc.) directamente a otro PC o servidor mediante el protocolo SCP.

1.  Genera una ruta en la pestaña "Route Generator" o "Map Wizard".
2.  Haz clic en el botón **Transfer**.
3.  Ingresa las credenciales SSH del destino:
    -   **Host**: IP o nombre de dominio.
    -   **Port**: Puerto SSH (por defecto 22).
    -   **Username**: Usuario SSH.
    -   **Password**: Contraseña SSH.
    -   **Remote Path**: Ruta absoluta en el servidor donde se guardarán los archivos.
4.  Haz clic en **Send Files**.

**Nota**: Esta funcionalidad requiere que la librería `paramiko` esté instalada en el backend (ya incluida en `requirements.txt`).

## Documentación y Notebooks

Para entender mejor los algoritmos y herramientas utilizados, consulta la documentación detallada y los notebooks interactivos en el directorio `docs`:

- [**Ver Documentación de Notebooks**](./docs/README.md)