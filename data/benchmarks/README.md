# Performans ölçümleri

Her dosya bir kaynaktan alınmış ölçümleri tutar ve `{ "sources": {...}, "results": [...] }` biçimindedir. Ölçümler katalogla birlikte doğrulanır (`src/engines/benchmark/validate.ts`); hatalı ölçüm yüklenmez. Testlerin tanımı (adı, birimi, açıklaması, gereken koşullar): `src/engines/benchmark/tests.ts`.

## Ölçüm kaydı

```json
{
  "test": "blender-cycles",
  "subject": { "partId": "cpu-amd-ryzen-7-9800x3d" },
  "device": "AMD Ryzen 7 9800X3D 8-Core Processor",
  "value": 367.88,
  "conditions": { "blenderVersion": "5.2.0", "computeType": "CPU", "statistic": "median" },
  "sampleCount": 222,
  "source": "bod-cpu-5.2.0"
}
```

- `subject`: İşlemcide katalogdaki parçanın id'si (`partId`). Ekran kartında grafik işlemcisi (`gpuChip`, katalogdaki `gpuChip` değeriyle aynı); ölçüm o grafik işlemcisini kullanan bütün kartlara uygulanır. Ölçüm kartın kendisiyle yapılmamıştır; arayüz bunu belirtir.
- `device`: Kaynakta cihazın geçtiği ad, değerin hangi satırdan alındığı izlenebilsin diye.
- `conditions`: Testin gerektirdiği koşulların hepsi (ör. Blender sürümü, hesaplama türü, istatistik).
- `sampleCount`: Değer birden çok ölçümün ortancasıysa ölçüm sayısı. Az ölçümlü değerler daha az güvenilirdir; arayüz sayıyı gösterir.
- `note` (isteğe bağlı): Ölçümle ilgili bilinmesi gereken bir durum; ör. kaynağın kartın 8 GB ve 16 GB sürümlerini ayırmaması.
- `source`: Aynı dosyadaki `sources` anahtarı; kaynakta `url`, `retrieved` (YYYY-AA-GG) ve varsa `license` bulunur.

## Kurallar

- Ölçüm tahmin edilmez, hesaplanmaz, başka bir ölçümden türetilmez. Ölçümü olmayan parça "ölçüm yok" görünür.
- Yalnızca kullanım şartları buna izin veren kaynaklar kullanılır (kontrol: `docs/asama-4-plan.md`).
- Aynı test, parça ve koşulla ikinci ölçüm girilmez.

## Blender Open Data (`blender-*.json`)

Lisans: CC0. Değerler Blender Open Data'nın sorgu sayfasında cihaza göre gruplanmış ortanca puanlardır ("Median Score"). Ekran kartları kendi üreticisinin hızlandırıcısıyla sorgulanır: NVIDIA OptiX, AMD HIP, Intel oneAPI. Sorgu sayfası sonuçları şu adresten JSON olarak alır:

```
https://opendata.blender.org/benchmarks/query/?compute_type=CPU&blender_version=5.2.0&group_by=device_name&response_type=datatables
```

`compute_type` yerine `OPTIX`, `HIP` ya da `ONEAPI` yazılır. Yeni bir Blender sürümüne geçilince yeni bir dosya açılır; eski sürümün ölçümleri yeni sürümünkilerle karıştırılmaz.
