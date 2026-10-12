import type { ReactNode } from "react";

type GlyphName =
  | "arrow" | "arrow-up" | "fingerprint" | "shield" | "key"
  | "lock" | "sparkle" | "check" | "globe" | "chevron"
  | "clock" | "layers" | "device" | "privacy";

const paths: Record<GlyphName, ReactNode> = {
  arrow: <><path d="M4 12h16" /><path d="m13 5 7 7-7 7" /></>,
  "arrow-up": <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  fingerprint: <><path d="M12 11a2 2 0 0 0-2 2c0 2.5-.3 4.1-1.2 6" /><path d="M14 17.5c-.2 1.6-.5 2.7-1 4" /><path d="M8 8.5a6 6 0 0 1 10 4.5c0 2-.2 4.1-.8 6" /><path d="M5.5 16c.3-1 .5-2.2.5-3a6 6 0 0 1 .4-2.2" /><path d="M4.7 8A9 9 0 0 1 20 10" /><path d="M3.5 12.5c0 1.6-.3 3.1-1 4.8" /></>,
  shield: <><path d="M12 2.5 20 6v5.6c0 5.1-3.1 8.4-8 9.9-4.9-1.5-8-4.8-8-9.9V6l8-3.5Z" /><path d="m8.4 12 2.5 2.5 4.8-5" /></>,
  key: <><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9" /><path d="M16 7l2 2" /><path d="M18 5l2 2" /></>,
  lock: <><rect x="4.5" y="10" width="15" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /><path d="M12 14v3" /></>,
  sparkle: <><path d="m12 2 2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2L12 2Z" /></>,
  check: <path d="m5 12 4 4L19 6" />,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c-5 5-5 13 0 18M12 3c5 5 5 13 0 18" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
  device: <><rect x="5" y="2.5" width="14" height="19" rx="2.5" /><path d="M10 18.5h4" /></>,
  privacy: <><circle cx="12" cy="12" r="9" /><path d="M8 12h8M12 8v8" /></>,
};

export function Glyph({
  name,
  size = 20,
  className = "",
}: {
  name: GlyphName;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}
