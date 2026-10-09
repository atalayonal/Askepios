import { Star } from "lucide-react";

export function Stars({ count }: { count: number | null }) {
  if (!count) return null;
  return (
    <span className="flex items-center" role="img" aria-label={`${count}/5`}>
      {Array.from({ length: count }, (_, i) => (
        <Star key={i} aria-hidden className="h-3.5 w-3.5 fill-amber text-amber" />
      ))}
    </span>
  );
}
