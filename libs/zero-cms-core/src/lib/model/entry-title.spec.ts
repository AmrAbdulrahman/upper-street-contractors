import { describe, expect, it } from 'vitest';
import type { MediaItem } from './media';
import type { Field, Type } from './schema';
import {
  blocksToPlainText,
  entryTitle,
  firstWords,
  isTitleFieldCandidate,
  isUntitled,
  richtextToPlainText,
  titleFieldOf,
} from './entry-title';

/** A Type with one field, which is what every derivation case needs. */
const typeWith = (field: Field, extra: Partial<Type> = {}): Type => ({
  __name: 'thing',
  label: 'Thing',
  fields: [field],
  titleField: field.__name,
  ...extra,
});

const entry = (values: Record<string, unknown> = {}) => ({
  __id: 'a1b2c3d4-0000',
  ...values,
});

const media = (over: Partial<MediaItem> = {}): MediaItem => ({
  id: 'm1',
  filename: 'IMG_4821.jpg',
  url: 'https://blob/IMG_4821.jpg',
  mime: 'image/jpeg',
  size: 1234,
  kind: 'image',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  lastEditedBy: 'tester',
  ...over,
});

describe('plain-text extraction', () => {
  it('flattens a blocks tree, marks and all', () => {
    expect(
      blocksToPlainText([
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'We replaced the entire rear ' },
            { type: 'text', text: 'dormer', bold: true },
            { type: 'text', text: ' roof structure.' },
          ],
        },
      ])
    ).toBe('We replaced the entire rear dormer roof structure.');
  });

  it('newline-separates list items so a list is not one run-on word', () => {
    expect(
      blocksToPlainText([
        {
          type: 'list',
          format: 'unordered',
          children: [
            { type: 'list-item', children: [{ type: 'text', text: 'First' }] },
            { type: 'list-item', children: [{ type: 'text', text: 'Second' }] },
          ],
        },
      ])
    ).toBe('First\nSecond');
  });

  it('is empty for a non-array (an unset blocks field)', () => {
    expect(blocksToPlainText(undefined)).toBe('');
  });

  it('strips richtext tags and decodes entities without a DOM', () => {
    expect(
      richtextToPlainText('<p>Kitchens &amp; bathrooms</p><p>Since 2004</p>')
    ).toBe('Kitchens & bathrooms Since 2004');
  });

  it('drops script and style content rather than reading it as copy', () => {
    expect(
      richtextToPlainText('<style>p{color:red}</style><p>Real copy</p>')
    ).toBe('Real copy');
  });

  it('decodes numeric and hex entities', () => {
    expect(richtextToPlainText('<p>caf&#233; &#x2014; open</p>')).toBe(
      'café — open'
    );
  });
});

describe('firstWords', () => {
  it('keeps three words and marks that more follow', () => {
    expect(firstWords('We replaced the entire rear roof')).toBe(
      'We replaced the…'
    );
  });

  it('adds no ellipsis when there is nothing more', () => {
    expect(firstWords('Two words')).toBe('Two words');
    expect(firstWords('One two three')).toBe('One two three');
  });

  it('is empty for whitespace only', () => {
    expect(firstWords('   \n  ')).toBe('');
  });
});

