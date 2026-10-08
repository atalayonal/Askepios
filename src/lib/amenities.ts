import type { Locale } from "@/i18n/dictionaries";

// Otel ve oda özellikleri veritabanında bu anahtarlarla tutulur (hotels.amenities, room_types.amenities).
// Yeni bir özellik eklemek için buraya anahtar ve iki dilde etiket eklemek yeterli; simgesi amenity-icon.tsx'te.

export const HOTEL_AMENITIES = {
  wifi: { tr: "Ücretsiz Wi-Fi", en: "Free Wi-Fi" },
  parking: { tr: "Otopark", en: "Parking" },
  airport_shuttle: { tr: "Havalimanı servisi", en: "Airport shuttle" },
  restaurant: { tr: "Restoran", en: "Restaurant" },
  bar: { tr: "Bar", en: "Bar" },
  breakfast: { tr: "Kahvaltı", en: "Breakfast" },
  room_service: { tr: "Oda servisi", en: "Room service" },
  reception_24h: { tr: "24 saat resepsiyon", en: "24-hour front desk" },
  elevator: { tr: "Asansör", en: "Lift" },
  fitness: { tr: "Fitness salonu", en: "Fitness centre" },
  pool: { tr: "Havuz", en: "Swimming pool" },
  spa: { tr: "Spa", en: "Spa" },
  sauna: { tr: "Sauna", en: "Sauna" },
  hammam: { tr: "Hamam", en: "Turkish bath" },
  family_rooms: { tr: "Aile odaları", en: "Family rooms" },
  accessible: { tr: "Engelli erişimi", en: "Accessible" },
  non_smoking: { tr: "Sigara içilmeyen odalar", en: "Non-smoking rooms" },
  laundry: { tr: "Çamaşırhane", en: "Laundry" },
  meeting_rooms: { tr: "Toplantı salonu", en: "Meeting rooms" },
  terrace: { tr: "Teras", en: "Terrace" },
  concierge: { tr: "Konsiyerj", en: "Concierge" },
} as const;

export const ROOM_AMENITIES = {
  private_bathroom: { tr: "Özel banyo", en: "Private bathroom" },
  ac: { tr: "Klima", en: "Air conditioning" },
  heating: { tr: "Isıtma", en: "Heating" },
  wifi: { tr: "Ücretsiz Wi-Fi", en: "Free Wi-Fi" },
  tv: { tr: "Televizyon", en: "TV" },
  minibar: { tr: "Minibar", en: "Minibar" },
  fridge: { tr: "Buzdolabı", en: "Fridge" },
  kettle: { tr: "Su ısıtıcısı", en: "Kettle" },
  coffee_machine: { tr: "Kahve makinesi", en: "Coffee machine" },
  safe: { tr: "Kasa", en: "Safe" },
  hairdryer: { tr: "Saç kurutma makinesi", en: "Hairdryer" },
  shower: { tr: "Duş", en: "Shower" },
  bathtub: { tr: "Küvet", en: "Bathtub" },
  desk: { tr: "Çalışma masası", en: "Desk" },
  wardrobe: { tr: "Gardırop", en: "Wardrobe" },
  phone: { tr: "Telefon", en: "Telephone" },
  soundproof: { tr: "Ses yalıtımı", en: "Soundproofing" },
  city_view: { tr: "Şehir manzarası", en: "City view" },
  slippers: { tr: "Terlik", en: "Slippers" },
} as const;

export type HotelAmenity = keyof typeof HOTEL_AMENITIES;
export type RoomAmenity = keyof typeof ROOM_AMENITIES;

type Labels = Record<string, { tr: string; en: string }>;

/** Bilinen anahtarları tanımlı sırada etiketleriyle döner; bilinmeyenleri atlar. */
export function amenityList(keys: readonly string[] | null | undefined, kind: "hotel" | "room", locale: Locale) {
  const labels: Labels = kind === "hotel" ? HOTEL_AMENITIES : ROOM_AMENITIES;
  const set = new Set(keys ?? []);
  return Object.keys(labels)
    .filter((key) => set.has(key))
    .map((key) => ({ key, label: labels[key][locale] }));
}

/** Formdan gelen değerleri bilinen anahtarlarla sınırlar. */
export function cleanAmenities(values: string[], kind: "hotel" | "room"): string[] {
  const labels: Labels = kind === "hotel" ? HOTEL_AMENITIES : ROOM_AMENITIES;
  return Object.keys(labels).filter((key) => values.includes(key));
}
