/**
 * Financial Calculation Utilities
 */
export const DENOMINATIONS = [200, 100, 50, 20, 10, 5];

/**
 * Calculates total cash based on denominations object
 * @param {Object} denominations { "200": 5, "100": 10, ... }
 * @returns {number}
 */
export function calculateDenominationsTotal(denominations) {
  if (!denominations) return 0;

  return Object.entries(denominations).reduce(
    (sum, [denom, count]) => sum + Number(denom) * (Number(count) || 0),
    0,
  );
}

/**
 * Calculates the discrepancy between counted cash and expected cash
 * @param {number} counted
 * @param {number} expected
 * @returns {number}
 */
export function calculateDiscrepancy(counted, expected) {
  return Number(counted || 0) - Number(expected || 0);
}

/**
 * Validates if a discrepancy requires a note
 * @param {number} discrepancy
 * @returns {boolean}
 */
export function isDiscrepancySignificant(discrepancy) {
  return Math.abs(discrepancy) > 0.01;
}
