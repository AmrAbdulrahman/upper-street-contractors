import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';
import path from 'node:path';

const generatedDir = path.join(process.cwd(), 'apps/website/src/generated');
const graphqlPath = path.join(generatedDir, 'graphql.ts');

for (const extra of ['schema-types.ts', 'operations.ts']) {
  const extraPath = path.join(generatedDir, extra);
  if (existsSync(extraPath)) {
    unlinkSync(extraPath);
  }
}

let source = readFileSync(graphqlPath, 'utf8');
const duplicateBlock =
  /\nexport type PublicationStatus =\n  \| 'DRAFT'\n  \| 'PUBLISHED';\n/g;
const matches = [...source.matchAll(duplicateBlock)];

if (matches.length > 1) {
  const secondMatch = matches[1];
  source =
    source.slice(0, secondMatch.index) +
    source.slice(secondMatch.index + secondMatch[0].length);
}

writeFileSync(graphqlPath, source);
