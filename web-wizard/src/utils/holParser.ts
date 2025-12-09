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

export const generateHolString = (features: any[]): string => {
    return features.map((feature, index) => {
        const props = feature.properties || {};

        // Get coordinates
        let x = props.x;
        let y = props.y;

        // If not directly in properties, try to get from utm_coordinates
        if ((x === undefined || y === undefined) && props.utm_coordinates) {
            x = props.utm_coordinates.x;
            y = props.utm_coordinates.y;
        }

        // If still undefined, we might need to convert from geometry (if we want to be robust)
        // But Wizard.tsx ensures enrichment before save, so utm_coordinates should be there.
        // Fallback to 0 if something is really wrong
        if (x === undefined) x = 0;
        if (y === undefined) y = 0;

        // Get other properties with defaults based on reference file
        const z = props.z !== undefined ? props.z : 0; // Default Z
        const z_hole = props.z_hole !== undefined ? props.z_hole : 10;

        // Unknowns (fixed values from reference)
        const unk1 = 270;
        const unk2 = 0.0;
        const unk3 = 0;
        const unk4 = -90;

        // Use existing drillhole_id if available, otherwise use index + 1
        const drillhole_id = props.drillhole_id !== undefined ? props.drillhole_id : (index + 1);
        const mesh = props.mesh || 'peld';

        // Format: x y z z_hole unk1 unk2 unk3 unk4 drillhole_id mesh
        // Use tab or space separation? Reference looks like spaces/tabs.
        // We'll use multiple spaces to align somewhat, or just single space.
        // Reference: 343348.51005739527    6334425.48609453       11.80   10   270   0.0   0  -90    19    peld
        // It seems to use variable spacing. We'll use standard space separation.

        return `${x} ${y} ${z} ${z_hole} ${unk1} ${unk2} ${unk3} ${unk4} ${drillhole_id} ${mesh}`;
    }).join('\n');
};
