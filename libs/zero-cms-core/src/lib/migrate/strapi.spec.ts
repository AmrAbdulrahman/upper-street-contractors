import { describe, it, expect } from 'vitest';
import { migrateStrapiSchemas, type StrapiContentType } from './strapi';

const contentTypes: StrapiContentType[] = [
  {
    info: { singularName: 'icon', displayName: 'Icon' },
    attributes: { name: { type: 'string', required: true } },
  },
  {
    info: { singularName: 'project-card', displayName: 'Project Card' },
    attributes: {
      title: { type: 'string', required: true },
      summary: { type: 'text' },
      body: { type: 'blocks' },
      order: { type: 'integer' },
      price: { type: 'decimal' },
      featured: { type: 'boolean' },
      meta: { type: 'json' },
      variant: { type: 'enumeration', enum: ['light', 'dark'] },
      banner: { type: 'media', allowedTypes: ['images'] },
      gallery: { type: 'media', multiple: true, allowedTypes: ['images', 'videos'] },
      icon: { type: 'relation', relation: 'manyToOne', target: 'api::icon.icon' },
      related: {
        type: 'relation',
        relation: 'manyToMany',
        target: 'api::project-card.project-card',
      },
      widget: { type: 'component', component: 'shared.x' },
    },
  },
];

describe('migrateStrapiSchemas', () => {
  const { schema, warnings } = migrateStrapiSchemas(contentTypes);
  const project = schema.find((t) => t.__name === 'project-card')!;
  const field = (n: string) => project.fields.find((f) => f.__name === n);

  it('maps scalar + structured types', () => {
    expect(field('title')).toMatchObject({ __type: 'text', required: true });
    expect(field('summary')).toMatchObject({ __type: 'longtext' });
    expect(field('body')).toMatchObject({ __type: 'blocks' });
    expect(field('order')).toMatchObject({ __type: 'number', integer: true });
    expect(field('price')).toMatchObject({ __type: 'number' });
    expect(field('meta')).toMatchObject({ __type: 'json' });
    expect(field('variant')).toMatchObject({
      __type: 'lookup',
      options: ['light', 'dark'],
    });
  });

  it('maps media accept + relation cardinality', () => {
    expect(field('banner')).toMatchObject({ __type: 'asset', accept: 'image' });
    expect(field('gallery')).toMatchObject({ __type: 'asset', accept: 'any' });
    expect(field('icon')).toMatchObject({
      __type: 'reference',
      allowedTypes: ['icon'],
    });
    expect(field('related')).toMatchObject({
      __type: 'references',
      allowedTypes: ['project-card'],
    });
  });

  it('skips components and warns about lossy conversions', () => {
    expect(field('widget')).toBeUndefined();
    expect(warnings.some((w) => w.includes('gallery'))).toBe(true);
    expect(warnings.some((w) => w.includes('widget'))).toBe(true);
  });
});
