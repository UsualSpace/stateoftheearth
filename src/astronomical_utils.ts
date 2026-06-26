export function getJulianDate(): number {
    return Date.now() / 86400000 + 2440587.5;
}

export function getEarthRotationAngle(t_u: number): number {
    const o = 2451545.0;
    const lhs = 0.7790572732640;
    const rhs = 1.00273781191135448;
    const theta = 2 * Math.PI * (lhs + rhs * (t_u - o));
    return ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}

export function getOrbitAngle(jd: number): number {
    const d = jd - 2451545.0;
    const L = (280.460 + 0.9856474 * d) % 360;
    return L;
}

export function getGMST(jd: number): number {
  const T = (jd - 2451545.0) / 36525.0;

  let gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    (T * T * T) / 38710000;

  gmst = ((gmst % 360) + 360) % 360;

  return gmst;
}
