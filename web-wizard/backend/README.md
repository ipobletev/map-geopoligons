# Web Wizard Backend

Este es el backend para la aplicación Web Wizard, construido con FastAPI. Proporciona servicios para la generación de rutas y procesamiento de datos geoespaciales para operaciones mineras.

## Descripción

El backend se encarga de recibir archivos de entrada (pozos, geocercas, calles, etc.), procesarlos utilizando algoritmos de geometría computacional y grafos, y generar un plan de ruta optimizado junto con visualizaciones y archivos de configuración.

## Estructura del Proyecto

- `main.py`: Punto de entrada de la aplicación. Define la API REST y maneja las peticiones.
- `route_gen_logic.py`: Contiene la lógica central para la generación de rutas.
- `utils.py`: Funciones de utilidad para lectura de archivos (ej. `.hol`), transformaciones de coordenadas y operaciones geométricas.
- `fit_streets.py`: Módulo para el ajuste y procesamiento de calles.
- `generated/`: Directorio donde se almacenan temporalmente los archivos generados para su descarga.

## Requisitos

El proyecto utiliza Python y requiere las siguientes librerías principales:

- FastAPI
- Uvicorn
- GeoPandas
- Shapely
- NetworkX
- Matplotlib
- Pandas

Para ver la lista completa de dependencias, consulta `requirements.txt`.

## Instalación

1.  Asegúrate de tener Python instalado (se recomienda Python 3.8+).
2.  Crea y activa un entorno virtual:

```bash
python -m venv .venv
source .venv/Scripts/activate
```

3.  Instala las dependencias:

```bash
pip install -r requirements.txt
```

## Ejecución

Para iniciar el servidor de desarrollo:

```bash
python main.py
```

O usando uvicorn directamente:

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

El servidor se iniciará en `http://0.0.0.0:8000`.

## API Endpoints

### `POST /api/generate-routes`

Inicia el proceso de generación de rutas.

**Parámetros (Form Data):**

- `holes` (File): Archivo `.hol` con la ubicación de los pozos.
- `geofence` (File): Archivo GeoJSON con la geocerca.
- `streets` (File): Archivo GeoJSON con las calles.
- `home_pose` (File): Archivo GeoJSON con la posición de inicio.
- `obstacles` (File, opcional): Archivo GeoJSON con obstáculos.
- `high_obstacles` (File, opcional): Archivo GeoJSON con obstáculos altos.
- `transit_streets` (File, opcional): Archivo GeoJSON con calles de tránsito.
- `fit_streets` (bool): Habilitar ajuste de calles.
- `fit_twice` (bool): Ajustar calles dos veces.
- `wgs84` (bool): Si los datos están en WGS84.
- `use_obstacles` (bool): Usar obstáculos en la generación.
- `use_high_obstacles` (bool): Usar obstáculos altos.
- `use_transit_streets` (bool): Usar calles de tránsito.

**Respuesta:**

Retorna un stream de eventos (NDJSON) que reporta el progreso del cálculo y finalmente el resultado con enlaces a los archivos generados.

## Notas Adicionales

- Los archivos generados se sirven estáticamente desde el directorio `/generated`.
- El backend maneja conversiones de coordenadas (UTM a Lat/Lon) automáticamente según sea necesario.
