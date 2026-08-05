import base64
import json
import random
import uuid
from pathlib import Path

import gradio as gr
import requests

# ------------------------ AYARLAR ------------------------
OLLAMA_URL = "http://localhost:11434"
VISION_MODEL = "llava"        # moondream | llava | minicpm-v | llama3.2-vision
WHISPER_SIZE = "small"        # tiny | base | small | medium
IMAGE_DIR = Path("images")    # pratik görsellerini buraya koy
IMAGE_DIR.mkdir(exist_ok=True)
IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}
# ---------------------------------------------------------

from faster_whisper import WhisperModel

print(f"🎧 Whisper '{WHISPER_SIZE}' yükleniyor (ilk seferde model indirilir)...")
whisper = WhisperModel(WHISPER_SIZE, device="cpu", compute_type="int8")
print("✅ Whisper hazır.")

EVAL_PROMPT = """You are a friendly English teacher. A Turkish student is practicing describing images in English.
Look at the image carefully.

The student's description:
\"\"\"
__USER_TEXT__
\"\"\"

Answer in Markdown. Use EXACTLY these headings (headings stay in Turkish; example sentences in English, explanations in Turkish):

## 📷 Örnek Tanım
Your own natural description of the image in English (2-4 sentences).

## ✏️ Düzeltilmiş Hali
The student's text with all grammar/spelling/vocabulary corrections applied. Keep their meaning and style.

## 🔍 Düzeltmeler
Each mistake as: **yanlış** → **doğru** — kısa Türkçe açıklama.
No mistakes: "Harika, belirgin hata yok! 👏"

## 💡 Kaçırdığın Detaylar
2-4 visible things the student did not mention. For each, give a ready-to-use English sentence + Turkish translation in parentheses.

## 🚀 Kelime ve İfade Önerileri
3-5 useful words/phrases for this image: **word** – Türkçe anlamı – example sentence.

## ⭐ Puan: X/10
Score out of 10 (accuracy + vocabulary + grammar) with a 1-2 sentence Turkish explanation.
"""


def image_to_b64(path: str) -> str:
    return base64.b64encode(Path(path).read_bytes()).decode()


def stream_vision(prompt: str, image_path: str):
    payload = {
        "model": VISION_MODEL,
        "prompt": prompt,
        "stream": True,
        "options": {"temperature": 0.3},
    }
    if image_path:
        payload["images"] = [image_to_b64(image_path)]

    with requests.post(f"{OLLAMA_URL}/api/generate", json=payload,
                       stream=True, timeout=(10, 600)) as r:
        if r.status_code == 404:
            raise RuntimeError(
                f"'{VISION_MODEL}' bulunamadı. `ollama pull {VISION_MODEL}` çalıştırdın mı?")
        r.raise_for_status()
        for line in r.iter_lines():
            if not line:
                continue
            data = json.loads(line)
            if "error" in data:
                raise RuntimeError(data["error"])
            if data.get("response"):
                yield data["response"]
            if data.get("done"):
                break


def transcribe(audio_path: str) -> str:
    segments, _ = whisper.transcribe(audio_path, language="en",
                                     beam_size=5, vad_filter=True)
    return " ".join(s.text.strip() for s in segments).strip()


def random_local_path():
    files = [p for p in IMAGE_DIR.iterdir()
             if p.is_file() and p.suffix.lower() in IMAGE_EXTS]
    return str(random.choice(files)) if files else None


def pick_local_image():
    p = random_local_path()
    if not p:
        gr.Warning("images/ klasörü boş. Görsel ekleyin ya da 🌐 butonunu kullanın.")
    return p


def fetch_web_image():
    try:
        r = requests.get("https://picsum.photos/900/600", timeout=15)
        r.raise_for_status()
        p = IMAGE_DIR / f"web_{uuid.uuid4().hex[:8]}.jpg"
        p.write_bytes(r.content)
        return str(p)
    except Exception as e:
        gr.Warning(f"Görsel indirilemedi: {e}")
        return None


def evaluate(image_path, written_text, audio_path):
    user_text = (written_text or "").strip()
    transcript = ""

    if audio_path:
        try:
            transcript = transcribe(audio_path)
        except Exception as e:
            gr.Warning(f"Ses çözümlenemedi: {e}")
        if transcript:
            user_text = f"{user_text} {transcript}".strip()

    if not image_path:
        yield transcript, "⚠️ Önce bir görsel seç veya yükle."
        return
    if not user_text:
        yield transcript, "⚠️ İngilizce bir tanım yaz veya sesli anlat."
        return

    yield transcript, "*🤔 Model görseli inceliyor, biraz sürebilir...*\n"

    prompt = EVAL_PROMPT.replace("__USER_TEXT__", user_text)
    answer = ""
    try:
        for chunk in stream_vision(prompt, image_path):
            answer += chunk
            yield transcript, answer
    except requests.exceptions.ConnectionError:
        yield transcript, "❌ Ollama'ya ulaşılamadı. Çalışıyor mu? `ollama serve` deneyin."
    except Exception as e:
        yield transcript, f"❌ Hata: {e}"


with gr.Blocks(title="İngilizce Görsel Tanımlama", theme=gr.themes.Soft()) as demo:
    gr.Markdown(
        "# 🖼️ Görseli İngilizce Tanımla\n"
        "Görseli incele → İngilizce **yaz** veya **konuş** → yerel yapay zeka "
        "kendi tanımını yapıp seni değerlendirsin, öneriler versin. "
        "(Her şey bilgisayarında çalışır 🖥️)"
    )

    with gr.Row():
        with gr.Column(scale=3):
            img = gr.Image(label="📷 Görsel (kendi görselini sürükleyip bırakabilirsin)",
                           type="filepath", sources=["upload"],
                           value=random_local_path(), height=380)
            with gr.Row():
                btn_local = gr.Button("🎲 Yerelden rastgele")
                btn_web = gr.Button("🌐 İnternetten rastgele")
        with gr.Column(scale=2):
            text_in = gr.Textbox(label="✍️ İngilizce tanımın (yazılı)", lines=6,
                                 placeholder="In this image, I can see ...")
            audio_in = gr.Audio(label="🎤 İngilizce tanımın (sesli)",
                                sources=["microphone"], type="filepath")
            eval_btn = gr.Button("✅ Değerlendir", variant="primary")

    transcript_out = gr.Textbox(label="🎧 Whisper'ın duydukları", interactive=False)
    feedback_out = gr.Markdown()

    btn_local.click(pick_local_image, outputs=[img])
    btn_web.click(fetch_web_image, outputs=[img])
    eval_btn.click(evaluate, inputs=[img, text_in, audio_in],
                   outputs=[transcript_out, feedback_out])

demo.launch(inbrowser=True)