const STYLES: Record<string, string> = {
  PENDING: "bg-amber-soft text-amber-800",
  CONFIRMED: "bg-success-soft text-success",
  REJECTED: "bg-danger-soft text-danger",
  CANCELLED: "bg-background text-muted",
};

const DOTS: Record<string, string> = {
  PENDING: "bg-amber",
  CONFIRMED: "bg-success",
  REJECTED: "bg-danger",
  CANCELLED: "bg-muted",
};

export function ReservationStatus({ status, labels }: { status: string; labels: Record<string, string> }) {
  return (
    <span className={`badge ${STYLES[status] ?? ""}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${DOTS[status] ?? "bg-muted"}`} />
      {labels[status] ?? status}
    </span>
  );
}
