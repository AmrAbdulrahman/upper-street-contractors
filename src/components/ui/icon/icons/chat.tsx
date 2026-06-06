import type { IconSvgProps } from "../types";

export function ChatIcon({ className }: IconSvgProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm3.75 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6.75 7.5h10.5a2.25 2.25 0 0 1 2.25 2.25v5.25a2.25 2.25 0 0 1-2.25 2.25H9.75l-3 2.25v-9.75A2.25 2.25 0 0 1 6.75 7.5Z"
      />
    </svg>
  );
}
