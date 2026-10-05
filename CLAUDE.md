@AGENTS.md

# Askepios

- Kullanıcıya ve koddaki yorumlarda Türkçe yaz.
- Klinik izolasyonu ve rezervasyon kuralları veritabanında (RLS + `create_reservation_request` / `change_reservation_status`). Yeni bir tablo eklerken RLS'yi aç ve `tests/db` içine izolasyon testi ekle.
- Şema değişiklikleri yeni bir dosya olarak `supabase/migrations/` altına eklenir; mevcut migration dosyaları değiştirilmez (canlıya çıktıktan sonra).
- Müsaitlik: oda varsayılan olarak müsait, `room_closures` kapalı aralıkları tutar. Fiyat: `room_rates`, kişi sayısına göre, kliniğe özel fiyat genel fiyatın önüne geçer.
