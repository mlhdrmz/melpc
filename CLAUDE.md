# MelPC

MelPC, bilgisayar toplamak ya da hazır bilgisayar almak isteyip kafası karışık olan birinin her şeyi tek yerde anlayabileceği bir **Windows masaüstü uygulaması**. İtopya ve Gaming.gen.tr'deki "PC toplama" araçlarının daha kapsamlısı:

- parçalar ve teknik özellikleri,
- uyumluluk kontrolü (ne neye uyar, ne uymaz),
- Türkiye fiyatları ve bir parçanın en ucuz nerede olduğu,
- parçaların kendi kategorisi içinde sıralaması,
- toplanan sistemin "neden iyi, neden kötü" değerlendirmesi,
- parça ve sistem karşılaştırma ekranları,
- kasanın içini gösteren 3D görünüm.

Hem oyuncu hem mühendis dostu olmalı.

## Çalışma kuralları (önce bunları oku)

- Proje sahibi Melih. Onunla Türkçe konuş. Uygulamanın arayüzü Türkçe; kod, dosya ve değişken adları İngilizce.
- Sorulmayan hiçbir şeyi kendi inisiyatifinle değiştirme: tasarım, görsel, metin, içerik ya da çalışan kod. Emin değilsen önce sor.
- Büyük bir geliştirme ya da yeni bir özellik işine başlamadan önce netleştirici soruları numaralı liste olarak sor. Melih onaylamadan başlama.
- Fiyat, performans değeri ya da teknik özellik asla uydurulmaz. Bilinmeyen bir değer "bilinmiyor" ya da "güncel değil" olarak görünür.

## Alınan kararlar

- **Platform:** Windows masaüstü uygulaması. Şimdilik yalnızca Melih'in kişisel kullanımı için; hesap ve giriş sistemi yok.
- **Teknoloji:** Electron, 3D için Three.js, yerel veritabanı olarak SQLite. Arayüz HTML/CSS/JS ile yazılır.
- **Tasarım yönü:** "B · Vitrin" taslağı: koyu zemin, mor ve turkuaz ışıklar, kasa ekranın ortasında büyük. Logo olarak "A · Atölye" taslağındaki çip logosu kullanılır.
- **İlk sürümün (v1) kapsamı:** Yalnızca masaüstü kasa toplama. Laptop ve monitörler sonraki sürümde; klavye, mouse, monitör kolu gibi çevre birimleri daha sonra.
- **Pazar:** Türkiye. Fiyatlar TL olarak, Türkiye'deki mağazalardan alınır.
- **Fiyat takibi:** Baştan otomatik (bkz. Fiyat motoru).
- **Açıklamalar:** "Neden iyi, neden kötü" metinleri önceden yazılmış kurallara dayanır. Uygulamanın içinde canlı yapay zekâ yok (API maliyeti yüzünden).
- **3D:** Tek bir standart kasa (genel model). Anakart, işlemci ve soğutucusu, RAM, ekran kartı, güç kaynağı (PSU), diskler ve fanların kasada genelde nerede durduğunu gösterir. Kasa toplama ekranında seçilen parçanın yeri vurgulanır. Her ürün için ayrı 3D model yapılmaz.
- **Kurulum dosyası:** Şimdilik yok. Uygulama sık güncelleneceği için sonraya bırakıldı. Geliştirme sırasında `npm install` ve `npm start` ile çalıştırılır.

## Motorlar

Uygulamanın mantığı, birbiriyle birlikte çalışan motorlara ayrılır:

1. **Katalog motoru:** Parçalar ve teknik özellikleri. Her bilginin kaynağı (link) ve eklenme/güncellenme tarihi saklanır.
2. **Fiyat motoru:** Her mağaza için ayrı bir okuyucu (adaptör). Fiyat geçmişini tutar, bir parçanın en ucuz nerede olduğunu bulur.
   - Mağazaları yormamak için seyrek çeker (günde 1–2 kez).
   - Okuyamadığı fiyatı tahmin etmez, "güncel değil" olarak gösterir.
   - Kullanım şartlarında otomatik erişimi açıkça yasaklayan bir mağaza listeden çıkarılır.
   - Aynı ürün farklı mağazalarda model ve üretici kodlarıyla eşleştirilir.
3. **Uyumluluk motoru:** İşlemci soketi ve chipset, RAM tipi, hızı ve kapasitesi, güç hesabı (PSU yeterli mi), kasa ile anakart form faktörü, ekran kartı uzunluğu ile kasa sınırı, soğutucu yüksekliği, radyatör ve fan yerleri, M.2 ve SATA yuvaları.
4. **Puan motoru:** Parçaları kendi kategorisi içinde sıralar; toplanan sistemi oyun ve mühendislik kullanımı için ayrı ayrı değerlendirir.
5. **Açıklama motoru:** Kural tabanlı "neden iyi, neden kötü" metinleri ve çoğu kişinin gözden kaçırdığı ayrıntılar: watt değerleri, darboğaz, masaüstü ve laptop parçaları arasındaki farklar.
6. **Donanım okuma motoru:** Melih'in kendi bilgisayarındaki parçaları okur ve yükseltme önerir ("bu anakarta hangi parça uyar").

## Veri ilkeleri

- Performans değerleri her zaman kaynağıyla ve nerede, nasıl ölçüldüğüyle (benchmark adı, test koşulları) gösterilir.
- Her teknik özelliğin bir kaynağı vardır. Kaynağı olmayan bilgi kataloğa girmez.

## Aşamalar

1. Proje dokümanı ve tasarım taslakları. "B · Vitrin" seçildi; kasanın görünümü örnek fotoğrafa göre netleşecek. ← **şu an burada**
2. Uygulama iskeleti, katalog, uyumluluk, 3D kasa ve Kasa Topla ekranı.
3. Fiyat motoru (Türkiye mağazaları).
4. Karşılaştırma ekranları, puanlama, açıklamalar ve hazır satılan kasalarla karşılaştırma.
5. "Bilgisayarım": kendi bilgisayarını okuma ve yükseltme önerileri.

Sonra: laptop ve monitörler; klavye, mouse, ek ekran ve monitör kolu gibi çevre birimleri; "bilgisayar nasıl toplanır" rehberi; kurulum dosyası.

## Henüz karar verilmeyenler (başlamadan önce Melih'e sor)

- Kasanın görünümü: kutu gibi değil, daha farklı bir kasa olacak. Melih örnek bir kasa fotoğrafı gönderecek; kasa ona göre çizilecek.
- Arayüz çatısı: React, Svelte ya da sade JavaScript.
- Takip edilecek mağazalar. Öneri: İtopya, Gaming.gen.tr, Vatan Bilgisayar, İncehesap, Sinerji, Hepsiburada, Amazon Türkiye. 3. aşamada kesinleşecek.
