# IngTeacher

Yerel calisan telaffuz calisma uygulamasi.

## Baslatma

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

## Resim anlatma

1. `Resim` sekmesine gecin ve bilgisayardan bir gorsel secin.
2. Ayarlardaki Ollama endpoint ve gorsel modelini kontrol edin (varsayilan model: `llava`).
3. `Kaydet` dugmesine basip resmi kendi İngilizce cumlelerinizle anlatin. Konusmaniz metne donusturulur ve duzenlenebilir.
   Resim anlatiminda kayit otomatik durmaz; anlatiminiz bittiginde `Durdur` dugmesine basin.
4. `Anlatimimi AI ile degerlendir` dugmesine basin. AI; duzeltilmis anlatim, hatalar, eksik detaylar, kelime onerileri ve puan hazirlar.
5. AI ornegini yan tarafta gorebilir, `Ornek seslendir` ile dinleyebilir ve tekrar kayit yapabilirsiniz.

Resim aciklamasi yerel Ollama uzerinden uretilir. Bunun icin Ollama'nin acik ve secilen gorsel modelinin yuklu olmasi gerekir.
