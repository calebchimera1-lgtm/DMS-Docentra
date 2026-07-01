export function formatBytes(bytes: number | string): string {
  const n = typeof bytes === 'string' ? Number(bytes) : bytes;
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  return `${(n / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleString();
}
