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

type DocRef = { uid: string; documentId: string };

type LooseDocService = {
  findFirst: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  findMany: (params: Record<string, unknown>) => Promise<Record<string, unknown>[]>;
  findOne: (params: Record<string, unknown>) => Promise<Record<string, unknown> | null>;
  publish: (params: { documentId: string }) => Promise<unknown>;
};

function docService(uid: string): LooseDocService {
  return strapi.documents(
    uid as Parameters<typeof strapi.documents>[0],
  ) as unknown as LooseDocService;
}

/**
 * Index every relation attribute across all api:: content types, keyed by the
 * UID it points AT. Lets us answer "which content types can be a parent of this
 * child, and through which field?" when walking the relation graph upward.
 */
function buildReverseRelationIndex(): Map<string, { parentUid: string; field: string }[]> {
  const index = new Map<string, { parentUid: string; field: string }[]>();
  for (const [uid, schema] of Object.entries(strapi.contentTypes)) {
    if (!uid.startsWith('api::')) continue;
    for (const [field, attr] of Object.entries(schema.attributes ?? {})) {
      const typed = attr as { type?: string; target?: string };
      if (typed.type === 'relation' && typed.target?.startsWith('api::')) {
        const list = index.get(typed.target) ?? [];
        list.push({ parentUid: uid, field });
        index.set(typed.target, list);
      }
    }
  }
  return index;
}

/** Does this document currently have a published version (i.e. is it live)? */
async function hasPublishedVersion(uid: string, documentId: string): Promise<boolean> {
  const schema = strapi.contentTypes[uid];
  const svc = docService(uid);
  try {
    if (schema?.kind === 'singleType') {
      const pub = await svc.findFirst({ status: 'published' });
      return Boolean((pub as { documentId?: string } | null)?.documentId);
    }
    const pub = await svc.findOne({ documentId, status: 'published' });
    return Boolean((pub as { documentId?: string } | null)?.documentId);
  } catch {
    return false;
  }
}

/**
 * Find every live parent document whose *draft* relation still references the
 * given child. We read the draft (not published) link because unpublishing the
 * child only strips it from published parents — the draft relation is intact and
 * is what re-publishing the parent will rebuild the published relation from.
 */
async function findLiveParentsLinkingChild(
  child: DocRef,
  reverseIndex: Map<string, { parentUid: string; field: string }[]>,
): Promise<DocRef[]> {
  const parents: DocRef[] = [];

  for (const { parentUid, field } of reverseIndex.get(child.uid) ?? []) {
    const schema = strapi.contentTypes[parentUid];
    if (!schema) continue;

    let parentDocs: Record<string, unknown>[] = [];
    try {
      const svc = docService(parentUid);
      if (schema.kind === 'singleType') {
        const one = await svc.findFirst({ status: 'draft', populate: { [field]: true } });
        parentDocs = one ? [one] : [];
      } else {
        parentDocs = await svc.findMany({ status: 'draft', populate: { [field]: true } });
      }
    } catch {
      continue;
    }

    for (const parentDoc of parentDocs) {
      const documentId = parentDoc?.documentId;
      if (typeof documentId !== 'string') continue;

      const rel = parentDoc[field];
      const linked = Array.isArray(rel) ? rel : rel ? [rel] : [];
      const referencesChild = linked.some(
        (entry) => (entry as { documentId?: string })?.documentId === child.documentId,
      );
      if (!referencesChild) continue;

      // Only repair parents that are themselves live — a draft-only parent isn't
      // shown on the site, so there's no broken published link to rebuild.
      if (await hasPublishedVersion(parentUid, documentId)) {
        parents.push({ uid: parentUid, documentId });
      }
    }
  }

  return parents;
}

/**
 * Rebuild the published relation graph after entries are (re-)published.
 *
 * In Strapi 5, draft and published are distinct version rows and relations are
 * version-specific links between rows. Unpublishing a child deletes its
 * published row, cascade-removing the link from every published parent;
 * re-publishing the child creates a *new* published row that existing published
 * parents are not re-linked to. So a re-published entry stays invisible inside
 * any `status: PUBLISHED` parent query until the parent is re-published too —
 * and because re-publishing a parent recreates *its* published row, the same
 * breakage propagates up to the grandparent, and so on to the page root.
 *
 * Fix: walk the relation graph upward from each published entry (via the intact
 * draft links) to collect all live ancestors, then re-publish bottom-up
 * (children before parents) so every level relinks to the freshly-published
 * version below it.
 */
