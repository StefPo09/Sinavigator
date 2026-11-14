import Link from "next/link";
import { surfaceHref, type LandingSite } from "./landingSites";

const siteDetails = {
  "Shackleton Rim": ["South polar region · candidate site", "A crater rim at the Moon’s south pole, studied for its long sunlight."],
  "Malapert Massif": ["South polar region · candidate site", "A mountainous area near the Moon’s south pole."],
  "Chandrayaan-3": ["Southern highlands · landing site", "Explore the site of the Chandrayaan-3 lunar landing."],
  "Apollo 11": ["Sea of Tranquility · landing site", "Explore the site of the first crewed Moon landing."],
  "Apollo 17": ["Taurus–Littrow · landing site", "Explore the valley where the Apollo 17 crew landed."],
};

export function LandingSitePanel({ site }: { site: LandingSite }) {
  const [region, description] = siteDetails[site];

  return (
    <aside className="info-card">
      <p className="eyebrow text-accent">Selected landing site</p>
      <h2 className="mt-3 text-[clamp(1.6rem,2.5vw,2.8rem)] leading-tight">{site}</h2>
      <p className="mt-2 text-sm text-muted">{region}</p>
      <p className="mt-4 text-sm text-muted">{description}</p>
      <section className="mt-5 border-t border-line pt-4">
        <h3 className="text-lg">Sun &amp; Earth here</h3>
        <p className="mt-1 text-sm text-muted">Illustrative values for the preview.</p>
        <dl className="mt-4 space-y-4 text-sm">
          {[["Sun elevation", "0.9°"], ["Earth elevation", "3.2°"], ["Earthset in", "4 h 12 min"]].map(([label, value]) => (
            <div key={label}>
              <dt className="text-muted">{label}</dt>
              <dd className="info-field text-base">{value}</dd>
            </div>
          ))}
        </dl>
      </section>
      <Link href={surfaceHref(site)} className="ui-button ui-button-primary mt-5 w-full">View from surface</Link>
    </aside>
  );
}
