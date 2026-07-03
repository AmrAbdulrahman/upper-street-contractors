import { headers } from "next/headers";

// export function isStrapiInspectionBuildEnabled(): boolean {
//   return (
//     process.env.NEXT_PUBLIC_STRAPI_INSPECTION_MODE === "true" ||
//     process.env.ENABLE_PREVIEW === "true"
//   );
// }

// export async function isStrapiInspectionEnabled(): Promise<boolean> {
//   // if (process.env.NODE_ENV === "production") {
//   //   return false;
//   // }

//   if (process.env.NEXT_PUBLIC_STRAPI_INSPECTION_MODE === "true") {
//     return true;
//   }

//   // ?inspect=true is only available with preview middleware; avoid headers()
//   // on static production builds so pages stay cacheable.
//   if (process.env.ENABLE_PREVIEW !== "true") {
//     return false;
//   }

//   try {
//     const headersList = await headers();
//     return headersList.get("x-inspect") === "true";
//   } catch {
//     // build time (generateStaticParams) — no request context, default PUBLISHED
//     return false;
//   }
// }
