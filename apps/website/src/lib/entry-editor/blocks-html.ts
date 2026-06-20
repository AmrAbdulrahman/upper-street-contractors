/**
 * Bounded converters between Strapi `blocks` (JSON) and HTML, scoped to exactly
 * the node/mark set the public renderer (rich-text.tsx) supports plus a small
 * round-trip superset. HugeRTE edits HTML; Strapi stores blocks. `htmlToBlocks`
 * reports any unsupported nodes it drops so the UI can warn before save.
 *
 * Pure + framework-agnostic. `htmlToBlocks` uses DOMParser → call it client-side
 * only (the richtext editor is a client/ssr:false leaf).
 */

type Mark = "bold" | "italic" | "underline" | "strikethrough" | "code";

type TextNode = { type: "text"; text: string } & Partial<Record<Mark, boolean>>;
type LinkNode = { type: "link"; url: string; children: TextNode[] };
type InlineNode = TextNode | LinkNode;
type ListItemNode = { type: "list-item"; children: BlockChild[] };
type ListNode = {
  type: "list";
  format: "ordered" | "unordered";
  children: (ListItemNode | ListNode)[];
};
type BlockChild = InlineNode | ListNode;
export type Block = Record<string, unknown> & { type: string };

const MARK_TAGS: Record<Mark, string> = {
  code: "code",
  strikethrough: "s",
  underline: "u",
  italic: "em",
  bold: "strong",
};
// Innermost → outermost wrapping order.
const MARK_ORDER: Mark[] = ["code", "strikethrough", "underline", "italic", "bold"];

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return escapeText(value).replace(/"/g, "&quot;");
}

// ---------- blocks → HTML ----------

function textNodeToHtml(node: TextNode): string {
  let html = escapeText(node.text ?? "");
  for (const mark of MARK_ORDER) {
    if (node[mark]) {
      const tag = MARK_TAGS[mark];
      html = `<${tag}>${html}</${tag}>`;
    }
  }
  return html;
}

function childrenToHtml(children: unknown): string {
  if (!Array.isArray(children)) return "";
  return children
    .map((child) => {
      const node = child as { type?: string };
      if (node?.type === "link") {
        const link = child as LinkNode;
        return `<a href="${escapeAttr(link.url ?? "")}">${childrenToHtml(
          link.children,
        )}</a>`;
      }
      if (node?.type === "list") {
        return listToHtml(child as ListNode);
      }
      if (node?.type === "list-item") {
        return `<li>${childrenToHtml((child as ListItemNode).children)}</li>`;
      }
      return textNodeToHtml(child as TextNode);
    })
    .join("");
}

function listToHtml(list: ListNode): string {
  const tag = list.format === "ordered" ? "ol" : "ul";
  return `<${tag}>${childrenToHtml(list.children)}</${tag}>`;
}

function blockToHtml(block: Block): string {
  switch (block.type) {
    case "paragraph":
      return `<p>${childrenToHtml(block.children)}</p>`;
    case "heading": {
      const level = Math.min(Math.max(Number(block.level) || 1, 1), 6);
      return `<h${level}>${childrenToHtml(block.children)}</h${level}>`;
    }
    case "list":
      return listToHtml(block as unknown as ListNode);
    case "quote":
      return `<blockquote>${childrenToHtml(block.children)}</blockquote>`;
    case "code":
      return `<pre><code>${childrenToHtml(block.children)}</code></pre>`;
    case "image": {
      const image = (block.image ?? {}) as {
        url?: string;
        alternativeText?: string;
      };
      return `<img src="${escapeAttr(image.url ?? "")}" alt="${escapeAttr(
        image.alternativeText ?? "",
      )}" />`;
    }
    default:
      return "";
  }
}

export function blocksToHtml(blocks: unknown): string {
  if (!Array.isArray(blocks)) return "";
  return blocks.map((block) => blockToHtml(block as Block)).join("");
}

// ---------- HTML → blocks ----------

const PASSTHROUGH_TAGS = new Set(["DIV", "SECTION", "ARTICLE", "BODY", "MAIN", "SPAN"]);

type Marks = Partial<Record<Mark, boolean>>;

