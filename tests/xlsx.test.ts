import { inflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { dictionaries } from "@/i18n/dictionaries";
import { monthWorkbook } from "@/lib/summary-export";
import { buildXlsx } from "@/lib/xlsx";

/** ZIP içindeki dosyaları okur (sıkıştırmasız ya da deflate). */
function unzip(data: Uint8Array): Record<string, string> {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const files: Record<string, string> = {};
  let pos = 0;
  while (view.getUint32(pos, true) === 0x04034b50) {
    const method = view.getUint16(pos + 8, true);
    const size = view.getUint32(pos + 18, true);
    const nameLength = view.getUint16(pos + 26, true);
    const extra = view.getUint16(pos + 28, true);
    const name = new TextDecoder().decode(data.slice(pos + 30, pos + 30 + nameLength));
    const body = data.slice(pos + 30 + nameLength + extra, pos + 30 + nameLength + extra + size);
    files[name] = new TextDecoder().decode(method === 8 ? inflateRawSync(body) : body);
    pos += 30 + nameLength + extra + size;
  }
  return files;
}

describe("xlsx", () => {
  it("sayfaları, metin, sayı ve tarih hücrelerini yazar; özel karakterleri kaçırır", () => {
    const files = unzip(buildXlsx([{ name: "Rezervasyonlar", rows: [["A", "B"], ["Şişli & <Otel>", 12.5], [{ date: "2026-10-18" }, null]] }]));
    expect(Object.keys(files)).toContain("xl/worksheets/sheet1.xml");
    expect(files["xl/workbook.xml"]).toContain('name="Rezervasyonlar"');
    const sheet = files["xl/worksheets/sheet1.xml"];
    expect(sheet).toContain("Şişli &amp; &lt;Otel&gt;");
    expect(sheet).toContain('<c r="B2" s="2"><v>12.5</v></c>');
    // 18.10.2026 = Excel seri numarası 46313
    expect(sheet).toContain('<c r="A3" s="1"><v>46313</v></c>');
  });

  it("aylık özet: admin için klinik sütunu ve klinik sayfası; para birimleri ayrı sütun", () => {
    const row = {
      id: "1",
      reference: "LERRA-0001",
      hotel_id: "h1",
      hotel_name: "Otel X",
      room_name: "Double",
      clinic_id: "c1",
      clinic_name: "Lerra",
      check_in: "2026-10-05",
      check_out: "2026-10-08",
      guest_count: 2,
      total_price: "300.00",
      currency: "EUR",
      status: "CONFIRMED",
      reservation_guests: [{ full_name: "Ayşe Yılmaz", position: 1 }],
    };
    const files = unzip(monthWorkbook([row, { ...row, id: "2", reference: "LERRA-0002", currency: "USD", total_price: 100 }], dictionaries.tr, true));
    expect(files["xl/workbook.xml"]).toContain('name="Kliniklere göre"');
    expect(files["xl/worksheets/sheet1.xml"]).toContain("Ayşe Yılmaz");
    expect(files["xl/worksheets/sheet2.xml"]).toContain("Tutar (EUR)");
    expect(files["xl/worksheets/sheet2.xml"]).toContain("Tutar (USD)");

    const clinic = unzip(monthWorkbook([row], dictionaries.tr, false));
    expect(clinic["xl/workbook.xml"]).not.toContain("Kliniklere göre");
    expect(clinic["xl/worksheets/sheet1.xml"]).not.toContain(">Klinik<");
  });
});
