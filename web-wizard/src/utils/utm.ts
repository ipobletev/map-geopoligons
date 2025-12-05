import proj4 from 'proj4';

export const toUTM = (lat: number, lon: number) => {
    const zone = Math.floor((lon + 180) / 6) + 1;
    const hemisphere = lat >= 0 ? 'N' : 'S';

    // Define UTM projection for the calculated zone
    // EPSG:326xx for North, EPSG:327xx for South
    // But proj4 string is easier
    const utmProj = `+proj=utm +zone=${zone} +${lat >= 0 ? 'north' : 'south'} +datum=WGS84 +units=m +no_defs`;
    const wgs84Proj = 'EPSG:4326';

    const [x, y] = proj4(wgs84Proj, utmProj, [lon, lat]);

    return {
        x,
        y,
        zone,
        hemisphere
    };
};

export const enrichGeoJSONWithUTM = (geojson: any) => {
    if (!geojson || !geojson.features) return geojson;

    const newFeatures = geojson.features.map((feature: any) => {
        const geometry = feature.geometry;
        if (!geometry) return feature;

        const coords = geometry.coordinates;
        const type = geometry.type;
        let utmCoords: any = null;

        if (type === 'Point') {
            const [lon, lat] = coords;
            utmCoords = toUTM(lat, lon);
        } else if (type === 'LineString') {
            utmCoords = coords.map((pt: number[]) => {
                const [lon, lat] = pt;
                return toUTM(lat, lon);
            });
        } else if (type === 'Polygon') {
            utmCoords = coords.map((ring: number[][]) => {
                return ring.map((pt: number[]) => {
                    const [lon, lat] = pt;
                    return toUTM(lat, lon);
                });
            });
        }

        return {
            ...feature,
            properties: {
                ...feature.properties,
                utm_coordinates: utmCoords
            }
        };
    });

    return {
        ...geojson,
        features: newFeatures
    };
};
