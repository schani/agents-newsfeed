export function Photo({ src, aspect = 1.5, fill, alt }: { src: string; aspect?: number; fill?: boolean; alt?: string }) {
  return (
    <div className={fill ? "photo fill" : "photo"} style={fill ? undefined : { aspectRatio: String(aspect) }}>
      <img src={src} alt={alt ?? ""} decoding="async" />
    </div>
  );
}
