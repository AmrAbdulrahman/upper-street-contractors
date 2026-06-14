import type { CodegenConfig } from '@graphql-codegen/cli'
import * as dotenv from 'dotenv'

dotenv.config({ path: 'apps/website/.env.local' })

const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337'
const strapiToken = process.env.STRAPI_API_TOKEN

if (!strapiToken) {
  throw new Error('STRAPI_API_TOKEN must be set in apps/website/.env.local')
}

const reactApolloPluginConfig = {
  withHooks: true,
  withComponent: false,
  withHOC: false,
  documentMode: 'documentNode' as const,
  apolloReactCommonImportFrom: '@apollo/client/react',
  apolloReactHooksImportFrom: '@apollo/client/react',
  importOperationTypesFrom: 'graphql',
  importDocumentNodeFrom: 'graphql',
}

const config: CodegenConfig = {
  schema: {
    [`${strapiUrl}/graphql`]: {
      headers: {
        Authorization: `Bearer ${strapiToken}`,
      },
    },
  },
  documents: 'apps/website/src/**/*.graphql',
  // documents: 'apps/website/src/test.graphql',
  generates: {
    'apps/website/src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typed-document-node',
      ],
      config: {
        documentMode: 'documentNode',
        scalars: {
          JSON: 'unknown',
          DateTime: 'string',
          Upload: 'unknown',
        },
      },
    },
    'apps/website/src/generated/apollo-hooks.ts': {
      plugins: [
        {
          add: {
            content: "// @ts-nocheck\nimport type * as graphql from './graphql';\n\n",
          },
        },
        { 'typescript-react-apollo': reactApolloPluginConfig },
      ],
    },
    'apps/website/src/generated/schema.graphql': {
      plugins: ['schema-ast'],
      config: {
        includeDirectives: true,
      },
    },
  },
}

export default config
