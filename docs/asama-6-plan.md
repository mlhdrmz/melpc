# 6. aşama planı: laptop görünümü ve popüler parçalar

Kapsam: Bilgisayarım'daki laptop görselini normal bir laptop gibi göstermek ve kataloğa popüler parçaları eklemek. Melih kararları 19.11.2026'da verdi.

## Kararlar

1. **İş bölümü:** Parça ve kaynak araştırması ile görsel taslaklar Claude sohbetinde yapılır. Sonuçlar (ölçü dokümanı, katalog kayıtları) depoya yazılır ve doğrudan `main`'e gönderilir. Kodlama Claude Code'da yapılır.
2. **Oyun puanı:** Şimdilik yok, sonra eklenecek. Arayüzdeki "ölçüm kaynağı yok" notları yerinde kalır; bu aşamada oyunla ilgili kod değişmez.
3. **Laptop görseli:**
   - Varsayılan görünüm ekranı açık, normal bir laptop: ekran, klavye ve touchpad. Marka kopyası değil; yazı ve logo yok.
   - İç görünüme iki yoldan geçilir: 3D görünümdeki "İçini göster" düğmesi ve Bilgisayarım'daki listede bir parçaya (bellek, SSD, Wi-Fi) tıklamak. Tıklanan parça mor ışıkla vurgulanır.
   - İç görünümde klavyenin olduğu üst yüzey buzlu cam gibi saydamlaşır, iç kısım onun altından görünür. Ekran yerinde kalır; ekransız iç görünüm yok.
4. **Yeni parçalar:** Popüler markaların en çok kullanılan parçaları. Kategoriler sonra daha da genişletilecek.
   - Önce aday listesi çıkarılır (`docs/katalog-aday-listesi-2.md`) ve Melih onaylar.
   - Özellikler üreticinin sayfasından, kaynağıyla toplanır ve `data/catalog/` dosyalarına doğrudan yazılır. Katalog doğrulamasından ve testlerden geçtiği kontrol edilir.
5. **Kapsam:** Bu aşamada yalnızca bu işler var. Diğerleri "Sonraya kalanlar"da.

## Yapılacaklar

### Sohbette (araştırma ve tasarım)

1. Laptop görselinin taslağı: dış ve iç görünüm. ✓ Melih 19.11.2026'da onayladı; ölçüler `design/laptop-olculeri.md`'de, görseller ve taslak kodu `design/laptop-*` dosyalarında.
2. Aday parça listesi (`docs/katalog-aday-listesi-2.md`, 46 parça). ✓ Melih 19.11.2026'da onayladı; parçalar kataloğa ekleniyor.

### Code'da (kodlama)

`design/laptop-olculeri.md` eklendikten sonra başlar. Önceki aşamalardaki gibi ayrı bir dalda yapılır. Dal açmadan önce `main` güncellenir, çünkü sohbetten gelen dosyalar doğrudan `main`'e gönderiliyor.

1. Laptop gövde modeli: dış görünüm, `design/laptop-olculeri.md`'ye göre.
2. İç görünüm: üst yüzey buzlu cam gibi saydamlaşır; geçiş yumuşak olur.
3. "İçini göster / Dışını göster" düğmesi ve listede bir parçaya tıklayınca iç görünüme geçiş.
4. Testler geçer, tip denetimi temiz.

## Sonraya kalanlar

- Oyun puanı: kullanım şartları izin veren bir kaynak bulununca.
- Kategorileri genişletme: daha çok model ve alt segment.
- Tasarım değişiklikleri: Melih'in istekleri gelecek.
- Laptop ve monitörler; çevre birimleri; "bilgisayar nasıl toplanır" rehberi; kurulum dosyası.
- Önceki aşamalardan açık kalanlar: Vatan Bilgisayar'ın hız sınırı, masaüstü bilgisayar okuma, hazır sistem karşılaştırmasının kısmi kalması (bkz. `docs/asama-3-plan.md`, `docs/asama-4-plan.md`, `docs/asama-5-plan.md`).

## Bitiş ölçütleri

- Laptop dış ve iç görünümü onaylanan taslağa uyuyor; düğmeyle ve listeden iç görünüme geçiş çalışıyor.
- Yeni parçalar katalog doğrulamasından geçiyor; her değerin kaynağı var.
- Testler geçiyor, tip denetimi temiz.
