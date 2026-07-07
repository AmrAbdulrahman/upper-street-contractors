/** Wire protocol shared by the http adapter and the reference server. */

export const RPC_PATH = '/zero-cms/rpc';

/** Adapter methods exposed over the wire. Media bytes travel as base64. */
export type RpcOp =
  | 'getSchema'
  | 'getSchemaVersion'
  | 'saveSchema'
  | 'create'
  | 'update'
  | 'patch'
  | 'delete'
  | 'publish'
  | 'unpublish'
  | 'discardDraft'
  | 'get'
  | 'query'
  | 'listDrafts'
  | 'validateRefs'
  | 'locate'
  | 'listMedia'
  | 'putMedia'
  | 'updateMedia'
  | 'getMedia'
  | 'deleteMedia';

export interface RpcRequest {
  op: RpcOp;
  args: unknown[];
}

export interface RpcErrorBody {
  error: { code: string; message: string; details?: unknown };
}
