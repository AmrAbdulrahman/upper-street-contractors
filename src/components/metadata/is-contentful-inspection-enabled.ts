import { headers } from "next/headers";

export function isContentfulInspectionBuildEnabled(): boolean {
  return (
    process.env.NEXT_PUBLIC_CONTENTFUL_INSPECTION_MODE === "true" ||
    process.env.CONTENTFUL_PREVIEW === "true"
  );
}

export async function isContentfulInspectionEnabled(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_CONTENTFUL_INSPECTION_MODE === "true") {
    return true;
  }

  // ?inspect=true is only available with preview middleware; avoid headers()
  // on static production builds so pages stay cacheable.
  if (process.env.CONTENTFUL_PREVIEW !== "true") {
    return false;
  }

  const headersList = await headers();

  return headersList.get("x-inspect") === "true";
}
