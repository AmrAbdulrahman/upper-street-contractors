'use client';

/**
 * Inspect-mode hover host: wraps a single element and shows a floating cluster of
 * action buttons on hover (portaled to body, kept alive while the pointer moves
 * onto it). Ported from the website's Strapi inspect layer, decoupled and
 * neutral-themed for the widget library.
 *
 * The cluster used to be a single hardcoded pencil. It takes an `actions` list
 * now because a section inside the Section builder needs a drag handle and a
 * remove button on the SAME anchor — a second floating overlay would fight the
 * first for the same corner, and both would fight the hover-keepalive logic.
 */

import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';

export function mergeClassNames(
  ...classes: (string | undefined | false)[]
): string {
  return classes.filter(Boolean).join(' ');
}

export const editButtonClassName = [
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-md',
  'border border-white/20 bg-neutral-900/90 text-white shadow-md backdrop-blur-sm',
  'transition-colors hover:bg-neutral-900',
].join(' ');

const EDIT_ATTR = 'data-zero-cms-inspect-edit';

/** One button in the floating cluster. */
export interface InspectAction {
  /** React key + a stable hook for tests. */
  key: string;
  /** `aria-label` and tooltip — the button is icon-only. */
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  /** A drag handle's ref (e.g. dnd-kit's `handleRef`). */
  ref?: Ref<HTMLButtonElement>;
  /** Grab cursor + `touch-none`, for a drag handle rather than a click target. */
  grab?: boolean;
  /** Tints the button red — for destructive actions. */
  danger?: boolean;
}

export function PencilIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10"
      />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
      />
    </svg>
  );
}

export function DuplicateIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M16.5 8.25V6a2.25 2.25 0 0 0-2.25-2.25H6A2.25 2.25 0 0 0 3.75 6v8.25A2.25 2.25 0 0 0 6 16.5h2.25m0-6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 10.5V18A2.25 2.25 0 0 1 18 20.25h-7.5A2.25 2.25 0 0 1 8.25 18v-7.5Z"
      />
    </svg>
  );
}

/**
 * Save as template. A bookmark rather than a star: a star reads as "favourite"
 * — a mark you toggle on the thing itself — and this creates a separate Entry.
 */
export function TemplateIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0 1 11.186 0Z"
      />
    </svg>
  );
}

export function GrabIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {[8, 12, 16].map((y) =>
        [9, 15].map((x) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" />)
      )}
    </svg>
  );
}

type InspectableChild = ReactElement<{
  className?: string;
  children?: ReactNode;
  onPointerEnter?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
  ref?: Ref<HTMLElement>;
}>;

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (!ref) return;
  if (typeof ref === 'function') ref(node);
  else (ref as { current: T | null }).current = node;
}

function isMovingToEditControl(relatedTarget: EventTarget | null): boolean {
  return (
    relatedTarget instanceof Element &&
    relatedTarget.closest(`[${EDIT_ATTR}]`) !== null
  );
}

function isPointerOverTarget(x: number, y: number, host: HTMLElement): boolean {
  const target = document.elementFromPoint(x, y);
  if (!target) return false;
  return host.contains(target) || target.closest(`[${EDIT_ATTR}]`) !== null;
}

function useClearHoverOnPointerExit(
  hovered: boolean,
  hostNode: HTMLElement | null,
  setHovered: (hovered: boolean) => void
) {
  useLayoutEffect(() => {
    if (!hovered || !hostNode) return;
    const clearIfOutside = (e: PointerEvent) => {
      if (!isPointerOverTarget(e.clientX, e.clientY, hostNode)) setHovered(false);
    };
    const clearOnBlur = () => setHovered(false);
    document.addEventListener('pointermove', clearIfOutside, true);
    window.addEventListener('blur', clearOnBlur);
    return () => {
      document.removeEventListener('pointermove', clearIfOutside, true);
      window.removeEventListener('blur', clearOnBlur);
    };
  }, [hovered, hostNode, setHovered]);
}

