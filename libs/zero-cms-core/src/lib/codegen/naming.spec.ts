import { describe, expect, it } from 'vitest';
import { camelCase, humanize, pascalCase } from './naming';

describe('pascalCase / camelCase', () => {
  it('splits kebab, snake and camel identifiers alike', () => {
    expect(pascalCase('blog-post')).toBe('BlogPost');
    expect(pascalCase('middle_name')).toBe('MiddleName');
    expect(pascalCase('doneTitle')).toBe('DoneTitle');
    expect(camelCase('blog-post')).toBe('blogPost');
  });
});

describe('humanize', () => {
  it('title-cases a camelCase key', () => {
    expect(humanize('doneTitle')).toBe('Done Title');
    expect(humanize('doneMessage')).toBe('Done Message');
  });

  it('leaves a single lowercase word capitalised only', () => {
    expect(humanize('questions')).toBe('Questions');
    expect(humanize('overline')).toBe('Overline');
  });

  it('splits snake_case, which the CMS schema still contains', () => {
    expect(humanize('middle_name')).toBe('Middle Name');
  });

  it('keeps small words lowercase mid-phrase', () => {
    expect(humanize('listOfPoints')).toBe('List of Points');
  });

  it('capitalises a small word when it leads', () => {
    expect(humanize('ofPoints')).toBe('Of Points');
  });

  it('expands acronyms rather than title-casing them', () => {
    expect(humanize('sidebarCta')).toBe('Sidebar CTA');
    expect(humanize('url')).toBe('URL');
    expect(humanize('siteUrl')).toBe('Site URL');
    expect(humanize('whatsappNumber')).toBe('WhatsApp Number');
    expect(humanize('imgDescription')).toBe('Image Description');
    expect(humanize('href')).toBe('Link');
  });

  it('only matches an acronym as a whole word', () => {
    // `grid` contains no acronym; `cta` inside `contact` must not fire either.
    expect(humanize('serviceGrid')).toBe('Service Grid');
    expect(humanize('contactDetails')).toBe('Contact Details');
  });

  it('survives keys it cannot improve, rather than mangling them', () => {
    // No word boundary to split on — this one needs a real `label`.
    expect(humanize('lastname')).toBe('Lastname');
    expect(humanize('')).toBe('');
    expect(humanize('___')).toBe('___');
  });

  it('handles the long conditional keys on form-field', () => {
    expect(humanize('dependsOnFieldKey')).toBe('Depends on Field Key');
    expect(humanize('emergencyHorizonDays')).toBe('Emergency Horizon Days');
  });
});
