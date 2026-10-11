import { db, ref, set, get, serverTimestamp } from "./firebase.js";
import { generateCode, copyToClipboard, setStatus, renderQR } from "./utils.js";

const textInput = document.getElementById("textInput");
const createBtn = document.getElementById("createBtn");
const resultCard = document.getElementById("resultCard");
const roomCodeEl = document.getElementById("roomCode");
const roomLinkInput = document.getElementById("roomLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const openRoomBtn = document.getElementById("openRoomBtn");
const joinCodeInput = document.getElementById("joinCode");
const joinBtn = document.getElementById("joinBtn");
const statusEl = document.getElementById("status");

const ROOM_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

// Проверка занятости кода
async function pickFreeCode() {
  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const snap = await get(ref(db, `rooms/${code}`));
    if (!snap.exists()) return code;
  }
  throw new Error("Не удалось подобрать свободный код");
}

async function createRoom() {
  const text = textInput.value.trim();
  if (!text) {
    setStatus(statusEl, "Введи текст", "err");
    textInput.focus();
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

    const link = `${location.origin}${location.pathname.replace(/index\.html$/, "")}room.html?r=${code}`;

    roomCodeEl.textContent = code;
    roomLinkInput.value = link;
    renderQR("qrcode", link);

    resultCard.classList.remove("hidden");
    setStatus(statusEl, "Комната создана", "ok");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    setStatus(statusEl, "Ошибка: " + e.message, "err");
  } finally {
    createBtn.disabled = false;
  }
}

copyLinkBtn?.addEventListener("click", async () => {
  const ok = await copyToClipboard(roomLinkInput.value);
  setStatus(statusEl, ok ? "Ссылка скопирована" : "Не удалось скопировать", ok ? "ok" : "err");
});

openRoomBtn?.addEventListener("click", () => {
  const code = roomCodeEl.textContent.trim();
  if (code && code !== "----") location.href = `room.html?r=${code}`;
});

joinBtn?.addEventListener("click", () => {
  const code = joinCodeInput.value.trim();
  if (!/^\d{4}$/.test(code)) {
    setStatus(statusEl, "Код — 4 цифры", "err");
    return;
  }
  location.href = `room.html?r=${code}`;
});

joinCodeInput?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

createBtn?.addEventListener("click", createRoom);