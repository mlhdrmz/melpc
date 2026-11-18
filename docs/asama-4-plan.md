# 4. aşama planı: karşılaştırma, puanlama, açıklamalar

Kapsam: parçaları kendi kategorisinde sıralamak, toplanan sistemi oyun ve mühendislik için değerlendirmek, "neden iyi, neden kötü" açıklamaları, parça ve toplama karşılaştırma ekranları ve hazır satılan sistemlerle karşılaştırma. Melih aşağıdaki kararları 18.11.2026'da onayladı ("önerilerle başla").

## Kararlar

1. **Performans verisi:** Her ölçüm kaynağı, test adı ve koşuluyla gösterilir; ölçümü olmayan parça "ölçüm yok" görünür, tahmin edilmez.
   - Oyun: tek bir bağımsız inceleme sitesinin karşılaştırma tabloları; kullanım şartları başlamadan kontrol edilir (sonuç aşağıda).
   - Render ve mühendislik: Blender Open Data (CC0).
2. **Puanlanan parçalar:** Ölçüme dayalı puanı yalnızca işlemci ve ekran kartı alır. Bellek, depolama, güç kaynağı, kasa, soğutucu ve anakart üretici değerleriyle sıralanır (depolamada okuma hızı, bellekte CL ve hızdan hesaplanan gecikme, güç kaynağında verimlilik ve watt).
3. **Mühendislik profili:** CAD (tek çekirdek), simülasyon ve derleme (çok çekirdek ve bellek miktarı), render (Blender puanı). Oyunda varsayılan çözünürlük 1440p; 1080p ve 4K seçilebilir.
4. **Sistem değerlendirmesi:** Oyun ve mühendislik için ayrı puan (0–100, katalogdaki en güçlü parçaya göre); hangi ölçümlerden ve hangi ağırlıklarla hesaplandığı ekranda yazar.
5. **Açıklamalar:** Önceden yazılmış kurallar; her madde tek cümle, altında sayılar ve kaynak. Darboğaz için yüzde gibi sahte kesinlik yok, gerekçeli uyarı var. Laptop farkları laptoplar eklenince.
6. **Karşılaştırma ekranları:** "Karşılaştır" sayfası: Parçalar (aynı kategoriden 2–4 parça) ve Toplamalar (kayıtlı 2–3 toplama). Parça seçme penceresinde ve kayıtlı toplamalarda "Karşılaştırmaya ekle".
7. **Hazır sistemler:** Melih linki yapıştırır; fiyat ve parça listesi okunur, tanınan parçalar eşleştirilir, "kendin toplasan" fiyatıyla karşılaştırılır, tanınmayan parça gösterilir. Otomatik tarama yok.
8. **Çalışma düzeni:** `asama-4` dalı (`main`'den), her adım bir commit, sonunda PR (taban `main`). Önce performans verisinin biçimi birkaç parçalık örnekle Melih'e gösterilir.

## Kaynak kontrolü (18.11.2026)

| Kaynak | Ne ölçüyor | Kullanım şartı | Sonuç |
|---|---|---|---|
| Tom's Hardware (GPU ve CPU sıralama tabloları) | Oyun FPS'i, tek ve çok çekirdek | Future US kullanım şartları sitedeki herhangi bir bilginin izinsiz kopyalanmasını, çoğaltılmasını ve otomatik toplanmasını yasaklıyor. Tablolar otomatik okumaya da açık değil. | Kullanılamaz |
| TechPowerUp (inceleme tabloları) | Oyun performansı | robots.txt: içerik yalnızca kişisel, ticari olmayan kullanım için; "herhangi bir yazılımın geliştirilmesi" ve metin/veri madenciliği yazılı izin gerektiren kullanımlar. | Kullanılamaz (izin alınmadan) |
| OpenML "fps-in-video-games" ve benzerleri | Oyun FPS'i | CC BY etiketli ama veriler UserBenchmark ve TechPowerUp gibi sitelerden; eski donanım. | Uygun değil |
| Blender Open Data | Cycles render hızı (örnek/dakika, sahnelerin toplamı) | Veri CC0 lisanslı, kayıt gerekmiyor. | Kullanılıyor |

Blender Open Data'da, Blender 5.2.0 ile, katalogdaki 15 işlemcinin ve 11 ekran kartı işlemcisinin hepsinin ortanca puanı var. Ekran kartları kendi üreticisinin hızlandırıcısıyla sorgulanır: NVIDIA OptiX, AMD HIP, Intel oneAPI.

**Oyun ve tek çekirdek (Melih onayladı, 18.11.2026):** Şartları izin veren bir kaynak bulunamadığı için oyun puanı şimdilik yok; oyun tarafında yalnızca kaynağı belli kurallarla notlar var. Mühendislik puanı işlemcinin Blender puanı (çok çekirdekli iş), ekran kartının Blender puanı ve bellek miktarıyla hesaplanır; CAD için "tek çekirdek ölçümü yok" görünür. İzin alınırsa (ör. TechPowerUp) oyun ölçümleri eklenir.

## Yapılacaklar

1. Performans verisinin biçimi ve birkaç parçalık örnek (Melih'in onayı bekleniyor).
2. Bütün işlemci ve ekran kartları için ölçümler.
3. Puan motoru: işlemci ve ekran kartı sıralaması, öbür kategorilerde üretici değerleriyle sıralama, sistem puanları.
4. Açıklama motoru: kurallar ve metinler.
5. Karşılaştır sayfası: parçalar ve toplamalar.
6. Hazır sistemle karşılaştırma.

## Bitiş ölçütleri

- Her puanın yanında ölçümün kaynağı, test adı, koşulu ve tarihi görünüyor; ölçümü olmayan parça "ölçüm yok" görünüyor.
- Hiçbir performans değeri tahmin edilmiyor ya da uydurulmuyor.
- Testler geçiyor.
