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

export const strapiEditButtonClassName = [
  "flex h-8 w-8 cursor-pointer items-center justify-center rounded-md",
  "border border-white/20 bg-dark/90 text-white shadow-md backdrop-blur-sm",
  "transition-colors hover:bg-dark",
].join(" ");

const STRAPI_INSPECT_EDIT_ATTR = "data-strapi-inspect-edit";

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
    relatedTarget.closest(`[${STRAPI_INSPECT_EDIT_ATTR}]`) !== null
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
    target.closest(`[${STRAPI_INSPECT_EDIT_ATTR}]`) !== null
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

function StrapiInspectEditButton({
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
      className={strapiEditButtonClassName}
      style={style}
      {...{ [STRAPI_INSPECT_EDIT_ATTR]: "" }}
      onPointerLeave={(event) => {
        const related = event.relatedTarget;
        if (related instanceof Node && anchor.contains(related)) {
          return;
        }
        onDismiss();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
    >
      <PencilIcon className="h-4 w-4" />
    </button>,
    document.body,
  );
}

function StrapiInspectClone({
  child,
  inspectClassName,
  hovered,
  setHovered,
  onEdit,
  editAriaLabel,
}: {
  child: InspectableChild;
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  onEdit: () => void;
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
        <StrapiInspectEditButton
          anchor={hostNode}
          onEdit={onEdit}
          editAriaLabel={editAriaLabel}
          onDismiss={() => setHovered(false)}
        />
      ) : null}
    </>
  );
}

export function StrapiInspectHost({
  children,
  className,
  inspectClassName,
  hovered,
  setHovered,
  onEdit,
  editAriaLabel,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  onEdit: () => void;
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
        <StrapiInspectEditButton
          anchor={hostNode}
          onEdit={onEdit}
          editAriaLabel={editAriaLabel}
          onDismiss={() => setHovered(false)}
        />
      ) : null}
    </>
  );
}

export function cloneWithStrapiInspect({
  children,
  inspectClassName,
  hovered,
  setHovered,
  onEdit,
  editAriaLabel,
}: {
  children: ReactNode;
  /** Merged with the root child's existing `className`. */
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  onEdit: () => void;
  editAriaLabel: string;
}): ReactNode {
  if (Children.count(children) !== 1 || !isValidElement(children)) {
    return children;
  }

  const child = Children.only(children) as InspectableChild;

  return (
    <StrapiInspectClone
      child={child}
      inspectClassName={inspectClassName}
      hovered={hovered}
      setHovered={setHovered}
      onEdit={onEdit}
      editAriaLabel={editAriaLabel}
    />
  );
}

export function wrapWithStrapiInspect({
  children,
  className,
  inspectClassName,
  hovered,
  setHovered,
  onEdit,
  editAriaLabel,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  inspectClassName: string;
  hovered: boolean;
  setHovered: (hovered: boolean) => void;
  onEdit: () => void;
  editAriaLabel: string;
  as?: "div" | "span";
}): ReactNode {
  if (Children.count(children) === 1 && isValidElement(children)) {
    const child = Children.only(children) as InspectableChild;

    if (typeof child.type === "string") {
      return (
        <StrapiInspectClone
          child={child}
          inspectClassName={inspectClassName}
          hovered={hovered}
          setHovered={setHovered}
          onEdit={onEdit}
          editAriaLabel={editAriaLabel}
        />
      );
    }
  }

  return (
    <StrapiInspectHost
      as={as}
      className={className}
      inspectClassName={inspectClassName}
      hovered={hovered}
      setHovered={setHovered}
      onEdit={onEdit}
      editAriaLabel={editAriaLabel}
    >
      {children}
    </StrapiInspectHost>
  );
}
