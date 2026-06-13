"use client";

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
} from "react";
import { createPortal } from "react-dom";
import { PencilIcon } from "./pencil-icon";

export function mergeClassNames(...classes: (string | undefined | false)[]): string {
  return classes.filter(Boolean).join(" ");
}

export const contentfulEditButtonClassName = [
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md",
  "border border-white/20 bg-dark/90 text-white shadow-md backdrop-blur-sm",
  "transition-colors hover:bg-dark",
].join(" ");

const CONTENTFUL_INSPECT_EDIT_ATTR = "data-contentful-inspect-edit";

type InspectableChild = ReactElement<{
  className?: string;
  children?: ReactNode;
  onPointerEnter?: (event: ReactPointerEvent<HTMLElement>) => void;
  onPointerLeave?: (event: ReactPointerEvent<HTMLElement>) => void;
  ref?: Ref<HTMLElement>;
}>;

function assignRef<T>(ref: Ref<T> | undefined, node: T | null) {
  if (!ref) return;

  if (typeof ref === "function") {
    ref(node);
  } else {
    ref.current = node;
  }
}

function isMovingToInspectEditControl(relatedTarget: EventTarget | null): boolean {
  return (
    relatedTarget instanceof Element &&
    relatedTarget.closest(`[${CONTENTFUL_INSPECT_EDIT_ATTR}]`) !== null
  );
}

function isPointerOverInspectTarget(
  clientX: number,
  clientY: number,
  host: HTMLElement,
): boolean {
  const target = document.elementFromPoint(clientX, clientY);
  if (!target) {
    return false;
  }

  return (
    host.contains(target) ||
    target.closest(`[${CONTENTFUL_INSPECT_EDIT_ATTR}]`) !== null
  );
}

function useClearInspectHoverOnPointerExit(
  hovered: boolean,
  hostNode: HTMLElement | null,
  setHovered: (hovered: boolean) => void,
) {
  useLayoutEffect(() => {
    if (!hovered || !hostNode) {
      return;
    }

    const clearIfOutside = (event: PointerEvent) => {
      if (!isPointerOverInspectTarget(event.clientX, event.clientY, hostNode)) {
        setHovered(false);
      }
    };

    const clearOnWindowBlur = () => {
      setHovered(false);
    };

    document.addEventListener("pointermove", clearIfOutside, true);
    window.addEventListener("blur", clearOnWindowBlur);

    return () => {
      document.removeEventListener("pointermove", clearIfOutside, true);
      window.removeEventListener("blur", clearOnWindowBlur);
    };
  }, [hovered, hostNode, setHovered]);
}

function ContentfulInspectEditButton({
  anchor,
  editUrl,
  editAriaLabel,
  onDismiss,
}: {
  anchor: HTMLElement;
  editUrl: string;
  editAriaLabel: string;
  onDismiss: () => void;
}) {
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    const updatePosition = () => {
      const rect = anchor.getBoundingClientRect();
      setStyle({
        position: "fixed",
        top: rect.top + 8,
        left: rect.right - 40,
        zIndex: 50,
        visibility: "visible",
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);

    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [anchor]);

  return createPortal(
    <button
      type="button"
      aria-label={editAriaLabel}
      className={contentfulEditButtonClassName}
      style={style}
      {...{ [CONTENTFUL_INSPECT_EDIT_ATTR]: "" }}
      onPointerLeave={(event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && anchor.contains(related)) {
          return;
        }
        onDismiss();
      }}
      onClick={(event) => {
        event.stopPropagation();
        window.open(editUrl, "_blank", "noopener,noreferrer");
      }}
    >
      <PencilIcon className="h-4 w-4" />
    </button>,
    document.body,
  );
}

