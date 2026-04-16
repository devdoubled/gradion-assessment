/**
 * Format a monetary amount using the browser's Intl API.
 * Automatically handles zero-decimal currencies (VND, JPY, etc.).
 */
export function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amount);
  } catch {
    // fallback for unrecognised currency codes
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/**
 * Format a date string as dd/mm/yyyy.
 */
export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-GB'); // → 16/04/2026
}

/**
 * Given an array of expense items, return a map of currency → total amount.
 * Sorted by currency code so the display order is stable.
 */
export function groupByCurrency(
  items: { amount: number; currency: string }[],
): { currency: string; total: number }[] {
  const map: Record<string, number> = {};
  for (const item of items) {
    map[item.currency] = (map[item.currency] ?? 0) + item.amount;
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([currency, total]) => ({ currency, total }));
}