function inlineFromNode(node: Node, marks: Marks, dropped: Set<string>): InlineNode[] {
  const result: InlineNode[] = [];

  node.childNodes.forEach((child) => {
    if (child.nodeType === 3 /* text */) {
      const text = child.textContent ?? "";
      if (text.length > 0) {
        result.push({ type: "text", text, ...marks });
      }
      return;
    }
    if (child.nodeType !== 1 /* element */) return;

    const el = child as Element;
    const tag = el.tagName;

    switch (tag) {
      case "STRONG":
      case "B":
        result.push(...inlineFromNode(el, { ...marks, bold: true }, dropped));
        return;
      case "EM":
      case "I":
        result.push(...inlineFromNode(el, { ...marks, italic: true }, dropped));
        return;
      case "S":
      case "DEL":
      case "STRIKE":
        result.push(
          ...inlineFromNode(el, { ...marks, strikethrough: true }, dropped),
        );
        return;
      case "U":
        result.push(...inlineFromNode(el, { ...marks, underline: true }, dropped));
        return;
      case "CODE":
        result.push(...inlineFromNode(el, { ...marks, code: true }, dropped));
        return;
      case "SPAN":
        result.push(...inlineFromNode(el, marks, dropped));
        return;
      case "BR":
        result.push({ type: "text", text: "\n", ...marks });
        return;
      case "A": {
        const url = el.getAttribute("href") ?? "";
        const children = inlineFromNode(el, marks, dropped).filter(
          (n): n is TextNode => n.type === "text",
        );
        result.push({
          type: "link",
          url,
          children: children.length ? children : [{ type: "text", text: "" }],
        });
        return;
      }
      default:
        // Unknown inline element: record it, but keep any text it wraps.
        dropped.add(tag.toLowerCase());
        result.push(...inlineFromNode(el, marks, dropped));
    }
  });

  return result;
}

function inlineChildren(el: Element, dropped: Set<string>): InlineNode[] {
  const nodes = inlineFromNode(el, {}, dropped);
  return nodes.length ? nodes : [{ type: "text", text: "" }];
}

function listItemFrom(li: Element, dropped: Set<string>): ListItemNode {
  const inline: InlineNode[] = [];
  const nested: ListNode[] = [];

  li.childNodes.forEach((child) => {
    if (child.nodeType === 1) {
      const el = child as Element;
      if (el.tagName === "UL" || el.tagName === "OL") {
        nested.push(listFrom(el, dropped));
        return;
      }
    }
    inline.push(...inlineFromNode(child as Node, {}, dropped));
  });

  const children: BlockChild[] = inline.length
    ? [...inline, ...nested]
    : nested.length
      ? nested
      : [{ type: "text", text: "" }];
  return { type: "list-item", children };
}

function listFrom(el: Element, dropped: Set<string>): ListNode {
  const format = el.tagName === "OL" ? "ordered" : "unordered";
  const children: ListItemNode[] = [];
  el.childNodes.forEach((child) => {
    if (child.nodeType === 1 && (child as Element).tagName === "LI") {
      children.push(listItemFrom(child as Element, dropped));
    }
  });
  return { type: "list", format, children };
}

function collectBlocks(node: Node, blocks: Block[], dropped: Set<string>): void {
  node.childNodes.forEach((child) => {
    if (child.nodeType === 3) {
      const text = (child.textContent ?? "").trim();
      if (text.length > 0) {
        blocks.push({ type: "paragraph", children: [{ type: "text", text }] });
      }
      return;
    }
    if (child.nodeType !== 1) return;

    const el = child as Element;
    const tag = el.tagName;

    if (tag === "P") {
      blocks.push({ type: "paragraph", children: inlineChildren(el, dropped) });
    } else if (/^H[1-6]$/.test(tag)) {
      blocks.push({
        type: "heading",
        level: Number(tag[1]),
        children: inlineChildren(el, dropped),
      });
    } else if (tag === "UL" || tag === "OL") {
      blocks.push(listFrom(el, dropped) as unknown as Block);
    } else if (tag === "BLOCKQUOTE") {
      blocks.push({ type: "quote", children: inlineChildren(el, dropped) });
    } else if (tag === "PRE") {
      blocks.push({
        type: "code",
        children: [{ type: "text", text: el.textContent ?? "" }],
      });
    } else if (PASSTHROUGH_TAGS.has(tag)) {
      collectBlocks(el, blocks, dropped);
    } else if (tag === "BR") {
      // ignore stray top-level breaks
    } else {
      dropped.add(tag.toLowerCase());
    }
  });
}

export function htmlToBlocks(html: string): { blocks: Block[]; dropped: string[] } {
  if (typeof DOMParser === "undefined") {
    throw new Error("htmlToBlocks must run in the browser (DOMParser unavailable)");
  }
  const doc = new DOMParser().parseFromString(html ?? "", "text/html");
  const dropped = new Set<string>();
  const blocks: Block[] = [];
  collectBlocks(doc.body, blocks, dropped);

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph", children: [{ type: "text", text: "" }] });
  }
  return { blocks, dropped: [...dropped] };
}
