/** Formats a number for the given locale. */
export function formatNumber(n: number, locale: string, opts?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(locale, opts).format(n);
}
