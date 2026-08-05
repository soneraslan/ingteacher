const els = {
  textTab: document.querySelector("#textTab"),
  imageTab: document.querySelector("#imageTab"),
  textPanel: document.querySelector("#textPanel"),
  imagePanel: document.querySelector("#imagePanel"),
  readingText: document.querySelector("#readingText"),
  splitWords: document.querySelector("#splitWords"),
  splitSentences: document.querySelector("#splitSentences"),
  buildPractice: document.querySelector("#buildPractice"),
  loadSample: document.querySelector("#loadSample"),
  saveText: document.querySelector("#saveText"),
  deleteText: document.querySelector("#deleteText"),
  savedTexts: document.querySelector("#savedTexts"),
  textTitle: document.querySelector("#textTitle"),
  sourceFile: document.querySelector("#sourceFile"),
  fileStatus: document.querySelector("#fileStatus"),
  prevDocumentPart: document.querySelector("#prevDocumentPart"),
  nextDocumentPart: document.querySelector("#nextDocumentPart"),
  documentPartStatus: document.querySelector("#documentPartStatus"),
  imageFile: document.querySelector("#imageFile"),
  imageStatus: document.querySelector("#imageStatus"),
  selectedImage: document.querySelector("#selectedImage"),
  imageEmpty: document.querySelector("#imageEmpty"),
  imageDescription: document.querySelector("#imageDescription"),
  imageUserText: document.querySelector("#imageUserText"),
  imageEvaluation: document.querySelector("#imageEvaluation"),
  clearImage: document.querySelector("#clearImage"),
  generateImagePractice: document.querySelector("#generateImagePractice"),
  evaluateImageDescription: document.querySelector("#evaluateImageDescription"),
  currentPrompt: document.querySelector("#currentPrompt"),
  positionLabel: document.querySelector("#positionLabel"),
  segments: document.querySelector("#segments"),
  recordButton: document.querySelector("#recordButton"),
  speakButton: document.querySelector("#speakButton"),
  prevSegment: document.querySelector("#prevSegment"),
  nextSegment: document.querySelector("#nextSegment"),
  skipSegment: document.querySelector("#skipSegment"),
  heardText: document.querySelector("#heardText"),
  feedbackText: document.querySelector("#feedbackText"),
  micTestButton: document.querySelector("#micTestButton"),
  micLevel: document.querySelector("#micLevel"),
  micStatus: document.querySelector("#micStatus"),
  scoreValue: document.querySelector("#scoreValue"),
  asrEndpoint: document.querySelector("#asrEndpoint"),
  ttsEndpoint: document.querySelector("#ttsEndpoint"),
  imageOllamaEndpoint: document.querySelector("#imageOllamaEndpoint"),
  visionModel: document.querySelector("#visionModel"),
  language: document.querySelector("#language"),
  threshold: document.querySelector("#threshold"),
  thresholdValue: document.querySelector("#thresholdValue"),
  decreaseSpeechRate: document.querySelector("#decreaseSpeechRate"),
  increaseSpeechRate: document.querySelector("#increaseSpeechRate"),
  speechRateValue: document.querySelector("#speechRateValue"),
  autoAdvance: document.querySelector("#autoAdvance"),
  browserFallback: document.querySelector("#browserFallback"),
  clearSession: document.querySelector("#clearSession"),
};

const state = {
  activeSource: "text",
  mode: "sentence",
  textMode: "sentence",
  segments: [],
  current: 0,
  results: [],
  mediaRecorder: null,
  recognition: null,
  browserTranscript: "",
  browserTranscriptBase: "",
  browserStopRequested: false,
  browserResultHandled: false,
  discardRecordingResult: false,
  micStream: null,
  audioContext: null,
  analyser: null,
  levelFrame: null,
  micTesting: false,
  audioChunks: [],
  recording: false,
  voiceDetected: false,
  silenceStartedAt: null,
  recordingStartedAt: null,
  autoStopRequested: false,
  savedTexts: [],
  documentParts: [],
  documentPartIndex: 0,
  documentTitle: "",
  speechRate: 0.8,
  imageDataUrl: "",
  imageDescription: "",
  imageUserText: "",
  imageLoading: false,
  practiceStates: {
    text: { segments: [], current: 0, results: [] },
    image: { segments: [], current: 0, results: [] },
  },
};

const storageKey = "ingteacher.savedTexts.v1";
const sessionStorageKey = "ingteacher.session.v1";
const documentPartsStorageKey = "ingteacher.documentParts.v1";
const autoStopVoiceLevel = 10;
const autoStopSilenceLevel = 6;
const autoStopBaseSilenceMs = 1600;
const autoStopSilencePerWordMs = 120;
const autoStopBaseMinRecordingMs = 900;
const autoStopMinRecordingPerWordMs = 350;
const liveAdvanceThreshold = 75;
const maxSentenceWords = 15;
const sampleText =
  "Good morning. I am practicing English pronunciation today. I want to speak clearly, slowly, and confidently.";

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}' ]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function splitText(text, mode) {
  const clean = text.trim();
  if (!clean) return [];
  if (mode === "word") {
    return clean
      .split(/\s+/)
      .map((part) => part.trim())
      .filter(Boolean);
  }
  const sentences = clean.match(/[^.!?]+[.!?]*/g) ?? [clean];
  return sentences.flatMap((sentence) => {
    const words = sentence.trim().split(/\s+/).filter(Boolean);
    const parts = [];
    const partCount = Math.ceil(words.length / maxSentenceWords);
    const wordsPerPart = Math.ceil(words.length / partCount);

    for (let index = 0; index < words.length; index += wordsPerPart) {
      parts.push(words.slice(index, index + wordsPerPart).join(" "));
    }

    return parts;
  });
}

function saveActivePracticeState() {
  state.practiceStates[state.activeSource] = {
    segments: [...state.segments],
    current: state.current,
    results: state.results.map((result) => (result ? { ...result } : result)),
  };
}

function loadPracticeState(source) {
  const saved = state.practiceStates[source] ?? { segments: [], current: 0, results: [] };
  state.segments = [...saved.segments];
  state.current = Math.max(0, Math.min(saved.current || 0, state.segments.length - 1));
  state.results = saved.results.map((result) => (result ? { ...result } : result));
}

