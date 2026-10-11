import type { ReactNode } from "react";

type IconName =
  | "shield" | "fingerprint" | "key" | "lock" | "arrow" | "chevron"
  | "database" | "layers" | "check" | "download" | "sparkle" | "clock"
  | "globe" | "trash" | "devices";

export function SecurityIcon({
  name,
  className = "h-5 w-5",
}: {
  name: IconName;
  className?: string;
}) {
  const paths: Record<IconName, ReactNode> = {
    shield: <><path d="M12 2.75 20 6v5.7c0 5.15-3.25 8.1-8 9.8-4.75-1.7-8-4.65-8-9.8V6l8-3.25Z" /><path d="m9 12 2 2 4-4" /></>,
    fingerprint: <><path d="M7 11.5a5 5 0 0 1 10 0V15" /><path d="M10 12v3.5a2 2 0 0 0 4 0V12" /><path d="M4.5 12v3.5a7.5 7.5 0 0 0 15 0V12a7.5 7.5 0 0 0-15-1.3" /><path d="M7.5 18.5a5 5 0 0 0 9 0" /></>,
    key: <><circle cx="8" cy="15.5" r="3.5" /><path d="M11.5 15.5H21m-4 0V13m3 2.5V13" /></>,
    lock: <><rect x="4.5" y="10" width="15" height="11" rx="2.5" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6" /></>,
    chevron: <path d="m9 5 7 7-7 7" />,
    database: <><ellipse cx="12" cy="5.5" rx="8" ry="3.5" /><path d="M4 5.5v13c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5v-13M4 12c0 1.93 3.58 3.5 8 3.5s8-1.57 8-3.5" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Zm-9 9 9 5 9-5M3 16l9 5 9-5" /></>,
    check: <path d="m5 12 4.5 4.5L19 7" />,
    download: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
    sparkle: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5L12 2Z" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c-3 2.4-4.5 5.4-4.5 9s1.5 6.6 4.5 9c3-2.4 4.5-5.4 4.5-9S15 5.4 12 3Z" /></>,
    trash: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7M10 11v6m4-6v6" /></>,
    devices: <><rect x="3" y="4" width="15" height="12" rx="2" /><path d="M8 20h10m-5-4v4m7-10h1v10h-5" /></>,
  };
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}
