# IngTeacher

Yerel calisan telaffuz calisma uygulamasi.

## Baslatma

Python gereksinimlerini proje kokunden kurun:

```powershell
python -m pip install -r H:\ingteacher\requirement.txt
```

IngTeacher ana arayuzu icin Node.js kurulu olmalidir. Proje ek bir npm paketi kullanmaz;
baslatma komutu Python'un yerlesik HTTP sunucusunu `npm run dev` araciligiyla calistirir.

En kolay yol:

```powershell
H:\ingteacher\basla.bat
```

Alternatif olarak elle baslatmak isterseniz:

```powershell
cd H:\ingteacher
npm run dev
```

Sonra Chrome'da su adresi acin:

```text
http://localhost:5173
```

## Kullanim

1. Metin yazin, dosya secin veya `Ornek metin` dugmesine basin.
2. `Calismayi hazirla` ile metni parcalara ayirin.
3. `Ornek seslendir` ile telaffuzu dinleyin.
4. `Kaydet` ile okuyun; cumle sonunda sessizlik algilaninca kayit otomatik durur. Gerekirse `Durdur` ile elle bitirebilir veya `Atla` ile zorlandiginiz cumleyi gecabilirsiniz.

ASR veya TTS endpoint bos kalirsa uygulama Chrome'un Web Speech ve speechSynthesis ozelliklerini kullanir.

## AI metin ve egitim modeli (Ollama)

Uygulama yalnizca bilgisayarinizda yuklu olan Ollama modellerini kullanir.
Tarayiciya model indirmez; bu nedenle WebLLM onbellegi veya tarayici depolama kotasi kullanilmaz.

1. Ollama'yi baslatin.
2. Kullanmak istediginiz modeli indirin; ornegin `ollama pull qwen2.5:7b`.
3. Uygulamadaki `AI Metin` veya `Egitim modu` sekmesine gecin.
4. Model listesi otomatik olarak `/api/tags` uzerinden gelir. Yeni bir model indirdikten sonra `Yenile` dugmesine basin.

Varsayilan endpoint: `http://127.0.0.1:11434/api/generate`.

## Resim anlatma

1. `Resim` sekmesine gecin ve bilgisayardan bir gorsel secin.
2. Ayarlardaki Ollama endpoint ve gorsel modelini kontrol edin (varsayilan model: `llava`).
3. `Kaydet` dugmesine basip resmi kendi İngilizce cumlelerinizle anlatin. Konusmaniz metne donusturulur ve duzenlenebilir.
   Resim anlatiminda kayit otomatik durmaz; anlatiminiz bittiginde `Durdur` dugmesine basin.
4. `Anlatimimi AI ile degerlendir` dugmesine basin. AI; duzeltilmis anlatim, hatalar, eksik detaylar, kelime onerileri ve puan hazirlar.
5. AI ornegini yan tarafta gorebilir, `Ornek seslendir` ile dinleyebilir ve tekrar kayit yapabilirsiniz.

Resim aciklamasi ve degerlendirme yerel Ollama uzerinden uretilir. Bunun icin Ollama'nin acik ve secilen gorsel modelinin (varsayilan `llava`) yuklu olmasi gerekir.
Bu bolum AI metin ureticisinden bagimsizdir; yine de Ollama'nin acik ve gorsel modelinin yuklu olmasi gerekir.

## Uyarlanabilir egitim modu

`Egitim modu` sekmesi A1 seviyesinden baslayan sesli/yazili bir İngilizce sohbet calismasidir. Ajan her turda tek bir soru sorar, yazdiginiz veya mikrofonla verdiginiz cevabi degerlendirir ve yeni soruyu seviyenize gore zorlastirir.

- Seviyeler A1, A2, B1, B2, C1 ve C2 sirasi ile ilerler.
- Seviye yukseltme karari kurala bagli bir sayaçla degil, ajanin son cevaplarda gordugu tutarli performansa gore verilir.
- Soru sesi A1'de 0.65x ile baslar ve C2'de 1.20x'e kadar otomatik hizlanir.
- `Soruyu dinle` ile ayni soruyu tekrar dinleyebilir; `Kaydet` ile cevabi soyleyebilir veya metin alanina yazabilirsiniz.
- Bu mod, AI Metin sekmesindeki secili Ollama modelini kullanir. Ilk sorudan once bir model secili ve hazir olmalidir.
- `Kaldigim yeri isaretle`, metin, resim, AI metni, egitim gecmisi, ayarlar ve ilerleme durumunu `H:\\ingteacher\\ingteacher_kaldigim_yer.md` dosyasina kaydeder. Sonraki oturumda `Yedegi geri yukle` ile ayni dosyadan devam edebilirsiniz.

## Testler

```powershell
npm test
npm run test:dom
```

`npm test` uygulama akislarini (Ollama ve geriye donuk model yukleme akisini) sanal DOM ile dener.
`npm run test:dom` HTML/JS arasindaki `id` tutarliligini kontrol eder.
