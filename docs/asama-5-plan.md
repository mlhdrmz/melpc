# 5. aşama planı: Bilgisayarım

Kapsam: Melih'in kendi bilgisayarını (Dell G15 5520 laptop) okumak; içinde ne olduğunu, neyin değiştirilebileceğini ve yükseltme önerilerini göstermek. Melih aşağıdaki kararları 18.11.2026'da onayladı ("önerilerle başla").

## Kararlar

1. **Kapsam:** Önce yalnızca Melih'in laptopu. Masaüstü bilgisayar okuma sonraya kalır; deneyecek bir masaüstü yok.
2. **Okuma:** Windows'un donanım bilgisi (WMI/CIM) okunur.
   - Okuma ana süreçte, PowerShell ile ve yalnızca "Oku"ya basınca yapılır.
   - Ek paket kullanılmaz, internete bir şey gitmez, seri numaraları okunmaz.
   - Windows'un yanlış raporladığı değerler Windows'tan alınmaz. Örneğin ekran kartı belleği 4 GB'ta kesiliyor, bellek üst sınırı takılı bellekten küçük görünüyor.
3. **Yükseltme bilgisi:** Dell'in resmî kılavuzundan, kaynaklı bir "laptop profili" hazırlanır; yalnızca bu model için. Başka laptoplar, laptoplar kataloğa eklenince gelir.
4. **Öneriler:**
   - **Bellek:** Kılavuzdaki sınırla karşılaştırılıp durum söylenir. SO-DIMM bellekler şimdilik kataloğa eklenmez.
   - **SSD:** Boş yuva varsa ikinci SSD önerilir, yoksa mevcut diskin yerine. Katalogdaki uygun M.2 SSD'ler fiyatlarıyla gösterilir.
   - **Wi-Fi:** Yalnızca bilgi verilir.
   - **İşlemci ve ekran kartı:** "Lehimli, değiştirilemez" notu düşülür.
5. **SSD uyumu:** Depolama kategorisine "soğutucu (heatsink) var mı" alanı eklenir. Katalogdaki SSD'ler için üretici sayfasından doldurulur. Laptopa yalnızca soğutucusuz olanlar önerilir.
6. **Performans:** Laptopun işlemci ve ekran kartı ölçümleri Blender Open Data'dan (CC0) alınır. Laptop, katalogdaki masaüstü parçalarla aynı ölçekte gösterilir; sayılar kaynaklıdır, yüzde tahmini yoktur.
7. **Görsel:** Genel bir laptop çizilir, marka kopyası olmaz; logo ve yazı yoktur.
   - Alt kapak açık görünür: arkada fanlar ve ısı boruları, ortada RAM ve SSD yuvaları, önde batarya.
   - Değiştirilebilen parçalar vurgulanır.
   - Önce tarayıcıda açılan bir taslak hazırlanır. Onaydan sonra 3D görünüme ikinci gövde modeli olarak eklenir.
8. **Saklama:** Yalnızca son okuma, seri numarası olmadan, yerel veritabanında tutulur. Geçmiş tutulmaz; "Yeniden oku" ile güncellenir.
9. **Çalışma düzeni:** `asama-5` dalı `main`'den açılır, her adım bir commit olur, sonunda PR açılır (taban `main`). Önce görsel taslak ve laptop profili Melih'e gösterilir.

## Laptop profili: Dell G15 5520 (Melih onayladı, 18.11.2026)

Windows'un okuduğu (18.11.2026, WMI) ve Dell'in "Dell G15 5520 Setup and Specifications" sayfalarında yazan değerler. Dell'in PDF'i otomatik okumaya kapalı; aynı içerik dell.com'daki HTML sayfalarından okundu. Profil dosyası: `data/laptops/dell-g15-5520.json`.

