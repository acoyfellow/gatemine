const measuredDiameter: number | null = 10;
const nominalDiameter = 10;

const isNominal = measuredDiameter === nominalDiameter;
const needsCorrection = measuredDiameter !== null;

// Text containing == or != is not an equality expression.
const calibrationNote = 'Use === and !== for comparisons';
