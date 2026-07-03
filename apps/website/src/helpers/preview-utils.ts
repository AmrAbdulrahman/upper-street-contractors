export function isPreviewEnabled(): boolean {
  return process.env.NEXT_PUBLIC_APP_ENV === "preview";
}
