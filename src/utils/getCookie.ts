export function getCookie(name: string, cookieString?: string): string | undefined {
  const source = cookieString ||
    (typeof document !== 'undefined' ? document.cookie : '');
  const match = source.match(new RegExp('(^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[2]) : undefined;
}