describe('titleFieldOf', () => {
  it('honours the declared Title field over the first text field', () => {
    const type: Type = {
      __name: 'figure',
      fields: [
        { __name: 'credit', __type: 'text' },
        { __name: 'caption', __type: 'text' },
      ],
      titleField: 'caption',
    };
    expect(titleFieldOf(type)?.__name).toBe('caption');
  });

  it('falls back to the first text/longtext when none is declared', () => {
    const type: Type = {
      __name: 'figure',
      fields: [
        { __name: 'image', __type: 'asset' },
        { __name: 'caption', __type: 'text' },
      ],
    };
    expect(titleFieldOf(type)?.__name).toBe('caption');
  });

  it('falls back rather than blanking when the Title field was removed', () => {
    const type: Type = {
      __name: 'figure',
      fields: [{ __name: 'caption', __type: 'text' }],
      titleField: 'gone',
    };
    expect(titleFieldOf(type)?.__name).toBe('caption');
  });

  it('falls back when the Title field became a relation', () => {
    const type: Type = {
      __name: 'figure',
      fields: [
        { __name: 'caption', __type: 'text' },
        { __name: 'owner', __type: 'reference', allowedTypes: ['author'] },
      ],
      titleField: 'owner',
    };
    expect(titleFieldOf(type)?.__name).toBe('caption');
  });

  it('has nothing for a Type with no eligible field at all', () => {
    expect(
      titleFieldOf({
        __name: 'link',
        fields: [{ __name: 'target', __type: 'reference', allowedTypes: ['page'] }],
      })
    ).toBeUndefined();
    expect(titleFieldOf(undefined)).toBeUndefined();
  });

  it('rejects only relations as candidates', () => {
    expect(isTitleFieldCandidate({ __name: 'x', __type: 'boolean' })).toBe(true);
    expect(isTitleFieldCandidate({ __name: 'x', __type: 'asset' })).toBe(true);
    expect(
      isTitleFieldCandidate({ __name: 'x', __type: 'reference', allowedTypes: [] })
    ).toBe(false);
    expect(
      isTitleFieldCandidate({ __name: 'x', __type: 'references', allowedTypes: [] })
    ).toBe(false);
  });
});

describe('entryTitle — per kind', () => {
  it('takes text as it stands', () => {
    const type = typeWith({ __name: 'label', __type: 'text' });
    expect(entryTitle(type, entry({ label: 'Your email' }))).toBe('Your email');
  });

  it('clamps a long plain value to 40 characters', () => {
    const type = typeWith({ __name: 'label', __type: 'longtext' });
    const title = entryTitle(
      type,
      entry({ label: 'A'.repeat(60) })
    );
    expect(title).toBe(`${'A'.repeat(40)}…`);
  });

  it('summarises richtext to three words', () => {
    const type = typeWith({ __name: 'body', __type: 'richtext' });
    expect(
      entryTitle(type, entry({ body: '<p>We replaced the entire rear roof</p>' }))
    ).toBe('We replaced the…');
  });

  it('summarises blocks to three words', () => {
    const type = typeWith({ __name: 'body', __type: 'blocks' });
    expect(
      entryTitle(
        type,
        entry({
          body: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Every job starts with ' },
                { type: 'text', text: 'a survey', bold: true },
              ],
            },
          ],
        })
      )
    ).toBe('Every job starts…');
  });

  it('names an image by its alt text', () => {
    const type = typeWith({ __name: 'image', __type: 'asset' });
    expect(
      entryTitle(type, entry({ image: 'm1' }), [
        media({ alternativeText: 'Rear dormer loft' }),
      ])
    ).toBe('Rear dormer loft');
  });

  it('falls back to the filename when there is no alt text', () => {
    const type = typeWith({ __name: 'image', __type: 'asset' });
    expect(entryTitle(type, entry({ image: 'm1' }), [media()])).toBe(
      'IMG_4821.jpg'
    );
    expect(
      entryTitle(type, entry({ image: 'm1' }), [media({ alternativeText: '  ' })])
    ).toBe('IMG_4821.jpg');
  });

  it('accepts the media library as a Map as well as an array', () => {
    const type = typeWith({ __name: 'image', __type: 'asset' });
    const item = media({ alternativeText: 'Wetroom' });
    expect(entryTitle(type, entry({ image: 'm1' }), new Map([['m1', item]]))).toBe(
      'Wetroom'
    );
  });

  it('is untitled when the media library was not passed, or the item is gone', () => {
    const type = typeWith({ __name: 'image', __type: 'asset' });
    expect(entryTitle(type, entry({ image: 'm1' }))).toBe('Untitled Thing');
    expect(entryTitle(type, entry({ image: 'm1' }), [])).toBe('Untitled Thing');
  });

  it('prints a lookup, a date and a colour as stored', () => {
    expect(
      entryTitle(
        typeWith({ __name: 'variant', __type: 'lookup', options: ['rule', 'dots'] }),
        entry({ variant: 'dots' })
      )
    ).toBe('dots');
    expect(
      entryTitle(
        typeWith({ __name: 'publishedAt', __type: 'date' }),
        entry({ publishedAt: '2026-08-30' })
      )
    ).toBe('2026-08-30');
    expect(
      entryTitle(
        typeWith({ __name: 'glowColor', __type: 'color' }),
        entry({ glowColor: '#c8a24a' })
      )
    ).toBe('#c8a24a');
  });

  it('prints a number, including zero', () => {
    const type = typeWith({ __name: 'logoSize', __type: 'number' });
    expect(entryTitle(type, entry({ logoSize: 48 }))).toBe('48');
    expect(entryTitle(type, entry({ logoSize: 0 }))).toBe('0');
  });

  it('prints a boolean as Yes / No, including false', () => {
    const type = typeWith({ __name: 'emergency', __type: 'boolean' });
    expect(entryTitle(type, entry({ emergency: true }))).toBe('Yes');
    expect(entryTitle(type, entry({ emergency: false }))).toBe('No');
  });

  it('shortens json', () => {
    const type = typeWith({ __name: 'meta', __type: 'json' });
    expect(entryTitle(type, entry({ meta: { a: 1 } }))).toBe('{"a":1}');
  });

  it('never derives a title from a relation', () => {
    const type: Type = {
      __name: 'link',
      label: 'Link',
      fields: [{ __name: 'target', __type: 'reference', allowedTypes: ['page'] }],
      titleField: 'target',
    };
    expect(entryTitle(type, entry({ target: 'other-entry-id' }))).toBe(
      'Untitled Link'
    );
  });
});

