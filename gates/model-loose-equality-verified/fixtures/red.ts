const measuredDiameter: number | null = null;

if (measuredDiameter == null) {
  throw new Error('Missing measurement');
}

const isNominal = measuredDiameter != 10;
