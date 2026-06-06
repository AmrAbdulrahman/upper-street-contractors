import { PageSection } from "@/components/sections";
import { GetHomePageDocument } from "@/generated/graphql";
import { getClient } from "@/lib/apollo-server";

export default async function Home() {
  const { data } = await getClient().query({
    query: GetHomePageDocument,
  });

  const page = data?.pageCollection?.items?.at(0);
  const sections = page?.sectionsCollection?.items ?? [];

  return (
    <>
      {sections.map((section) =>
        section ? (
          <PageSection key={section._id} section={section} />
        ) : null,
      )}
    </>
  );
}