function setSourceTab(source, { persist = true } = {}) {
  const nextSource = source === "image" ? "image" : "text";
  if (state.activeSource !== nextSource) saveActivePracticeState();
  state.activeSource = nextSource;
  state.mode = nextSource === "image" ? "sentence" : state.textMode;
  loadPracticeState(nextSource);

  els.textPanel.hidden = nextSource !== "text";
  els.imagePanel.hidden = nextSource !== "image";
  els.textTab.classList.toggle("active", nextSource === "text");
  els.imageTab.classList.toggle("active", nextSource === "image");
  els.textTab.setAttribute("aria-selected", String(nextSource === "text"));
  els.imageTab.setAttribute("aria-selected", String(nextSource === "image"));
  els.splitWords.classList.toggle("active", state.mode === "word");
  els.splitSentences.classList.toggle("active", state.mode === "sentence");

  if (state.segments.length) updateActiveResult();
  else if (nextSource === "image") {
    els.heardText.textContent = "Henuz kayit yok.";
    els.feedbackText.textContent = state.imageDataUrl
      ? "Kaydet'e bas ve resmi kendi İngilizce cumlelerinle anlat."
      : "Once bir resim sec.";
  } else {
    els.heardText.textContent = "Henuz kayit yok.";
    els.feedbackText.textContent = "Calismak icin once metin yaz veya kayitli bir metin sec.";
  }
  render();
  if (persist) persistSession();
}

function levenshtein(a, b) {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
  for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }

  return matrix[a.length][b.length];
}

function similarity(expected, heard) {
  const a = normalizeText(expected);
  const b = normalizeText(heard);
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  const maxLength = Math.max(a.length, b.length);
  return Math.round((1 - distance / maxLength) * 100);
}

function renderSpeechRate() {
  els.speechRateValue.textContent = `${state.speechRate.toFixed(2)}x`;
  els.decreaseSpeechRate.disabled = state.speechRate <= 0.5;
  els.increaseSpeechRate.disabled = state.speechRate >= 1.2;
}

function renderThreshold() {
  els.thresholdValue.textContent = `${els.threshold.value}%`;
}

function changeSpeechRate(delta) {
  const next = Math.min(1.2, Math.max(0.5, Number((state.speechRate + delta).toFixed(2))));
  state.speechRate = next;
  renderSpeechRate();
  persistSession();
}

function persistSession() {
  saveActivePracticeState();
  const session = {
    readingText: els.readingText.value,
    textTitle: els.textTitle.value,
    savedTextId: els.savedTexts.value,
    mode: state.mode,
    current: state.current,
    results: state.results,
    documentPartIndex: state.documentPartIndex,
    documentTitle: state.documentTitle,
    speechRate: state.speechRate,
    practiceStates: { text: state.practiceStates.text },
    language: els.language.value,
    threshold: els.threshold.value,
    autoAdvance: els.autoAdvance.checked,
    browserFallback: els.browserFallback.checked,
    asrEndpoint: els.asrEndpoint.value,
    ttsEndpoint: els.ttsEndpoint.value,
    imageOllamaEndpoint: els.imageOllamaEndpoint.value,
    visionModel: els.visionModel.value,
  };
  try {
    localStorage.setItem(sessionStorageKey, JSON.stringify(session));
  } catch {
    els.feedbackText.textContent = "Oturum kaydedilemedi; dosya metni cok buyuk olabilir.";
  }
}

function persistDocumentParts() {
  try {
    localStorage.setItem(
      documentPartsStorageKey,
      JSON.stringify({
        title: state.documentTitle,
        parts: state.documentParts,
      }),
    );
  } catch {
    els.feedbackText.textContent = "Dosya bolumleri kalici kaydedilemedi; sayfa yenilenirse dosyayi tekrar secmek gerekebilir.";
  }
}

function restoreDocumentParts(title) {
  try {
    const saved = JSON.parse(localStorage.getItem(documentPartsStorageKey) ?? "null");
    if (!saved || saved.title !== title || !Array.isArray(saved.parts)) return [];
    return saved.parts;
  } catch {
    return [];
  }
}

function restoreSession() {
  try {
    const session = JSON.parse(localStorage.getItem(sessionStorageKey) ?? "null");
    if (!session) return false;

    state.mode = session.mode === "word" ? "word" : "sentence";
    state.textMode = state.mode;
    state.documentPartIndex = Number(session.documentPartIndex) || 0;
    state.documentTitle = session.documentTitle || "";
    state.documentParts = restoreDocumentParts(state.documentTitle);
    state.speechRate = Number(session.speechRate) || 0.8;
    state.imageDescription = "";

    els.readingText.value = session.readingText || "";
    els.textTitle.value = session.textTitle || "";
    els.language.value = session.language || "en-US";
    els.threshold.value = session.threshold || "75";
    els.autoAdvance.checked = session.autoAdvance ?? true;
    els.browserFallback.checked = session.browserFallback ?? true;
    els.asrEndpoint.value = session.asrEndpoint || "";
    els.ttsEndpoint.value = session.ttsEndpoint || "";
    els.imageOllamaEndpoint.value = session.imageOllamaEndpoint || "http://127.0.0.1:11434/api/generate";
    els.visionModel.value = session.visionModel || "llava";
    els.imageDescription.textContent = state.imageDescription || "Once resmi kendi cumlelerinle anlat; AI ornegini istersen sonra hazirla.";
    renderSavedTexts(session.savedTextId || "");
    updateDocumentNav();
    renderSpeechRate();
    renderThreshold();

    const textSegments = splitText(els.readingText.value, state.mode);
    const savedPractices = session.practiceStates ?? {};
    state.practiceStates.text = Array.isArray(savedPractices.text?.segments)
      ? savedPractices.text
      : {
          segments: textSegments,
          current: Number(session.current) || 0,
          results: Array.isArray(session.results) ? session.results : [],
        };
    state.practiceStates.image = { segments: [], current: 0, results: [] };
    state.activeSource = "text";
    loadPracticeState("text");
    setSourceTab("text", { persist: false });
    return true;
  } catch {
    return false;
  }
}

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeTitle(text) {
  const compact = text.replace(/\s+/g, " ").trim();
  return compact.slice(0, 42) || "Adsiz metin";
}

function makeFileTitle(fileName) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim() || "Dosyadan metin";
}

