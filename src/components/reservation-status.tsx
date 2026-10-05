const STYLES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-800",
  CONFIRMED: "bg-teal-50 text-teal-800",
  REJECTED: "bg-rose-50 text-rose-800",
  CANCELLED: "bg-slate-100 text-slate-600",
};

export function ReservationStatus({ status, labels }: { status: string; labels: Record<string, string> }) {
  return <span className={`badge ${STYLES[status] ?? ""}`}>{labels[status] ?? status}</span>;
}
