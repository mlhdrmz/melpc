# Laptop ölçüleri (6. aşama, Bilgisayarım)

Melih 19.11.2026'da onayladı. Görseller: `laptop-dis-gorunum.png`, `laptop-ic-gorunum.png`, `laptop-ic-gorunum-bellek-secili.png`. Taslağın Three.js kodu `laptop-taslak.html` dosyasında; görünüşün referansıdır, uygulamaya doğrudan kopyalanacak kod değildir. Bu doküman bugünkü `src/renderer/src/three/LaptopBody.tsx` modelinin yerini alacak gövde modelini tanımlar.

## Kurallar

- Genel bir 15,6 inç oyun laptopu çizilir. Marka kopyası değildir; yazı ve logo yoktur.
- Varsayılan görünüm dış görünümdür: ekran açık ve yanık, klavye ışığı açık.
- İç görünüme "İçini göster" düğmesiyle ya da Bilgisayarım'daki listede bir parçaya tıklanınca geçilir. Üst yüzey (klavye, avuç içi ve touchpad) buzlu cama döner, iç kısım onun altından görünür. Ekran yerinde kalır; ekransız iç görünüm yoktur.
- Seçili parçanın yeri bugünkü gibi mor ışıkla vurgulanır. İşaret noktaları yalnızca iç görünümde görünür.

## Koordinat sistemi

- Birim milimetredir. Sahnede 1 birim 100 mm'dir (bugünkü `MM = 0.01`).
- X soldan sağa (laptopun önünde oturan kişiye göre), Y aşağıdan yukarı, Z arkadan (menteşe) öne doğrudur.
- Orijin tabanın sol-arka-alt köşesidir.
- Gövde modelinin merkezi (`center`): (178,5; 95; 95).

## Taban

