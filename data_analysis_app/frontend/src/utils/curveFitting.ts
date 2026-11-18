/**
 * Curve fitting utilities for trend lines.
 *
 * Both fitters below use the same strategy: grid-search the one parameter the
 * model is nonlinear in, and solve for the remaining parameter(s) via closed-form
 * least squares at each grid point (the model is linear in those, for any fixed
 * value of the nonlinear one). This guarantees the global optimum over the grid -
 * no local minima, no hand-tuned learning rate/iteration count, and critically, no
 * floor/regularization bias pulling the result away from what the data actually
 * supports. Same idea as the backend's `calibrate_effort_curve` (grid-search the
 * curve exponent, closed-form OLS for the linear part).
 */

function logSpace(min: number, max: number, count: number): number[] {
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  const step = (logMax - logMin) / (count - 1);
  const values = [];
  for (let i = 0; i < count; i++) {
    values.push(Math.exp(logMin + i * step));
  }
  return values;
}

/**
 * Fit an exponential saturation curve (diminishing returns)
 * Model: y = C * (1 - e^(-k*x)), k > 0
 * Passes through origin (0,0) and approaches asymptote C
 */
export function fitExponentialSaturation(data: Array<{ x: number; y: number }>) {
  if (data.length < 2) {
    return null;
  }

  // Filter out invalid points
  const validData = data.filter(d =>
    isFinite(d.x) && isFinite(d.y) && d.x >= 0 && d.y >= 0
  );

  if (validData.length < 2) {
    return null;
  }

  const xValues = validData.map(d => d.x);
  const yValues = validData.map(d => d.y);
  const xMax = Math.max(...xValues);

  if (xMax <= 0) {
    return null;
  }

  // For a fixed k, y = C * basis(x) is linear in C - solve it exactly via OLS
  // rather than tracking it through gradient descent.
  const solveForC = (k: number) => {
    let sumBasisSq = 0;
    let sumBasisY = 0;
    for (const point of validData) {
      const basis = 1 - Math.exp(-k * point.x);
      sumBasisSq += basis * basis;
      sumBasisY += basis * point.y;
    }
    if (sumBasisSq < 1e-12) {
      return null;
    }
    const C = sumBasisY / sumBasisSq;
    let sse = 0;
    for (const point of validData) {
      const basis = 1 - Math.exp(-k * point.x);
      const residual = C * basis - point.y;
      sse += residual * residual;
    }
    return { C, sse };
  };

  // Wide grid: from a very gentle near-linear approach to a very steep one that
  // saturates almost immediately, relative to the data's own x-range.
  const searchGrid = (kMin: number, kMax: number, count: number) => {
    let best: { k: number; C: number; sse: number } | null = null;
    for (const k of logSpace(kMin, kMax, count)) {
      const result = solveForC(k);
      if (result && isFinite(result.sse) && (!best || result.sse < best.sse)) {
        best = { k, C: result.C, sse: result.sse };
      }
    }
    return best;
  };

  const coarse = searchGrid(0.001 / xMax, 100 / xMax, 400);
  if (!coarse) {
    return null;
  }

  // Finer grid centered on the coarse optimum for extra precision.
  const fine = searchGrid(coarse.k / 5, coarse.k * 5, 300);
  const best = fine && fine.sse < coarse.sse ? fine : coarse;

  const { C, k } = best;

  // Calculate R²
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / yValues.length;
  let ssTotal = 0;
  for (const point of validData) {
    ssTotal += Math.pow(point.y - yMean, 2);
  }
  const rSquared = ssTotal > 0 ? Math.max(0, 1 - best.sse / ssTotal) : 0;

  // Generate curve points
  const numPoints = 100;
  const step = xMax / numPoints;
  const curvePoints = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = i * step;
    const y = C * (1 - Math.exp(-k * x));
    curvePoints.push({ x, y });
  }

  return {
    parameters: { C, k },
    rSquared,
    curvePoints,
    equation: `y = ${C.toFixed(2)} * (1 - e^(-${k.toFixed(4)}*x))`,
  };
}

