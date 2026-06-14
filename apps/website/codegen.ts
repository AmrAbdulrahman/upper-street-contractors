import type { CodegenConfig } from '@graphql-codegen/cli'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const strapiUrl = process.env.STRAPI_URL || 'http://localhost:1337'
const strapiToken = process.env.STRAPI_API_TOKEN

if (!strapiToken) {
  throw new Error('STRAPI_API_TOKEN must be set in .env.local')
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

const sharedScalars = {
  JSON: 'unknown',
  DateTime: 'string',
  Upload: 'unknown',
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
  generates: {
    'apps/website/src/generated/graphql.ts': {
      plugins: ['typescript', 'typescript-operations', 'typed-document-node'],
      config: {
        documentMode: 'documentNode',
        enumsAsTypes: true,
        onlyOperationTypes: true,
        scalars: sharedScalars,
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
