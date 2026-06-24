type DraftDocument = {
  documentId?: string;
  updatedAt?: string | Date;
};

function hasUnpublishedDraft(
  draft: DraftDocument,
  published: DraftDocument | null | undefined,
): boolean {
  if (!draft.documentId) return false;
  if (!published?.documentId) return true;

  const draftTime = new Date(draft.updatedAt ?? 0).getTime();
  const publishedTime = new Date(published.updatedAt ?? 0).getTime();
  return draftTime > publishedTime;
}

async function findDraftDocuments(
  uid: string,
  kind: string,
): Promise<DraftDocument[]> {
  const documents = strapi.documents(
    uid as Parameters<typeof strapi.documents>[0],
  ) as unknown as {
    findFirst: (params: { status: string }) => Promise<DraftDocument | null>;
    findMany: (params: { status: string }) => Promise<DraftDocument[]>;
  };

  if (kind === 'singleType') {
    const draft = await documents.findFirst({ status: 'draft' });
    return draft ? [draft] : [];
  }

  return documents.findMany({ status: 'draft' });
}

async function findPublishedDocuments(
  uid: string,
  kind: string,
): Promise<DraftDocument[]> {
  const documents = strapi.documents(
    uid as Parameters<typeof strapi.documents>[0],
  ) as unknown as {
    findFirst: (params: { status: string }) => Promise<DraftDocument | null>;
    findMany: (params: { status: string }) => Promise<DraftDocument[]>;
  };

  if (kind === 'singleType') {
    const published = await documents.findFirst({ status: 'published' });
    return published ? [published] : [];
  }

  return documents.findMany({ status: 'published' });
}

/**
 * Batch-publish endpoint backing inspect-mode's "Publish all changes" button.
 *
 * Takes `{ entries: [{ uid, documentId }] }` and publishes each draft → published
 * via the Document Service. Each entry is published independently so one failure
 * doesn't abort the batch. UIDs are restricted to real `api::*` content types.
 */
export default {
  async listDrafts(ctx) {
    const entries: { uid: string; documentId: string }[] = [];

    for (const [uid, schema] of Object.entries(strapi.contentTypes)) {
      if (!uid.startsWith('api::') || !schema.options?.draftAndPublish) {
        continue;
      }

      try {
        const drafts = await findDraftDocuments(uid, schema.kind);
        const publishedList = await findPublishedDocuments(uid, schema.kind);
        const publishedById = new Map(
          publishedList
            .filter((entry) => entry.documentId)
            .map((entry) => [entry.documentId as string, entry]),
        );

        for (const draft of drafts) {
          if (
            hasUnpublishedDraft(
              draft,
              publishedById.get(draft.documentId as string),
            )
          ) {
            entries.push({
              uid,
              documentId: draft.documentId as string,
            });
          }
        }
      } catch {
        // Skip content types that fail to load.
      }
    }

    ctx.body = { entries };
  },

  async publishBatch(ctx) {
    const entries = ctx.request.body?.entries;

    if (!Array.isArray(entries)) {
      return ctx.badRequest('`entries` must be an array of { uid, documentId }.');
    }

    const published: { documentId: string }[] = [];
    const errors: { documentId: string | null; error: string }[] = [];

    for (const entry of entries) {
      const uid = entry?.uid;
      const documentId = entry?.documentId;

      if (typeof uid !== 'string' || typeof documentId !== 'string') {
        errors.push({
          documentId: typeof documentId === 'string' ? documentId : null,
          error: 'Each entry needs a uid and documentId.',
        });
        continue;
      }

      // Allow-list: only genuine api:: content types (no admin/plugin internals).
      if (!uid.startsWith('api::') || !strapi.contentTypes[uid]) {
        errors.push({ documentId, error: `Unknown content type: ${uid}` });
        continue;
      }

      try {
        // `publish` only exists on draft-and-publish content types, so the
        // generically-typed document service doesn't surface it — narrow here.
        const documents = strapi.documents(
          uid as Parameters<typeof strapi.documents>[0],
        ) as unknown as {
          publish: (params: { documentId: string }) => Promise<unknown>;
        };
        await documents.publish({ documentId });
        published.push({ documentId });
      } catch (error) {
        errors.push({
          documentId,
          error: error instanceof Error ? error.message : 'Publish failed.',
        });
      }
    }

    ctx.body = { published, errors };
  },
};