| Parça | Ölçü |
|---|---|
| Taban izdüşümü | 357 × 265 mm, köşe yarıçapı 12 mm |
| Alt plaka | Y 0–2, kenar pahı 0,8 mm |
| Yan duvarlar | Y 2–19, duvar kalınlığı 2,5 mm (iç köşe yarıçapı 9,5 mm) |
| Üst yüzey (klavye ve avuç içi) | Y 19–22, kenar pahı 1,1 mm |
| Arka hava çıkışları | Arka yüzde (Z = 0), X 30–125 ve 232–327. Koyu panel Y 5–16 (#0e0e13); önünde 4 yatay çıta, Y 6,5 / 9 / 11,5 / 14, her biri 1,1 mm (#4b4f58) |
| Sağ yandaki bağlantı noktaları | X = 357 yüzünde, Y 8,5–13,5; Z 118–131, 138–151 ve 160–170 (#0b0b0f) |

## Klavye

- 1U = 17,5 mm. Tuşlar arası boşluk 2,6 mm; bir tuşun genişliği n × 17,5 − 2,6 mm.
- Tuş başlıkları Y 22,15–23,7; köşe yarıçapı 1,6 mm, pah 0,45 mm. Tuşların üstünde yazı yoktur.
- Ana blok X 10'dan başlar. Sayısal tuş takımı X 277,5'ten başlar (ana bloktan 5 mm sonra).
- İşlev tuşu sırası: Z 36–45 (9 mm derinlik). Ana blokta 15, sayısal takımın üstünde 4 tuş.
- Diğer beş sıra Z 48'den başlar ve 17,5 mm arayla dizilir:
  1. 13 × 1U ve 2U
  2. 1,5U, 12 × 1U ve 1,5U
  3. 1,75U, 11 × 1U ve 2,25U
  4. 2,25U, 10 × 1U ve 2,75U
  5. 1,25U, 1U, 1,25U, 1,25U, 5,25U (boşluk tuşu), 1U, 1U ve ok tuşları. Ok tuşları yarım yüksekliktedir: sol ve sağ sıranın önünde, yukarı ve aşağı ortada üst üste.
- Sayısal takım: 1. sırada 4 × 1U; 2. sırada 3 × 1U ve iki sıra boyunca 1U genişliğinde artı tuşu; 3. sırada 3 × 1U; 4. sırada 3 × 1U ve iki sıra boyunca Enter; 5. sırada 2U genişliğinde 0 tuşu ve 1U.
- Arka ışık (yalnızca dış görünümde): tuşların altında X 10–347,5, Z 36–135,5 boyunca, Y 22,05'te mor (#a58bff) düz bir yüzey; opaklık 0,22, ışıktan etkilenmez. Tuşların arasından mor ışık görünür.

## Touchpad

- Merkezi X 139,06 (boşluk tuşunun ortası), genişliği 118 mm, Z 158–234, köşe yarıçapı 6 mm, Y 21,6–22,32.
- Dış görünümde çevresinde 1 mm genişliğinde metal çerçeve: #5b5f6b, köşe yarıçapı 7 mm, Y 21,6–22,2.

## Kapak ve ekran

- Menteşe ekseni X boyuncadır: Y 24, Z 10. Kapak 115° açıktır (eksen etrafında `rotation.x = −115°`).
- Kapağın kapalıyken yerel ölçüleri: X 0–357, menteşeden uzunluk 238 mm, kalınlık 7 mm (yerel +Y), köşe yarıçapı 10 mm, pah 1 mm. Ekran yerel −Y yüzündedir.
- İç yüz: 1,2 mm içeriden siyah çerçeve plakası (#0b0b0f, metalness 0,2, roughness 0,35).
- Ekran: 345,6 × 194,4 mm (15,6 inç, 16:9). Yatayda ortalanır; menteşeden 32 mm yukarıda başlar (alt çerçeve 32 mm, üst çerçeve 11,6 mm, yan çerçeveler 5,7 mm).
- Ekran görüntüsü: MelPC renklerinde sade bir arka plan; yazı ve logo yoktur. Koyu zemin (#0d0b15), sol altta mor (#a58bff), sağ üstte turkuaz (#62d2f4) yumuşak ışık ve ortadan geçen ince ışık şeritleri (`laptop-taslak.html` içindeki canvas). Işıktan ve ton eşlemeden etkilenmez (`toneMapped: false`).
- Menteşeler: iki silindir, yarıçap 6 mm, X 38–82 ve 275–319, merkez Y 23, Z 9 (#1c1d22).

## İç kısım

- Bugünkü `LaptopBody.tsx`'teki iç parçalar ve ölçüleri aynen kalır: fanlar, ısı boruları, işlemci ve ekran kartı plakaları, iki SO-DIMM, M.2 SSD, Wi-Fi kartı, batarya ve hoparlörler.
- İç kısım alttan bakışa göre çizilmişti; üstten bakışta sol ve sağ yer değiştirir. Bu yüzden iç parçalar X ekseninde aynalanır: iç grup `scale.x = −1`, `position.x = 357`. Sonuçta bellek sağda, SSD ve Wi-Fi solda görünür.
- Bugünkü 6 mm'lik iç duvarlar ve Y 0–3'teki taban kaldırılır. Yerine Y 2–3'te iç zemin gelir: X 2,5–354,5, Z 2,5–262,5 (#24252c).
- Soğutucu kanatçıkları Z 3–22 olur (duvar inceldiği için 7 yerine 3'ten başlar).
- İç ışıklar yalnızca iç görünümde yanar: mor nokta ışık (iç koordinat 180, 200, 140), şiddet 1,4, mesafe 6 birim; turkuaz nokta ışık (300, 90, 60), şiddet 1,2, mesafe 5 birim.
- Vurgulama kutuları ve işaret noktaları bugünkü değerlerle kalır; iç grupta oldukları için kendiliğinden aynalanırlar.

## Malzemeler

| Yüzey | Dış görünüm | İç görünüm |
|---|---|---|
| Taban | MeshStandard #4a4d57, metalness 0,6, roughness 0,42 | Aynı |
| Kapak | MeshStandard #464953, metalness 0,6, roughness 0,42 | Aynı |
| Üst yüzey | MeshStandard #33353d, metalness 0,5, roughness 0,62 | Buzlu cam |
| Tuşlar | MeshStandard #16151c, metalness 0,1, roughness 0,75 | Buzlu cam |
| Touchpad | MeshStandard #2f3139, metalness 0,3, roughness 0,32 | Buzlu cam |
| Üst yüzeyin kenar çizgileri | Yok | EdgesGeometry (eşik 25°), #d9d2ff, opaklık 0,55 |

- Buzlu cam: `MeshPhysicalMaterial` — color #eeecf8, metalness 0, roughness 0,2, transmission 1, thickness 2, ior 1,45, specularIntensity 0,7.
- Işıklar ve ton eşleme bugünkü `CaseViewer` ile aynıdır.
- Zeminde yumuşak gölge (isteğe bağlı): 560 × 420 mm'lik düzlem, Y −0,6; ortası %55 siyah, kenarlara doğru şeffaf.

## Kamera açıları

Sahne biriminde, merkeze göre; görüş açısı 32°. Değerler taslakta denendi.

| Açı | Konum | Bakış noktası |
|---|---|---|
| Serbest (dış görünümde varsayılan) | (4,5; 2,6; 6,9) | (0; −0,12; −0,05) |
| İç görünüm ("İçini göster" ya da listeden tıklama) | (3,55; 5,95; 6,5) | (0; −0,05; 0,1) |
| Üstten | (0; 8,3; 3,9) | (0; −0,1; 0,2) |

## Davranış

1. Bilgisayarım açılınca dış görünüm ve "Serbest" açı gelir.
2. Görünüm düğmelerinin yanında bir geçiş düğmesi bulunur: dış görünümde "İçini göster" (katman simgesi), iç görünümde "Dışını göster" (göz simgesi).
3. "Okunan donanım" ya da "Ne değiştirilebilir" listesinde bir parçaya tıklanınca iç görünüm açılır, kamera iç görünüm açısına gider ve parça mor ışıkla vurgulanır.
4. Geçiş yaklaşık 0,5 saniye sürer: üst yüzey, tuşlar ve touchpad matlıktan buzlu cama geçer, klavye ışığı söner ve kenar çizgileri belirir. Dış görünüme dönüşte tersi olur.
5. İşaret noktaları yalnızca iç görünümde görünür.

## Taslak dosyası

`laptop-taslak.html` taslağın Three.js kodudur. Açmak için depo kökünde bir yerel sunucu gerekir (ör. `python -m http.server`). Sonra tarayıcıda `/design/laptop-taslak.html?view=exterior`, `?view=inside` ya da `?view=inside-ram` açılır.
