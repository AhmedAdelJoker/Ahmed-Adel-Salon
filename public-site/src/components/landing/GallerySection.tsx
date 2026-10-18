/**
 * GallerySection — masonry gallery of owner-uploaded photos.
 *
 * Uses an explicit 12-column grid with `grid-column` spans per tile,
 * matching the mockup: one large tile, then smaller ones around it.
 * Images come from `landingPortfolio` (owner-uploaded). An empty portfolio
 * renders nothing — an empty gallery is better than placeholder faces.
 */

export type Translate = (key: string, vars?: Record<string, unknown>) => string;

export interface GalleryImage {
  id: string | number;
  src: string;
  alt?: string;
  caption?: string;
  /** How many of the 12 grid columns this tile spans. Defaults to 3. */
  span?: number;
}

export interface GallerySectionProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  images: GalleryImage[];
}

export default function GallerySection({
  eyebrow,
  title,
  subtitle,
  images,
}: GallerySectionProps) {
  if (images.length === 0) return null;

  return (
    <section id="gallery" className="mk-section">
      <div className="mk-shell">
        <div className="mk-svc-head">
          <div>
            {eyebrow ? <p className="mk-eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="mk-h2">{title}</h2> : null}
            {subtitle ? <p className="mk-lead">{subtitle}</p> : null}
          </div>
        </div>

        <div className="mk-gallery-grid">
          {images.map((img, idx) => {
            const span = idx === 0 ? 7 : idx <= 2 ? 5 : img.span ?? 3;
            return (
              <figure
                key={String(img.id)}
                className={`mk-work mk-work-span-${span}`}
              >
                <img
                  src={img.src}
                  alt={img.alt ?? ""}
                  className="h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                {img.caption ? (
                  <span className="mk-work-caption">{img.caption}</span>
                ) : null}
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}