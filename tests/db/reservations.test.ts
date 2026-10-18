import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase, createUser, insertReturningId } from "./helpers";

let db: Client;
let drop: () => Promise<void>;

const ids = {} as Record<
  "clinicA" | "clinicB" | "admin" | "userA" | "userB" | "partnered" | "other" | "room" | "otherRoom",
  string
>;

const guest = (name = "Ayşe Yılmaz", extra: Record<string, string> = {}) => ({
  full_name: name,
  nationality: "TR",
  id_number: "10000000146",
  birth_date: "1985-04-12",
  gender: "F",
  phone: "+90 555 000 00 00",
  ...extra,
});

async function request(userId: string, roomId: string, checkIn: string, checkOut: string, guests = [guest()]) {
  return asUser(db, userId, async () => {
    const { rows } = await db.query("select public.create_reservation_request($1, $2, $3, $4, p_consent => true) as id", [
      roomId,
      checkIn,
      checkOut,
      JSON.stringify(guests),
    ]);
    return rows[0].id as string;
  });
}

beforeAll(async () => {
  ({ db, drop } = await createTestDatabase());

  ids.clinicA = await insertReturningId(db, "insert into clinics (name) values ('Klinik A') returning id");
  ids.clinicB = await insertReturningId(db, "insert into clinics (name) values ('Klinik B') returning id");
  ids.admin = await createUser(db, "admin@askepios.test", "admin");
  ids.userA = await createUser(db, "a@klinik.test", "clinic_user", ids.clinicA);
  ids.userB = await createUser(db, "b@klinik.test", "clinic_user", ids.clinicB);

  ids.partnered = await insertReturningId(db, "insert into hotels (name, city) values ('Otel X', 'İstanbul') returning id");
  ids.other = await insertReturningId(db, "insert into hotels (name, city) values ('Otel Z', 'İstanbul') returning id");
  await db.query("insert into hotel_contacts (hotel_id, phone) values ($1, '+90 212 000 00 00')", [ids.partnered]);

  ids.room = await insertReturningId(db, "insert into room_types (hotel_id, name_tr, max_occupancy) values ($1, 'Standart Oda', 3) returning id", [ids.partnered]);
  ids.otherRoom = await insertReturningId(db, "insert into room_types (hotel_id, name_tr) values ($1, 'Standart Oda') returning id", [ids.other]);

  // Klinik A sadece Otel X ile anlaşmalı. Klinik B her iki otelle anlaşmalı.
  await db.query("insert into clinic_hotel_access (clinic_id, hotel_id) values ($1, $2), ($3, $2), ($3, $4)", [
    ids.clinicA,
    ids.partnered,
    ids.clinicB,
    ids.other,
  ]);

  // Genel fiyatlar: Ekim 100/120/150, Kasım 110 (single). Klinik B'ye özel single fiyatı Ekim'de 90.
  await db.query(
    `insert into room_rates (room_type_id, clinic_id, occupancy, price, valid_from, valid_to) values
      ($1, null, 1, 100, '2030-10-01', '2030-10-31'),
      ($1, null, 2, 120, '2030-10-01', '2030-10-31'),
      ($1, null, 3, 150, '2030-10-01', '2030-10-31'),
      ($1, null, 1, 110, '2030-11-01', '2030-11-30'),
      ($1, $2, 1, 90, '2030-10-01', '2030-10-31'),
      ($3, null, 1, 70, '2030-10-01', '2030-10-31')`,
    [ids.room, ids.clinicB, ids.otherRoom],
  );

  // 15 Ekim gecesi kapalı.
  await db.query("insert into room_closures (room_type_id, date_from, date_to) values ($1, '2030-10-15', '2030-10-15')", [ids.room]);
});

afterAll(async () => {
  await drop?.();
});

describe("müsaitlik kontrolü", () => {
  it("aralıktaki tek bir kapalı gece bile talebi engeller", async () => {
    await expect(request(ids.userA, ids.room, "2030-10-14", "2030-10-17")).rejects.toThrow("room_unavailable");
  });

  it("çıkış günü gece sayılmaz: 15 Ekim çıkışlı konaklama kabul edilir", async () => {
    await expect(request(ids.userA, ids.room, "2030-10-13", "2030-10-15")).resolves.toBeTruthy();
  });

  it("kapalı gecenin ertesinden başlayan konaklama kabul edilir", async () => {
    await expect(request(ids.userA, ids.room, "2030-10-16", "2030-10-18")).resolves.toBeTruthy();
  });

  it("aynı tarihe ikinci talep de kabul edilir (admin karar verir)", async () => {
    await expect(request(ids.userA, ids.room, "2030-10-16", "2030-10-18")).resolves.toBeTruthy();
  });
});

