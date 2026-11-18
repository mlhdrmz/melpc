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
- **Arayüz çatısı:** React + TypeScript, Vite ile. 3D görünüm Three.js ile, React Three Fiber üzerinden yazılır.
- **Veritabanı kütüphanesi:** Windows'ta ek derleme aracı (Visual Studio Build Tools, Python) gerektirmeyen bir SQLite kütüphanesi.
- **Fontlar:** Uygulama internetsiz de açılabilmeli; fontlar (Saira, Inter) uygulamanın içine paketlenir.
- **Tasarım yönü:** "B · Vitrin" taslağı: koyu zemin, mor ve turkuaz ışıklar, kasa ekranın ortasında büyük. Logo olarak "A · Atölye" taslağındaki çip logosu kullanılır.
- **İlk sürümün (v1) kapsamı:** Yalnızca masaüstü kasa toplama. Laptop ve monitörler sonraki sürümde; klavye, mouse, monitör kolu gibi çevre birimleri daha sonra.
- **Pazar:** Türkiye. Fiyatlar TL olarak, Türkiye'deki mağazalardan alınır.
- **Fiyat takibi:** Baştan otomatik (bkz. Fiyat motoru).
- **Mağazalar:** İtopya, Gaming.gen.tr ve Vatan Bilgisayar (3. aşamada kesinleşti). Sinerji ve Amazon Türkiye'nin robots.txt dosyası bütün siteyi yasaklıyor; İncehesap ve Hepsiburada bot korumalı. Bunlar şimdilik yok; ayrıntı `docs/asama-3-plan.md`.
- **Açıklamalar:** "Neden iyi, neden kötü" metinleri önceden yazılmış kurallara dayanır. Uygulamanın içinde canlı yapay zekâ yok (API maliyeti yüzünden).
- **Kasa görünümü:** MelPC'ye özgü bir kasa. Gri metal gövde, pahlı kenarlar, köşeleri vidalı cam yan pencere, camın altında mor-turkuaz ışık çizgisi ve güç kaynağını örten havalandırmalı bir bant var; ön yüzde ışıklı, ızgaralı bir altıgen ve arkasında üç fan bulunuyor. Herhangi bir markanın kasasının kopyası değil; üzerinde yazı ya da logo yok.
- **3D:** Tek bir standart kasa (genel model); bütün toplamalarda aynı temel görsel kullanılır. Parçalar gerçekte durdukları yerde, ATX ölçülerine göre yerleşir (bkz. `design/kasa-olculeri.md`). Temel görselde sıvı soğutma (işlemcide pompa, tavanda 360 mm radyatör ve 3 fan), arka fan, önde 3 fan ve mor-siyah kılıflı kablolar var. Kasa Topla ekranında seçilen parçanın yeri mor ışıkla vurgulanır. Her ürün için ayrı 3D model yapılmaz.
- **3D görünümün yapısı:** Görünüm, ileride laptop modeli de eklenebilecek şekilde kurulur; gösterilen "gövde modeli" (masaüstü kasa, laptop) değiştirilebilir olmalı.
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

1. Proje dokümanı ve tasarım taslakları. ✓ Tamamlandı: "B · Vitrin" seçildi, kasanın dışı ve içi netleşti (bkz. `design/`).
2. Uygulama iskeleti, katalog, uyumluluk, 3D kasa ve Kasa Topla ekranı. ✓ Tamamlandı — plan: `docs/asama-2-plan.md`
3. Fiyat motoru (Türkiye mağazaları). ← **şu an burada** — ayrıntılı plan ve durum: `docs/asama-3-plan.md` (Melih onayladı)
4. Karşılaştırma ekranları, puanlama, açıklamalar ve hazır satılan kasalarla karşılaştırma.
5. "Bilgisayarım": kendi bilgisayarını okuma ve yükseltme önerileri.

Sonra: laptop ve monitörler; klavye, mouse, ek ekran ve monitör kolu gibi çevre birimleri; "bilgisayar nasıl toplanır" rehberi; kurulum dosyası.

Laptop görseli (laptoplar eklendiğinde ya da 5. aşamada): Laptoplarda toplama yok; işlemci ve ekran kartı karta lehimli, kullanıcı genelde yalnızca RAM (bazı modellerde), SSD ve bazen Wi-Fi kartını değiştirebilir. Bu yüzden görsel "içinde ne var, neyi yükseltebilirim" sorusuna cevap verir. Genel düzen: arkada iki fan ve ısı boruları, altlarında işlemci ve ekran kartı, ortada RAM ve SSD yuvaları, önde batarya. İnce laptoplar için RAM'in lehimli olduğu ikinci bir sürüm gerekebilir. Melih'in kendi bilgisayarı da bir laptop; "Bilgisayarım" ekranında yükseltme önerilerini bu görselle göstermek işe yarar.

## Tasarım dosyaları (`design/`)

- `kasa-topla-vitrin.html`: Seçilen "B · Vitrin" Kasa Topla ekranı; tarayıcıda tek başına açılır. Görünüşün referansıdır, uygulamaya doğrudan kopyalanacak kod değildir.
- `kasa-ici.svg` ve `kasa-gorunumu.png`: Kasanın dışı ve sıvı soğutmalı iç görseli.
- `kasa-olculeri.md`: 3D modelde kullanılacak koordinat sistemi ve parçaların milimetre cinsinden yerleri.
- Taslaklardaki parça adları, fiyatlar, puanlar ve mağazalar örnektir; gerçek değildir.

## Henüz karar verilmeyenler (başlamadan önce Melih'e sor)

- Şu an açık karar yok.