/**
 * Fit an exponential decay curve to data points
 * Model: y = a * e^(-b*x) + c
 * Decreases steeply at first, then levels off - good for inverse relationships
 */
export function fitExponentialDecay(data: Array<{ x: number; y: number }>) {
  if (data.length < 3) {
    return null;
  }

  // Filter out invalid points
  const validData = data.filter(d =>
    isFinite(d.x) && isFinite(d.y) && d.x >= 0 && d.y >= 0
  );

  if (validData.length < 3) {
    return null;
  }

  const xValues = validData.map(d => d.x);
  const yValues = validData.map(d => d.y);

  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);
  const xRange = xMax - xMin;

  if (xRange <= 0) {
    return null;
  }

  const n = validData.length;

  // For a fixed b, y = a*e^(-b*x) + c is linear in (a, c) - solve the 2x2 normal
  // equations exactly rather than tracking both through gradient descent.
  const solveForAC = (b: number) => {
    let sumBasisSq = 0;
    let sumBasis = 0;
    let sumBasisY = 0;
    let sumY = 0;
    for (const point of validData) {
      const basis = Math.exp(-b * point.x);
      sumBasisSq += basis * basis;
      sumBasis += basis;
      sumBasisY += basis * point.y;
      sumY += point.y;
    }
    const determinant = sumBasisSq * n - sumBasis * sumBasis;
    if (Math.abs(determinant) < 1e-12) {
      return null;
    }
    const a = (sumBasisY * n - sumBasis * sumY) / determinant;
    const c = (sumBasisSq * sumY - sumBasis * sumBasisY) / determinant;
    let sse = 0;
    for (const point of validData) {
      const residual = a * Math.exp(-b * point.x) + c - point.y;
      sse += residual * residual;
    }
    return { a, c, sse };
  };

  const searchGrid = (bMin: number, bMax: number, count: number) => {
    let best: { b: number; a: number; c: number; sse: number } | null = null;
    for (const b of logSpace(bMin, bMax, count)) {
      const result = solveForAC(b);
      if (result && isFinite(result.sse) && (!best || result.sse < best.sse)) {
        best = { b, a: result.a, c: result.c, sse: result.sse };
      }
    }
    return best;
  };

  const coarse = searchGrid(0.001 / xRange, 100 / xRange, 400);
  if (!coarse) {
    return null;
  }

  const fine = searchGrid(coarse.b / 5, coarse.b * 5, 300);
  const best = fine && fine.sse < coarse.sse ? fine : coarse;

  const { a, b, c } = best;

  // Calculate R²
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / yValues.length;
  let ssTotal = 0;
  for (const point of validData) {
    ssTotal += Math.pow(point.y - yMean, 2);
  }
  const rSquared = ssTotal > 0 ? Math.max(0, 1 - best.sse / ssTotal) : 0;

  // Generate curve points
  const numPoints = 100;
  const step = xRange / numPoints;
  const curvePoints = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = xMin + i * step;
    const y = a * Math.exp(-b * x) + c;
    curvePoints.push({ x, y });
  }

  return {
    parameters: { a, b, c },
    rSquared,
    curvePoints,
    equation: `y = ${a.toFixed(2)} * e^(-${b.toFixed(4)}*x) + ${c.toFixed(2)}`,
  };
}

/**
 * Fit a Lorentz (Cauchy-Lorentzian) curve to data points
 * Model: y = A / (1 + ((x - x0) / γ)²)
 * Bell-shaped curve with peak at x0 - good for speed vs slope relationships
 * Based on research showing Lorentz curves fit hiking speed-slope data well
 */