describe("tarih ve misafir doğrulaması", () => {
  it("çıkış girişten önce olamaz", async () => {
    await expect(request(ids.userA, ids.room, "2030-10-20", "2030-10-20")).rejects.toThrow("invalid_dates");
  });

  it("geçmiş tarihe talep oluşturulamaz", async () => {
    await expect(request(ids.userA, ids.room, "2020-10-20", "2020-10-21")).rejects.toThrow("check_in_in_past");
  });

  it("oda kapasitesinden fazla misafir kabul edilmez", async () => {
    const guests = [guest("A"), guest("B"), guest("C"), guest("D")];
    await expect(request(ids.userA, ids.room, "2030-10-20", "2030-10-21", guests)).rejects.toThrow("invalid_guest_count");
  });

  it("misafir adı zorunludur", async () => {
    await expect(request(ids.userA, ids.room, "2030-10-20", "2030-10-21", [guest(" ")])).rejects.toThrow("guest_name_required");
  });
});

describe("misafir kimlik bilgileri", () => {
  const tryGuest = (extra: Record<string, string>) =>
    request(ids.userA, ids.room, "2030-10-25", "2030-10-26", [guest("Test Kişi", extra)]).then(
      () => "ok",
      (e: Error) => e.message,
    );

  it("T.C. vatandaşı için geçerli T.C. Kimlik No ister", async () => {
    expect(await tryGuest({ id_number: "" })).toBe("guest_id_required");
    expect(await tryGuest({ id_number: "12345678901" })).toBe("invalid_tckn");
    expect(await tryGuest({ id_number: "1000000014" })).toBe("invalid_tckn");
  });

  it("yabancı misafir için pasaport no ister; uyruk, doğum tarihi ve cinsiyet zorunlu", async () => {
    expect(await tryGuest({ nationality: "", id_number: "U1234567" })).toBe("guest_nationality_required");
    expect(await tryGuest({ nationality: "DE", id_number: "12-3" })).toBe("invalid_passport");
    expect(await tryGuest({ nationality: "DE", id_number: "C01X00T47", birth_date: "" })).toBe("invalid_birth_date");
    expect(await tryGuest({ nationality: "DE", id_number: "C01X00T47", birth_date: "2999-01-01" })).toBe("invalid_birth_date");
    expect(await tryGuest({ nationality: "DE", id_number: "C01X00T47", gender: "" })).toBe("guest_gender_required");
  });

  it("geçerli bilgiler kaydedilir; pasaport no büyük harfe çevrilir", async () => {
    expect(await tryGuest({ nationality: "de", id_number: "c01x 00t47" })).toBe("ok");
    const { rows } = await db.query(
      "select nationality, id_number, birth_date::text, gender from reservation_guests where full_name = 'Test Kişi'",
    );
    expect(rows[0]).toEqual({ nationality: "DE", id_number: "C01X00T47", birth_date: "1985-04-12", gender: "F" });
  });
});

describe("fiyat", () => {
  it("misafir sayısına göre fiyatı seçer ve toplamı kaydeder", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-20", "2030-10-22", [guest("A"), guest("B")]);
    const { rows } = await db.query("select total_price, currency, guest_count from reservations where id = $1", [id]);
    expect(rows[0]).toMatchObject({ total_price: "240.00", currency: "EUR", guest_count: 2 });
  });

  it("dönem değişen konaklamada her geceyi kendi fiyatıyla hesaplar", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-30", "2030-11-02");
    const { rows } = await db.query("select total_price, price_breakdown from reservations where id = $1", [id]);
    expect(rows[0].total_price).toBe("310.00");
    expect(rows[0].price_breakdown).toHaveLength(3);
  });

  it("fiyatı tanımlı olmayan gece varsa talep reddedilir", async () => {
    await expect(request(ids.userA, ids.room, "2030-11-29", "2030-12-02")).rejects.toThrow("price_not_available");
  });

  it("kliniğe özel fiyat genel fiyatın önüne geçer", async () => {
    const id = await request(ids.userB, ids.room, "2030-10-20", "2030-10-21");
    const { rows } = await db.query("select total_price from reservations where id = $1", [id]);
    expect(rows[0].total_price).toBe("90.00");
  });

  it("fiyat sonradan değişse de eski rezervasyonun fiyatı değişmez", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-25", "2030-10-26");
    await db.query("update room_rates set price = 999 where room_type_id = $1 and occupancy = 1 and clinic_id is null and valid_from = '2030-10-01'", [ids.room]);
    const { rows } = await db.query("select total_price from reservations where id = $1", [id]);
    expect(rows[0].total_price).toBe("100.00");
    await db.query("update room_rates set price = 100 where room_type_id = $1 and occupancy = 1 and clinic_id is null and valid_from = '2030-10-01'", [ids.room]);
  });
});

