import type { Dictionary } from "@/i18n/dictionaries";

type HotelDefaults = {
  name: string;
  city: string;
  district: string;
  address: string;
  stars: number | null;
  website: string | null;
  description_tr: string;
  description_en: string;
};

export function HotelFields({ t, defaults }: { t: Dictionary; defaults?: HotelDefaults }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium">{t.hotels.name}</span>
        <input name="name" required defaultValue={defaults?.name} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.hotels.city}</span>
        <input name="city" defaultValue={defaults?.city ?? "İstanbul"} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.hotels.district}</span>
        <input name="district" defaultValue={defaults?.district} className="input mt-1" />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium">{t.hotels.address}</span>
        <input name="address" defaultValue={defaults?.address} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.hotels.stars}</span>
        <select name="stars" defaultValue={defaults?.stars ?? ""} className="input mt-1">
          <option value="">-</option>
          {[1, 2, 3, 4, 5].map((s) => (
            <option key={s} value={s}>
              {"★".repeat(s)}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.hotels.website}</span>
        <input name="website" type="url" defaultValue={defaults?.website ?? ""} className="input mt-1" />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium">{t.hotels.descriptionTr}</span>
        <textarea name="description_tr" rows={4} defaultValue={defaults?.description_tr} className="input mt-1" />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium">{t.hotels.descriptionEn}</span>
        <textarea name="description_en" rows={4} defaultValue={defaults?.description_en} className="input mt-1" />
      </label>
    </div>
  );
}

type RoomDefaults = {
  name_tr: string;
  name_en: string;
  description_tr: string;
  description_en: string;
  bed_info: string;
  max_occupancy: number;
};

export function RoomFields({ t, defaults }: { t: Dictionary; defaults?: RoomDefaults }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block">
        <span className="text-sm font-medium">{t.hotels.roomNameTr}</span>
        <input name="name_tr" required defaultValue={defaults?.name_tr ?? "Standart Oda"} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.hotels.roomNameEn}</span>
        <input name="name_en" defaultValue={defaults?.name_en ?? "Standard Room"} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.hotels.maxOccupancy}</span>
        <input name="max_occupancy" type="number" min={1} max={10} defaultValue={defaults?.max_occupancy ?? 3} className="input mt-1" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">{t.hotels.bedInfo}</span>
        <input name="bed_info" defaultValue={defaults?.bed_info} className="input mt-1" />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium">{t.hotels.descriptionTr}</span>
        <textarea name="description_tr" rows={3} defaultValue={defaults?.description_tr} className="input mt-1" />
      </label>
      <label className="block sm:col-span-2">
        <span className="text-sm font-medium">{t.hotels.descriptionEn}</span>
        <textarea name="description_en" rows={3} defaultValue={defaults?.description_en} className="input mt-1" />
      </label>
    </div>
  );
}
