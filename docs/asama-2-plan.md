# 2. aşama planı

Kapsam: uygulama iskeleti, katalog, uyumluluk, 3D kasa ve Kasa Topla ekranı. Melih bu planı ve aşağıdaki kararları onayladı.

## Kararlar

- **Uygulama:** Electron + React + TypeScript (Vite). `npm install` ve `npm start` ile Melih'in Windows bilgisayarında açılır.
- **3D:** Three.js, React Three Fiber üzerinden.
- **Veritabanı:** SQLite. Windows'ta ek derleme aracı gerektirmeyen bir kütüphane kullanılır (ör. Node'un yerleşik `node:sqlite` modülü ya da sql.js). Electron sürümüyle sorunsuz çalışanı seçilir.
- **Fontlar:** Saira ve Inter uygulamanın içine paketlenir (ör. `@fontsource` paketleri); internet gerekmez.
- **İlk katalog:** 8 kategoride, her birinde Türkiye'de satılan 10–15 güncel parça. Platformlar: AMD AM5 ve AM4, Intel LGA1851 ve LGA1700.
- **Fiyatlar:** 3. aşamaya kadar yok. Fiyat alanı "Fiyat: henüz yok" olarak görünür; hiçbir fiyat uydurulmaz.

## Yapılacaklar (sırayla)

### 1. Proje iskeleti

- Electron ana süreç, preload ve React arayüzü ayrı. Güvenli ayarlar: `contextIsolation` açık, `nodeIntegration` kapalı; arayüz veriye preload üzerinden erişir.
- Önerilen klasörler: `src/main`, `src/preload`, `src/renderer`, `src/engines/catalog`, `src/engines/compat`, `data/catalog`.
- B · Vitrin tasarım dili: renkler, fontlar ve çip logosu `design/kasa-topla-vitrin.html` dosyasındaki gibi.

### 2. Veritabanı ve katalog motoru

- Tablolar: parçalar (kategori, marka, model, üretici kodu), teknik özellikler (her biri kaynak linki ve alınma tarihiyle), kayıtlı toplamalar.
- Katalog verisi `data/catalog/` altında JSON dosyalarında durur; uygulama açılışta veritabanına yükler.
- Her teknik özellik üreticinin sayfasından alınır ve kaynağı yazılır. Kaynağı olmayan bilgi kataloğa girmez; bilinmeyen değer "bilinmiyor" görünür.
- Kategoriler ve gereken alanlar:
  - **İşlemci:** soket, çekirdek/izlek, temel ve en yüksek saat hızı, TDP (W), dahili grafik var mı, desteklenen bellek tipleri.
  - **Anakart:** soket, yonga seti, form faktörü (ATX / Micro-ATX / Mini-ITX), bellek tipi, bellek yuvası sayısı, en yüksek bellek, M.2 yuvası sayısı, SATA sayısı, PCIe x16 yuvaları.
  - **Bellek (RAM):** tip (DDR4/DDR5), toplam kapasite, modül sayısı, hız (MT/s), CL, yükseklik (mm).
  - **Ekran kartı:** grafik işlemcisi, VRAM, uzunluk (mm), kalınlık (yuva), toplam kart gücü (W), güç soketleri, üreticinin önerdiği güç kaynağı (W).
  - **Depolama:** tip (M.2 NVMe / SATA), arayüz (PCIe 4.0 / 5.0), kapasite, form faktörü.
  - **Güç kaynağı:** güç (W), verimlilik sertifikası, ATX 3.x desteği, modülerlik, uzunluk (mm), ekran kartı güç soketleri.
  - **Kasa:** desteklenen anakart boyutları, en uzun ekran kartı (mm), en yüksek hava soğutucu (mm), radyatör yerleri ve boyları, güç kaynağı uzunluk sınırı.
  - **İşlemci soğutucu:** tip (hava / sıvı), desteklenen soketler, yükseklik (hava soğutucu), radyatör boyu (sıvı soğutma).

### 3. Uyumluluk motoru

Her kural "uyumlu / uyarı / uyumsuz" sonucu ve Türkçe bir açıklama döndürür (ilgili değerlerle, ör. "Ekran kartı 304 mm, kasa sınırı 360 mm: 56 mm pay var").

- İşlemci soketi ile anakart soketi aynı mı.
- Bellek tipi anakarta uyuyor mu; modül sayısı yuva sayısını, toplam kapasite anakartın sınırını aşıyor mu.
- Anakartın form faktörü kasada destekleniyor mu.
- Ekran kartı uzunluğu kasa sınırına sığıyor mu (payı da gösterilir).
- Hava soğutucunun yüksekliği kasaya sığıyor mu; sıvı soğutmada radyatör boyu kasanın radyatör yerlerinden birine uyuyor mu.
- Soğutucu işlemci soketini destekliyor mu.
- M.2 ve SATA disk sayısı anakarttaki yuvaları aşıyor mu.
- Güç: tahmini tüketim (işlemci TDP'si + ekran kartı gücü + diğer parçalar için sabit pay) güç kaynağına göre yeterli mi; ekran kartı üreticisinin önerdiği gücü karşılıyor mu; gerekli güç soketleri var mı.
- Güç kaynağının uzunluğu kasa sınırına sığıyor mu.
- Her kural için birim testleri yazılır.

### 4. 3D kasa

- `design/kasa-olculeri.md` koordinatlarıyla, `design/kasa-ici.svg` görünümünde kurulur: gri metal gövde, pahlı kenarlar, cam yan pencere, ışıklı altıgen ön yüz; içeride sıvı soğutma, fanlar, mor-siyah kılıflı kablolar.
- Hazır açılar: Yan, Ön, Üst, Serbest. Fareyle döndürme ve yakınlaştırma.
- Seçilen parçanın yeri mor ışıkla vurgulanır; diğer parçalarda işaret noktaları olur, üstüne gelince parçanın adı görünür.
- Gösterilen gövde modeli (masaüstü kasa, ileride laptop) değiştirilebilir yapıda olur.

### 5. Kasa Topla ekranı (B · Vitrin)

- **Sol:** 8 kategori; seçilen parçanın adı ve kısa özellikleri; fiyat yerine "Fiyat: henüz yok".
- **Orta:** 3D kasa ve açı düğmeleri.
- **Sağ:** Uyumluluk sonuçları ve güç çubuğu (tahmini tüketim / güç kaynağı). Performans puanı ile "neden iyi, neden kötü" kartları 4. aşamada eklenir; bu aşamada gösterilmez.
- **Parça seçme penceresi:** kategoriye göre liste, arama, filtreler (ör. soket, bellek tipi). Seçili toplamayla uyumsuz parçalar işaretlenir ve nedeni yazılır.
- Toplama kaydedilebilir ve kayıtlı toplama yeniden açılabilir.

## Bitiş ölçütleri

- `npm install` ve `npm start` ile uygulama Melih'in bilgisayarında açılıyor.
- 8 kategoride parça seçilebiliyor; uyumluluk sonuçları doğru ve testler geçiyor.
- 3D kasada seçili parçanın yeri vurgulanıyor; açılar ve döndürme çalışıyor.
- Hiçbir fiyat, puan ya da teknik özellik uydurulmamış; her teknik özelliğin kaynağı var.

## Bu aşamada yok

Fiyatlar ve mağazalar (3. aşama); puanlama, açıklamalar ve karşılaştırma (4. aşama); "Bilgisayarım" (5. aşama); laptop ve monitörler.