function ActionCluster({
  anchor,
  actions,
  onDismiss,
}: {
  anchor: HTMLElement;
  actions: InspectAction[];
  onDismiss: () => void;
}) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        top: rect.top + 8,
        // Right-anchored rather than `left: rect.right - width`, so the cluster
        // doesn't need to know its own width as buttons are added/removed.
        // clientWidth (not innerWidth) so it never tucks under the scrollbar.
        right: Math.max(8, document.documentElement.clientWidth - rect.right + 8),
        // Below the sticky app header (z-100) + bar (z-1000) so the cluster is
        // clipped by the chrome instead of floating over it when content scrolls
        // under; still above ordinary page content.
        zIndex: 90,
        visibility: 'visible',
      });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [anchor]);

  return createPortal(
    <div
      className="flex items-center gap-1"
      style={style}
      {...{ [EDIT_ATTR]: '' }}
      onPointerLeave={(event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && anchor.contains(related)) return;
        onDismiss();
      }}
    >
      {actions.map((a) => (
        <button
          key={a.key}
          ref={a.ref}
          type="button"
          aria-label={a.label}
          title={a.label}
          className={mergeClassNames(
            editButtonClassName,
            a.grab && 'cursor-grab touch-none active:cursor-grabbing',
            a.danger && 'hover:bg-red-600'
          )}
          onClick={
            a.onClick &&
            ((event) => {
              event.stopPropagation();
              a.onClick?.();
            })
          }
        >
          {a.icon}
        </button>
      ))}
    </div>,
    document.body
  );
}

export interface InspectHostShared {
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  /**
   * The floating buttons to show on hover, left-to-right. Callers build the
   * whole list so a section can order them drag / edit / remove.
   */
  actions: InspectAction[];
}

/** Clones a single host element, attaching hover handlers + the floating button. */
function InspectClone({
  child,
  inspectClassName,
  hovered,
  setHovered,
  actions,
}: InspectHostShared & { child: InspectableChild }) {
  const [hostNode, setHostNode] = useState<HTMLElement | null>(null);
  const { onPointerEnter, onPointerLeave } = child.props;

  const setRef = useCallback(
    (node: HTMLElement | null) => {
      assignRef(child.props.ref, node);
      setHostNode(node);
    },
    [child.props.ref]
  );

  useLayoutEffect(() => {
    if (!hostNode) return;
    const enter = (e: PointerEvent) => {
      onPointerEnter?.(e as unknown as ReactPointerEvent<HTMLElement>);
      setHovered(true);
    };
    const leave = (e: PointerEvent) => {
      onPointerLeave?.(e as unknown as ReactPointerEvent<HTMLElement>);
      if (isMovingToEditControl(e.relatedTarget)) return;
      setHovered(false);
    };
    hostNode.addEventListener('pointerenter', enter);
    hostNode.addEventListener('pointerleave', leave);
    return () => {
      hostNode.removeEventListener('pointerenter', enter);
      hostNode.removeEventListener('pointerleave', leave);
    };
  }, [hostNode, onPointerEnter, onPointerLeave, setHovered]);

  useClearHoverOnPointerExit(hovered, hostNode, setHovered);

  return (
    <>
      {cloneElement(child, {
        ref: setRef,
        className: mergeClassNames(child.props.className, inspectClassName),
      })}
      {hovered && hostNode ? (
        <ActionCluster
          anchor={hostNode}
          actions={actions}
          onDismiss={() => setHovered(false)}
        />
      ) : null}
    </>
  );
}

/** Wraps children in a `<div>`/`<span>` host with the hover edit affordance. */
export function InspectHost({
  children,
  className,
  inspectClassName,
  hovered,
  setHovered,
  actions,
  as: Tag = 'div',
}: InspectHostShared & {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'span';
}) {
  const [hostNode, setHostNode] = useState<HTMLElement | null>(null);
  useClearHoverOnPointerExit(hovered, hostNode, setHovered);
  return (
    <>
      <Tag
        ref={setHostNode}
        className={mergeClassNames(className, inspectClassName)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={(event) => {
          if (isMovingToEditControl(event.relatedTarget)) return;
          setHovered(false);
        }}
      >
        {children}
      </Tag>
      {hovered && hostNode ? (
        <ActionCluster
          anchor={hostNode}
          actions={actions}
          onDismiss={() => setHovered(false)}
        />
      ) : null}
    </>
  );
}

/**
 * Prefer cloning a single host element (so the inspect outline lands on the real
 * node); otherwise wrap in a host tag.
 */
export function wrapWithInspect({
  children,
  className,
  as = 'div',
  ...shared
}: InspectHostShared & {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'span';
}): ReactNode {
  if (Children.count(children) === 1 && isValidElement(children)) {
    const child = Children.only(children) as InspectableChild;
    if (typeof child.type === 'string') {
      return <InspectClone child={child} {...shared} />;
    }
  }
  return (
    <InspectHost as={as} className={className} {...shared}>
      {children}
    </InspectHost>
  );
}
