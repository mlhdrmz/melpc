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

## Yapılacaklar

1. Laptop profili (Dell kılavuzu) ve görsel taslak. Melih'in onayı bekleniyor.
2. Donanım okuma motoru (WMI) ve son okumanın saklanması.
3. Laptop profilinin veri biçimi ve doğrulaması.
4. Depolamaya "soğutucu" alanı ve katalogdaki SSD'lerin verisi.
5. Laptopun işlemci ve ekran kartı için Blender ölçümleri.
6. Yükseltme önerileri motoru ve açıklamalar.
7. "Bilgisayarım" ekranı ve 3D laptop gövde modeli.

## Bitiş ölçütleri

- Okunan her değerin nereden geldiği görünüyor: Windows ya da kılavuz. Windows'un yanlış raporladığı değerler kullanılmıyor.
- Yükseltme bilgileri kılavuzdan, kaynağıyla geliyor; bilinmeyen değer "bilinmiyor" görünüyor.
- Hiçbir performans değeri tahmin edilmiyor ya da uydurulmuyor.
- Testler geçiyor.
