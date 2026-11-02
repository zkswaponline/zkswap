import { Eyebrow, PixelLink } from "@/components/ui/kit";

export default function NotFound() {
  return (
    <section className="sec" style={{ paddingTop: 200, paddingBottom: 180 }}>
      <div className="col2">
        <Eyebrow>404</Eyebrow>
        <h1 className="h-page">No route to this page</h1>
        <p className="lede">The address does not lead anywhere on this site.</p>
        <PixelLink href="/" className="mt-8">
          Back home
        </PixelLink>
      </div>
    </section>
  );
}