function cleanImportedText(text) {
  return String(text ?? "")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function splitIntoDocumentParts(text, maxSentences = 2) {
  const clean = cleanImportedText(text);
  if (!clean) return [];

  const sourceParts = clean.match(/[^.!?]+[.!?]*/g) ?? [clean];
  const parts = [];
  let current = [];

  sourceParts.forEach((rawPart) => {
    const part = cleanImportedText(rawPart);
    if (!part) return;

    current.push(part);
    if (current.length >= maxSentences) {
      parts.push(cleanImportedText(current.join(" ")));
      current = [];
    }
  });

  if (current.length) parts.push(cleanImportedText(current.join(" ")));
  return parts;
}

async function extractPdfText(file) {
  if (!window.pdfjsLib) {
    throw new Error("PDF okuyucu yuklenemedi. Internet baglantisini kontrol edin.");
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc =
    "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    els.fileStatus.textContent = `PDF okunuyor: ${pageNumber} / ${pdf.numPages}`;
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    pages.push(...splitIntoDocumentParts(pageText));
  }

  return pages;
}

async function extractDocxText(file) {
  if (!window.mammoth) {
    throw new Error("Word okuyucu yuklenemedi. Internet baglantisini kontrol edin.");
  }

  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return splitIntoDocumentParts(result.value);
}

async function extractFileText(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".pdf") || file.type === "application/pdf") {
    return extractPdfText(file);
  }
  if (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return extractDocxText(file);
  }
  if (name.endsWith(".txt") || file.type.startsWith("text/")) {
    return splitIntoDocumentParts(await file.text());
  }
  if (name.endsWith(".doc")) {
    throw new Error("Eski .doc formati desteklenmiyor. Word'de .docx olarak kaydedip secin.");
  }
  throw new Error("Bu dosya formati desteklenmiyor. PDF, DOCX veya TXT secin.");
}

async function importSourceFile() {
  const file = els.sourceFile.files?.[0];
  if (!file) return;

  els.fileStatus.textContent = `${file.name} okunuyor...`;
  els.feedbackText.textContent = "Dosyadan metin cikariliyor.";

  try {
    const parts = await extractFileText(file);
    if (!parts.length) {
      throw new Error("Dosyada secilebilir metin bulunamadi. Taranmis PDF ise OCR gerekecek.");
    }

    state.documentParts = parts;
    state.documentPartIndex = 0;
    state.documentTitle = makeFileTitle(file.name);
    persistDocumentParts();
    els.textTitle.value = state.documentTitle;
    els.savedTexts.value = "";
    showDocumentPart(0);
    els.fileStatus.textContent = `${file.name} yuklendi. ${parts.length} metin parcasi bulundu.`;
  } catch (error) {
    els.fileStatus.textContent = error.message;
    els.feedbackText.textContent = error.message;
  } finally {
    els.sourceFile.value = "";
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(new Error("Resim okunamadi.")));
    reader.readAsDataURL(file);
  });
}

async function prepareImageDataUrl(file) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = new Image();
  await new Promise((resolve, reject) => {
    image.addEventListener("load", resolve, { once: true });
    image.addEventListener("error", () => reject(new Error("Resim tarayicida acilamadi.")), { once: true });
    image.src = originalDataUrl;
  });

  const maxDimension = 1280;
  const scale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const context = canvas.getContext("2d");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.86);
}

async function selectPracticeImage() {
  const file = els.imageFile.files?.[0];
  if (!file) return;
  setSourceTab("image");
  els.imageStatus.textContent = `${file.name} hazirlaniyor...`;
  try {
    state.imageDataUrl = await prepareImageDataUrl(file);
    state.imageDescription = "";
    state.imageUserText = "";
    state.practiceStates.image = { segments: [], current: 0, results: [] };
    loadPracticeState("image");
    els.selectedImage.src = state.imageDataUrl;
    els.selectedImage.hidden = false;
    els.imageEmpty.hidden = true;
    els.imageDescription.textContent = "Once resmi kendi cumlelerinle anlat; AI ornegini istersen sonra hazirla.";
    els.imageUserText.value = "";
    els.imageEvaluation.textContent = "Kendi anlatimini yaz veya kaydet, sonra AI degerlendirmesini baslat.";
    els.clearImage.disabled = false;
    els.generateImagePractice.disabled = false;
    els.evaluateImageDescription.disabled = true;
    els.imageStatus.textContent = `${file.name} secildi.`;
    els.heardText.textContent = "Henuz kayit yok.";
    els.feedbackText.textContent = "Kaydet'e bas ve resmi kendi İngilizce cumlelerinle anlat.";
    render();
    persistSession();
  } catch (error) {
    els.imageStatus.textContent = error.message;
    els.feedbackText.textContent = error.message;
  } finally {
    els.imageFile.value = "";
  }
}

function clearPracticeImage() {
  state.imageDataUrl = "";
  state.imageDescription = "";
  state.imageUserText = "";
  state.practiceStates.image = { segments: [], current: 0, results: [] };
  loadPracticeState("image");
  els.selectedImage.removeAttribute("src");
  els.selectedImage.hidden = true;
  els.imageEmpty.hidden = false;
  els.imageDescription.textContent = "Once resmi kendi cumlelerinle anlat; AI ornegini istersen sonra hazirla.";
  els.imageUserText.value = "";
  els.imageEvaluation.textContent = "Kendi anlatimini yaz veya kaydet, sonra AI degerlendirmesini baslat.";
  els.imageStatus.textContent = "JPG, PNG, WEBP veya BMP resmi secebilirsin.";
  els.clearImage.disabled = true;
  els.generateImagePractice.disabled = true;
  els.evaluateImageDescription.disabled = true;
  els.heardText.textContent = "Henuz kayit yok.";
  els.feedbackText.textContent = "Once bir resim sec.";
  render();
  persistSession();
}

async function requestVisionModel(prompt, { jsonResponse = false } = {}) {
  const endpoint = els.imageOllamaEndpoint.value.trim();
  const model = els.visionModel.value.trim();
  if (!endpoint || !model) throw new Error("Gorsel Ollama endpoint ve model adini gir.");
  const body = {
    model,
    prompt,
    images: [state.imageDataUrl.split(",")[1]],
    stream: false,
    options: { temperature: 0.3 },
  };
  if (jsonResponse) body.format = "json";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `Ollama ${response.status} dondu.`);
  const answer = String(data.response || "").trim();
  if (!answer) throw new Error("Model gecerli bir yanit uretmedi.");
  return answer;
}

