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
const publicationMatches = [...source.matchAll(duplicateBlock)];

if (publicationMatches.length > 1) {
  const secondMatch = publicationMatches[1];
  source =
    source.slice(0, secondMatch.index) +
    source.slice(secondMatch.index + secondMatch[0].length);
}

const enumMarker = 'export type Enum_Badge_Variant';
const firstEnumIdx = source.indexOf(enumMarker);
const secondEnumIdx =
  firstEnumIdx === -1 ? -1 : source.indexOf(enumMarker, firstEnumIdx + 1);
const queryMarker = '\nexport type GetHomePageQueryVariables';

if (secondEnumIdx !== -1) {
  const queryIdx = source.indexOf(queryMarker, secondEnumIdx);

  if (queryIdx !== -1) {
    source = source.slice(0, secondEnumIdx) + source.slice(queryIdx);
  }
}

writeFileSync(graphqlPath, source);