describe("anlaşmalı / anlaşmasız otel", () => {
  it("klinik anlaşmasız otelde talep oluşturamaz", async () => {
    await expect(request(ids.userA, ids.otherRoom, "2030-10-20", "2030-10-21")).rejects.toThrow("hotel_not_partnered");
  });

  it("klinik anlaşmasız oteli ve odasını görür ama fiyatını göremez", async () => {
    await asUser(db, ids.userA, async () => {
      const hotels = await db.query("select id from hotels where id = $1", [ids.other]);
      const rooms = await db.query("select id from room_types where id = $1", [ids.otherRoom]);
      const rates = await db.query("select id from room_rates where room_type_id = $1", [ids.otherRoom]);
      expect(hotels.rowCount).toBe(1);
      expect(rooms.rowCount).toBe(1);
      expect(rates.rowCount).toBe(0);
    });
  });

  it("klinik otelin iletişim bilgilerini göremez", async () => {
    await asUser(db, ids.userA, async () => {
      const { rowCount } = await db.query("select * from hotel_contacts");
      expect(rowCount).toBe(0);
    });
  });
});

describe("klinik izolasyonu", () => {
  it("klinik başka kliniğin rezervasyonunu ID ile bile göremez", async () => {
    const idB = await request(ids.userB, ids.room, "2030-10-27", "2030-10-28");
    await asUser(db, ids.userA, async () => {
      for (const table of ["reservations"]) {
        const { rowCount } = await db.query(`select 1 from ${table} where id = $1`, [idB]);
        expect(rowCount).toBe(0);
      }
      const guests = await db.query("select 1 from reservation_guests where reservation_id = $1", [idB]);
      const history = await db.query("select 1 from reservation_status_history where reservation_id = $1", [idB]);
      expect(guests.rowCount).toBe(0);
      expect(history.rowCount).toBe(0);
    });
  });

  it("klinik sadece kendi rezervasyonlarını listeler", async () => {
    await asUser(db, ids.userA, async () => {
      const { rows } = await db.query("select distinct clinic_id from reservations");
      expect(rows).toEqual([{ clinic_id: ids.clinicA }]);
    });
  });

  it("klinik başka kliniği, kullanıcılarını ve özel fiyatlarını göremez", async () => {
    await asUser(db, ids.userA, async () => {
      const clinics = await db.query("select id from clinics");
      const profiles = await db.query("select id from profiles");
      const rates = await db.query("select id from room_rates where clinic_id = $1", [ids.clinicB]);
      expect(clinics.rows).toEqual([{ id: ids.clinicA }]);
      expect(profiles.rows).toEqual([{ id: ids.userA }]);
      expect(rates.rowCount).toBe(0);
    });
  });

  it("klinik doğrudan tabloya rezervasyon yazamaz, fiyatı ve durumu değiştiremez", async () => {
    await expect(
      asUser(db, ids.userA, () =>
        db.query(
          `insert into reservations (clinic_id, created_by, hotel_id, room_type_id, check_in, check_out, guest_count,
             hotel_name, room_name, price_breakdown, total_price, currency, status)
           values ($1, $2, $3, $4, '2030-10-20', '2030-10-21', 1, 'x', 'x', '[]', 0, 'EUR', 'CONFIRMED')`,
          [ids.clinicA, ids.userA, ids.partnered, ids.room],
        ),
      ),
    ).rejects.toThrow(/row-level security/);

    const updated = await asUser(db, ids.userA, () => db.query("update reservations set status = 'CONFIRMED', total_price = 1"));
    expect(updated.rowCount).toBe(0);
  });

  it("klinik fiyat ve müsaitlik verisini değiştiremez", async () => {
    await asUser(db, ids.userA, async () => {
      const rates = await db.query("update room_rates set price = 1");
      const closures = await db.query("delete from room_closures");
      expect(rates.rowCount).toBe(0);
      expect(closures.rowCount).toBe(0);
    });
  });

  it("pasif klinik kullanıcısı talep oluşturamaz ve hiçbir şey göremez", async () => {
    await db.query("update clinics set is_active = false where id = $1", [ids.clinicA]);
    await expect(request(ids.userA, ids.room, "2030-10-20", "2030-10-21")).rejects.toThrow("not_clinic_user");
    await asUser(db, ids.userA, async () => {
      const { rowCount } = await db.query("select 1 from reservations");
      expect(rowCount).toBe(0);
    });
    await db.query("update clinics set is_active = true where id = $1", [ids.clinicA]);
  });
});

