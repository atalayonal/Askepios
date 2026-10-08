-- 8 Ekim 2026'dan önce kurulmuş canlı projede tek seferlik güncelleme:
-- otel/oda özellikleri sütunlarını ekler, otellerin tanıtım bilgilerini ve görsellerini yükler.
-- Tekrar çalıştırılırsa bir şey değiştirmez. Boş bir projeye kurulum.sql ile kurulum yapıldıysa gerekmez.

begin;

-- ===== supabase/migrations/20261008000000_hotel_features.sql
-- Otel ve oda özellikleri (Wi-Fi, otopark, minibar vb.) ve oda büyüklüğü.
-- Özellikler sabit anahtarlarla tutulur (ör. 'wifi'); etiket ve simgeler uygulamada (src/lib/amenities.ts).
-- Yeni tablo yok; mevcut RLS politikaları bu sütunları da kapsar.

alter table public.hotels
  add column if not exists amenities text[] not null default '{}';

alter table public.room_types
  add column if not exists amenities text[] not null default '{}',
  add column if not exists size_m2 smallint check (size_m2 is null or size_m2 between 5 and 500);

-- ===== supabase/otel-icerigi.sql
-- Otellerin tanıtım bilgileri, özellikleri ve görselleri (8 Ekim 2026'da otellerin kendi siteleri ve
-- rezervasyon sitelerinden derlendi). Yıldız ve oda büyüklükleri doğrulanmadıysa boş bırakıldı.
-- Sadece boş alanları doldurur: panelden girilmiş bir bilgi varsa ona dokunmaz. Tekrar çalıştırılabilir.

update public.hotels h set
  district = case when h.district = '' then v.district else h.district end,
  address = case when h.address = '' then v.address else h.address end,
  stars = coalesce(h.stars, v.stars),
  website = coalesce(nullif(h.website, ''), v.website),
  description_tr = case when h.description_tr = '' then v.description_tr else h.description_tr end,
  description_en = case when h.description_en = '' then v.description_en else h.description_en end,
  amenities = case when h.amenities = '{}' then v.amenities else h.amenities end
