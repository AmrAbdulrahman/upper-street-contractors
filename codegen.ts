import type { CodegenConfig } from '@graphql-codegen/cli'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const spaceId = process.env.CONTENTFUL_SPACE_ID
const token = process.env.CONTENTFUL_ACCESS_TOKEN

if (!spaceId || !token) {
  throw new Error('CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN must be set in .env.local')
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
    [`https://graphql.contentful.com/content/v1/spaces/${spaceId}`]: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  },
  documents: 'src/**/*.graphql',
  generates: {
    'src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typed-document-node',
      ],
      config: {
        documentMode: 'documentNode',
      },
    },
    'src/generated/apollo-hooks.ts': {
      plugins: [
        {
          add: {
            content: "// @ts-nocheck\nimport type * as graphql from './graphql';\n\n",
          },
        },
        { 'typescript-react-apollo': reactApolloPluginConfig },
      ],
    },
    'src/generated/schema.graphql': {
       plugins: ['schema-ast'],
       config: {
         includeDirectives: true
       },
     },
  },
}

export default config