async function generateImagePractice() {
  if (!state.imageDataUrl || state.imageLoading) return;
  const model = els.visionModel.value.trim();

  state.imageLoading = true;
  els.generateImagePractice.disabled = true;
  els.imageStatus.textContent = `${model} resmi inceliyor...`;
  els.feedbackText.textContent = "Yerel AI resim icin İngilizce calisma cumleleri hazirliyor.";
  const prompt = [
    "You are a friendly English pronunciation teacher.",
    "Describe the visible image naturally in 2 to 4 simple English sentences.",
    "Each sentence must contain no more than 15 words.",
    "Mention the main subject, action, setting, and important visible details.",
    "Return only the English description without headings, bullets, or explanations.",
  ].join(" ");

  try {
    const description = cleanImportedText(await requestVisionModel(prompt));

    state.imageDescription = description;
    els.imageDescription.textContent = description;
    state.mode = "sentence";
    buildPractice();
    els.imageStatus.textContent = "AI ornegi hazir. Ornek seslendir ile dinleyebilirsin.";
    els.feedbackText.textContent = "Kendi anlatimini ayri alanda yazabilir veya Kaydet ile konusabilirsin.";
  } catch (error) {
    els.imageStatus.textContent = `Aciklama hazirlanamadi: ${error.message}`;
    els.feedbackText.textContent = "Ollama'nin acik oldugunu ve gorsel model adini kontrol et.";
  } finally {
    state.imageLoading = false;
    els.generateImagePractice.disabled = !state.imageDataUrl;
    persistSession();
  }
}

function formatImageEvaluation(result) {
  const corrections = Array.isArray(result.corrections) && result.corrections.length
    ? result.corrections.map((item) => `• ${item}`).join("\n")
    : "• Belirgin bir hata bulunmadi.";
  const missed = Array.isArray(result.missed_details) && result.missed_details.length
    ? result.missed_details.map((item) => `• ${item}`).join("\n")
    : "• Onemli gorunur detaylar anlatilmis.";
  const vocabulary = Array.isArray(result.vocabulary) && result.vocabulary.length
    ? result.vocabulary.map((item) => `• ${item}`).join("\n")
    : "• Ek kelime onerisi yok.";
  return [
    "DUZELTILMIS ANLATIM",
    result.corrected_description || "—",
    "",
    "DUZELTMELER",
    corrections,
    "",
    "KACIRDIGIN DETAYLAR",
    missed,
    "",
    "KELIME VE IFADE ONERILERI",
    vocabulary,
    "",
    `PUAN: ${Number(result.score) || 0}/10`,
    result.summary || "",
  ].join("\n");
}

async function evaluateImageUserDescription() {
  const userText = cleanImportedText(els.imageUserText.value);
  if (!state.imageDataUrl || !userText || state.imageLoading) return;
  state.imageUserText = userText;
  state.imageLoading = true;
  els.generateImagePractice.disabled = true;
  els.evaluateImageDescription.disabled = true;
  els.imageStatus.textContent = `${els.visionModel.value.trim()} anlatimini degerlendiriyor...`;
  els.imageEvaluation.textContent = "AI resmi ve senin cumlelerini birlikte inceliyor...";
  const prompt = `
You are a friendly English teacher evaluating a Turkish student's description of an image.
Study the image and the student's own English description below.

STUDENT DESCRIPTION:
${userText}

Return JSON only with this exact structure:
{
  "example_description": "Your natural 2-4 sentence English description; maximum 15 words per sentence.",
  "corrected_description": "Correct the student's grammar, spelling, and vocabulary while preserving meaning.",
  "corrections": ["wrong -> correct — short Turkish explanation"],
  "missed_details": ["Useful English sentence — Turkish translation"],
  "vocabulary": ["word or phrase — Turkish meaning — English example sentence"],
  "score": 0,
  "summary": "One or two encouraging Turkish sentences explaining the score."
}
Score from 0 to 10 using visual accuracy, grammar, and vocabulary. Do not invent invisible details.
`.trim();

  try {
    const raw = await requestVisionModel(prompt, { jsonResponse: true });
    const result = JSON.parse(raw);
    const example = cleanImportedText(result.example_description || "");
    if (example) {
      state.imageDescription = example;
      els.imageDescription.textContent = example;
      state.mode = "sentence";
      buildPractice();
    }
    els.imageEvaluation.textContent = formatImageEvaluation(result);
    els.imageStatus.textContent = "Anlatimin degerlendirildi. Metni duzelterek tekrar kaydedebilirsin.";
    els.feedbackText.textContent = "AI degerlendirmesi hazir. Ornek cumleleri TTS ile dinleyebilirsin.";
  } catch (error) {
    els.imageEvaluation.textContent = `Degerlendirme yapilamadi: ${error.message}`;
    els.imageStatus.textContent = "Ollama'nin acik oldugunu ve gorsel modeli kontrol et.";
  } finally {
    state.imageLoading = false;
    els.generateImagePractice.disabled = !state.imageDataUrl;
    els.evaluateImageDescription.disabled = !state.imageDataUrl || !cleanImportedText(els.imageUserText.value);
    persistSession();
  }
}

function updateDocumentNav() {
  const total = state.documentParts.length;
  els.prevDocumentPart.disabled = !total || state.documentPartIndex <= 0;
  els.nextDocumentPart.disabled = !total || state.documentPartIndex >= total - 1;
  els.documentPartStatus.textContent = total
    ? `${state.documentTitle}: ${state.documentPartIndex + 1} / ${total}`
    : "Dosyadan metin bekleniyor.";
}

function showDocumentPart(index) {
  if (!state.documentParts.length) {
    updateDocumentNav();
    return;
  }

  state.documentPartIndex = Math.max(0, Math.min(index, state.documentParts.length - 1));
  els.readingText.value = state.documentParts[state.documentPartIndex];
  els.textTitle.value = `${state.documentTitle} - ${state.documentPartIndex + 1}`;
  updateDocumentNav();
  buildPractice();
  persistSession();
}

function canAdvanceDocumentPart() {
  return state.activeSource === "text" &&
    state.documentParts.length > 0 &&
    state.documentPartIndex < state.documentParts.length - 1;
}

function advanceToNextDocumentPart() {
  showDocumentPart(state.documentPartIndex + 1);
  els.feedbackText.textContent = "Yeni metin getirildi. Devam edebilirsin.";
}

function loadSavedTexts() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
    state.savedTexts = Array.isArray(parsed) ? parsed : [];
  } catch {
    state.savedTexts = [];
  }
}

function persistSavedTexts() {
  localStorage.setItem(storageKey, JSON.stringify(state.savedTexts));
}

