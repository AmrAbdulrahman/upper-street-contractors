import { describe, expect, it } from 'vitest';
import { generateClientSource } from './generate';
import type { Schema } from '../model/schema';

const schema: Schema = [
  { __name: 'author', fields: [{ __name: 'name', __type: 'text', required: true }] },
  {
    __name: 'blog-post',
    fields: [
      { __name: 'title', __type: 'text', required: true },
      { __name: 'category', __type: 'lookup', options: ['News', 'Guide'] },
      { __name: 'author', __type: 'reference', allowedTypes: ['author'] },
    ],
  },
];

describe('generateClientSource', () => {
  const src = generateClientSource(schema);

  it('emits PascalCase entity + Input + Populated interfaces', () => {
    expect(src).toContain('export interface BlogPost {');
    expect(src).toContain('export interface BlogPostInput {');
    expect(src).toContain('export interface BlogPostPopulated extends Omit<BlogPost,');
  });

  it('types lookup as a string-literal union and required vs optional', () => {
    expect(src).toContain('category?: "News" | "Guide";');
    expect(src).toContain('title: string;'); // required, no `?`
  });

  it('populated reference becomes the target entity type', () => {
    expect(src).toContain('author?: Author | null;');
  });

  it('binds camelCase stores in createClient', () => {
    expect(src).toContain("blogPostStore: bindStore<BlogPostInput, BlogPost>(adapter, \"blog-post\")");
    expect(src).toContain("authorStore: bindStore<AuthorInput, Author>(adapter, \"author\")");
  });
});
