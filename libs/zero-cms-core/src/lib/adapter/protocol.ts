/** Wire protocol shared by the http adapter and the reference server. */

export const RPC_PATH = '/zero-cms/rpc';

/** Adapter methods exposed over the wire. Media bytes travel as base64. */
export type RpcOp =
  | 'getSchema'
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
  | 'validateRefs'
  | 'locate'
  | 'listMedia'
  | 'putMedia'
  | 'getMedia'
  | 'deleteMedia';

export interface RpcRequest {
  op: RpcOp;
  args: unknown[];
}

export interface RpcErrorBody {
  error: { code: string; message: string; details?: unknown };
}