describe("durum yönetimi", () => {
  async function changeStatus(userId: string, reservationId: string, status: string, note = "") {
    return asUser(db, userId, () => db.query("select public.change_reservation_status($1, $2, $3)", [reservationId, status, note]));
  }

  it("yeni talep PENDING başlar ve geçmişe yazılır", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-05", "2030-10-06");
    const { rows } = await db.query("select status from reservations where id = $1", [id]);
    const history = await db.query("select from_status, to_status, changed_by from reservation_status_history where reservation_id = $1", [id]);
    expect(rows[0].status).toBe("PENDING");
    expect(history.rows).toEqual([{ from_status: null, to_status: "PENDING", changed_by: ids.userA }]);
  });

  it("admin onaylar; kim, ne zaman ve not geçmişe yazılır", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-06", "2030-10-07");
    await changeStatus(ids.admin, id, "CONFIRMED", "Otel telefonla onayladı");
    const history = await db.query(
      "select from_status, to_status, changed_by, note from reservation_status_history where reservation_id = $1 order by id",
      [id],
    );
    expect(history.rows[1]).toEqual({ from_status: "PENDING", to_status: "CONFIRMED", changed_by: ids.admin, note: "Otel telefonla onayladı" });
  });

  it("klinik durumu değiştiremez", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-07", "2030-10-08");
    await expect(changeStatus(ids.userA, id, "CANCELLED")).rejects.toThrow("not_admin");
  });

  it("izin verilmeyen geçişler reddedilir", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-08", "2030-10-09");
    await changeStatus(ids.admin, id, "REJECTED");
    await expect(changeStatus(ids.admin, id, "CONFIRMED")).rejects.toThrow("invalid_status_transition");
  });

  it("onaylı rezervasyon iptal edilebilir", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-09", "2030-10-10");
    await changeStatus(ids.admin, id, "CONFIRMED");
    await expect(changeStatus(ids.admin, id, "CANCELLED")).resolves.toBeTruthy();
  });

  it("admin iç notları kliniğe görünmez", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-10", "2030-10-11");
    await asUser(db, ids.admin, () => db.query("insert into reservation_admin_notes (reservation_id, author_id, body) values ($1, $2, 'İç not')", [id, ids.admin]));
    await asUser(db, ids.userA, async () => {
      const { rowCount } = await db.query("select 1 from reservation_admin_notes");
      expect(rowCount).toBe(0);
    });
  });
});

describe("fiyat dönemleri", () => {
  it("aynı oda, klinik ve kişi sayısı için çakışan fiyat dönemi girilemez", async () => {
    await expect(
      db.query("insert into room_rates (room_type_id, occupancy, price, valid_from, valid_to) values ($1, 1, 50, '2030-10-15', '2030-11-05')", [ids.room]),
    ).rejects.toThrow(/room_rates_no_overlap/);
  });
});

describe("başlangıç verisi", () => {
  it("seed.sql hatasız yüklenir: 11 otel, her birinde Single/Double/Triple oda", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const seed = readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8");
    const before = await db.query("select count(*)::int as n from hotels");
    await db.query(seed);
    const hotels = await db.query("select count(*)::int as n from hotels");
    const rooms = await db.query("select count(*)::int as n from room_types where name_tr in ('Single Oda', 'Double Oda', 'Triple Oda')");
    const rates = await db.query("select count(*)::int as n from room_rates where valid_from = '2026-09-01'");
    expect(hotels.rows[0].n - before.rows[0].n).toBe(11);
    expect(rooms.rows[0].n).toBe(33);
    // Her oda, kapasitesine kadar her kişi sayısı için aynı oda fiyatıyla: 11 × (1 + 2 + 3)
    expect(rates.rows[0].n).toBe(66);
  });
});

