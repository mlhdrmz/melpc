# Kasa ve parça yerleşimi (3D temel görsel)

Bu tablo, `kasa-ici.svg` çiziminin dayandığı ölçülerdir. Uygulamadaki 3D kasa (Three.js) bu koordinatlarla kurulur. Bütün toplamalarda aynı temel görsel kullanılır; seçilen parçanın gerçek ölçüleri (ör. ekran kartı uzunluğu) katalogdan gelir ve uyumluluk hesabında kullanılır.

## Koordinat sistemi

- Birim: milimetre.
- **X:** arkadan öne (0 = arka panelin iç yüzü).
- **Y:** aşağıdan yukarı (0 = zemin; ayaklar 0–20).
- **Z:** sağ yan kapaktan (anakart tepsisi, Z = 0) sol cam kapağa (Z = 230).
- Görünür taraf: sol yan (cam pencere), ön yüz ve hafif yukarıdan bakış.

## Kasa

| Parça | X | Y | Z | Not |
|---|---|---|---|---|
| Gövde | 0–450 | 20–510 | 0–230 | Ayaklar Y 0–20 |
| Ön panel çerçevesi | 450–476 | 20–510 | 0–230 | Köşeleri kesik sekizgen |
| Yan panel düz kısmı (Z = 230) | 0–450 | 44–476 | 230 | Üst ve alt kenarları pahlı |
| Üst-sol pah | 0–450 | 476 → 510 | 230 → 196 | |
| Alt-sol pah | 0–450 | 44 → 20 | 230 → 206 | |
| Cam pencere | 16–434 | 152–466 | 230 | Köşe yarıçapı 16; vidalar (30,166), (420,166), (30,452), (420,452) |
| Işık çizgisi (camın altında) | 26–424 | 139–147 | 230 | Mor → turkuaz |
| Alt bant havalandırma | 250–426 | 58–125 | 230 | 5 yatay yarık |

Ön panel (X = 476 düzlemi, koordinatlar Z, Y):

- Dış hat: (0,44), (0,476), (34,510), (196,510), (230,476), (230,44), (206,20), (24,20)
- Işıklı altıgen: (115,484), (184,444), (184,92), (115,52), (46,92), (46,444)
- Altıgenin arkasındaki 3 fan (120 mm): merkez Z = 115, Y = 150 / 275 / 400

## Anakart (ATX)

ATX standardı: anakart 305 × 244 mm, arka G/Ç açıklığı 158,75 × 44,45 mm, en fazla 7 genişleme yuvası, yuvalar 20,32 mm aralıklı.

| Parça | X | Y | Z | Not |
|---|---|---|---|---|
| Anakart | 12–256 | 115–420 | 6–8 | Ara parça (standoff) yüksekliği 6 mm |
| G/Ç açıklığı (arka panel, X = 0) | 0 | 261,25–420 | 6–50,45 | |
| Genişleme yuvaları | 0 | 1. yuva merkezi 251,1 | — | Anakart üst kenarından 168,9 mm; sonraki yuvalar 20,32 mm aşağıda |
| İşlemci soketi merkezi | 122 | 345 | — | |
| G/Ç kapağı + arka VRM soğutucu | 14–48 | 261,25–418 | 8–40 | |
| Üst VRM soğutucu | 50–160 | 388–412 | 8–30 | |
| EPS 8-pin | 30–60 | 408–418 | 8–20 | |
| 24-pin | 244–255 | 285–338 | 8–24 | Kablo tepsideki deliğe girer |
| RAM yuvaları | A1 180–186, A2 188,5–195,5, B1 197–203, B2 205,5–212,5 | 274,6–408 | 8–41 | DDR5 133,35 mm; çift kanal için A2 ve B2 dolu |
| M.2 SSD (2280 + soğutucu) | 45–125 | 273,5–295,5 | 8–17 | İşlemci ile ekran kartı arasında |
| Yonga seti soğutucu | 170–232 | 150–195 | 8–16 | |
| SATA | 248–255 | 140–182 | 8–18 | |

## Soğutma ve fanlar (temel görsel: sıvı soğutma)

| Parça | X | Y | Z | Not |
|---|---|---|---|---|
| Pompa (işlemcinin üstünde) | 85–159 | 308–382 | 8–50 | Ön yüzünde ışıklı halka |
| Radyatör (360 mm, tavanda) | 22–420 | 472–499 | 66–194 | |
| Tavan fanları (3 × 120 mm) | 40–160, 160–280, 280–400 | 447–472 | 70–190 | Alt yüzleri ışıklı |
| Hortumlar | Pompanın ön yüzünden | → | Radyatörün ön ucuna (X ≈ 404–414, Y 471) | Örgülü, iki adet |
| Arka fan (120 mm) | 0 (arka panel) | merkez 385 | merkez 120 | Işıklı |
| Ön fanlar (3 × 120 mm) | 424–449 | merkez 150 / 275 / 400 | merkez 115 | Ön paneldeki altıgenin arkasında |

## Ekran kartı, güç kaynağı, kablolar

| Parça | X | Y | Z | Not |
|---|---|---|---|---|
| Ekran kartı (örnek: 304 mm, 3 yuva) | 2–304 | 199,1–259,1 | 10–140 | 1. yuvada; seçiliyken mor ışıkla vurgulanır |
| Ekran kartı güç soketi | 196–216 | 259,1 (üst yüz) | 108–122 | Kablo öne kıvrılıp örtüdeki boşluğa iner |
| Güç kaynağı örtüsü | 0–400 | 20–112 | 0–230 | Üstü delikli; kablo boşluğu X 222–256, Z 118–174 |
| Güç kaynağı (150 × 86 × 160 mm) | 6–166 | 22–108 | 40–190 | Örtünün altında, çizimde kesikli |
| Kablo geçiş delikleri (tepside, Z = 0) | 264–290 | 300–356, 214–270, 128–184 | 0 | Lastikli, Y kesikli |
| EPS kablo deliği | 28–72 | 428–446 | 0 | |

Kablolar mor ve siyah kılıflıdır.

## Işık ve renkler

- Vurgu renkleri: mor `#a58bff`, turkuaz `#62d2f4`; ışıklar mordan turkuaza geçer.
- Gövde: gri metal (`#2a2c32` – `#5a5e68`).
- Seçili parça: mor dış ışık (`#a58bff`).

## Örnek çizimdeki kamera

Perspektifli: kamera konumu (900, 272, 1550), bakış noktası (215, 262, 115). Uygulamada kamera kullanıcı tarafından döndürülebilir; "Yan", "Ön", "Üst", "Serbest" hazır açılardır.
