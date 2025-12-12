
export interface RouteGenerationOptions {
    fit_streets: boolean;
    fit_twice: boolean;
    wgs84: boolean;
    use_obstacles: boolean;
    use_high_obstacles: boolean;
    use_transit_streets: boolean;
}

export type GenerateRoutesCallback = (message: any) => void;

/**
 * Sends a request to generate routes.
 * @param filesMap A map of file keys (e.g., 'holes', 'geofence') to File objects.
 * @param geoJsonMap A map of file keys to GeoJSON objects (for Wizard usage).
 * @param options Generation options.
 * @param onMessage Callback for progress/result/error messages.
 */
export async function generateRoutes(
    filesMap: Record<string, File | null>,
    geoJsonMap: Record<string, any> | null,
    options: RouteGenerationOptions,
    onMessage: GenerateRoutesCallback
) {
    const formData = new FormData();


    // Mapping based on backend expectations
    // RouteGenerator uses: holes, geofence, streets, home_pose, obstacles, high_obstacles, transit_streets
    // Wizard uses keys like: objective, geofence, road, home, obstacles, tall_obstacle, transit_road
    // We need to handle both or standardize logic.
    // Let's assume the caller passes the CORRECT KEYS expected by this function logic, OR we make this function generic.
    // The backend expects specific field names: 'holes', 'geofence', 'streets', 'home_pose', etc.

    // Strategy: The caller is responsible for mapping their data to these standard keys.
    // If filesMap has 'holes', use it. If geoJsonMap has 'holes', use it.

    const fields = [
        { key: 'holes', filename: 'holes.geojson' },
        { key: 'geofence', filename: 'geofence.geojson' },
        { key: 'streets', filename: 'streets.geojson' },
        { key: 'home_pose', filename: 'home_pose.geojson' },
        { key: 'obstacles', filename: 'obstacles.geojson' },
        { key: 'high_obstacles', filename: 'high_obstacles.geojson' },
        { key: 'transit_streets', filename: 'transit_streets.geojson' },
    ];

    fields.forEach(field => {
        if (filesMap[field.key]) {
            formData.append(field.key, filesMap[field.key]!);
        } else if (geoJsonMap && geoJsonMap[field.key]) {
            const blob = new Blob([JSON.stringify(geoJsonMap[field.key])], { type: 'application/json' });
            formData.append(field.key, blob, field.filename);
        }
    });

    // Append Options
    formData.append('fit_streets', options.fit_streets.toString());
    formData.append('fit_twice', options.fit_twice.toString());
    formData.append('wgs84', options.wgs84.toString());
    formData.append('use_obstacles', options.use_obstacles.toString());
    formData.append('use_high_obstacles', options.use_high_obstacles.toString());
    formData.append('use_transit_streets', options.use_transit_streets.toString());

    try {
        const response = await fetch('/api/generate-routes', {
            method: 'POST',
            body: formData,
        });

        if (!response.body) {
            throw new Error('No response body');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const message = JSON.parse(line);
                    onMessage(message);
                } catch (e) {
                    console.error('Error parsing JSON:', e);
                }
            }
        }
    } catch (err: any) {
        console.error(err);
        onMessage({ type: 'error', message: err.message || 'Connection error' });
    }
}
