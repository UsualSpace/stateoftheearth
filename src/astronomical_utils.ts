export function getJulianDate(): number {
    return Date.now() / 86400000 + 2440587.5;
}

export function getEarthRotationAngle(t_u: number): number {
    const o = 2451545.0;
    const lhs = 0.7790572732640;
    const rhs = 1.00273781191135448;
    const theta = 2 * Math.PI * (lhs + rhs * (t_u - o));
    return theta;
}

