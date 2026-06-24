/**
 * Custom content-api route for inspect-mode batch publishing.
 *
 * Auth is intentionally left at the default: the content-api API-token strategy
 * protects this route, so a full-access API token is required to call it. Do NOT
 * set `config.auth = false` (that would make it public).
 */
export default {
  routes: [
    {
      method: 'GET',
      path: '/inspect/drafts',
      handler: 'inspect.listDrafts',
      config: {
        policies: [],
        middlewares: [],
      },
    },
    {
      method: 'POST',
      path: '/inspect/publish',
      handler: 'inspect.publishBatch',
      config: {
        policies: [],
        middlewares: [],
      },
    },
  ],
};
