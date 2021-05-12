export function timestampToDate(timestamp: string): string {
  const date = new Date(parseInt(timestamp));
  return date.toLocaleDateString();
}
