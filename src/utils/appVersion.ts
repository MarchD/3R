export function isAlphaVersion(search: string = window.location.search): boolean {
  return new URLSearchParams(search).get('version') === 'alpha';
}
