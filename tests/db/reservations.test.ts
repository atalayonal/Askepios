import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Client } from "pg";
import { asUser, createTestDatabase, createUser, insertReturningId } from "./helpers";

let db: Client;
let drop: () => Promise<void>;

const ids = {} as Record<
  "clinicA" | "clinicB" | "admin" | "userA" | "userB" | "partnered" | "other" | "room" | "otherRoom",
  string
>;

const guest = (name = "Ayşe Yılmaz") => ({ full_name: name, nationality: "TR", phone: "+90 555 000 00 00" });

async function request(userId: string, roomId: string, checkIn: string, checkOut: string, guests = [guest()]) {
  return asUser(db, userId, async () => {
    const { rows } = await db.query("select public.create_reservation_request($1, $2, $3, $4) as id", [
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
  it("seed.sql hatasız yüklenir: 11 otel, her biri 3 fiyatlı", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const seed = readFileSync(path.resolve(__dirname, "../../supabase/seed.sql"), "utf8");
    const before = await db.query("select count(*)::int as n from hotels");
    await db.query(seed);
    const hotels = await db.query("select count(*)::int as n from hotels");
    const rates = await db.query("select count(*)::int as n from room_rates where valid_from = '2026-09-01'");
    expect(hotels.rows[0].n - before.rows[0].n).toBe(11);
    expect(rates.rows[0].n).toBe(33);
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
