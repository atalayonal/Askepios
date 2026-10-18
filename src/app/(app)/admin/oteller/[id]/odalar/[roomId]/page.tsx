import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getDictionary, getLocale } from "@/i18n/server";
import { withSignedUrls } from "@/lib/images";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { StatusBadge } from "../../../../klinikler/components";
import { RoomFields } from "../../../components";
import { RateEditor } from "../../../rate-editor";
import { ImageManager } from "../../../image-manager";
import { setRoomActive, updateRoomType } from "../../../actions";

export default async function RoomDetailPage({ params }: PageProps<"/admin/oteller/[id]/odalar/[roomId]">) {
  await requireAdmin();
  const { id: hotelId, roomId } = await params;
  const t = await getDictionary();
  const locale = await getLocale();
  const supabase = await createClient();

  const { data: room } = await supabase.from("room_types").select("*, hotels(name)").eq("id", roomId).eq("hotel_id", hotelId).maybeSingle();
  if (!room) notFound();

  const [{ data: rates }, { data: images }, { data: clinics }] = await Promise.all([
    supabase
      .from("room_rates")
      .select("id, occupancy, price, currency, valid_from, valid_to, clinics(name)")
      .eq("room_type_id", roomId)
      .order("valid_from")
      .order("occupancy"),
    supabase.from("hotel_images").select("id, storage_path, sort_order, is_cover").eq("room_type_id", roomId).order("sort_order"),
    supabase.from("clinics").select("id, name").order("name"),
  ]);
  const signed = await withSignedUrls(supabase, images ?? []);
  const hotelName = (room.hotels as unknown as { name: string }).name;
  const occupancies = Array.from({ length: room.max_occupancy }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      <Link href={`/admin/oteller/${hotelId}`} className="back-link">
        ← {hotelName}
      </Link>
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="page-title">{room.name_tr}</h1>
        <StatusBadge active={room.is_active} labels={t.common} />
        <form action={setRoomActive.bind(null, room.id, hotelId, !room.is_active)} className="ml-auto">
          <button type="submit" className="btn-secondary">
            {room.is_active ? t.common.deactivate : t.common.activate}
          </button>
        </form>
      </div>

      <RateEditor roomId={room.id} hotelId={hotelId} occupancies={occupancies} rates={rates ?? []} clinics={clinics ?? []} t={t} />

      <section className="card p-6">
        <h2 className="mb-4 font-semibold">{t.hotels.images}</h2>
        <ImageManager hotelId={hotelId} roomTypeId={room.id} images={signed} t={t.hotels} />
      </section>

      <section className="card max-w-3xl p-6">
        <ActionForm action={updateRoomType.bind(null, room.id, hotelId)} className="space-y-4">
          <>
            <>
              <RoomFields t={t} locale={locale} defaults={room} />
              <SubmitButton className="btn-primary">{t.common.save}</SubmitButton>
            </>
          </>
        </ActionForm>
      </section>
    </div>
  );
}
