import Link from "next/link";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Privacy Auth — home">
      <span className="brand-icon" aria-hidden="true">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M12 2.75 20 6v5.6c0 5.05-3.1 8.5-8 10-4.9-1.5-8-4.95-8-10V6l8-3.25Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
          <path d="m8.4 12 2.5 2.5 4.8-5.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="brand-name">privacy<span>auth</span>{!compact && <span className="brand-period">.</span>}</span>
    </Link>
  );
}
