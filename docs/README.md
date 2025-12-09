# Documentación de Notebooks

Este directorio contiene Jupyter Notebooks diseñados para explicar, probar y visualizar los algoritmos de generación de rutas y optimización de trayectorias.

## Configuración del Entorno

Para ejecutar estos notebooks de manera aislada y correcta, se recomienda utilizar un entorno virtual de Python. Sigue estos pasos:

1.  **Crear el entorno virtual:**
    Navega a la raíz de este directorio (/docs) de notebooks y ejecuta:
    ```bash
    python -m venv .venv
    ```

2.  **Activar el entorno virtual:**
    *   **Windows:**
        ```bash
        #CMD
        .venv\Scripts\activate
        #Gitbash
        source .venv/Scripts/activate
        ```
    *   **macOS/Linux:**
        ```bash
        source .venv/bin/activate
        ```

3.  **Instalar dependencias:**
    Instala las dependencias del proyecto y Jupyter Lab. Asegúrate de que el archivo `requirements.txt` del backend esté accesible (ajusta la ruta si es necesario).
    ```bash
    pip install -r requirements.txt
    ```

## Ejecución

Una vez configurado el entorno, puedes iniciar Jupyter Lab para explorar los notebooks:

```bash
jupyter-lab
```

Esto abrirá la interfaz de Jupyter Lab en tu navegador, donde podrás seleccionar y ejecutar cualquiera de los notebooks listados anteriormente.

## Notebooks Disponibles

### 1. Optimización de Trayectorias (Street Fitting)
**Archivo:** [`1_path_optimizer_street_fitting.ipynb`](./1_path_optimizer_street_fitting.ipynb)

Este notebook es una herramienta interactiva para visualizar y ajustar el algoritmo de "Street Fitting" (Ajuste de Calles). Utiliza PyTorch para optimizar la trayectoria de una calle, asegurando que cumpla con restricciones de seguridad y suavidad.

**Características Principales:**
- **Simulación Interactiva:** Utiliza widgets para modificar en tiempo real la posición de obstáculos (agujeros), dimensiones del vehículo y parámetros de optimización.
- **Visualización en Tiempo Real:** Muestra la ruta original, la ruta optimizada, los obstáculos y la evolución del proceso de optimización.
- **Ajuste de Parámetros:** Permite experimentar con pesos de repulsión, fidelidad, márgenes de seguridad y número de iteraciones.

**Uso:**
1. Ejecuta todas las celdas para cargar las librerías y clases.
2. Ve a la sección "Simulación Interactiva".
3. Ajusta los valores en los campos de texto y sliders.
4. Haz clic en el botón **"Optimize Route"** para ver el resultado.

### 2. Explicación del Algoritmo Backend
**Archivo:** [`2_algorithm_explanation.ipynb`](./2_algorithm_explanation.ipynb)

Este documento detalla la lógica completa del backend para la generación de rutas. Explica paso a paso cómo se procesan los datos desde la entrada hasta la generación del plan global.

**Contenido:**
- **Flujo de Ejecución:** Validación de entradas, ajuste de calles, filtrado de pozos, creación del grafo y ensamblaje de resultados.
- **Lógica de Negocio:** Desglose de la función `generate_routes_logic` y sus componentes.
- **Estructura de Datos:** Explicación de los DataFrames utilizados y generados.

### 3. Interacción con el Backend
**Archivo:** [`3_backend_interaction.ipynb`](./3_backend_interaction.ipynb)

Este notebook demuestra cómo interactuar programáticamente con el backend, simulando la acción de "Generar Ruta" de la interfaz gráfica pero desde código Python.

**Funcionalidades:**
- **Carga de Datos:** Ejemplo de cómo cargar archivos GeoJSON y `.hol` desde un directorio.
- **Generación de Rutas:** Llamada directa a la lógica de generación de rutas del backend.
- **Visualización de Resultados:** Generación de gráficos con `matplotlib` para inspeccionar el plan global, incluyendo la orientación de los diferentes tipos de puntos (pozos, calles, home).
- **Exportación:** Guarda el resultado en un archivo `global_plan.csv`.

