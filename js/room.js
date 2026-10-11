import { db, ref, set, get, onValue } from "./firebase.js";
import { copyToClipboard, setStatus, renderQR } from "./utils.js";

const params = new URLSearchParams(location.search);
const code = (params.get("r") || "").trim();

const roomCodeLabel = document.getElementById("roomCodeLabel");
const roomText = document.getElementById("roomText");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");
const savedHint = document.getElementById("savedHint");
const roomLinkInput = document.getElementById("roomLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const statusEl = document.getElementById("status");

let saveTimer = null;
let suppressNext = false;

if (!/^\d{4}$/.test(code)) {
  setStatus(statusEl, "Неверный код комнаты", "err");
  roomText.disabled = true;
} else {
  init();
}

function init() {
  roomCodeLabel.textContent = code;
  const link = `${location.origin}${location.pathname}?r=${code}`;
  roomLinkInput.value = link;
  renderQR("qrcode", link);

  const roomRef = ref(db, `rooms/${code}`);

  // Realtime-подписка
  onValue(
    roomRef,
    (snap) => {
      const data = snap.val();
      if (!data) {
        // Комната ещё не создана — создадим пустую
        set(roomRef, { text: "", createdAt: Date.now(), updatedAt: Date.now() });
        setStatus(statusEl, "Комната создана", "ok");
        return;
      }
      if (suppressNext) {
        suppressNext = false;
        setStatus(statusEl, "Синхронизировано", "ok");
        return;
      }
      if (document.activeElement !== roomText) {
        roomText.value = data.text || "";
      } else {
        roomText.value = data.text || "";
      }
      setStatus(statusEl, "Синхронизировано", "ok");
    },
    (err) => {
      console.error(err);
      setStatus(statusEl, "Ошибка соединения", "err");
    }
  );

  // Автосейв с дебаунсом
  roomText.addEventListener("input", () => {
    savedHint.textContent = "Печатаю...";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await set(roomRef, {
          text: roomText.value,
          updatedAt: Date.now(),
        });
        savedHint.textContent = "Сохранено ✓";
        setTimeout(() => (savedHint.textContent = ""), 1500);
      } catch (e) {
        savedHint.textContent = "Ошибка сохранения";
      }
    }, 500);
  });

  copyBtn.addEventListener("click", async () => {
    const ok = await copyToClipboard(roomText.value);
    setStatus(statusEl, ok ? "Скопировано ✓" : "Не удалось", ok ? "ok" : "err");
  });

  clearBtn.addEventListener("click", async () => {
    if (!confirm("Очистить текст в комнате для всех?")) return;
    roomText.value = "";
    await set(roomRef, { text: "", updatedAt: Date.now() });
  });

  copyLinkBtn.addEventListener("click", async () => {
    const ok = await copyToClipboard(roomLinkInput.value);
    setStatus(statusEl, ok ? "Ссылка скопирована" : "Не удалось", ok ? "ok" : "err");
  });

  // Автокопирование при заходе (браузер может блокировать без клика)
  setTimeout(async () => {
    const snap = await get(roomRef);
    const t = snap.val()?.text;
    if (t) {
      const ok = await copyToClipboard(t);
      if (ok) setStatus(statusEl, "Текст автоматически скопирован ✓", "ok");
    }
  }, 800);
}