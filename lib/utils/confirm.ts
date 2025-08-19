export function confirmAction(message: string): boolean {
  return typeof window !== 'undefined' && window.confirm(message);
}