from (values
  ('Bricks Hotel', 'Bahçelievler', 'Zafer Mah. Dumlupınar Cad. No:42 (E-5 yan yol), Yenibosna, 34197 Bahçelievler/İstanbul', 5, 'https://www.brickshotels.com/',
   'Bricks Hotel, Bahçelievler''in Yenibosna bölgesinde, E-5 yan yolu üzerinde yer alan bir iş ve kongre otelidir. CNR Expo ve İstanbul Fuar Merkezi''ne yaklaşık 2,5 km, İstanbul Havalimanı''na yaklaşık 40 km uzaklıktadır; İstanbul Havalimanı–Bakırköy otobüs hattının Kuleli Yenibosna durağı otele beş dakikalık yürüme mesafesindedir. Otelde iki restoran, teras restoran, kafe, toplantı salonları ile spa, Türk hamamı, sauna ve fitness merkezi bulunur.',
   'Bricks Hotel is a business and conference hotel in the Yenibosna area of Bahçelievler, on the E-5 service road. It is about 2.5 km from CNR Expo and the Istanbul Expo Center and roughly 40 km from Istanbul Airport; the Kuleli Yenibosna stop of the Istanbul Airport–Bakırköy shuttle bus is a five-minute walk away. Facilities include two restaurants, a terrace restaurant, a café, meeting rooms, a spa with Turkish bath and sauna, and a fitness centre.',
   array['wifi', 'parking', 'airport_shuttle', 'restaurant', 'room_service', 'reception_24h', 'fitness', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'family_rooms', 'accessible', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('ADM Grand', 'Bağcılar', 'Mahmutbey Mah. Taşocağı Yolu Cad. No:35, 34218 Bağcılar/İstanbul', 5, 'https://admgrandotel.com/',
   'ADM Grand Hotel, Bağcılar''ın Mahmutbey Mahallesi''nde, Başakşehir, İkitelli ve Mall of İstanbul çevresine yakın konumda 334 odalı bir şehir otelidir. İstanbul Havalimanı''na yaklaşık 35 km uzaklıktadır. Otelde Türk hamamı, sauna, buhar odası ve ısıtmalı kapalı havuz bulunan Santé Spa & Wellness merkezi, fitness salonu, iki restoran, toplantı ve düğün salonları ile ücretsiz kapalı otopark bulunur.',
   'ADM Grand Hotel is a 334-room city hotel in the Mahmutbey neighbourhood of Bağcılar, close to Başakşehir, İkitelli and Mall of Istanbul. It is about 35 km from Istanbul Airport. Facilities include the Santé Spa & Wellness centre with a Turkish bath, sauna, steam room and heated indoor pool, a fitness centre, two restaurants, meeting and wedding venues, and free covered parking.',
   array['wifi', 'parking', 'restaurant', 'reception_24h', 'fitness', 'pool', 'spa', 'sauna', 'hammam', 'elevator', 'accessible', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('La Quinta Basin Hotel', 'Bağcılar', '15 Temmuz Mah. Bahar Cad. No:61 (Basın Ekspres Yolu), 34212 Bağcılar/İstanbul', null, 'https://www.wyndhamhotels.com/laquinta/istanbul-turkiye/la-quinta-istanbul-gunesli/overview',
   'La Quinta by Wyndham İstanbul Güneşli, Bağcılar''da Basın Ekspres Yolu üzerinde, M9 metro hattına kısa yürüme mesafesinde yer alan 404 odalı bir oteldir. İstanbul Havalimanı''na 33 km, Sabiha Gökçen Havalimanı''na 63 km uzaklıkta olup İstanbul Fuar Merkezi ve CNR Expo''ya yakındır. Otelde kapalı havuz, sauna, Türk hamamı ve spa, fitness merkezi, restoranlar, balo salonu ve toplantı salonları ile ücretsiz otopark bulunur.',
   'La Quinta by Wyndham Istanbul Güneşli is a 404-room hotel on the Basın Ekspres road in Bağcılar, a short walk from the M9 metro line. It is 33 km from Istanbul Airport and 63 km from Sabiha Gökçen Airport, and close to the Istanbul Expo Center and CNR Expo. Facilities include an indoor pool, sauna, Turkish bath and spa, a fitness centre, restaurants, a ballroom with meeting rooms, and free parking.',
   array['wifi', 'parking', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'fitness', 'pool', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'accessible', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('Martinenz Hotel', 'Fatih', 'Mesihpaşa Mah. Koska Cad. No:4/1, Laleli, 34130 Fatih/İstanbul', 3, 'https://www.hotelmartinenz.com/',
   'Martinenz Hotel, Tarihi Yarımada''da Laleli''de, Koska Caddesi üzerinde yer alan 110 odalı bir şehir otelidir. 1990''da inşa edilen otel 2020''de tamamen yenilenmiştir; Kapalıçarşı ve tarihi alanlar yürüme mesafesindedir. Otelde 24 saat resepsiyon, restoran, ücretli oda servisi ve çamaşır hizmeti bulunur; otopark yoktur.',
   'Martinenz Hotel is a 110-room city hotel on Koska Street in Laleli, on Istanbul''s historic peninsula. Built in 1990 and fully renovated in 2020, it is within walking distance of the Grand Bazaar and the historic sites. The hotel has a 24-hour reception, a restaurant, paid room service and laundry; there is no parking.',
   array['wifi', 'restaurant', 'bar', 'room_service', 'reception_24h', 'elevator', 'non_smoking', 'laundry', 'concierge']::text[]),
  ('Glorious Hotel', 'Fatih', 'Ordu Cad. Yeşil Tulumba Sok. No:17, Laleli, 34130 Fatih/İstanbul', 4, 'https://www.glorioushotelistanbul.com/',
   'Glorious Hotel, Fatih''in Laleli semtinde, Ordu Caddesi''ne bağlı Yeşil Tulumba Sokak''ta yer alan 100 odalı bir oteldir. Kapalıçarşı yaklaşık 1 km, Sultanahmet ve Ayasofya yaklaşık 2–3 km uzaklıktadır; İstanbul Havalimanı ve Sabiha Gökçen Havalimanı''na uzaklığı yaklaşık 45 km''dir. Otelde restoran, bar, ısıtmalı kapalı havuz, hamam ve buhar odası bulunan spa ile toplantı salonu bulunur.',
   'Glorious Hotel is a 100-room hotel on Yeşil Tulumba Street off Ordu Avenue in Laleli, Fatih. The Grand Bazaar is about 1 km away and Sultanahmet and Hagia Sophia about 2–3 km; Istanbul Airport and Sabiha Gökçen Airport are each roughly 45 km away. The hotel has a restaurant, a bar, a spa with a heated indoor pool, Turkish bath and steam room, and a meeting room.',
   array['wifi', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'pool', 'spa', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('Sorisso Hotel', 'Fatih', 'Kemalpaşa Mah. Ordu Cad. No:60, Laleli, 34130 Fatih/İstanbul', 4, 'https://www.sorrisohotel.com/',
   'Sorriso Hotel, Fatih''in Laleli semtinde, Ordu Caddesi üzerinde yer alan dört yıldızlı bir oteldir. Aksaray tramvay durağına yaklaşık 100 m, Yenikapı metro ve Marmaray istasyonlarına yürüyerek 5 dakika uzaklıktadır; Kapalıçarşı yürüyerek yaklaşık 10, Sultanahmet yaklaşık 15 dakikadır. Otelde Türk ve dünya mutfağı sunan restoran, lobi bar ile sauna, buhar odası, jakuzi ve Türk hamamı bulunan spa merkezi vardır.',
   'Sorriso Hotel is a four-star hotel on Ordu Avenue in Laleli, Fatih. It is about 100 m from the Aksaray tram stop and a five-minute walk from the Yenikapı metro and Marmaray stations; the Grand Bazaar is about 10 minutes and Sultanahmet about 15 minutes away on foot. The hotel has a restaurant serving Turkish and international cuisine, a lobby bar, and a spa with sauna, steam room, jacuzzi and Turkish bath.',
   array['wifi', 'restaurant', 'bar', 'reception_24h', 'fitness', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'laundry', 'terrace', 'concierge']::text[]),
  ('Büyük Hamit Hotel', 'Fatih', 'Kemalpaşa Mah. Gençtürk Cad. No:72-74, 34134 Fatih/İstanbul', 4, 'https://www.hotelbuyukhamit.com/tr',
   'Büyük Hamit Hotel, Fatih''te Gençtürk Caddesi üzerinde yer alan dört yıldızlı bağımsız bir oteldir. Vezneciler metro istasyonuna 300 m, Laleli tramvay durağına 600 m uzaklıkta olup Çemberlitaş yaklaşık 1,5 km, Topkapı Sarayı yaklaşık 2,9 km mesafededir; İstanbul Havalimanı''na 41 km, Sabiha Gökçen Havalimanı''na 39 km uzaklıktadır. Otelde açık büfe kahvaltı sunulan restoran ve kafeterya bulunur, havaalanı transferi sağlanır; otopark yoktur.',
   'Büyük Hamit Hotel is an independent four-star hotel on Gençtürk Avenue in Fatih. It is 300 m from Vezneciler metro station and 600 m from the Laleli tram stop, about 1.5 km from Çemberlitaş and 2.9 km from Topkapı Palace; Istanbul Airport is 41 km and Sabiha Gökçen Airport 39 km away. The hotel has a restaurant serving a buffet breakfast and a cafeteria, and offers airport transfers; there is no parking.',
   array['wifi', 'airport_shuttle', 'restaurant', 'elevator', 'breakfast']::text[]),
  ('Holiday Inn Topkapı', 'Fatih', 'Topkapı Mah. Turgut Özal Millet Cad. No:189, Topkapı, Fatih/İstanbul', null, 'https://www.ihg.com/holidayinn/hotels/us/en/istanbul/istmc/hoteldetail',
   'Holiday Inn Istanbul City, Fatih''in Topkapı semtinde, Turgut Özal Millet Caddesi üzerinde, tarihi surların yakınında yer alan 203 odalı bir IHG otelidir. Pazartekke tramvay durağına yaklaşık 100 m uzaklıktadır; İstanbul Havalimanı yaklaşık 46 km mesafededir. Otelde açık havuz, spa (hamam, sauna, buhar odası), fitness salonu, restoran, bar, balo salonu ve toplantı salonları ile otopark bulunur.',
   'Holiday Inn Istanbul City is a 203-room IHG hotel on Turgut Özal Millet Avenue in Topkapı, Fatih, near the historic city walls. The Pazartekke tram stop is about 100 m away and Istanbul Airport about 46 km. Facilities include an outdoor pool, a spa with Turkish bath, sauna and steam room, a fitness room, a restaurant, a bar, a ballroom and meeting rooms, and on-site parking.',
   array['wifi', 'parking', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'fitness', 'pool', 'spa', 'sauna', 'hammam', 'elevator', 'non_smoking', 'laundry', 'meeting_rooms', 'terrace', 'concierge']::text[]),
  ('Ramada Golden Horn', 'Beyoğlu', 'Sütlüce Mah. İmrahor Cad. No:12, 34445 Beyoğlu/İstanbul', null, 'https://www.wyndhamhotels.com/ramada/istanbul-turkiye/ramada-istanbul-golden-horn/overview',
   'Ramada by Wyndham Istanbul Golden Horn, Beyoğlu''nun Sütlüce semtinde, Haliç kıyısında ve Haliç Kongre Merkezi''nin yakınında yer alan 112 odalı bir oteldir. İstanbul Havalimanı''na yaklaşık 35–37 km uzaklıktadır. Otelde iki restoran ve bar, Türk hamamı, sauna, buhar odası ve jakuzi bulunan spa ile 300 kişilik balo salonu ve toplantı salonları vardır.',
   'Ramada by Wyndham Istanbul Golden Horn is a 112-room hotel in Sütlüce, Beyoğlu, on the Golden Horn and near the Haliç Congress Center. Istanbul Airport is about 35–37 km away. The hotel has two restaurants and a bar, a spa with Turkish bath, sauna, steam room and hot tub, a ballroom for 300 guests and meeting rooms.',
   array['wifi', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'laundry', 'meeting_rooms', 'concierge']::text[]),
  ('Ramada Florya', 'Küçükçekmece', 'Beşyol Mah. Birlik Cad. No:10, Florya, 34295 Küçükçekmece/İstanbul', 4, 'https://www.wyndhamhotels.com/ramada/istanbul-turkiye/ramada-istanbul-florya/overview',
   'Ramada by Wyndham Istanbul Florya, Küçükçekmece''nin Beşyol Mahallesi''nde, eski Atatürk Havalimanı''nın yanında yer alan 90 odalı bir oteldir. Florya Plajı''na yaklaşık 2 km, İstanbul Akvaryum''a 3 km, İstanbul Havalimanı''na yaklaşık 43 km uzaklıktadır. Otelde restoran, bar, spa, sauna, Türk hamamı, fitness salonu ve iki toplantı salonu bulunur.',
   'Ramada by Wyndham Istanbul Florya is a 90-room hotel in the Beşyol neighbourhood of Küçükçekmece, next to the former Atatürk Airport. It is about 2 km from Florya beach, 3 km from Istanbul Aquarium and about 43 km from Istanbul Airport. The hotel has a restaurant, a bar, a spa with sauna and Turkish bath, a fitness centre and two meeting rooms.',
   array['wifi', 'parking', 'airport_shuttle', 'restaurant', 'bar', 'room_service', 'reception_24h', 'fitness', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'accessible', 'laundry', 'meeting_rooms', 'concierge']::text[]),
  ('Business Life Bakırköy', 'Bakırköy', 'Sakızağacı Mah. Havlucular Sok. No:3, 34142 Bakırköy/İstanbul', 3, null,
   'Business Life Hotel & SPA Bakırköy, Bakırköy''ün Sakızağacı Mahallesi''nde yer alan 45 odalı bir şehir otelidir. Marmaray Yenimahalle istasyonuna ve Veliefendi Hipodromu''na yaklaşık 1 km, Bakırköy merkezine yaklaşık 1 km, Ataköy Marina''ya yaklaşık 2 km, İstanbul Havalimanı''na yaklaşık 50 km uzaklıktadır. Otelde 24 saat resepsiyon, açık büfe kahvaltı ile hamam, sauna, buhar odası ve masaj hizmetleri sunan spa bulunur; otelin kendi otoparkı yoktur.',
   'Business Life Hotel & SPA Bakırköy is a 45-room city hotel in the Sakızağacı neighbourhood of Bakırköy. It is about 1 km from Marmaray Yenimahalle station, Veliefendi Hippodrome and Bakırköy centre, about 2 km from Ataköy Marina and about 50 km from Istanbul Airport. The hotel has a 24-hour reception, a buffet breakfast and a spa with Turkish bath, sauna, steam room and massage; it has no parking of its own.',
   array['wifi', 'airport_shuttle', 'bar', 'room_service', 'reception_24h', 'fitness', 'spa', 'sauna', 'hammam', 'elevator', 'breakfast', 'non_smoking', 'meeting_rooms']::text[])
) as v(name, district, address, stars, website, description_tr, description_en, amenities)
where h.name = v.name;

update public.room_types rt set
  bed_info = case when rt.bed_info = '' then coalesce(v.bed_info, '') else rt.bed_info end,
  size_m2 = coalesce(rt.size_m2, v.size_m2::smallint),
  amenities = case when rt.amenities = '{}' then v.amenities else rt.amenities end
from (values
  ('Bricks Hotel', 'Single Oda', '2 tek kişilik yatak (ayrı single oda yok; Superior Twin oda tek kişi kullanımı)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'soundproof', 'heating', 'wardrobe', 'fridge', 'city_view', 'slippers']::text[]),
  ('Bricks Hotel', 'Double Oda', '1 king yatak (Superior King oda)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'soundproof', 'heating', 'wardrobe', 'fridge', 'city_view', 'slippers']::text[]),
  ('Bricks Hotel', 'Triple Oda', 'Ayrı üç kişilik oda yok; Family Suite: iki yatak odası ve iki banyo (çift kişilik + iki tek kişilik yatak)', 56, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'soundproof', 'heating', 'wardrobe', 'fridge', 'city_view', 'slippers']::text[]),
  ('ADM Grand', 'Single Oda', '1 queen yatak (ayrı single oda yok; tek yataklı standart oda)', null, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'bathtub', 'phone', 'soundproof', 'wardrobe', 'slippers']::text[]),
  ('ADM Grand', 'Double Oda', '1 king yatak (King Room)', 43, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'bathtub', 'phone', 'soundproof', 'wardrobe', 'slippers']::text[]),
  ('ADM Grand', 'Triple Oda', '2 tek kişilik yatak (Standard Twin oda, 3 kişiye kadar ilan ediliyor; ayrı üç kişilik oda doğrulanamadı)', 31, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'bathtub', 'phone', 'soundproof', 'wardrobe', 'slippers']::text[]),
  ('La Quinta Basin Hotel', 'Single Oda', '1 king yatak (ayrı single oda yok; Superior King oda tek kişi kullanımı, 26–28 m²)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'wardrobe', 'slippers']::text[]),
  ('La Quinta Basin Hotel', 'Double Oda', '1 king yatak (Superior King oda, 26–28 m²) veya 2 tek kişilik yatak (Deluxe King/Twin, 30–32 m²)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'wardrobe', 'slippers']::text[]),
  ('La Quinta Basin Hotel', 'Triple Oda', 'Deluxe Triple oda (28–32 m²): 3 tek kişilik yatak veya 1 çift + 1 tek kişilik yatak', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'desk', 'shower', 'phone', 'wardrobe', 'slippers']::text[]),
  ('Martinenz Hotel', 'Single Oda', '2 tek kişilik yatak (ayrı single oda yok; Standart Twin oda tek kişi kullanımı)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'shower', 'phone', 'wardrobe', 'city_view', 'slippers']::text[]),
  ('Martinenz Hotel', 'Double Oda', '1 çift kişilik (French) yatak (Standart French oda)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'shower', 'phone', 'wardrobe', 'city_view', 'slippers']::text[]),
  ('Martinenz Hotel', 'Triple Oda', '3 tek kişilik yatak (Standart Triple oda)', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'hairdryer', 'shower', 'phone', 'wardrobe', 'city_view', 'slippers']::text[]),
  ('Glorious Hotel', 'Single Oda', 'Standart Single oda; yatak tipi belirtilmemiş (fotoğrafta 1 çift kişilik yatak)', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'heating', 'slippers']::text[]),
  ('Glorious Hotel', 'Double Oda', '1 çift kişilik veya 2 tek kişilik yatak (Standart Double/Twin oda)', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'heating', 'slippers']::text[]),
  ('Glorious Hotel', 'Triple Oda', '1 çift kişilik + 1 tek kişilik yatak (Standart Triple oda)', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'heating', 'slippers']::text[]),
  ('Sorisso Hotel', 'Single Oda', 'Standart Single oda, 1 kişilik; yatak tipi belirtilmemiş', 18, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Sorisso Hotel', 'Double Oda', '1 çift kişilik yatak (Standart Double oda)', 22, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Sorisso Hotel', 'Triple Oda', '1 çift kişilik + 1 tek kişilik yatak (Standart Triple oda)', 25, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Büyük Hamit Hotel', 'Single Oda', '1 çift kişilik (French) yatak (ayrı single oda yok; Standard Double oda tek kişi kullanımı)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'wardrobe', 'fridge', 'city_view']::text[]),
  ('Büyük Hamit Hotel', 'Double Oda', '1 çift kişilik (French) yatak (Standard Double) veya 2 tek kişilik yatak (Standard Twin)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'wardrobe', 'fridge', 'city_view']::text[]),
  ('Büyük Hamit Hotel', 'Triple Oda', '2 tek + 1 tek kişilik yatak veya 1 çift + 1 tek kişilik yatak (Classic Triple oda)', 28, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'hairdryer', 'private_bathroom', 'shower', 'phone', 'soundproof', 'wardrobe', 'fridge', 'city_view']::text[]),
  ('Holiday Inn Topkapı', 'Single Oda', '1 büyük yatak (ayrı single oda yok; standart oda tek kişi kullanımı)', null, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Holiday Inn Topkapı', 'Double Oda', '1 queen/king yatak veya 2 tek kişilik yatak (standart oda)', null, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Holiday Inn Topkapı', 'Triple Oda', 'Ayrı üç kişilik oda doğrulanamadı; iki büyük yataklı oda kullanılıyor', null, array['ac', 'wifi', 'tv', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'heating', 'slippers']::text[]),
  ('Ramada Golden Horn', 'Single Oda', '1 king yatak (ayrı single oda yok; Standart King oda tek kişi kullanımı)', 27, array['ac', 'wifi', 'tv', 'minibar', 'coffee_machine', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'heating', 'wardrobe', 'slippers']::text[]),
  ('Ramada Golden Horn', 'Double Oda', '1 king yatak (Standart King) veya 2 tek kişilik yatak (Standart Twin)', 27, array['ac', 'wifi', 'tv', 'minibar', 'coffee_machine', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'heating', 'wardrobe', 'slippers']::text[]),
  ('Ramada Golden Horn', 'Triple Oda', '3 tek kişilik yatak (Triple oda)', 28, array['ac', 'wifi', 'tv', 'minibar', 'coffee_machine', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'heating', 'wardrobe', 'slippers']::text[]),
  ('Ramada Florya', 'Single Oda', '1 çift kişilik yatak (ayrı single oda yok; standart oda tek kişi kullanımı)', 23, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'phone']::text[]),
  ('Ramada Florya', 'Double Oda', '1 çift kişilik yatak (standart oda)', 23, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'phone']::text[]),
  ('Ramada Florya', 'Triple Oda', '1 çift kişilik + 1 tek kişilik yatak', null, array['ac', 'wifi', 'tv', 'minibar', 'safe', 'phone']::text[]),
  ('Business Life Bakırköy', 'Single Oda', 'Economy Single oda (1 kişilik); yatak tipi belirtilmemiş', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'slippers']::text[]),
  ('Business Life Bakırköy', 'Double Oda', '1 çift kişilik yatak (Standart oda; Ekonomik çift kişilik oda 14 m²)', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'slippers']::text[]),
  ('Business Life Bakırköy', 'Triple Oda', 'Standart oda (3 kişilik): çift kişilik yatak + ek yatak/kanepe; üçüncü yatak tipi doğrulanamadı', null, array['ac', 'wifi', 'tv', 'minibar', 'kettle', 'safe', 'hairdryer', 'desk', 'private_bathroom', 'shower', 'phone', 'slippers']::text[])
) as v(hotel_name, room_name, bed_info, size_m2, amenities)
join public.hotels h on h.name = v.hotel_name
where rt.hotel_id = h.id and rt.name_tr = v.room_name;

