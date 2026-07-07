'use client';

// Self-hosted / bundled HugeRTE — these side-effect imports register the editor
// and its assets onto window.hugerte (no CDN). This whole module is loaded only
// via next/dynamic({ ssr: false }) from ./hugerte-editor, so `import "hugerte"`
// never runs on the server (it would crash SSR).
import 'hugerte';
import 'hugerte/models/dom';
import 'hugerte/themes/silver';
import 'hugerte/icons/default';
import 'hugerte/plugins/lists';
import 'hugerte/plugins/link';

import { Editor } from '@hugerte/hugerte-react';
import type { Editor as HugeRTEEditor } from 'hugerte';
import { useMemo, useState } from 'react';
import { blocksToHtml, htmlToBlocks } from './blocks-html';
import type { BlocksContent } from './types';

// Locked to exactly what the ZeroCmsBlocks renderer supports: Text/H1-3, bold,
// italic, strikethrough, inline code, bullet/numbered list, link.
const TOOLBAR = 'blocks | bold italic strikethrough inlinecode | bullist numlist | link';

const INIT = {
  menubar: false,
  statusbar: false,
  branding: false,
  height: 320,
  plugins: 'lists link',
  toolbar: TOOLBAR,
  block_formats: 'Paragraph=p;Heading 1=h1;Heading 2=h2;Heading 3=h3',
  // Skins are served from apps/website/public/hugerte. Loaded by URL (not the
  // bundler chunk path) to avoid HugeRTE's asset-fetching 404ing.
  skin_url: '/hugerte/skins/ui/oxide',
  content_css: '/hugerte/skins/content/default/content.min.css',
  formats: { inlinecode: { inline: 'code' } },
  setup: (editor: HugeRTEEditor) => {
    editor.ui.registry.addToggleButton('inlinecode', {
      text: '</>',
      tooltip: 'Inline code',
      onAction: () => editor.execCommand('mceToggleFormat', false, 'inlinecode'),
      onSetup: (api) => {
        const binding = editor.formatter.formatChanged('inlinecode', (state) =>
          api.setActive(state)
        );
        return () => binding.unbind();
      },
    });
  },
};

/**
 * Edits a `blocks` field as HTML via HugeRTE, converting blocks↔HTML at the edges.
 * HugeRTE owns the working HTML (no blocks→HTML round-trip per keystroke); each
 * edit converts HTML→blocks and reports any nodes the block model can't hold.
 */
export default function HugeRTEBlocksEditorImpl({
  value,
  onChange,
}: {
  value: BlocksContent;
  onChange: (value: BlocksContent) => void;
}) {
  // Seed once from the incoming blocks (the editor is remounted per entry, so a
  // mount-time seed is enough — see EntryEditor `key`).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seededHtml = useMemo(() => blocksToHtml(value ?? []), []);
  const [html, setHtml] = useState(seededHtml);
  // `dirty` gates the drop warning and guards the editor's init fire: an untouched
  // field must not be clobbered by a load-time blocks→HTML→blocks round-trip.
  const [dirty, setDirty] = useState(false);

  const dropped = useMemo(() => {
    try {
      return [...new Set(htmlToBlocks(html).dropped)];
    } catch {
      return [];
    }
  }, [html]);

  return (
    <div>
      <Editor
        value={html}
        init={INIT}
        onEditorChange={(next) => {
          setHtml(next);
          // Skip the init fire (still the seed); every real edit emits.
          if (!dirty && next === seededHtml) return;
          if (!dirty) setDirty(true);
          onChange(htmlToBlocks(next).blocks);
        }}
      />
      {dirty && dropped.length > 0 ? (
        <p role="alert" className="mt-2 rounded-md bg-red-50 px-3 py-2 text-xs text-red-700">
          Unsupported content ({dropped.join(', ')}) will be removed on save.
        </p>
      ) : null}
    </div>
  );
}