function renderSavedTexts(selectedId = "") {
  els.savedTexts.innerHTML = "";
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = state.savedTexts.length ? "Metin secin" : "Kayitli metin yok";
  els.savedTexts.append(empty);

  state.savedTexts.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.id;
    option.textContent = item.title;
    els.savedTexts.append(option);
  });

  els.savedTexts.value = selectedId;
  els.deleteText.disabled = !selectedId;
}

function saveCurrentText() {
  const text = els.readingText.value.trim();
  if (!text) {
    els.feedbackText.textContent = "Once calismak istedigin metni yaz veya yapistir.";
    return;
  }

  const selectedId = els.savedTexts.value;
  const title = els.textTitle.value.trim() || makeTitle(text);
  const existing = state.savedTexts.find((item) => item.id === selectedId);

  if (existing) {
    existing.title = title;
    existing.text = text;
  } else {
    state.savedTexts.push({ id: createId(), title, text });
  }

  persistSavedTexts();
  const saved = existing ?? state.savedTexts[state.savedTexts.length - 1];
  renderSavedTexts(saved.id);
  els.textTitle.value = saved.title;
  els.feedbackText.textContent = "Metin kaydedildi. Artik listeden secebilirsin.";
  persistSession();
}

function selectSavedText() {
  const selected = state.savedTexts.find((item) => item.id === els.savedTexts.value);
  els.deleteText.disabled = !selected;
  if (!selected) return;

  state.documentParts = [];
  state.documentPartIndex = 0;
  state.documentTitle = "";
  localStorage.removeItem(documentPartsStorageKey);
  updateDocumentNav();
  els.textTitle.value = selected.title;
  els.readingText.value = selected.text;
  buildPractice();
  persistSession();
}

function deleteSelectedText() {
  const selectedId = els.savedTexts.value;
  if (!selectedId) return;

  state.savedTexts = state.savedTexts.filter((item) => item.id !== selectedId);
  persistSavedTexts();
  els.savedTexts.value = "";
  els.textTitle.value = "";
  renderSavedTexts();
  els.feedbackText.textContent = "Secilen metin silindi.";
  persistSession();
}

function describeSpeechError(error) {
  const message = error?.message ?? String(error);
  const errors = {
    "no-speech": "Ses algilanmadi. Mikrofon testinde cubuk hareket ediyor mu kontrol edin, sonra biraz daha yakindan ve net okuyun.",
    "not-allowed": "Mikrofon izni verilmedi. Tarayicinin adres cubugundaki mikrofon iznini acin.",
    "audio-capture": "Tarayici mikrofon aygitina erisemedi. Windows giris aygitini ve mikrofon gizlilik iznini kontrol edin.",
    network: "Tarayici konusma tanima servisine ulasamadi. Yerel ASR endpoint kullanmak daha saglam olur.",
  };

  return errors[message] ?? `Ses cozumlenemedi: ${message}`;
}

async function openMicStream() {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Mikrofon erisimi bu tarayicida desteklenmiyor.");
  }

  if (!state.micStream) {
    state.micStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  return state.micStream;
}

function startLevelMeter(stream) {
  stopLevelMeter({ closeStream: false });
  state.audioContext = new AudioContext();
  const source = state.audioContext.createMediaStreamSource(stream);
  state.analyser = state.audioContext.createAnalyser();
  state.analyser.fftSize = 512;
  source.connect(state.analyser);

  const data = new Uint8Array(state.analyser.fftSize);
  const tick = () => {
    state.analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (const sample of data) {
      const centered = sample - 128;
      sum += centered * centered;
    }
    const rms = Math.sqrt(sum / data.length);
    const level = Math.min(100, Math.round(rms * 3.8));
    els.micLevel.style.width = `${level}%`;
    if (state.recording) {
      updateAutoStopFromLevel(level);
      els.micStatus.textContent = level > 8
        ? "Mikrofon sesi aliyor."
        : state.activeSource === "image"
        ? "Resim anlatiminda kaydi Durdur dugmesiyle bitir."
        : "Sessizlik algilanirsa kayit otomatik duracak.";
    }
    state.levelFrame = requestAnimationFrame(tick);
  };

  tick();
}

function resetAutoStopState() {
  state.voiceDetected = false;
  state.silenceStartedAt = null;
  state.recordingStartedAt = null;
  state.autoStopRequested = false;
}

function beginAutoStopState() {
  resetAutoStopState();
  state.recordingStartedAt = performance.now();
}

function getRecordingTiming(segment = state.segments[state.current]) {
  const wordCount = state.activeSource === "image"
    ? 15
    : Math.max(1, normalizeText(segment).split(/\s+/).filter(Boolean).length);
  return {
    wordCount,
    minRecordingMs: autoStopBaseMinRecordingMs + (wordCount - 1) * autoStopMinRecordingPerWordMs,
    silenceMs: autoStopBaseSilenceMs + (wordCount - 1) * autoStopSilencePerWordMs,
  };
}

function updateAutoStopFromLevel(level) {
  if (!state.recording || state.autoStopRequested) return;
  if (state.activeSource === "image") return;

  const now = performance.now();
  const timing = getRecordingTiming();
  if (level >= autoStopVoiceLevel) {
    state.voiceDetected = true;
    state.silenceStartedAt = null;
    return;
  }

  if (!state.voiceDetected || level > autoStopSilenceLevel) return;
  if (now - state.recordingStartedAt < timing.minRecordingMs) return;

  if (state.silenceStartedAt === null) {
    state.silenceStartedAt = now;
    return;
  }

  if (now - state.silenceStartedAt >= timing.silenceMs) {
    state.autoStopRequested = true;
    els.feedbackText.textContent = "Sessizlik algilandi; kayit otomatik durduruluyor.";
    stopRecording();
  }
}

function stopLevelMeter({ closeStream = true } = {}) {
  if (state.levelFrame) cancelAnimationFrame(state.levelFrame);
  state.levelFrame = null;
  if (state.audioContext) state.audioContext.close();
  state.audioContext = null;
  state.analyser = null;
  els.micLevel.style.width = "0%";

  if (closeStream && state.micStream) {
    state.micStream.getTracks().forEach((track) => track.stop());
    state.micStream = null;
  }
}

async function toggleMicTest() {
  if (state.micTesting) {
    state.micTesting = false;
    els.micTestButton.textContent = "Mikrofonu test et";
    els.micStatus.textContent = "Mikrofon testi durdu.";
    stopLevelMeter();
    return;
  }

  try {
    const stream = await openMicStream();
    state.micTesting = true;
    els.micTestButton.textContent = "Testi durdur";
    els.micStatus.textContent = "Konusun; cubuk hareket ediyorsa mikrofon calisiyor.";
    startLevelMeter(stream);
  } catch (error) {
    els.micStatus.textContent = describeSpeechError(error);
    els.feedbackText.textContent = describeSpeechError(error);
  }
}