describe('entryTitle — override and fallback', () => {
  it('the override wins over the derived value', () => {
    const type = typeWith({ __name: 'label', __type: 'text' });
    expect(
      entryTitle(type, entry({ label: 'Your email', __title: 'Email (required)' }))
    ).toBe('Email (required)');
  });

  it('a blank override does not win', () => {
    const type = typeWith({ __name: 'label', __type: 'text' });
    expect(entryTitle(type, entry({ label: 'Your email', __title: '   ' }))).toBe(
      'Your email'
    );
    expect(entryTitle(type, entry({ label: 'Your email', __title: null }))).toBe(
      'Your email'
    );
  });

  it('trims a stored override', () => {
    const type = typeWith({ __name: 'label', __type: 'text' });
    expect(entryTitle(type, entry({ __title: '  Padded  ' }))).toBe('Padded');
  });

  it('falls back to Untitled + the Type label when the value is blank', () => {
    const type = typeWith({ __name: 'label', __type: 'text' });
    expect(entryTitle(type, entry({ label: '' }))).toBe('Untitled Thing');
    expect(entryTitle(type, entry({}))).toBe('Untitled Thing');
    expect(entryTitle(type, entry({ label: '   ' }))).toBe('Untitled Thing');
  });

  it('uses __name when the Type has no label, and copes with no Type at all', () => {
    const type: Type = { __name: 'form-field', fields: [] };
    expect(entryTitle(type, entry({}))).toBe('Untitled form-field');
    expect(entryTitle(undefined, entry({}))).toBe('Untitled entry');
  });

  it('reports untitled only when nothing resolved', () => {
    const type = typeWith({ __name: 'label', __type: 'text' });
    expect(isUntitled(type, entry({ label: 'Your email' }))).toBe(false);
    expect(isUntitled(type, entry({ __title: 'Override' }))).toBe(false);
    expect(isUntitled(type, entry({}))).toBe(true);
    expect(isUntitled({ __name: 'x', fields: [] }, entry({}))).toBe(true);
  });
});
