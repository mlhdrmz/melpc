# Katalog verisi

Her kategori için bir dosya var (`cpu.json`, `motherboard.json`, `memory.json`, `gpu.json`, `storage.json`, `psu.json`, `case.json`, `cooler.json`). Her dosya parça kayıtlarından oluşan bir dizidir. Uygulama açılırken bu dosyaları okur, doğrular ve veritabanına yükler. Hatalı kayıt kataloğa alınmaz; hatası konsolda ve Kasa Topla ekranında "Katalog hataları" kartında görünür.

Alanların listesi ve tipleri: `src/engines/catalog/specDefs.ts`.

## Kayıt biçimi

```json
{
  "id": "gpu-ornek-marka-model",
  "category": "gpu",
  "brand": "Marka",
  "model": "Model adı",
  "mpn": "Üretici parça kodu",
  "sources": {
    "maker": { "url": "https://üreticinin-ürün-sayfası", "retrieved": "2026-11-17", "title": "Ürün sayfası · Teknik özellikler" }
  },
  "specs": {
    "lengthMm": { "value": 304, "source": "maker" },
    "powerConnectors": { "value": { "16-pin": 1 }, "source": "maker" },
    "recommendedPsuW": { "value": null, "note": "Üretici sayfasında yazmıyor" }
  },
  "addedAt": "2026-11-17",
  "updatedAt": "2026-11-17"
}
```

## Kurallar

- Her değerin bir kaynağı vardır (`source`, `sources` içindeki bir anahtar). Kaynağı olmayan değer doğrulamadan geçmez.
- Bilinmeyen değer `null` yazılır (ya da hiç yazılmaz) ve uygulamada "bilinmiyor" görünür. Tahmin edilmez.
- Kaynak önce üreticinin ürün sayfasıdır. `retrieved`, bilginin alındığı gündür.
- İşlemci gücü: `tdpW` AMD'nin "Default TDP" ya da Intel'in "Processor Base Power" değeri; `maxTurboPowerW` Intel'in "Maximum Turbo Power" değeri (AMD yayımlamaz, yazılmaz).
- Ekran kartı ve güç kaynağı soketleri: `16-pin` (12VHPWR / 12V-2x6), `8-pin` (PCIe 6+2), `6-pin`.