function render() {
  const total = state.segments.length || 1;
  const imageFreeDescription = state.activeSource === "image" && !state.segments.length;
  const currentSegment = state.segments[state.current] ?? (
    state.activeSource === "image" ? "Resmi kendi İngilizce cumlelerinle anlat." : "Calismayi hazirlayin."
  );
  els.currentPrompt.textContent = currentSegment;
  els.positionLabel.textContent = imageFreeDescription
    ? "Serbest anlatim"
    : `${Math.min(state.current + 1, total)} / ${total}`;
  els.prevSegment.disabled = state.current <= 0;
  els.nextSegment.disabled = state.current >= state.segments.length - 1;
  els.skipSegment.disabled = state.segments.length === 0;
  els.speakButton.disabled = state.segments.length === 0;
  els.recordButton.disabled = state.activeSource === "image"
    ? !state.imageDataUrl
    : state.segments.length === 0;

  els.segments.innerHTML = "";
  state.segments.forEach((segment, index) => {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "segment";
    chip.textContent = segment;
    chip.addEventListener("click", () => {
      state.current = index;
      updateActiveResult();
      render();
    });
    if (index === state.current) chip.classList.add("current");
    if (state.results[index]?.ok) chip.classList.add("correct");
    if (state.results[index]?.skipped) chip.classList.add("skipped");
    if (state.results[index] && !state.results[index].ok) chip.classList.add("wrong");
    els.segments.append(chip);
  });

  const scored = state.results.filter(Boolean);
  const average = scored.length
    ? Math.round(scored.reduce((sum, result) => sum + result.score, 0) / scored.length)
    : 0;
  els.scoreValue.textContent = `${average}%`;
}

function updateActiveResult() {
  const result = state.results[state.current];
  if (!result) {
    els.heardText.textContent = "Henuz kayit yok.";
    els.feedbackText.textContent = "Bu parcayi okuyun ve sonucu burada gorun.";
    return;
  }

  els.heardText.textContent = result.heard || "Ses metne donusturulemedi.";
  els.feedbackText.textContent = result.skipped
    ? "Bu parca atlandi. Sonra geri donup tekrar deneyebilirsin."
    : result.ok
    ? `Iyi eslesme: ${result.score}%.`
    : `Tekrar deneyin: ${result.score}%. Beklenen ifadeye daha yakin okuyun.`;
}

function buildPractice() {
  const practiceText = state.activeSource === "image"
    ? state.imageDescription
    : els.readingText.value;
  state.segments = splitText(practiceText, state.mode);
  state.current = 0;
  state.results = [];
  if (!state.segments.length) {
    els.heardText.textContent = "Henuz kayit yok.";
    els.feedbackText.textContent = state.activeSource === "image"
      ? "Once bir resim sec ve AI aciklamasi hazirla."
      : "Calismak icin once metin yaz veya kayitli bir metin sec.";
  } else {
    updateActiveResult();
  }
  render();
  persistSession();
}

function loadSampleText() {
  state.documentParts = [];
  state.documentPartIndex = 0;
  state.documentTitle = "";
  localStorage.removeItem(documentPartsStorageKey);
  els.savedTexts.value = "";
  els.textTitle.value = "Gunluk telaffuz ornegi";
  els.readingText.value = sampleText;
  updateDocumentNav();
  buildPractice();
  els.feedbackText.textContent = "Ornek metin hazir. Kaydet'e basarak listene ekleyebilirsin.";
}

function clearSession() {
  localStorage.removeItem(sessionStorageKey);
  localStorage.removeItem(documentPartsStorageKey);
  state.segments = [];
  state.current = 0;
  state.results = [];
  state.documentParts = [];
  state.documentPartIndex = 0;
  state.documentTitle = "";
  state.speechRate = 0.8;
  state.imageDataUrl = "";
  state.imageDescription = "";
  state.imageUserText = "";
  state.imageLoading = false;
  state.textMode = "sentence";
  state.practiceStates = {
    text: { segments: [], current: 0, results: [] },
    image: { segments: [], current: 0, results: [] },
  };
  els.readingText.value = "";
  els.textTitle.value = "";
  els.savedTexts.value = "";
  els.asrEndpoint.value = "";
  els.ttsEndpoint.value = "";
  els.imageOllamaEndpoint.value = "http://127.0.0.1:11434/api/generate";
  els.visionModel.value = "llava";
  els.language.value = "en-US";
  els.threshold.value = "75";
  els.autoAdvance.checked = true;
  els.browserFallback.checked = true;
  els.selectedImage.removeAttribute("src");
  els.selectedImage.hidden = true;
  els.imageEmpty.hidden = false;
  els.imageDescription.textContent = "Once resmi kendi cumlelerinle anlat; AI ornegini istersen sonra hazirla.";
  els.imageUserText.value = "";
  els.imageEvaluation.textContent = "Kendi anlatimini yaz veya kaydet, sonra AI degerlendirmesini baslat.";
  els.imageStatus.textContent = "JPG, PNG, WEBP veya BMP resmi secebilirsin.";
  els.clearImage.disabled = true;
  els.generateImagePractice.disabled = true;
  els.evaluateImageDescription.disabled = true;
  updateDocumentNav();
  renderSpeechRate();
  renderThreshold();
  state.activeSource = "text";
  setSourceTab("text", { persist: false });
  setMode("sentence");
  els.heardText.textContent = "Henuz kayit yok.";
  els.feedbackText.textContent = "Oturum sifirlandi. Metin yazabilir, dosya secebilir veya ornek metinle baslayabilirsin.";
}

function setMode(mode) {
  state.mode = mode;
  if (state.activeSource === "text") state.textMode = mode;
  els.splitWords.classList.toggle("active", mode === "word");
  els.splitSentences.classList.toggle("active", mode === "sentence");
  buildPractice();
}