describe("referans", () => {
  it("referans kliniğin kodu ve kendi sıra numarasıdır; her klinik 0001'den başlar", async () => {
    const clinic = await insertReturningId(db, "insert into clinics (name) values ('Lerra Clinic') returning id");
    const user = await createUser(db, "lerra@klinik.test", "clinic_user", clinic);
    await db.query("insert into clinic_hotel_access (clinic_id, hotel_id) values ($1, $2)", [clinic, ids.partnered]);

    const first = await request(user, ids.room, "2030-10-20", "2030-10-21");
    const second = await request(user, ids.room, "2030-10-22", "2030-10-23");
    const { rows } = await db.query("select id, reference from reservations where id in ($1, $2)", [first, second]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, r.reference]));
    expect(byId[first]).toBe("LERRA-0001");
    expect(byId[second]).toBe("LERRA-0002");
  });

  it("klinik kodu adından türetilir, Türkçe harfler sadeleşir, çakışırsa numara eklenir", async () => {
    const a = await db.query("insert into clinics (name) values ('Şifa Göz') returning code");
    const b = await db.query("insert into clinics (name) values ('Şifa Ankara') returning code");
    const c = await db.query("insert into clinics (name) values ('Dr. Öz Klinik') returning code");
    const d = await db.query("insert into clinics (name, code) values ('Özel', 'oz1') returning code");
    expect(a.rows[0].code).toBe("SIFA");
    expect(b.rows[0].code).toBe("SIFA2");
    expect(c.rows[0].code).toBe("DROZKL");
    expect(d.rows[0].code).toBe("OZ1");
  });

  it("klinik kullanıcısı kliniğin kodunu ya da sayacını değiştiremez", async () => {
    const result = await asUser(db, ids.userA, () =>
      db.query("update clinics set code = 'XX', reservation_count = 0 where id = $1", [ids.clinicA]),
    );
    expect(result.rowCount).toBe(0);
  });
});

describe("admin", () => {
  it("admin oturumuyla güncelleme yapılabilir ve updated_at yenilenir", async () => {
    const { rows } = await asUser(db, ids.admin, () =>
      db.query("update hotels set name = 'Otel X2' where id = $1 returning updated_at > created_at as changed", [ids.partnered]),
    );
    expect(rows[0].changed).toBe(true);
  });
});

describe("profil ve şifre", () => {
  it("yeni kullanıcı ilk girişte şifre değiştirmek zorunda; kendi bayrağını kapatabilir", async () => {
    const id = await createUser(db, "yeni@klinik.test", "clinic_user", ids.clinicA);
    const before = await db.query("select must_change_password from profiles where id = $1", [id]);
    expect(before.rows[0].must_change_password).toBe(true);
    await asUser(db, id, () => db.query("select public.mark_password_changed()"));
    const after = await db.query("select must_change_password from profiles where id = $1", [id]);
    expect(after.rows[0].must_change_password).toBe(false);
  });

  it("klinik kullanıcısı kendi rolünü ya da kliniğini değiştiremez", async () => {
    const result = await asUser(db, ids.userA, () =>
      db.query("update profiles set role = 'admin', clinic_id = null where id = $1", [ids.userA]),
    );
    expect(result.rowCount).toBe(0);
    const { rows } = await db.query("select role from profiles where id = $1", [ids.userA]);
    expect(rows[0].role).toBe("clinic_user");
  });

  it("giriş yapmamış (anon) kullanıcı hiçbir tabloyu okuyamaz", async () => {
    await db.query("begin");
    try {
      await db.query("set local role anon");
      await expect(db.query("select * from hotels")).rejects.toThrow(/permission denied/);
    } finally {
      await db.query("rollback");
    }
  });
});

describe("görsel depolama", () => {
  it("klinik görselleri okuyabilir ama yükleyemez; admin yükleyebilir", async () => {
    await db.query("insert into storage.objects (bucket_id, name) values ('hotel-images', 'x/1.webp')");
    await asUser(db, ids.userA, async () => {
      const { rowCount } = await db.query("select 1 from storage.objects where bucket_id = 'hotel-images'");
      expect(rowCount).toBeGreaterThan(0);
    });
    await expect(
      asUser(db, ids.userA, () => db.query("insert into storage.objects (bucket_id, name) values ('hotel-images', 'x/2.webp')")),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, ids.admin, () => db.query("insert into storage.objects (bucket_id, name) values ('hotel-images', 'x/3.webp')")),
    ).resolves.toBeTruthy();
  });
});

