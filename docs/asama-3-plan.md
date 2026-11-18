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

## Bitiş ölçütleri

- Üç mağazadan onaylanmış eşleşmelerin fiyatları çekiliyor; okunamayan fiyat "güncel değil" görünüyor ve toplama katılmıyor.
- Hiçbir fiyat tahmin edilmiyor ya da uydurulmuyor; her fiyatın mağazası, linki ve okunduğu zaman görünüyor.
- Testler geçiyor.