async function transcribeWithLocalModel(audioBlob) {
  const endpoint = els.asrEndpoint.value.trim();
  if (!endpoint) return null;

  const form = new FormData();
  form.append("audio", audioBlob, "reading.webm");
  form.append("language", els.language.value);

  const response = await fetch(endpoint, {
    method: "POST",
    body: form,
  });

  if (!response.ok) {
    throw new Error(`ASR endpoint ${response.status} dondu.`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await response.json();
    return data.text ?? data.transcript ?? data.result ?? "";
  }

  return response.text();
}

function createBrowserRecognition({ onResult, onError, onEnd }) {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) {
    throw new Error("Bu tarayicida Web Speech API yok.");
  }

  const recognition = new Recognition();
  recognition.lang = els.language.value;
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  recognition.addEventListener("result", (event) => {
    const transcript = Array.from(event.results)
      .map((result) => result[0]?.transcript ?? "")
      .join(" ");
    onResult(transcript);
  });

  recognition.addEventListener("error", (event) => onError(new Error(event.error)));
  recognition.addEventListener("end", onEnd);
  return recognition;
}

function finishBrowserListening() {
  state.recording = false;
  state.recognition = null;
  els.recordButton.textContent = "Kaydet";
  els.recordButton.classList.remove("recording");
  if (!state.micTesting) stopLevelMeter();
  resetAutoStopState();
  if (state.browserResultHandled || state.discardRecordingResult) {
    state.browserResultHandled = false;
    state.discardRecordingResult = false;
    return;
  }
  if (state.activeSource === "image") {
    applyImageTranscript(state.browserTranscript);
    return;
  }
  evaluateTranscript(state.browserTranscript);
}

function applyImageTranscript(transcript) {
  const cleanTranscript = cleanImportedText(transcript || "");
  state.imageUserText = cleanTranscript;
  els.imageUserText.value = cleanTranscript;
  els.heardText.textContent = cleanTranscript || "Ses metne donusturulemedi.";
  els.evaluateImageDescription.disabled = !state.imageDataUrl || !cleanTranscript;
  els.feedbackText.textContent = cleanTranscript
    ? "Konusman metne donusturuldu. Duzenleyip AI degerlendirmesini baslatabilirsin."
    : "Konusma metne donusturulemedi; tekrar kaydet veya anlatimini yazarak gir.";
  persistSession();
}

function acceptLiveBrowserTranscript(score) {
  state.browserResultHandled = true;
  els.feedbackText.textContent = `Anlik eslesme kabul edildi: ${score}%. Sonraki cumleye geciliyor.`;
  evaluateTranscript(state.browserTranscript, { threshold: liveAdvanceThreshold, forceAdvance: true });
  stopBrowserListening();
}

function startBrowserRecognitionCycle() {
  let cycleTranscript = "";
  state.recognition = createBrowserRecognition({
    onResult: (transcript) => {
      cycleTranscript = transcript.trim();
      state.browserTranscript = cleanImportedText(`${state.browserTranscriptBase} ${cycleTranscript}`);
      els.heardText.textContent = state.browserTranscript || "Dinliyorum...";
      if (state.activeSource === "image") {
        els.imageUserText.value = state.browserTranscript;
        els.evaluateImageDescription.disabled = !state.browserTranscript;
        els.feedbackText.textContent = "Resim anlatimini dinliyorum; bitirince metni duzenleyebilirsin.";
        return;
      }
      const expected = state.segments[state.current];
      const liveScore = similarity(expected, state.browserTranscript);
      const timing = getRecordingTiming(expected);
      const heardWordCount = normalizeText(state.browserTranscript).split(/\s+/).filter(Boolean).length;
      const enoughWordsHeard = heardWordCount >= Math.ceil(timing.wordCount * 0.8);
      const minimumTimePassed = performance.now() - state.recordingStartedAt >= timing.minRecordingMs;
      if (liveScore >= liveAdvanceThreshold && enoughWordsHeard && minimumTimePassed) {
        acceptLiveBrowserTranscript(liveScore);
        return;
      }
      els.feedbackText.textContent = "Dinliyorum; cumle bitince otomatik duracagim.";
    },
    onError: (error) => {
      if (error.message === "no-speech" && state.recording && !state.browserStopRequested) {
        els.feedbackText.textContent = "Dinlemeye devam ediyorum; biraz daha net okuyun.";
        return;
      }
      els.feedbackText.textContent = describeSpeechError(error);
    },
    onEnd: () => {
      state.recognition = null;
      if (state.recording && !state.browserStopRequested) {
        try {
          state.browserTranscriptBase = state.browserTranscript;
          startBrowserRecognitionCycle();
          return;
        } catch {
          els.feedbackText.textContent = "Tarayici dinlemeyi erken kesti; tekrar Kaydet'e basin.";
        }
      }
      finishBrowserListening();
    },
  });
  state.recognition.start();
}

async function startBrowserListening() {
  const stream = await openMicStream();
  startLevelMeter(stream);
  state.browserTranscript = "";
  state.browserTranscriptBase = "";
  state.browserStopRequested = false;
  state.recording = true;
  state.discardRecordingResult = false;
  beginAutoStopState();
  startBrowserRecognitionCycle();
  els.recordButton.textContent = "Durdur";
  els.recordButton.classList.add("recording");
  els.feedbackText.textContent = state.activeSource === "image"
    ? "Resim anlatimini dinliyorum; tamamlayinca Durdur dugmesine bas."
    : "Dinliyorum; cumle bitince otomatik duracagim.";
}

function stopBrowserListening() {
  state.browserStopRequested = true;
  state.recognition?.stop();
}

async function startRecording() {
  if (!els.asrEndpoint.value.trim() && els.browserFallback.checked) {
    await startBrowserListening();
    return;
  }

  if (!els.asrEndpoint.value.trim()) {
    els.feedbackText.textContent = "ASR endpoint girin veya tarayici yedegini acin.";
    return;
  }

  const stream = await openMicStream();
  startLevelMeter(stream);
  state.audioChunks = [];
  state.mediaRecorder = new MediaRecorder(stream);
  state.mediaRecorder.addEventListener("dataavailable", (event) => {
    if (event.data.size > 0) state.audioChunks.push(event.data);
  });
  state.mediaRecorder.addEventListener("stop", async () => {
    if (!state.micTesting) stopLevelMeter();
    if (state.discardRecordingResult) {
      state.discardRecordingResult = false;
      state.audioChunks = [];
      return;
    }
    const audioBlob = new Blob(state.audioChunks, { type: "audio/webm" });
    await evaluateRecording(audioBlob);
  });
  state.mediaRecorder.start();
  state.recording = true;
  state.discardRecordingResult = false;
  beginAutoStopState();
  els.recordButton.textContent = "Durdur";
  els.recordButton.classList.add("recording");
  els.feedbackText.textContent = state.activeSource === "image"
    ? "Resim anlatimini kaydediyorum; tamamlayinca Durdur dugmesine bas."
    : "Dinliyorum; cumle bitince otomatik duracagim.";
}