async function repairAncestorRelations(publishedChildren: DocRef[]): Promise<void> {
  if (publishedChildren.length === 0) return;

  const MAX_NODES = 500; // safety backstop against pathological graphs
  const reverseIndex = buildReverseRelationIndex();
  const key = (ref: DocRef) => `${ref.uid}|${ref.documentId}`;

  const repairSet = new Map<string, DocRef>(); // every node to re-publish (incl. originals)
  const deps = new Map<string, Set<string>>(); // parentKey -> child keys that must publish first
  const originals = new Set<string>();
  const seen = new Set<string>();

  for (const child of publishedChildren) {
    repairSet.set(key(child), child);
    originals.add(key(child));
    seen.add(key(child));
  }

  // Upward BFS: discover live ancestors and record child→parent ordering edges.
  let frontier = [...publishedChildren];
  while (frontier.length > 0 && repairSet.size <= MAX_NODES) {
    const next: DocRef[] = [];
    for (const child of frontier) {
      const parents = await findLiveParentsLinkingChild(child, reverseIndex);
      for (const parent of parents) {
        const parentKey = key(parent);
        if (!deps.has(parentKey)) deps.set(parentKey, new Set());
        deps.get(parentKey)!.add(key(child));

        if (!repairSet.has(parentKey)) repairSet.set(parentKey, parent);
        if (!seen.has(parentKey)) {
          seen.add(parentKey);
          next.push(parent);
        }
      }
    }
    frontier = next;
  }

  // Topological re-publish: publish a node only once all of its in-set children
  // are done, so each parent relinks to its children's final published rows.
  const done = new Set<string>();
  const pending = new Map(repairSet);
  while (pending.size > 0) {
    let progressed = false;
    for (const [nodeKey, ref] of [...pending]) {
      const childKeys = deps.get(nodeKey) ?? new Set<string>();
      const ready = [...childKeys].every((childKey) => done.has(childKey));
      if (!ready) continue;

      // Originals with no affected children were already published correctly by
      // the main loop — skip the redundant re-publish.
      const skipRedundant = originals.has(nodeKey) && childKeys.size === 0;
      if (!skipRedundant) {
        try {
          await docService(ref.uid).publish({ documentId: ref.documentId });
        } catch {
          // Best-effort — a single failed relink shouldn't abort the batch.
        }
      }
      done.add(nodeKey);
      pending.delete(nodeKey);
      progressed = true;
    }

    if (!progressed) {
      // Unresolved ordering (unexpected for a DAG) — flush the rest as-is.
      for (const [, ref] of pending) {
        try {
          await docService(ref.uid).publish({ documentId: ref.documentId });
        } catch {
          // Best-effort.
        }
      }
      pending.clear();
    }
  }
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
    const entries: { uid: string; documentId: string; published: boolean }[] = [];

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
          const publishedEntry = publishedById.get(draft.documentId as string);
          if (hasUnpublishedDraft(draft, publishedEntry)) {
            entries.push({
              uid,
              documentId: draft.documentId as string,
              published: Boolean(publishedEntry),
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
    const publishedDocs: DocRef[] = [];

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
        publishedDocs.push({ uid, documentId });
      } catch (error) {
        errors.push({
          documentId,
          error: error instanceof Error ? error.message : 'Publish failed.',
        });
      }
    }

    // Rebuild the published relation graph so re-published entries reappear
    // inside their (grand)parents' `status: PUBLISHED` queries. See
    // repairAncestorRelations for the Strapi 5 versioned-relation rationale.
    await repairAncestorRelations(publishedDocs);

    ctx.body = { published, errors };
  },

  /**
   * Inverse of publishBatch: reverts each entry to draft-only (unpublished), so
   * it stops rendering on the live site. Same `{ entries: [{ uid, documentId }] }`
   * shape, same allow-list and per-entry error isolation.
   */
  async unpublishBatch(ctx) {
    const entries = ctx.request.body?.entries;

    if (!Array.isArray(entries)) {
      return ctx.badRequest('`entries` must be an array of { uid, documentId }.');
    }

    const unpublished: { documentId: string }[] = [];
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
        // `unpublish` only exists on draft-and-publish content types, so the
        // generically-typed document service doesn't surface it — narrow here.
        const documents = strapi.documents(
          uid as Parameters<typeof strapi.documents>[0],
        ) as unknown as {
          unpublish: (params: { documentId: string }) => Promise<unknown>;
        };
        await documents.unpublish({ documentId });
        unpublished.push({ documentId });
      } catch (error) {
        errors.push({
          documentId,
          error: error instanceof Error ? error.message : 'Unpublish failed.',
        });
      }
    }

    ctx.body = { unpublished, errors };
  },
};
