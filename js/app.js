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

const roomNameInput = document.getElementById("roomNameInput");
const nameCount = document.getElementById("nameCount");
const createBtn = document.getElementById("createBtn");
const resultCard = document.getElementById("resultCard");
const resultName = document.getElementById("resultName");
const roomCodeEl = document.getElementById("roomCode");
const roomLinkInput = document.getElementById("roomLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const shareLinkBtn = document.getElementById("shareLinkBtn");
const openRoomBtn = document.getElementById("openRoomBtn");
const joinCodeInput = document.getElementById("joinCode");
const joinBtn = document.getElementById("joinBtn");
const statusEl = document.getElementById("status");

const MAX_NAME = 60;

roomNameInput.addEventListener("input", () => {
  const len = roomNameInput.value.length;
  nameCount.textContent = `${len} / ${MAX_NAME}`;
  if (len > MAX_NAME * 0.9) nameCount.style.color = "var(--danger)";
  else nameCount.style.color = "";
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
  const name = roomNameInput.value.trim();
  if (!name) {
    toast("Введи название комнаты", "error");
    shake(roomNameInput.parentElement);
    roomNameInput.focus();
    return;
  }

  createBtn.disabled = true;
  setStatus(statusEl, "Создаю...");

  try {
    const code = await pickFreeCode();
    await set(ref(db, `rooms/${code}`), {
      name,
      text: "",
      updatedAt: Date.now(),
      createdAt: Date.now(),
    });

    markCreator(code);

    const basePath = location.pathname.replace(/index\.html$/, "").replace(/\/$/, "");
    const link = `${location.origin}${basePath}/room.html?r=${code}`;

    resultName.textContent = name;
    roomCodeEl.textContent = code;
    roomLinkInput.value = link;
    renderQR("qrcode", link);

    resultCard.classList.remove("hidden");
    setStatus(statusEl, "Комната создана", "ok");
    toast("Комната создана!", "success");
    resultCard.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    const msg = e.message?.includes("permission") ? "Нет доступа к базе" : e.message;
    setStatus(statusEl, "Ошибка", "err");
    toast("Ошибка: " + msg, "error", 4000);
  } finally {
    createBtn.disabled = false;
  }
}

copyLinkBtn.addEventListener("click", async () => {
  const ok = await copyToClipboard(roomLinkInput.value);
  toast(ok ? "Ссылка скопирована" : "Не удалось", ok ? "success" : "error");
});

shareLinkBtn.addEventListener("click", async () => {
  const url = roomLinkInput.value;
  if (navigator.share) {
    try { await navigator.share({ title: "ClipSync", text: "Забери текст", url }); } catch {}
  } else {
    await copyToClipboard(url);
    toast("Ссылка скопирована", "success");
  }
});

openRoomBtn.addEventListener("click", () => {
  const code = roomCodeEl.textContent.trim();
  if (code && code !== "----") {
    markCreator(code);
    location.href = `room.html?r=${code}&me=1`;
  }
});

joinBtn.addEventListener("click", () => {
  const code = joinCodeInput.value.trim();
  if (!/^\d{4}$/.test(code)) {
    toast("Код — 4 цифры", "error");
    shake(joinCodeInput);
    return;
  }
  const weOwnIt = (() => {
    try { return localStorage.getItem(`creator:${code}`) === "1"; } catch { return false; }
  })();
  location.href = weOwnIt ? `room.html?r=${code}&me=1` : `room.html?r=${code}`;
});

joinCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinBtn.click();
});

createBtn.addEventListener("click", createRoom);

roomNameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createRoom();
});
