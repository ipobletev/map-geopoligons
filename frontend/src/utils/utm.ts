import proj4 from 'proj4';

export interface UTMCoords {
    easting: number;
    northing: number;
    zone_number: number;
    zone_letter: string;
}

export const toUtm = (lat: number, lon: number): UTMCoords | null => {
    try {
        const zone = Math.floor((lon + 180) / 6) + 1;
        const hemisphere = lat >= 0 ? 'north' : 'south';

        // Define UTM projection for the calculated zone
        const utmProjection = `+proj=utm +zone=${zone} +${hemisphere} +ellps=WGS84 +datum=WGS84 +units=m +no_defs`;
        const wgs84 = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs";

        const [easting, northing] = proj4(wgs84, utmProjection, [lon, lat]);

        return {
            easting,
            northing,
            zone_number: zone,
            zone_letter: getZoneLetter(lat)
        };
    } catch (e) {
        console.error("Error converting to UTM", e);
        return null;
    }
};

function getZoneLetter(lat: number): string {
    // Approximate zone letter calculation
    const letters = "CDEFGHJKLMNPQRSTUVWXX";
    const index = Math.floor(lat / 8) + 10;
    if (index >= 0 && index < letters.length) {
        return letters[index];
    }
    return "Z"; // Fallback
}
