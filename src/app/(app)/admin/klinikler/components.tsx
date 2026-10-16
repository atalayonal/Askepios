import type { Dictionary } from "@/i18n/dictionaries";

export function ClinicFields({
  t,
  defaults,
}: {
  t: Dictionary;
  defaults?: { name: string; code: string; contact_email: string | null; contact_phone: string | null };
}) {
  return (
    <>
      <label className="block">
        <span className="text-sm font-medium">{t.admin.clinicName}</span>
        <input name="name" required defaultValue={defaults?.name} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.admin.clinicCode}</span>
        <input
          name="code"
          defaultValue={defaults?.code}
          maxLength={10}
          pattern="[A-Za-z0-9]{2,10}"
          placeholder={defaults ? undefined : "LERRA"}
          className="input mt-1 uppercase"
        />
        <span className="mt-1 block text-xs text-muted">{defaults ? t.admin.clinicCodeEditHint : t.admin.clinicCodeHint}</span>
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.admin.contactEmail}</span>
        <input name="contact_email" type="email" defaultValue={defaults?.contact_email ?? ""} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.admin.contactPhone}</span>
        <input name="contact_phone" defaultValue={defaults?.contact_phone ?? ""} className="input mt-1" />
      </label>
    </>
  );
}

export function StatusBadge({ active, labels }: { active: boolean; labels: { active: string; inactive: string } }) {
  return (
    <span className={`badge ${active ? "bg-sky text-blue" : "bg-background text-muted"}`}>
      {active ? labels.active : labels.inactive}
    </span>
  );
}
