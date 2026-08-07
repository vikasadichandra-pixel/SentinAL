import React from "react";
import { Html } from "@react-three/drei";
import { polar2Cartesian } from "../../utils/geoDots";

// Map backend country codes to rough Latitude/Longitude coordinates
const COUNTRY_COORDS = {
    US: { lat: 38.0, lng: -97.0 },
    RU: { lat: 61.5, lng: 105.3 },
    JP: { lat: 36.2, lng: 138.2 },
    CN: { lat: 35.8, lng: 104.1 },
    IN: { lat: 20.5, lng: 78.9 },
    UNKNOWN: { lat: 0, lng: 0 },
};

// Map backend breach types to specific hex colors
const getThreatColor = (breachType) => {
    switch (breachType) {
        case "PRE_RELEASE":
            return "#a855f7"; // Purple
        case "TERRITORY":
            return "#f97316"; // Orange
        case "PIRACY":
        default:
            return "#ef4444"; // Red
    }
};

export default function ThreatMarkers({ violations, globeRadius = 100 }) {
    if (!violations || violations.length === 0) return null;

    return (
        <>
            {violations.map((violation) => {
                // 1. Get Lat/Lng
                const coords = COUNTRY_COORDS[violation.location] || COUNTRY_COORDS.UNKNOWN;

                // 2. Convert to 3D Space
                const pos = polar2Cartesian(coords.lat, coords.lng, globeRadius);

                // 3. Get Color mapping
                const color = getThreatColor(violation.breach_type);

                return (
                    <Html key={violation.id} position={[pos.x, pos.y, pos.z]} center>
                        <div className="pulse-container">
                            {/* The glowing center dot */}
                            <div
                                className="pulse-dot"
                                style={{
                                    backgroundColor: color,
                                    boxShadow: `0 0 10px ${color}`,
                                }}
                            />
                            {/* The expanding ripple ring */}
                            <div className="pulse-ring" style={{ borderColor: color }} />
                        </div>
                    </Html>
                );
            })}
        </>
    );
}