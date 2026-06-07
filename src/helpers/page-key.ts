export function pathnameToPageKey(pathname: string): string {
  const normalized = pathname.replace(/\/$/, "") || "/";

  return normalized === "/" ? "home" : normalized.slice(1);
}
