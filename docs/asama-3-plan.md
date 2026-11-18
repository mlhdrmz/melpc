# 3. aşama planı: fiyat motoru

Kapsam: Türkiye mağazalarından fiyatları otomatik çekmek, fiyat geçmişini tutmak, bir parçanın en ucuz nerede olduğunu ve toplamın kaça geldiğini göstermek. Melih aşağıdaki kararları 18.11.2026'da onayladı ("önerilerle başla").

## Kararlar

- **Dal:** `asama-3`. PR #3 (2. aşama) henüz birleşmediği için dal `asama-2`'nin üstünden açıldı.
- **Mağazalar:** İtopya, Gaming.gen.tr ve Vatan Bilgisayar ile başlanır. Sinerji, Amazon Türkiye, İncehesap ve Hepsiburada şimdilik yok (aşağıdaki ön kontrol).
- **Çekme zamanı:** Uygulama açılınca, son çekimin üzerinden 12 saat geçmişse arka planda çekilir. "Şimdi güncelle" düğmesi var. İkisi birlikte son 24 saatte en fazla 2 çekim yapabilir. Uygulama kapalıyken çalışan bir servis yok.
- **Ürün eşleştirme:** Okuyucu ürünü mağazada önce üretici koduyla, olmazsa model adıyla bulur. İlk eşleşme Melih'e "Bu ürün mü?" diye gösterilir. Onaylanırsa ürünün linki kaydedilir ve sonraki çekimler o linkten yapılır. Üretici kodu tutmayan bir eşleşme hiçbir zaman kendiliğinden kabul edilmez.
- **Hangi fiyat:** Ürün sayfasında görünen KDV dahil peşin fiyat ve stok durumu. Kargo, sepet indirimi, kupon ve taksit farkı hesaba katılmaz; ekranda bu belirtilir.
- **Toplamlar:**
  - "En ucuz kombinasyon": her parça en ucuz olduğu mağazadan.
  - "Tek mağazadan": bütün parçalar o mağazada stoktaysa o mağazanın toplamı.
  - Her parçada en ucuz mağaza ve diğer mağazaların fiyatları görünür.
- **Okunamayan fiyat:** "güncel değil" olarak, son okunduğu tarihle görünür. 3 günden eski fiyat toplamlara katılmaz.
- **Fiyat geçmişi:** Parça ayrıntısında, mağaza başına basit bir çizgi.
- **2. aşamadan kalanlar:** Çıkarılan parçaların yerine (Pure Rock 3, Kraken Plus 360, Q300L V2, Micro-ATX/Mini-ITX kasalar) adaylar bu aşamada, Türkiye'de satılıp satılmadıkları mağazalardan kontrol edilerek eklenir.

## Mağaza ön kontrolü (18.11.2026)

CLAUDE.md kuralı: kullanım şartlarında otomatik erişimi açıkça yasaklayan mağaza listeden çıkarılır. Ayrıca okuyucu `robots.txt` kurallarına uyar ve bot korumasını aşmaya çalışmaz.

| Mağaza | Kullanım şartları | robots.txt | Not |
|---|---|---|---|
| İtopya | Sitede genel bir kullanım şartları sayfası yok; gizlilik politikası, mesafeli satış sözleşmesi, iptal-iade ve garanti sayfalarında otomatik erişimle ilgili bir yasak yok. | Ürün sayfaları serbest. `/Urun/`, `/bilgisayar/`, `/kendin-topla`, arama sonuç sayfalaması ve bazı başka yollar yasak. | Ürün sayfasında yapılandırılmış veri (JSON-LD) var: fiyat, stok, üretici kodu. |
| Gaming.gen.tr | "Şartlar ve Koşullar" 2.2: site bilgilerinin çoğaltılması, yayınlanması ve başka sitede izinsiz kullanılması yasak. Otomatik erişimi yasaklayan bir madde yok. Kişisel fiyat takibi yayın yapmadığı için bu maddeye girmiyor. | Ürün ve arama sayfaları serbest. `robots.txt` yapay zekâ ve arama kullanımına açıkça izin veriyor. | JSON-LD'de fiyat, stok, EAN var; üretici kodu sayfadaki "Üretici Kodu" satırında. |
| Vatan Bilgisayar | Sitede genel bir kullanım şartları sayfası bulunamadı; gizlilik ve üyelik metinlerinde otomatik erişim yasağı yok. | Ürün sayfaları serbest. Arama sayfaları (`/arama/`) ve sayfalama yasak. | Cloudflare hız sınırı var: birkaç istekten sonra "1015" hatası verdi. Okuyucu bu mağazada çok yavaş çalışır, hata alınca o çekimi bırakır. |
| Sinerji | Bakılmadı | `Disallow: /` satırı var | Şimdilik yok |
| Amazon Türkiye | Bakılmadı | `Disallow: /` satırı var | Şimdilik yok |
| İncehesap, Hepsiburada | Bakılmadı | Düz isteğe 403 (bot koruması) | Koruma aşılmaz; şimdilik yok |

