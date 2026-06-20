/**
 * Batch-publish endpoint backing inspect-mode's "Publish all changes" button.
 *
 * Takes `{ entries: [{ uid, documentId }] }` and publishes each draft → published
 * via the Document Service. Each entry is published independently so one failure
 * doesn't abort the batch. UIDs are restricted to real `api::*` content types.
 */
export default {
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