function stopRecording() {
  if (state.recognition) {
    stopBrowserListening();
    return;
  }

  if (state.mediaRecorder?.state === "recording") state.mediaRecorder.stop();
  state.recording = false;
  els.recordButton.textContent = "Kaydet";
  els.recordButton.classList.remove("recording");
  resetAutoStopState();
}

async function evaluateRecording(audioBlob) {
  let heard = "";

  try {
    heard = await transcribeWithLocalModel(audioBlob);
  } catch (error) {
    els.feedbackText.textContent = els.browserFallback.checked
      ? `${error.message} Tarayici yedegi icin tekrar Kaydet'e basin.`
      : error.message;
    return;
  }

  if (state.activeSource === "image") applyImageTranscript(heard);
  else evaluateTranscript(heard);
}

function evaluateTranscript(heard, { threshold = Number(els.threshold.value), forceAdvance = false } = {}) {
  const expected = state.segments[state.current];
  const score = similarity(expected, heard);
  const ok = score >= threshold;
  state.results[state.current] = { heard, score, ok };
  updateActiveResult();

  if (ok && (forceAdvance || els.autoAdvance.checked)) {
    if (state.current < state.segments.length - 1) {
      state.current += 1;
      updateActiveResult();
    } else if (canAdvanceDocumentPart()) {
      advanceToNextDocumentPart();
      return;
    } else if (state.activeSource === "image") {
      els.feedbackText.textContent = "Resim anlatma calismasini tamamladin.";
    } else if (state.documentTitle && !state.documentParts.length) {
      els.feedbackText.textContent = "Dosya bolumleri bellekten silinmis. Devam etmek icin dosyayi tekrar sec.";
    } else {
      els.feedbackText.textContent = "Bu dosyadaki son metni de tamamladin.";
    }
  }
  render();
  persistSession();
}

function advancePastCurrentSegment() {
  if (state.current >= state.segments.length - 1 && canAdvanceDocumentPart()) {
    advanceToNextDocumentPart();
    return;
  }

  state.current = Math.min(state.segments.length - 1, state.current + 1);
  updateActiveResult();
  render();
  persistSession();
}

function skipCurrentSegment() {
  if (!state.segments.length) return;

  state.results[state.current] = {
    heard: "",
    score: 0,
    ok: false,
    skipped: true,
  };
  advancePastCurrentSegment();
  els.feedbackText.textContent = "Onceki parca atlandi. Buradan devam edin.";

  if (state.recording) {
    state.discardRecordingResult = true;
    stopRecording();
  }
}

async function speakCurrent() {
  const text = state.segments[state.current];
  if (!text) return;

  const endpoint = els.ttsEndpoint.value.trim();
  if (endpoint) {
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, language: els.language.value, rate: state.speechRate }),
      });

      if (!response.ok) throw new Error(`TTS endpoint ${response.status} dondu.`);
      const audioBlob = await response.blob();
      const audio = new Audio(URL.createObjectURL(audioBlob));
      await audio.play();
      return;
    } catch (error) {
      els.feedbackText.textContent = `${error.message} Tarayici seslendirmesi deneniyor.`;
    }
  }

  if ("speechSynthesis" in window) {
    speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = els.language.value;
    utterance.rate = state.speechRate;
    speechSynthesis.speak(utterance);
  } else {
    els.feedbackText.textContent = "Seslendirme bu tarayicida desteklenmiyor.";
  }
}

els.textTab.addEventListener("click", () => setSourceTab("text"));
els.imageTab.addEventListener("click", () => setSourceTab("image"));
els.splitWords.addEventListener("click", () => setMode("word"));
els.splitSentences.addEventListener("click", () => setMode("sentence"));
els.buildPractice.addEventListener("click", buildPractice);
els.loadSample.addEventListener("click", loadSampleText);
els.saveText.addEventListener("click", saveCurrentText);
els.deleteText.addEventListener("click", deleteSelectedText);
els.savedTexts.addEventListener("change", selectSavedText);
els.sourceFile.addEventListener("change", () => {
  importSourceFile();
});
els.imageFile.addEventListener("change", () => {
  selectPracticeImage();
});
els.clearImage.addEventListener("click", clearPracticeImage);
els.generateImagePractice.addEventListener("click", () => {
  generateImagePractice();
});
els.imageUserText.addEventListener("input", () => {
  state.imageUserText = els.imageUserText.value;
  els.evaluateImageDescription.disabled = !state.imageDataUrl || !cleanImportedText(state.imageUserText);
});
els.evaluateImageDescription.addEventListener("click", () => {
  evaluateImageUserDescription();
});
els.readingText.addEventListener("input", () => {
  persistSession();
});
els.prevDocumentPart.addEventListener("click", () => {
  showDocumentPart(state.documentPartIndex - 1);
});
els.nextDocumentPart.addEventListener("click", () => {
  showDocumentPart(state.documentPartIndex + 1);
});
els.prevSegment.addEventListener("click", () => {
  state.current = Math.max(0, state.current - 1);
  updateActiveResult();
  render();
  persistSession();
});
els.nextSegment.addEventListener("click", () => {
  advancePastCurrentSegment();
});
els.skipSegment.addEventListener("click", skipCurrentSegment);
els.recordButton.addEventListener("click", () => {
  if (state.recording) stopRecording();
  else startRecording().catch((error) => {
    els.feedbackText.textContent = `Mikrofon baslatilamadi: ${error.message}`;
  });
});
els.speakButton.addEventListener("click", speakCurrent);
els.micTestButton.addEventListener("click", toggleMicTest);
els.decreaseSpeechRate.addEventListener("click", () => changeSpeechRate(-0.05));
els.increaseSpeechRate.addEventListener("click", () => changeSpeechRate(0.05));
els.threshold.addEventListener("input", () => {
  renderThreshold();
  persistSession();
});
els.clearSession.addEventListener("click", clearSession);
[
  els.textTitle,
  els.asrEndpoint,
  els.ttsEndpoint,
  els.imageOllamaEndpoint,
  els.visionModel,
  els.language,
  els.autoAdvance,
  els.browserFallback,
].forEach((control) => {
  control.addEventListener("change", persistSession);
});

loadSavedTexts();
renderSavedTexts();
if (!restoreSession()) {
  updateDocumentNav();
  renderSpeechRate();
  renderThreshold();
  setMode("sentence");
}
