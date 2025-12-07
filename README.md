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