describe("müsaitlik yönetimi", () => {
  async function setAvailability(userId: string, rooms: string[], from: string, to: string, available: boolean) {
    return asUser(db, userId, () => db.query("select public.set_room_availability($1, $2, $3, $4)", [rooms, from, to, available]));
  }
  async function closures(room: string) {
    const { rows } = await db.query(
      "select to_char(date_from, 'MM-DD') as f, to_char(date_to, 'MM-DD') as t from room_closures where room_type_id = $1 and date_from >= '2031-01-01' order by date_from",
      [room],
    );
    return rows.map((r) => `${r.f}..${r.t}`);
  }

  it("admin aralık kapatır; ortasını açınca kapalı aralık ikiye bölünür", async () => {
    await setAvailability(ids.admin, [ids.room], "2031-03-01", "2031-03-10", false);
    expect(await closures(ids.room)).toEqual(["03-01..03-10"]);
    await setAvailability(ids.admin, [ids.room], "2031-03-04", "2031-03-05", true);
    expect(await closures(ids.room)).toEqual(["03-01..03-03", "03-06..03-10"]);
  });

  it("kapalı aralıkla çakışan yeni kapatma tek parça olur", async () => {
    await setAvailability(ids.admin, [ids.room], "2031-03-02", "2031-03-08", false);
    expect(await closures(ids.room)).toEqual(["03-01..03-01", "03-02..03-08", "03-09..03-10"]);
    await setAvailability(ids.admin, [ids.room], "2031-03-01", "2031-03-10", true);
    expect(await closures(ids.room)).toEqual([]);
  });

  it("birden fazla odaya aynı anda uygulanır", async () => {
    await setAvailability(ids.admin, [ids.room, ids.otherRoom], "2031-04-01", "2031-04-02", false);
    expect(await closures(ids.room)).toEqual(["04-01..04-02"]);
    expect(await closures(ids.otherRoom)).toEqual(["04-01..04-02"]);
  });

  it("klinik müsaitliği değiştiremez", async () => {
    await expect(setAvailability(ids.userA, [ids.room], "2031-05-01", "2031-05-02", false)).rejects.toThrow("not_admin");
  });
});

describe("fiyat teklifi (quote_reservation)", () => {
  async function quote(userId: string, room: string, checkIn: string, checkOut: string, guests: number) {
    return asUser(db, userId, async () => {
      const { rows } = await db.query("select public.quote_reservation($1, $2, $3, $4::smallint) as q", [room, checkIn, checkOut, guests]);
      return rows[0].q;
    });
  }

  it("müsait konaklama için gece gece fiyat ve toplam döner", async () => {
    const q = await quote(ids.userA, ids.room, "2030-10-20", "2030-10-22", 2);
    expect(q).toMatchObject({ ok: true, total: 240, currency: "EUR" });
    expect(q.nights).toHaveLength(2);
  });

  it("kapalı gece varsa müsait değil der", async () => {
    expect(await quote(ids.userA, ids.room, "2030-10-14", "2030-10-17", 1)).toEqual({ ok: false, reason: "room_unavailable" });
  });

  it("kliniğe özel fiyatı kullanır", async () => {
    expect(await quote(ids.userB, ids.room, "2030-10-20", "2030-10-21", 1)).toMatchObject({ ok: true, total: 90 });
  });

  it("anlaşmasız otel için fiyat vermez", async () => {
    await expect(quote(ids.userA, ids.otherRoom, "2030-10-20", "2030-10-21", 1)).rejects.toThrow("hotel_not_partnered");
  });
});

describe("KVKK", () => {
  it("klinik aydınlatma/rıza onayını işaretlemeden talep gönderemez", async () => {
    await expect(
      asUser(db, ids.userA, () =>
        db.query("select public.create_reservation_request($1, '2030-10-25', '2030-10-26', $2)", [ids.room, JSON.stringify([guest()])]),
      ),
    ).rejects.toThrow("consent_required");
  });

  it("onay zamanı kaydedilir", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-25", "2030-10-26");
    const { rows } = await db.query("select guest_consent_at from reservations where id = $1", [id]);
    expect(rows[0].guest_consent_at).toBeInstanceOf(Date);
  });

  it("konaklamadan 30 gün sonra kimlik bilgileri silinir, ad ve uyruk kalır; klinik silme fonksiyonunu çalıştıramaz", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-26", "2030-10-27");
    await db.query("update reservations set check_in = current_date - 40, check_out = current_date - 35 where id = $1", [id]);
    await expect(asUser(db, ids.userA, () => db.query("select public.purge_guest_identity(30)"))).rejects.toThrow(/permission denied/);

    await db.query("select public.purge_guest_identity(30)");
    const { rows } = await db.query("select full_name, nationality, id_number, birth_date, gender, identity_purged_at from reservation_guests where reservation_id = $1", [id]);
    expect(rows[0]).toMatchObject({ full_name: "Ayşe Yılmaz", nationality: "TR", id_number: "", birth_date: null, gender: "" });
    expect(rows[0].identity_purged_at).toBeInstanceOf(Date);
  });

  it("yaklaşan konaklamanın kimlik bilgileri silinmez", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-27", "2030-10-28");
    await db.query("select public.purge_guest_identity(30)");
    const { rows } = await db.query("select id_number from reservation_guests where reservation_id = $1", [id]);
    expect(rows[0].id_number).not.toBe("");
  });
});

