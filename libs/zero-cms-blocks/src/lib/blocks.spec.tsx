import { describe, it, expect } from 'vitest';
import { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ZeroCmsBlocks } from './renderer';
import { BlocksEditor } from './editor';
import type { BlocksContent } from './types';

describe('ZeroCmsBlocks renderer', () => {
  it('renders headings, marks, and lists (with overrides)', () => {
    const content = [
      { type: 'heading', level: 2, children: [{ type: 'text', text: 'Title' }] },
      {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'strong', bold: true },
        ],
      },
      {
        type: 'list',
        format: 'unordered',
        children: [{ type: 'list-item', children: [{ type: 'text', text: 'one' }] }],
      },
    ];
    const { container } = render(
      <ZeroCmsBlocks
        content={content}
        blocks={{ paragraph: ({ children }) => <p className="lead">{children}</p> }}
      />
    );
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Title');
    expect(container.querySelector('strong')?.textContent).toBe('strong');
    expect(container.querySelector('ul li')?.textContent).toBe('one');
    expect(container.querySelector('p.lead')).toBeTruthy(); // override applied
  });

  it('renders null for empty content', () => {
    const { container } = render(<ZeroCmsBlocks content={[]} />);
    expect(container.innerHTML).toBe('');
  });
});

describe('BlocksEditor', () => {
  it('adds a block and edits its text into structured blocks', () => {
    function Harness() {
      const [v, setV] = useState<BlocksContent>([]);
      return (
        <>
          <BlocksEditor value={v} onChange={setV} />
          <pre data-testid="out">{JSON.stringify(v)}</pre>
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '+ Block' }));
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'Hello world' } });

    const out = JSON.parse(screen.getByTestId('out').textContent || '[]');
    expect(out).toEqual([
      { type: 'paragraph', children: [{ type: 'text', text: 'Hello world' }] },
    ]);
  });
});
