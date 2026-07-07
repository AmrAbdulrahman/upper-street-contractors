'use client';

/**
 * Inspect-mode hover host: wraps a single element, shows a floating "edit" pencil
 * on hover (portaled to body, kept alive while the pointer moves onto it), and
 * calls `onEdit` when clicked. Ported from the website's Strapi inspect layer,
 * decoupled and neutral-themed for the widget library.
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
  'transition-colors hover:bg-neutral-900 z-[90]',
].join(' ');

const EDIT_ATTR = 'data-zero-cms-inspect-edit';

function PencilIcon() {
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

function EditButton({
  anchor,
  onEdit,
  editAriaLabel,
  onDismiss,
}: {
  anchor: HTMLElement;
  onEdit: () => void;
  editAriaLabel: string;
  onDismiss: () => void;
}) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: 'hidden' });

  useLayoutEffect(() => {
    const update = () => {
      const rect = anchor.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        top: rect.top + 8,
        left: rect.right - 40,
        // Below the sticky app header (z-100) + bar (z-1000) so the pencil is
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
    <button
      type="button"
      aria-label={editAriaLabel}
      className={editButtonClassName}
      style={style}
      {...{ [EDIT_ATTR]: '' }}
      onPointerLeave={(event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && anchor.contains(related)) return;
        onDismiss();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
    >
      <PencilIcon />
    </button>,
    document.body
  );
}

export interface InspectHostShared {
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  onEdit: () => void;
  editAriaLabel: string;
}

/** Clones a single host element, attaching hover handlers + the floating button. */
function InspectClone({
  child,
  inspectClassName,
  hovered,
  setHovered,
  onEdit,
  editAriaLabel,
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
        <EditButton
          anchor={hostNode}
          onEdit={onEdit}
          editAriaLabel={editAriaLabel}
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
  onEdit,
  editAriaLabel,
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
        <EditButton
          anchor={hostNode}
          onEdit={onEdit}
          editAriaLabel={editAriaLabel}
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