describe("oda kontenjanı", () => {
  let room: string;
  const confirm = (id: string) => asUser(db, ids.admin, () => db.query("select public.change_reservation_status($1, 'CONFIRMED')", [id]));

  beforeAll(async () => {
    room = await insertReturningId(db, "insert into room_types (hotel_id, name_tr, room_count) values ($1, 'Kontenjanlı Oda', 2) returning id", [ids.partnered]);
    await db.query("insert into room_rates (room_type_id, occupancy, price, valid_from, valid_to) values ($1, 1, 80, '2030-12-01', '2030-12-31')", [room]);
  });

  it("kontenjan dolunca (onaylı + bekleyen) yeni talep alınmaz; dolmayan gece etkilenmez", async () => {
    await request(ids.userA, room, "2030-12-01", "2030-12-03");
    await request(ids.userB, room, "2030-12-02", "2030-12-04");
    await expect(request(ids.userA, room, "2030-12-02", "2030-12-03")).rejects.toThrow("room_unavailable");
    await expect(request(ids.userA, room, "2030-12-01", "2030-12-02")).resolves.toBeTruthy();
  });

  it("onaylarken sadece onaylılar sayılır; kontenjan aşılacaksa onay reddedilir", async () => {
    const a = await request(ids.userA, room, "2030-12-10", "2030-12-11");
    const b = await request(ids.userA, room, "2030-12-10", "2030-12-11");
    await db.query("update room_types set room_count = 1 where id = $1", [room]);
    await confirm(a);
    await expect(confirm(b)).rejects.toThrow("no_rooms_left");
    await db.query("update room_types set room_count = 2 where id = $1", [room]);
  });

  it("iptal edilen rezervasyon yer açar", async () => {
    const a = await request(ids.userA, room, "2030-12-20", "2030-12-21");
    const b = await request(ids.userA, room, "2030-12-20", "2030-12-21");
    await expect(request(ids.userA, room, "2030-12-20", "2030-12-21")).rejects.toThrow("room_unavailable");
    await asUser(db, ids.admin, () => db.query("select public.change_reservation_status($1, 'REJECTED')", [b]));
    await confirm(a);
    await expect(request(ids.userA, room, "2030-12-20", "2030-12-21")).resolves.toBeTruthy();
  });

  it("kontenjanı boş oda tipinde sınır yok", async () => {
    const { rows } = await db.query("select public.room_has_capacity($1, '2030-10-20', '2030-10-21', true) as ok", [ids.room]);
    expect(rows[0].ok).toBe(true);
  });
});