export function fitLorentzCurve(
  data: Array<{ x: number; y: number }>,
  options?: {
    x0Range?: [number, number];
    gammaRange?: [number, number];
  }
) {
  if (data.length < 10) {
    return null;
  }

  // Filter out invalid points (allow negative x for slope data)
  const validData = data.filter(d =>
    isFinite(d.x) && isFinite(d.y) && d.y >= 0
  );

  if (validData.length < 10) {
    return null;
  }

  const xValues = validData.map(d => d.x);
  const yValues = validData.map(d => d.y);
  const xMin = Math.min(...xValues);
  const xMax = Math.max(...xValues);

  // Default parameter ranges (suitable for slope in degrees)
  const x0Range = options?.x0Range || [-15, 10];
  const gammaRange = options?.gammaRange || [3, 40];

  // For fixed (x0, gamma), y = A * basis(x) is linear in A - solve via OLS
  const solveForA = (x0: number, gamma: number) => {
    let sumBasisSq = 0;
    let sumBasisY = 0;
    for (const point of validData) {
      const basis = 1 / (1 + Math.pow((point.x - x0) / gamma, 2));
      sumBasisSq += basis * basis;
      sumBasisY += basis * point.y;
    }
    if (sumBasisSq < 1e-12) {
      return null;
    }
    const A = sumBasisY / sumBasisSq;
    if (A <= 0) {
      return null; // A must be positive
    }
    let sse = 0;
    for (const point of validData) {
      const basis = 1 / (1 + Math.pow((point.x - x0) / gamma, 2));
      const residual = A * basis - point.y;
      sse += residual * residual;
    }
    return { A, sse };
  };

  // 2D grid search over (x0, gamma)
  const searchGrid = (
    x0Min: number,
    x0Max: number,
    x0Count: number,
    gammaMin: number,
    gammaMax: number,
    gammaCount: number
  ) => {
    let best: { x0: number; gamma: number; A: number; sse: number } | null = null;

    // Linear spacing for x0 (can be negative)
    const x0Step = (x0Max - x0Min) / (x0Count - 1);
    for (let i = 0; i < x0Count; i++) {
      const x0 = x0Min + i * x0Step;

      // Log spacing for gamma (must be positive)
      for (const gamma of logSpace(gammaMin, gammaMax, gammaCount)) {
        const result = solveForA(x0, gamma);
        if (result && isFinite(result.sse) && (!best || result.sse < best.sse)) {
          best = { x0, gamma, A: result.A, sse: result.sse };
        }
      }
    }
    return best;
  };

  // Coarse grid search
  const coarse = searchGrid(
    x0Range[0], x0Range[1], 25,
    gammaRange[0], gammaRange[1], 25
  );

  if (!coarse) {
    return null;
  }

  // Fine grid around best point
  const x0Margin = (x0Range[1] - x0Range[0]) / 25;
  const gammaRatio = Math.pow(gammaRange[1] / gammaRange[0], 1 / 25);

  const fine = searchGrid(
    coarse.x0 - x0Margin, coarse.x0 + x0Margin, 15,
    coarse.gamma / gammaRatio, coarse.gamma * gammaRatio, 15
  );

  const best = fine && fine.sse < coarse.sse ? fine : coarse;
  const { A, x0, gamma } = best;

  // Calculate R²
  const yMean = yValues.reduce((sum, y) => sum + y, 0) / yValues.length;
  let ssTotal = 0;
  for (const point of validData) {
    ssTotal += Math.pow(point.y - yMean, 2);
  }
  const rSquared = ssTotal > 0 ? Math.max(0, 1 - best.sse / ssTotal) : 0;

  // Generate curve points spanning the data range
  const numPoints = 100;
  const xRange = xMax - xMin;
  const step = xRange / numPoints;
  const curvePoints = [];
  for (let i = 0; i <= numPoints; i++) {
    const x = xMin + i * step;
    const y = A / (1 + Math.pow((x - x0) / gamma, 2));
    curvePoints.push({ x, y });
  }

  return {
    parameters: { A, x0, gamma },
    rSquared,
    curvePoints,
    equation: `y = ${A.toFixed(2)} / (1 + ((x - ${x0.toFixed(1)}) / ${gamma.toFixed(1)})²)`,
  };
}
