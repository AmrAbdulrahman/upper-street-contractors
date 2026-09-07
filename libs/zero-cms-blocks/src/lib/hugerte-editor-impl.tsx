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
import 'hugerte/plugins/image';

import { Editor } from '@hugerte/hugerte-react';
import type { Editor as HugeRTEEditor } from 'hugerte';
import { useMemo, useState } from 'react';
import { blocksToHtml, htmlToBlocks } from './blocks-html';
import type { BlocksContent } from './types';

// Everything the `blocks` model can hold, and nothing else. Tables, text
// alignment and font colour are deliberately absent: there is no block or mark
// to store them in, so `htmlToBlocks` would strip them on save and the editor
// would warn about content the toolbar itself had just inserted.
const TOOLBAR =
  'blocks | bold italic underline strikethrough inlinecode | bullist numlist | link image | removeformat';

const INIT = {
  menubar: false,
  statusbar: false,
  branding: false,
  height: 320,
  plugins: 'lists link image',
  toolbar: TOOLBAR,
  // Blockquote and Preformatted are block FORMATS, not plugins — the renderer
  // has always had `quote` and `code` cases; only the way in was missing.
  block_formats:
    'Paragraph=p;Heading 1=h1;Heading 2=h2;Heading 3=h3;Heading 4=h4;Heading 5=h5;Heading 6=h6;Quote=blockquote;Preformatted=pre',
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
  uploadImage,
}: {
  value: BlocksContent;
  onChange: (value: BlocksContent) => void;
  uploadImage?: (file: File) => Promise<{ url: string; alt?: string }>;
}) {
  // Seed once from the incoming blocks (the editor is remounted per entry, so a
  // mount-time seed is enough — see EntryEditor `key`).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const seededHtml = useMemo(() => blocksToHtml(value ?? []), []);
  const [html, setHtml] = useState(seededHtml);
  // `dirty` gates the drop warning and guards the editor's init fire: an untouched
  // field must not be clobbered by a load-time blocks→HTML→blocks round-trip.
  const [dirty, setDirty] = useState(false);

  /**
   * The image half of the config, added only when a host can actually store a
   * file. Without an uploader the button would open a dialog whose Upload tab
   * silently fails, and a base64 `src` typed into the URL box would be written
   * into the entry as a megabyte of data URI.
   *
   * `automatic_uploads` is what routes a paste or a drag through the same
   * handler as the dialog, so every route ends at `putMedia` and none of them
   * leaves a `blob:` URL — which resolves to nothing at all once the tab that
   * created it is gone.
   */
  const init = useMemo(() => {
    if (!uploadImage) return { ...INIT, toolbar: TOOLBAR.replace(' image', ''), plugins: 'lists link' };
    return {
      ...INIT,
      automatic_uploads: true,
      file_picker_types: 'image',
      images_file_types: 'jpeg,jpg,png,gif,webp,avif,svg',
      images_upload_handler: async (blobInfo: { blob: () => Blob; filename: () => string }) => {
        const blob = blobInfo.blob();
        const file = new File([blob], blobInfo.filename(), {
          type: blob.type || 'image/png',
        });
        const { url } = await uploadImage(file);
        return url;
      },
      file_picker_callback: (
        callback: (value: string, meta?: Record<string, string>) => void
      ) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.addEventListener('change', () => {
          const file = input.files?.[0];
          if (!file) return;
          void uploadImage(file).then(({ url, alt }) => {
            callback(url, { alt: alt ?? file.name });
          });
        });
        input.click();
      },
    };
  }, [uploadImage]);

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
        init={init}
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
