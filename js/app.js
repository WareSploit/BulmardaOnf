import { db, ref, set, get } from "./firebase.js";
import {
  generateCode, copyToClipboard, setStatus, renderQR,
  icon, setIcon, toast, markCreator, shake,
  initTheme, toggleTheme,
} from "./utils.js";

initTheme();
document.getElementById("themeToggle").addEventListener("click", toggleTheme);

document.getElementById("logoIcon").innerHTML = icon("clipboard");
setIcon(document.getElementById("createIcon"), "plus");
document.getElementById("successIcon").innerHTML = icon("check");
setIcon(document.getElementById("copyLinkIcon"), "copy");
setIcon(document.getElementById("shareLinkIcon"), "share");
setIcon(document.getElementById("openRoomIcon"), "eye");
setIcon(document.getElementById("joinIcon"), "send");

const textInput = document.getElementById("textInput");
const charCount = document.getElementById("charCount");
const createBtn = document.getElementById("createBtn");
const resultCard = document.getElementById("resultCard");
const roomCodeEl = document.getElementById("roomCode");
const roomLinkInput = document.getElementById("roomLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const shareLinkBtn = document.getElementById("shareLinkBtn");
const openRoomBtn = document.getElementById("openRoomBtn");
const joinCodeInput = document.getElementById("joinCode");
const joinBtn = document.getElementById("joinBtn");
const statusEl = document.getElementById("status");

const MAX_SIZE = 100000;

textInput.addEventListener("input", () => {
  const len = textInput.value.length;
  charCount.textContent = `${len.toLocaleString("ru")} / ${MAX_SIZE.toLocaleString("ru")}`;
  if (len > MAX_SIZE * 0.9) charCount.style.color = "var(--danger)";
  else charCount.style.color = "";
});

joinCodeInput.addEventListener("input", () => {
  joinCodeInput.value = joinCodeInput.value.replace(/\D/g, "").slice(0, 4);
});

async function pickFreeCode() {
  for (let i = 0; i < 6; i++) {
    const code = generateCode();
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) return code;
  }
  throw new Error("Не удалось подобрать свободный код");
}

async function createRoom() {
  const text = textInput.value.trim();
  if (!text) {
    toast("Сначала введи текст", "error");
    shake(textInput.parentElement);
    textInput.focus();
    return;
  }
  if (text.length > MAX_SIZE) {
    toast("Текст слишком большой", "error");
    return;
  }

  createBtn.disabled = true;
  setStatus(statusEl, "Создаю...");

  try {
    const code = await pickFreeCode();
    await set(ref(db, `rooms/${code}`), {
      text,
      updatedAt: Date.now(),
      createdAt: Date.now(),
    });

    markCreator(code);

    const basePath = location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");
    const link = `${location.origin}${basePath}/room.html?r=${code}`;

    roomCodeEl.textContent = code;
    roomLinkInput.value = link;
    renderQR("qrcode", link);

    resultCard.classList.remove("hidden");
    setStatus(statusEl, "Комната создана", "ok");
    toast("Комната создана!", "success");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    const msg = e.message?.includes("permission") ? "Нет доступа к базе (проверь Rules)" : e.message;
    setStatus(statusEl, "Ошибка", "err");
    toast("Ошибка: " + msg, "error", 4000);
  } finally {
    createBtn.disabled = false;
  }
}

copyLinkBtn.addEventListener("click", async () => {
  const ok = await copyToClipboard(roomLinkInput.value);
  if (ok) toast("Ссылка скопирована", "success");
  else toast("Не удалось скопировать", "error");
});

shareLinkBtn.addEventListener("click", async () => {
  const url = roomLinkInput.value;
  if (navigator.share) {
    try {
      await navigator.share({ title: "ClipSync", text: "Забери текст по ссылке", url });
    } catch {}
  } else {
    await copyToClipboard(url);
    toast("Ссылка скопирована", "success");
  }
});

openRoomBtn.addEventListener("click", () => {
  const code = roomCodeEl.textContent.trim();
  if (code && code !== "----") location.href = `room.html?r=${code}`;
});

joinBtn.addEventListener("click", () => {
  const code = joinCodeInput.value.trim();
  if (!/^\d{4}$/.test(code)) {
    toast("Код — 4 цифры", "error");
    shake(joinCodeInput);
    return;
  }
  location.href = `room.html?r=${code}`;
});

joinCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

createBtn.addEventListener("click", createRoom);

textInput.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") createRoom();
});