| Konu | Windows'un okuduğu | Dell'in yazdığı | Kaynak sayfa |
|---|---|---|---|
| Bilgisayar | "Dell G15 5520" (taşınabilir, pil var) | | |
| İşlemci | "12th Gen Intel Core i7-12700H", 14 çekirdek, 20 izlek | "12th Generation Intel Core i7-12700H": "45 W", "14" çekirdek, "20" izlek. Seçenekler: i7-12700H ya da i5-12500H. | [Processor](https://www.dell.com/support/manuals/en-us/g-series-15-5520-laptop/dell-g15-5520-setup-and-specifications/processor?guid=guid-5487570d-81b8-4be9-8a7a-38ee06c4b03d&lang=en-us) |
| Ekran kartı | "NVIDIA GeForce RTX 3060 Laptop GPU". Bellek 4 GB görünüyor, bu yanlış: Windows'un bu alanı 4 GB'ta kesiliyor. | "NVIDIA GeForce RTX 3060", "6 GB", "GDDR6" | [GPU—Discrete](https://www.dell.com/support/manuals/en-us/g-series-15-5520-laptop/dell-g15-5520-setup-and-specifications/gpudiscrete?guid=guid-e2fe761c-386b-4115-8b4e-034eb55fbd37&lang=en-us) |
| Bellek | 2 × 32 GB, DDR5, 4800 MT/s, SO-DIMM; yuvalar "DIMM A" ve "DIMM B", ikisi de dolu. Windows'un bellek üst sınırı 32 GB görünüyor; takılı belleğin altında olduğu için kullanılmıyor. | "Two SoDIMM slots", "Dual-channel DDR5", "4800 MHz"; en büyük yapılandırma "32 GB"; yuva başına "8 GB, 16 GB, 32 GB". Listelenen yapılandırmalar 8, 16 ve 32 GB (2 × 16 GB). | [Memory](https://www.dell.com/support/manuals/en-us/g-series-15-5520-laptop/dell-g15-5520-setup-and-specifications/memory?guid=guid-e9d2ea83-38a4-431d-803c-96d63c1dbc34&lang=en-us) |
| SSD | "PM991a NVMe Samsung 1024GB" (tek disk) | "only one M.2 slot for either an M.2 2230 solid-state drive or an M.2 2280 solid-state drive"; 2280 için "PCIe Gen4 x4 NVMe", "Up to 2 TB"; 2230 için Gen3 ya da Gen4, "Up to 1 TB". | [Storage](https://www.dell.com/support/manuals/en-us/g-series-15-5520-laptop/dell-g15-5520-setup-and-specifications/storage?guid=guid-d79f17ca-e619-43e7-82a5-a0b0e7fb5c0a&lang=en-us) |
| Wi-Fi | "Killer(R) Wi-Fi 6 AX1650i 160MHz Wireless Network Adapter (201NGW)" | "One M.2 2230 slot for WiFi and Bluetooth combo card"; seçenekler "Intel AX201" ya da "Killer 1650i", Wi-Fi 6, "Bluetooth 5.2". | [Internal slots](https://www.dell.com/support/manuals/en-us/g-series-15-5520-laptop/dell-g15-5520-setup-and-specifications/internal-slots?guid=guid-647a9bd6-0be5-4b27-9df1-31e3c269abed&lang=en-us), [Wireless module](https://www.dell.com/support/manuals/en-us/g-series-15-5520-laptop/dell-g15-5520-setup-and-specifications/wireless-module?guid=guid-17e9c29d-abc5-44bd-95ce-79e58b869635&lang=en-us) |

Bu değerlerden çıkan durum:
- **Bellek:** İki yuva da Dell'in yuva başına izin verdiği en büyük modülle (32 GB) dolu. Dell'in listelediği en büyük yapılandırma 32 GB olsa da sistem 64 GB'ı görüyor. Daha fazla bellek eklenemez.
- **SSD:** İkinci SSD için yuva yok. Yükseltme, mevcut diskin yerine M.2 2280 PCIe Gen4 x4 bir SSD takmak demek; Dell 2 TB'a kadar yazıyor.
- **Wi-Fi:** Takılı kart, Dell'in iki seçeneğinden biri (Killer 1650i). Ekranda yalnızca bilgi olarak geçer.
- **İşlemci:** Karta lehimli. Intel'in sayfası paketi "FCBGA1744" (BGA) diye yazıyor.
- **Ekran kartı:** Dell'in servis kılavuzundaki değiştirilebilir parça listesinde ("Major components of your computer") ayrı parça olarak yok; değiştirilemez.

## Yapılacaklar

1. ✓ Laptop profili (Dell kılavuzu) ve görsel taslak (Melih onayladı).
2. ✓ Donanım okuma motoru (WMI) ve son okumanın saklanması.
3. ✓ Laptop profilinin veri biçimi ve doğrulaması.
4. ✓ Depolamaya "soğutucu" alanı ve katalogdaki SSD'lerin verisi.
5. ✓ Laptopun işlemci ve ekran kartı için Blender ölçümleri.
6. ✓ Yükseltme önerileri motoru ve açıklamalar.
7. ✓ "Bilgisayarım" ekranı ve 3D laptop gövde modeli.

## Deneme (18.11.2026)

- Uygulamada, test veri klasörüyle "Oku" denendi; Windows'tan gerçek okuma yapıldı.
- Okunan değerler: Dell G15 5520, i7-12700H, RTX 3060 Laptop (bellek kılavuzdan 6 GB), 2 × 32 GB DDR5-4800 SO-DIMM, Samsung PM991a 1 TB, Killer AX1650i.
- Her satırda değerin nereden geldiği yazıyor.
- Son okuma saklanıyor; sayfaya dönünce yeniden okumadan görünüyor. Kayıtta seri numarası yok.
- 162 test geçiyor, tip denetimi temiz.

## Açık kalanlar

- **SSD fiyatları:** Önerilen SSD'lerin çoğu henüz mağazalarla eşleştirilmedi. "Mağaza eşleştirme → Mağazalarda ara" ile eşleştirilince fiyatları görünür.
- **Soğutucu bilgisi bilinmeyen 6 SSD, laptoplara önerilmiyor:**
  - Crucial T705 ve P3 Plus: sayfa "Request Rejected" verdi.
  - SanDisk SN850X 1 ve 2 TB: özellik tablosu okunamadı.
  - Kingston KC3000 ve NV3: bot doğrulaması var.
- **Mevcut disk:** Samsung PM991a (OEM) için üretici okuma hızı kataloğa eklenmedi; ekranda mevcut diskle hız karşılaştırması yok.
- **Masaüstü:** Masaüstü bilgisayar okuma sonraya kaldı (1. karar).
- **3D hata önlemi:** Sayfa değişince 3D görünüm kapanırken bir kez "removeChild" hatası görüldü. Önlem olarak Bilgisayarım, Kasa Topla gibi gizleniyor, kapanmıyor.

## Bitiş ölçütleri

- Okunan her değerin nereden geldiği görünüyor: Windows ya da kılavuz. Windows'un yanlış raporladığı değerler kullanılmıyor.
- Yükseltme bilgileri kılavuzdan, kaynağıyla geliyor; bilinmeyen değer "bilinmiyor" görünüyor.
- Hiçbir performans değeri tahmin edilmiyor ya da uydurulmuyor.
- Testler geçiyor.