describe("iptal ve değişiklik talepleri", () => {
  const call = (userId: string, sql: string, params: unknown[]) => asUser(db, userId, () => db.query(sql, params));

  it("klinik kendi bekleyen talebini geri çeker; başkasınınkini çekemez", async () => {
    const id = await request(ids.userA, ids.room, "2030-11-01", "2030-11-02");
    await expect(call(ids.userB, "select public.withdraw_reservation_request($1)", [id])).rejects.toThrow("reservation_not_found");
    await call(ids.userA, "select public.withdraw_reservation_request($1, 'Hasta vazgeçti')", [id]);
    const { rows } = await db.query("select status from reservations where id = $1", [id]);
    expect(rows[0].status).toBe("CANCELLED");
  });

  it("onaylı rezervasyonu klinik doğrudan iptal edemez, iptal talebi gönderir; admin iptal edince talep kapanır", async () => {
    const id = await request(ids.userA, ids.room, "2030-11-02", "2030-11-03");
    await call(ids.admin, "select public.change_reservation_status($1, 'CONFIRMED')", [id]);
    await expect(call(ids.userA, "select public.withdraw_reservation_request($1)", [id])).rejects.toThrow("invalid_status_transition");

    await call(ids.userA, "select public.request_reservation_change($1, 'CANCEL', 'Ameliyat ertelendi')", [id]);
    await expect(call(ids.userA, "select public.request_reservation_change($1, 'CANCEL')", [id])).rejects.toThrow("change_request_open");

    const seen = await call(ids.userA, "select kind, status from reservation_change_requests where reservation_id = $1", [id]);
    expect(seen.rows).toEqual([{ kind: "CANCEL", status: "OPEN" }]);
    const other = await call(ids.userB, "select 1 from reservation_change_requests where reservation_id = $1", [id]);
    expect(other.rowCount).toBe(0);

    await call(ids.admin, "select public.change_reservation_status($1, 'CANCELLED', 'Otel iptali onayladı')", [id]);
    const { rows } = await db.query("select status, resolution_note from reservation_change_requests where reservation_id = $1", [id]);
    expect(rows[0]).toEqual({ status: "RESOLVED", resolution_note: "Otel iptali onayladı" });
  });

  it("değişiklik talebinde açıklama zorunlu; admin kapatır, klinik kapatamaz ve doğrudan yazamaz", async () => {
    const id = await request(ids.userA, ids.room, "2030-11-03", "2030-11-04");
    await expect(call(ids.userA, "select public.request_reservation_change($1, 'CHANGE', '')", [id])).rejects.toThrow("change_message_required");
    const { rows } = await call(ids.userA, "select public.request_reservation_change($1, 'CHANGE', 'Çıkış bir gün sonra olsun') as id", [id]);
    await expect(call(ids.userA, "select public.resolve_change_request($1)", [rows[0].id])).rejects.toThrow("not_admin");
    await expect(
      call(ids.userA, "insert into reservation_change_requests (reservation_id, kind) values ($1, 'CANCEL')", [id]),
    ).rejects.toThrow(/row-level security/);
    await call(ids.admin, "select public.resolve_change_request($1, 'Otel tarihi uzattı')", [rows[0].id]);
    const after = await db.query("select status from reservation_change_requests where id = $1", [rows[0].id]);
    expect(after.rows[0].status).toBe("RESOLVED");
  });
});

describe("otel onay numarası", () => {
  it("sadece admin girer, klinik görür", async () => {
    const id = await request(ids.userA, ids.room, "2030-11-05", "2030-11-06");
    await expect(asUser(db, ids.userA, () => db.query("select public.set_hotel_confirmation_no($1, 'X1')", [id]))).rejects.toThrow("not_admin");
    await asUser(db, ids.admin, () => db.query("select public.set_hotel_confirmation_no($1, ' HTL-778 ')", [id]));
    const { rows } = await asUser(db, ids.userA, () => db.query("select hotel_confirmation_no from reservations where id = $1", [id]));
    expect(rows[0].hotel_confirmation_no).toBe("HTL-778");
  });
});

describe("havalimanı transferi", () => {
  const withTransfer = (transfer: unknown) =>
    asUser(db, ids.userA, async () => {
      const { rows } = await db.query("select public.create_reservation_request($1, '2030-10-28', '2030-10-29', $2, p_consent => true, p_transfer => $3) as id", [
        ids.room,
        JSON.stringify([guest()]),
        JSON.stringify(transfer),
      ]);
      return rows[0].id as string;
    });

  it("geliş ve dönüş transferi kaydedilir; bilinmeyen alanlar atılır", async () => {
    const id = await withTransfer({
      arrival: { airport: "IST", at: "2030-10-28T14:30", flight: "TK1234", extra: "x" },
      departure: { airport: "SAW", at: "2030-10-29T18:00" },
    });
    const { rows } = await db.query("select transfer from reservations where id = $1", [id]);
    expect(rows[0].transfer).toEqual({
      arrival: { airport: "IST", at: "2030-10-28T14:30", flight: "TK1234" },
      departure: { airport: "SAW", at: "2030-10-29T18:00", flight: "" },
    });
  });

  it("transfer istenmezse boş kalır", async () => {
    const id = await request(ids.userA, ids.room, "2030-10-29", "2030-10-30");
    const { rows } = await db.query("select transfer from reservations where id = $1", [id]);
    expect(rows[0].transfer).toEqual({});
  });

  it("havalimanı ve uçuş saati zorunlu, uçuş no biçimi denetlenir", async () => {
    await expect(withTransfer({ arrival: { at: "2030-10-28T14:30" } })).rejects.toThrow("transfer_airport_required");
    await expect(withTransfer({ arrival: { airport: "IST", at: "" } })).rejects.toThrow("transfer_time_required");
    await expect(withTransfer({ arrival: { airport: "IST", at: "2030-13-40T99:00" } })).rejects.toThrow("transfer_time_required");
    await expect(withTransfer({ arrival: { airport: "IST", at: "2030-10-28T14:30", flight: "tk-1" } })).rejects.toThrow("invalid_flight_no");
    await expect(withTransfer({ hotel: {} })).rejects.toThrow("invalid_transfer");
  });
});
