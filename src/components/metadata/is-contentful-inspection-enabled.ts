import { headers } from "next/headers";

export async function isContentfulInspectionEnabled(): Promise<boolean> {
  if (process.env.NEXT_PUBLIC_CONTENTFUL_INSPECTION_MODE === "true") {
    return true;
  }

  const headersList = await headers();

  return headersList.get("x-inspect") === "true";
}
