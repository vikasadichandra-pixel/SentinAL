// Generates an array of evenly distributed latitude/longitude points on a sphere
export function fibonacciSphereLatLng(samples) {
    const points = [];
    const phi = Math.PI * (3 - Math.sqrt(5)); // Golden angle

    for (let i = 0; i < samples; i++) {
        const y = 1 - (i / (samples - 1)) * 2; // y goes from 1 to -1
        const radius = Math.sqrt(1 - y * y); // radius at y

        const theta = phi * i; // golden angle increment

        const x = Math.cos(theta) * radius;
        const z = Math.sin(theta) * radius;

        // Convert cartesian (x,y,z) back to Lat/Lng
        const lat = Math.asin(y) * (180 / Math.PI);
        const lng = Math.atan2(z, x) * (180 / Math.PI);

        points.push({ lat, lng });
    }

    return points;
}

// Ray-casting algorithm to check if a specific [lng, lat] falls inside a GeoJSON polygon
function pointInPolygon(point, vs) {
    let x = point[0], y = point[1];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
        let xi = vs[i][0], yi = vs[i][1];
        let xj = vs[j][0], yj = vs[j][1];
        let intersect =
            yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
}

// Iterates over your globe.json features to determine if a dot should be kept (it's on land)
export function isOnLand(lng, lat, features) {
    const pt = [lng, lat];
    for (let i = 0; i < features.length; i++) {
        const geom = features[i].geometry;
        if (geom.type === "Polygon") {
            if (pointInPolygon(pt, geom.coordinates[0])) return true;
        } else if (geom.type === "MultiPolygon") {
            for (let j = 0; j < geom.coordinates.length; j++) {
                if (pointInPolygon(pt, geom.coordinates[j][0])) return true;
            }
        }
    }
    return false;
}

// Converts Lat/Lng into 3D space (x, y, z).
// Note: Math perfectly aligned with ThreeGlobe's internal orientation
export function polar2Cartesian(lat, lng, radius) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (90 - lng) * (Math.PI / 180);

    return {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
    };
}