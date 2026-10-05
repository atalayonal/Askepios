import { requireClinicUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/server";

export default async function ClinicDashboard() {
  const user = await requireClinicUser();
  const t = await getDictionary();

  return (
    <div>
      <h1 className="text-xl font-semibold">{t.clinic.dashboardTitle}</h1>
      <p className="mt-1 text-sm text-slate-600">{user.clinicName}</p>
      <div className="card mt-6 p-6 text-sm text-slate-600">{t.clinic.comingSoon}</div>
    </div>
  );
}
