import proj4 from 'proj4';

// Define the projection for UTM Zone 19S (EPSG:32719)
// This is what the Python code uses.
export const UTM_ZONE_19S = '+proj=utm +zone=19 +south +datum=WGS84 +units=m +no_defs';
export const WGS84 = 'EPSG:4326';

export interface HolData {
    x: number;
    y: number;
    z: number;
    z_hole: number;
    drillhole_id: number;
    mesh: string;
}

export const parseHolFile = (content: string): any => {
    const lines = content.split('\n');
    const features = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        // Split by whitespace and filter out empty strings
        const parts = trimmed.split(/\s+/);

        // Expected format based on Python readHolFile:
        // x y z z_hole unkown0 unkown1 unkown2 unkown3 drillhole_id mesh
        // 0 1 2 3      4       5       6       7       8            9

        if (parts.length < 10) {
            console.warn('Skipping invalid line in .hol file:', line);
            continue;
        }

        try {
            const x = parseFloat(parts[0]);
            const y = parseFloat(parts[1]);
            const z = parseFloat(parts[2]);
            const z_hole = parseFloat(parts[3]);
            // parts[4] to parts[7] are unknown/unused
            const drillhole_id = parseInt(parts[8], 10);
            const mesh = parts[9];

            // Convert UTM to LatLon
            const [lon, lat] = proj4(UTM_ZONE_19S, WGS84, [x, y]);

            features.push({
                type: 'Feature',
                geometry: {
                    type: 'Point',
                    coordinates: [lon, lat] // GeoJSON is [lon, lat]
                },
                properties: {
                    x, // Keep original UTM coordinates in properties
                    y,
                    z,
                    z_hole,
                    drillhole_id,
                    mesh,
                    source: 'hol_import'
                }
            });
        } catch (e) {
            console.error('Error parsing line:', line, e);
        }
    }

    return {
        type: 'FeatureCollection',
        features: features
    };
};
