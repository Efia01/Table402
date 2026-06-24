/**
 * Money is represented everywhere as an integer number of **atomic units**.
 * 1 simUSD = 1,000,000 atomic units (6 decimals — mirrors typical stablecoin
 * precision such as Tempo pathUSD). All amounts in the project stay well under
 * Number.MAX_SAFE_INTEGER, so we use `number` (never floats with fractional
 * units) for simple JSON/DB interop. There is never fractional-unit arithmetic.
 */

export const ATOMIC_DECIMALS = 6;
export const ATOMIC_PER_USD = 1_000_000;

/** Parse a human USD string/number (e.g. "$0.0002", "1.5", 0.01) into atomic units. */
export function parseUsd(input: string | number): number {
  const raw = String(input).trim().replace(/^\$/, '').replace(/,/g, '');
  if (raw === '' || raw === '.' || !/^-?\d*(\.\d+)?$/.test(raw)) {
    throw new Error(`Invalid USD amount: ${JSON.stringify(input)}`);
  }
  const neg = raw.startsWith('-');
  const [whole, frac = ''] = raw.replace(/^-/, '').split('.');
  const fracPadded = (frac + '0'.repeat(ATOMIC_DECIMALS)).slice(0, ATOMIC_DECIMALS);
  const units = Number(whole || '0') * ATOMIC_PER_USD + Number(fracPadded || '0');
  return neg ? -units : units;
}

/** Format atomic units as a plain decimal string (no symbol), trimming trailing zeros. */
export function formatUnits(units: number, maxDecimals = ATOMIC_DECIMALS, minDecimals = 2): string {
  const neg = units < 0;
  const abs = Math.abs(Math.trunc(units));
  const whole = Math.floor(abs / ATOMIC_PER_USD);
  const frac = abs % ATOMIC_PER_USD;
  let fracStr = frac.toString().padStart(ATOMIC_DECIMALS, '0').slice(0, maxDecimals);
  fracStr = fracStr.replace(/0+$/, '');
  while (fracStr.length < minDecimals) fracStr += '0';
  const wholeStr = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${neg ? '-' : ''}${wholeStr}${fracStr ? '.' + fracStr : ''}`;
}

/** Format atomic units as a `€`-prefixed amount, e.g. 200 -> "€0.0002". */
export function formatUsd(units: number, opts?: { maxDecimals?: number; minDecimals?: number }): string {
  return `€${formatUnits(units, opts?.maxDecimals ?? ATOMIC_DECIMALS, opts?.minDecimals ?? 2)}`;
}

/** Atomic units -> MPP wire amount (a string of atomic units, per the spec). */
export function amountToWire(units: number): string {
  return Math.trunc(units).toString();
}

/** MPP wire amount string -> atomic units. */
export function amountFromWire(wire: string): number {
  const n = Number(wire);
  if (!Number.isInteger(n)) throw new Error(`Invalid wire amount: ${wire}`);
  return n;
}