Ürün sayfaları mağazaların site haritalarından (`sitemap`) bulunur; Vatan'da arama sayfası yasak olduğu için bu zorunlu, diğerlerinde de istek sayısını azaltır.

## Yapılacaklar

1. Fiyat motoru çekirdeği: veri tipleri, robots.txt denetimi, mağaza başına bekleme ve hata durumunda durma, JSON-LD okuyucu, üretici kodu karşılaştırması, site haritasından aday bulma, toplam hesapları. Birim testleri.
2. Mağaza okuyucuları (İtopya, Gaming.gen.tr, Vatan) ve canlı deneme.
3. Veritabanı: eşleşmeler, fiyat geçmişi, çekim kayıtları.
4. Arayüz: parça listesinde ve seçme penceresinde fiyatlar, üstte toplamlar, parça ayrıntısında mağaza fiyatları ve fiyat geçmişi, "Mağaza eşleştirme" ekranı, fiyat durumu ve "Şimdi güncelle".
5. Çıkarılan parçaların yerine adaylar.

## Durum (18.11.2026)

- 1–4 yapıldı. Eşleştirme kuralları İtopya ve Gaming.gen.tr'nin site haritalarıyla (102 parça) çevrimdışı denendi ve sıkılaştırıldı: kapasite (1 TB ≠ 2 TB), model soneki (B850 ≠ B850M, 245K ≠ 245KF), marka, bellek modül düzeni (2×16 ≠ 1×32) ve paket ürünler ayrılıyor.
- Canlı deneme: İtopya ve Gaming.gen.tr'de arama, "Bu ürün mü?" onayı ve fiyat okuma çalıştı (Samsung 990 Pro 2 TB iki mağazada da üretici koduyla eşleşti). İstekler mağaza başına 6 saniye arayla gitti.
- Vatan Bilgisayar ilk istekte HTTP 429 (Cloudflare hız sınırı) döndürüyor. Okuyucu bunu tanıyıp o işte Vatan'ı atlıyor; koruma aşılmaya çalışılmıyor. Sınır kalkana kadar Vatan'dan fiyat gelmez.
- Bazı mağazalar "üretici kodu" alanına model adı ya da barkod yazıyor; bunlar kod sayılmıyor ("kod yok" görünür, Melih ürün adına bakarak karar verir).

### 2. aşamadan kalanlar

Satış durumu İtopya ve Gaming.gen.tr'nin site haritalarından kontrol edildi (Vatan'ınki hız sınırı yüzünden okunamadı).

- **NZXT Kraken Plus 360:** İtopya'da 2025 RGB sürümü var (siyah RL-KR360-B2, beyaz RL-KR360-W2; kontrol sırasında ikisi de stokta yoktu). Kataloğa siyah sürüm "Kraken Plus 360 RGB (2025)" olarak girdi; özellikler NZXT'nin teknik sayfasından.
- **be quiet! Pure Rock 3:** İki mağazada da yok; eklenmedi.
- **Cooler Master MasterBox Q300L V2:** İki mağazada da yok; eklenmedi.
- **Micro-ATX kasa (Melih seçti):** ASUS A21 Plus ve MSI MAG PANO M100R PZ eklendi; ikisi de İtopya'da ve Gaming.gen.tr'de var. Özellikler ASUS'un ürün sayfasından ve MSI'ın teknik föyünden (MSI'ın sayfası otomatik okumaya kapalı). İkisinin de üretici kodu üretici kaynaklarında yazmadığı için katalogda kod yok; eşleşme ürün adına bakılarak onaylanır. Katalogda artık 105 parça var.
- **Mini-ITX kasa:** Melih NZXT H2 Flow'u seçti, ama NZXT'nin teknik sayfasına göre bu kasa yalnızca SFX/SFX-L güç kaynağı (en fazla 130 mm) ve en fazla 75 mm hava soğutucu alıyor; radyatör yalnızca önde, 280 mm'ye kadar ve fan + radyatör en fazla 60 mm kalınlıkta. Katalogdaki güç kaynaklarının ve hava soğutucuların hiçbiri sığmıyor, radyatör kalınlığını da uyumluluk motoru henüz denetleyemiyor. Eklenmeden önce Melih'e soruldu.

## Bitiş ölçütleri

- Üç mağazadan onaylanmış eşleşmelerin fiyatları çekiliyor; okunamayan fiyat "güncel değil" görünüyor ve toplama katılmıyor.
- Hiçbir fiyat tahmin edilmiyor ya da uydurulmuyor; her fiyatın mağazası, linki ve okunduğu zaman görünüyor.
- Testler geçiyor.