-- Uygulamayla gelen otel ve oda görselleri (public/otel-gorselleri). Görsel zaten kayıtlıysa tekrar eklenmez.
-- Otel veya oda adı bulunamazsa o satır atlanır. Otelin/odanın zaten kapak görseli varsa yenisi kapak yapılmaz.
insert into public.hotel_images (hotel_id, room_type_id, storage_path, sort_order, is_cover)
select h.id, rt.id, v.path, v.sort_order + 100,
  v.is_cover and not exists (
    select 1 from public.hotel_images e
    where e.hotel_id = h.id and e.is_cover and e.room_type_id is not distinct from rt.id
  )
from (values
  ('Bricks Hotel', null, '/otel-gorselleri/bricks-hotel/otel-dis-cephe.webp', 0, true),
  ('Bricks Hotel', null, '/otel-gorselleri/bricks-hotel/otel-dis-cephe-2.webp', 1, false),
  ('Bricks Hotel', null, '/otel-gorselleri/bricks-hotel/otel-lobi.webp', 2, false),
  ('Bricks Hotel', null, '/otel-gorselleri/bricks-hotel/otel-restoran.webp', 3, false),
  ('Bricks Hotel', 'Single Oda', '/otel-gorselleri/bricks-hotel/oda-single.webp', 0, true),
  ('Bricks Hotel', 'Double Oda', '/otel-gorselleri/bricks-hotel/oda-double.webp', 0, true),
  ('Bricks Hotel', 'Double Oda', '/otel-gorselleri/bricks-hotel/oda-double-2.webp', 1, false),
  ('Bricks Hotel', 'Triple Oda', '/otel-gorselleri/bricks-hotel/oda-triple.webp', 0, true),
  ('ADM Grand', null, '/otel-gorselleri/adm-grand/otel-dis-cephe.webp', 0, true),
  ('ADM Grand', null, '/otel-gorselleri/adm-grand/otel-lobi.webp', 1, false),
  ('ADM Grand', null, '/otel-gorselleri/adm-grand/otel-havuz.webp', 2, false),
  ('ADM Grand', null, '/otel-gorselleri/adm-grand/otel-restoran.webp', 3, false),
  ('ADM Grand', 'Single Oda', '/otel-gorselleri/adm-grand/oda-single.webp', 0, true),
  ('ADM Grand', 'Double Oda', '/otel-gorselleri/adm-grand/oda-double.webp', 0, true),
  ('ADM Grand', 'Double Oda', '/otel-gorselleri/adm-grand/oda-double-2.webp', 1, false),
  ('ADM Grand', 'Triple Oda', '/otel-gorselleri/adm-grand/oda-triple.webp', 0, true),
  ('La Quinta Basin Hotel', null, '/otel-gorselleri/la-quinta-basin/otel-dis-cephe.webp', 0, true),
  ('La Quinta Basin Hotel', null, '/otel-gorselleri/la-quinta-basin/otel-lobi.webp', 1, false),
  ('La Quinta Basin Hotel', null, '/otel-gorselleri/la-quinta-basin/otel-lobi-2.webp', 2, false),
  ('La Quinta Basin Hotel', null, '/otel-gorselleri/la-quinta-basin/otel-restoran.webp', 3, false),
  ('La Quinta Basin Hotel', 'Single Oda', '/otel-gorselleri/la-quinta-basin/oda-single.webp', 0, true),
  ('La Quinta Basin Hotel', 'Double Oda', '/otel-gorselleri/la-quinta-basin/oda-double.webp', 0, true),
  ('La Quinta Basin Hotel', 'Double Oda', '/otel-gorselleri/la-quinta-basin/oda-double-2.webp', 1, false),
  ('La Quinta Basin Hotel', 'Triple Oda', '/otel-gorselleri/la-quinta-basin/oda-triple.webp', 0, true),
  ('La Quinta Basin Hotel', 'Triple Oda', '/otel-gorselleri/la-quinta-basin/oda-triple-2.webp', 1, false),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-dis-cephe.webp', 0, true),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-dis-cephe-2.webp', 1, false),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-lobi.webp', 2, false),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-lobi-2.webp', 3, false),
  ('Martinenz Hotel', null, '/otel-gorselleri/martinenz-hotel/otel-restoran.webp', 4, false),
  ('Martinenz Hotel', 'Single Oda', '/otel-gorselleri/martinenz-hotel/oda-single.webp', 0, true),
  ('Martinenz Hotel', 'Double Oda', '/otel-gorselleri/martinenz-hotel/oda-double.webp', 0, true),
  ('Martinenz Hotel', 'Double Oda', '/otel-gorselleri/martinenz-hotel/oda-double-2.webp', 1, false),
  ('Martinenz Hotel', 'Triple Oda', '/otel-gorselleri/martinenz-hotel/oda-triple.webp', 0, true),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-dis-cephe.webp', 0, true),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-dis-cephe-2.webp', 1, false),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-lobi.webp', 2, false),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-lobi-2.webp', 3, false),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-havuz.webp', 4, false),
  ('Glorious Hotel', null, '/otel-gorselleri/glorious-hotel/otel-restoran.webp', 5, false),
  ('Glorious Hotel', 'Single Oda', '/otel-gorselleri/glorious-hotel/oda-single.webp', 0, true),
  ('Glorious Hotel', 'Double Oda', '/otel-gorselleri/glorious-hotel/oda-double.webp', 0, true),
  ('Glorious Hotel', 'Double Oda', '/otel-gorselleri/glorious-hotel/oda-double-2.webp', 1, false),
  ('Glorious Hotel', 'Triple Oda', '/otel-gorselleri/glorious-hotel/oda-triple.webp', 0, true),
  ('Glorious Hotel', 'Triple Oda', '/otel-gorselleri/glorious-hotel/oda-triple-2.webp', 1, false),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-dis-cephe.webp', 0, true),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-lobi.webp', 1, false),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-lobi-2.webp', 2, false),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-teras.webp', 3, false),
  ('Sorisso Hotel', null, '/otel-gorselleri/sorisso-hotel/otel-restoran.webp', 4, false),
  ('Sorisso Hotel', 'Single Oda', '/otel-gorselleri/sorisso-hotel/oda-single.webp', 0, true),
  ('Sorisso Hotel', 'Double Oda', '/otel-gorselleri/sorisso-hotel/oda-double.webp', 0, true),
  ('Sorisso Hotel', 'Double Oda', '/otel-gorselleri/sorisso-hotel/oda-double-2.webp', 1, false),
  ('Sorisso Hotel', 'Triple Oda', '/otel-gorselleri/sorisso-hotel/oda-triple.webp', 0, true),
  ('Sorisso Hotel', 'Triple Oda', '/otel-gorselleri/sorisso-hotel/oda-triple-2.webp', 1, false),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-dis-cephe.webp', 0, true),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-dis-cephe-2.webp', 1, false),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-lobi.webp', 2, false),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-lobi-2.webp', 3, false),
  ('Büyük Hamit Hotel', null, '/otel-gorselleri/buyuk-hamit-hotel/otel-restoran.webp', 4, false),
  ('Büyük Hamit Hotel', 'Single Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-single.webp', 0, true),
  ('Büyük Hamit Hotel', 'Double Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-double.webp', 0, true),
  ('Büyük Hamit Hotel', 'Double Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-double-2.webp', 1, false),
  ('Büyük Hamit Hotel', 'Triple Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-triple.webp', 0, true),
  ('Büyük Hamit Hotel', 'Triple Oda', '/otel-gorselleri/buyuk-hamit-hotel/oda-triple-2.webp', 1, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-dis-cephe.webp', 0, true),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-dis-cephe-2.webp', 1, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-lobi.webp', 2, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-lobi-2.webp', 3, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-havuz.webp', 4, false),
  ('Holiday Inn Topkapı', null, '/otel-gorselleri/holiday-inn-topkapi/otel-restoran.webp', 5, false),
  ('Holiday Inn Topkapı', 'Single Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-single.webp', 0, true),
  ('Holiday Inn Topkapı', 'Double Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-double.webp', 0, true),
  ('Holiday Inn Topkapı', 'Double Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-double-2.webp', 1, false),
  ('Holiday Inn Topkapı', 'Triple Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-triple.webp', 0, true),
  ('Holiday Inn Topkapı', 'Triple Oda', '/otel-gorselleri/holiday-inn-topkapi/oda-triple-2.webp', 1, false),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-dis-cephe.webp', 0, true),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-dis-cephe-2.webp', 1, false),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-lobi.webp', 2, false),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-lobi-2.webp', 3, false),
  ('Ramada Golden Horn', null, '/otel-gorselleri/ramada-golden-horn/otel-restoran.webp', 4, false),
  ('Ramada Golden Horn', 'Single Oda', '/otel-gorselleri/ramada-golden-horn/oda-single.webp', 0, true),
  ('Ramada Golden Horn', 'Double Oda', '/otel-gorselleri/ramada-golden-horn/oda-double.webp', 0, true),
  ('Ramada Golden Horn', 'Double Oda', '/otel-gorselleri/ramada-golden-horn/oda-double-2.webp', 1, false),
  ('Ramada Golden Horn', 'Triple Oda', '/otel-gorselleri/ramada-golden-horn/oda-triple.webp', 0, true),
  ('Ramada Florya', null, '/otel-gorselleri/ramada-florya/otel-dis-cephe.webp', 0, true),
  ('Ramada Florya', null, '/otel-gorselleri/ramada-florya/otel-dis-cephe-2.webp', 1, false),
  ('Ramada Florya', null, '/otel-gorselleri/ramada-florya/otel-lobi.webp', 2, false),
  ('Ramada Florya', null, '/otel-gorselleri/ramada-florya/otel-restoran.webp', 3, false),
  ('Ramada Florya', 'Single Oda', '/otel-gorselleri/ramada-florya/oda-single.webp', 0, true),
  ('Ramada Florya', 'Double Oda', '/otel-gorselleri/ramada-florya/oda-double.webp', 0, true),
  ('Ramada Florya', 'Triple Oda', '/otel-gorselleri/ramada-florya/oda-triple.webp', 0, true),
  ('Business Life Bakırköy', null, '/otel-gorselleri/business-life-bakirkoy/otel-dis-cephe.webp', 0, true),
  ('Business Life Bakırköy', null, '/otel-gorselleri/business-life-bakirkoy/otel-dis-cephe-2.webp', 1, false),
  ('Business Life Bakırköy', null, '/otel-gorselleri/business-life-bakirkoy/otel-lobi.webp', 2, false),
  ('Business Life Bakırköy', null, '/otel-gorselleri/business-life-bakirkoy/otel-restoran.webp', 3, false),
  ('Business Life Bakırköy', 'Single Oda', '/otel-gorselleri/business-life-bakirkoy/oda-single.webp', 0, true),
  ('Business Life Bakırköy', 'Double Oda', '/otel-gorselleri/business-life-bakirkoy/oda-double.webp', 0, true),
  ('Business Life Bakırköy', 'Double Oda', '/otel-gorselleri/business-life-bakirkoy/oda-double-2.webp', 1, false),
  ('Business Life Bakırköy', 'Triple Oda', '/otel-gorselleri/business-life-bakirkoy/oda-triple.webp', 0, true),
  ('Business Life Bakırköy', 'Triple Oda', '/otel-gorselleri/business-life-bakirkoy/oda-triple-2.webp', 1, false)
) as v(hotel_name, room_name, path, sort_order, is_cover)
join public.hotels h on h.name = v.hotel_name
left join public.room_types rt on rt.hotel_id = h.id and rt.name_tr = v.room_name
where (v.room_name is null or rt.id is not null)
  and not exists (select 1 from public.hotel_images e where e.storage_path = v.path);

commit;
