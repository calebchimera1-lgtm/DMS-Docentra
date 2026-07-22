/** Formats a running count into a prefixed, zero-padded document number (e.g. "Q-000042"). */
export function formatDocumentNumber(prefix: string, count: number): string {
  return `${prefix}-${String(count + 1).padStart(6, "0")}`;
}