function ContentfulInspectClone({
  child,
  inspectClassName,
  hovered,
  setHovered,
  editUrl,
  editAriaLabel,
}: {
  child: InspectableChild;
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  editUrl: string;
  editAriaLabel: string;
}) {
  const [hostNode, setHostNode] = useState<HTMLElement | null>(null);
  const { onPointerEnter, onPointerLeave } = child.props;

  const setInspectHostRef = useCallback(
    (node: HTMLElement | null) => {
      assignRef(child.props.ref, node);
      setHostNode(node);
    },
    [child.props.ref],
  );

  useLayoutEffect(() => {
    if (!hostNode) {
      return;
    }

    const handlePointerEnter = (event: PointerEvent) => {
      onPointerEnter?.(event as unknown as ReactPointerEvent<HTMLElement>);
      setHovered(true);
    };

    const handlePointerLeave = (event: PointerEvent) => {
      onPointerLeave?.(event as unknown as ReactPointerEvent<HTMLElement>);

      if (isMovingToInspectEditControl(event.relatedTarget)) {
        return;
      }

      setHovered(false);
    };

    hostNode.addEventListener("pointerenter", handlePointerEnter);
    hostNode.addEventListener("pointerleave", handlePointerLeave);

    return () => {
      hostNode.removeEventListener("pointerenter", handlePointerEnter);
      hostNode.removeEventListener("pointerleave", handlePointerLeave);
    };
  }, [hostNode, onPointerEnter, onPointerLeave, setHovered]);

  useClearInspectHoverOnPointerExit(hovered, hostNode, setHovered);

  const mergedClassName = mergeClassNames(child.props.className, inspectClassName);

  return (
    <>
      {cloneElement(child, {
        ref: setInspectHostRef,
        className: mergedClassName,
      })}
      {hovered && hostNode ? (
        <ContentfulInspectEditButton
          anchor={hostNode}
          editUrl={editUrl}
          editAriaLabel={editAriaLabel}
          onDismiss={() => setHovered(false)}
        />
      ) : null}
    </>
  );
}

export function ContentfulInspectHost({
  children,
  className,
  inspectClassName,
  hovered,
  setHovered,
  editUrl,
  editAriaLabel,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  editUrl: string;
  editAriaLabel: string;
  as?: "div" | "span";
}) {
  const [hostNode, setHostNode] = useState<HTMLElement | null>(null);

  useClearInspectHoverOnPointerExit(hovered, hostNode, setHovered);

  return (
    <>
      <Tag
        ref={setHostNode}
        className={mergeClassNames(className, inspectClassName)}
        onPointerEnter={() => setHovered(true)}
        onPointerLeave={(event) => {
          if (isMovingToInspectEditControl(event.relatedTarget)) {
            return;
          }

          setHovered(false);
        }}
      >
        {children}
      </Tag>
      {hovered && hostNode ? (
        <ContentfulInspectEditButton
          anchor={hostNode}
          editUrl={editUrl}
          editAriaLabel={editAriaLabel}
          onDismiss={() => setHovered(false)}
        />
      ) : null}
    </>
  );
}

export function cloneWithContentfulInspect({
  children,
  inspectClassName,
  hovered,
  setHovered,
  editUrl,
  editAriaLabel,
}: {
  children: ReactNode;
  /** Merged with the root child's existing `className`. */
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  editUrl: string;
  editAriaLabel: string;
}): ReactNode {
  if (Children.count(children) !== 1 || !isValidElement(children)) {
    return children;
  }

  const child = Children.only(children) as InspectableChild;

  return (
    <ContentfulInspectClone
      child={child}
      inspectClassName={inspectClassName}
      hovered={hovered}
      setHovered={setHovered}
      editUrl={editUrl}
      editAriaLabel={editAriaLabel}
    />
  );
}

export function wrapWithContentfulInspect({
  children,
  className,
  inspectClassName,
  hovered,
  setHovered,
  editUrl,
  editAriaLabel,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  editUrl: string;
  editAriaLabel: string;
  as?: "div" | "span";
}): ReactNode {
  if (Children.count(children) === 1 && isValidElement(children)) {
    const child = Children.only(children) as InspectableChild;

    if (typeof child.type === "string") {
      return (
        <ContentfulInspectClone
          child={child}
          inspectClassName={inspectClassName}
          hovered={hovered}
          setHovered={setHovered}
          editUrl={editUrl}
          editAriaLabel={editAriaLabel}
        />
      );
    }
  }

  return (
    <ContentfulInspectHost
      as={as}
      className={className}
      inspectClassName={inspectClassName}
      hovered={hovered}
      setHovered={setHovered}
      editUrl={editUrl}
      editAriaLabel={editAriaLabel}
    >
      {children}
    </ContentfulInspectHost>
  );
}
