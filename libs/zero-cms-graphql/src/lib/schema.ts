/** Build an executable GraphQL schema from a CMS Schema + Adapter (ADR 0005). */

import { makeExecutableSchema } from '@graphql-tools/schema';
import type { IResolvers } from '@graphql-tools/utils';
import type { GraphQLSchema } from 'graphql';
import type { Adapter, MediaItem, Schema } from '@usc/zero-cms-core';
import { generateSdl } from './sdl';
import { buildResolvers } from './resolvers';

export interface BuildSchemaArgs {
  schema: Schema;
  adapter: Adapter;
  /** Build a public URL for a media item. Default `/api/cms/media/<id>`. */
  mediaUrl?: (item: MediaItem) => string;
}

export function buildCmsSchema({
  schema,
  adapter,
  mediaUrl,
}: BuildSchemaArgs): GraphQLSchema {
  return makeExecutableSchema({
    typeDefs: generateSdl(schema),
    // Resolver map is dynamically shaped (one set of fields per Type).
    resolvers: buildResolvers({ schema, adapter, mediaUrl }) as unknown as IResolvers,
  });
}
