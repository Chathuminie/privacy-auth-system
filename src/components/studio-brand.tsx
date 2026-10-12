import Link from "next/link";

export function StudioBrand() {
  return (
    <Link className="pa-brand" href="/" aria-label="Privacy Auth home">
      <span className="pa-brand-mark" aria-hidden="true">p/a</span>
      <span className="pa-brand-name">privacy<span>auth.</span></span>
    </Link>
  );
}
