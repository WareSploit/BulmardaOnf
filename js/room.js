import { db, ref, set, get, onValue } from "./firebase.js";
import {
  copyToClipboard, setStatus, renderQR, icon, setIcon, toast,
  isCreator, initTheme, toggleTheme,
} from "./utils.js";

initTheme();
document.getElementById("themeToggle").addEventListener("click", toggleTheme);

setIcon(document.getElementById("backIcon"), "arrowLeft");
setIcon(document.getElementById("copyIcon"), "copy");
setIcon(document.getElementById("shareIcon"), "share");
setIcon(document.getElementById("deleteIcon"), "x");
setIcon(document.getElementById("copyLinkIcon2"), "copy");
document.getElementById("lockIcon").innerHTML = icon("lock");

const params = new URLSearchParams(location.search);
const code = (params.get("r") || "").trim();
const MAX_SIZE = 100000;

const roomCodeLabel = document.getElementById("roomCodeLabel");
const roleBadge = document.getElementById("roleBadge");
const roomText = document.getElementById("roomText");
const charCount = document.getElementById("charCount");
const readonlyHint = document.getElementById("readonlyHint");
const copyBtn = document.getElementById("copyBtn");
const editBtn = document.getElementById("editBtn");
const editIcon = document.getElementById("editIcon");
const shareBtn = document.getElementById("shareBtn");
const deleteBtn = document.getElementById("deleteBtn");
const savedHint = document.getElementById("savedHint");
const roomLinkInput = document.getElementById("roomLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const statusEl = document.getElementById("status");

let saveTimer = null;
let isCreatorRole = false;
let isEditing = false;

if (!/^\d{4}$/.test(code)) {
  setStatus(statusEl, "Неверный код", "err");
  roomText.disabled = true;
  toast("Неверный код комнаты", "error");
} else {
  init();
}

function init() {
  roomCodeLabel.textContent = code;

  isCreatorRole = isCreator(code);

  if (isCreatorRole) {
    setIcon(editIcon, "edit");
    editBtn.classList.remove("hidden");
    deleteBtn.classList.remove("hidden");
    roleBadge.innerHTML = `<span class="btn-icon">${icon("edit")}</span> Создатель`;
    roleBadge.classList.remove("reader");
  } else {
    roleBadge.innerHTML = `<span class="btn-icon">${icon("eye")}</span> Только чтение`;
    roleBadge.classList.add("reader");
  }

  const basePath = location.pathname.replace(/room\.html$/, "").replace(/\/$/, "");
  const link = `${location.origin}${basePath}/room.html?r=${code}`;
  roomLinkInput.value = link;
  renderQR("qrcode", link);

  const roomRef = ref(db, `rooms/${code}`);

  // Realtime-подписка — текст всегда синхронизируется
  onValue(
    roomRef,
    (snap) => {
      const data = snap.val();
      if (!data) {
        if (!isCreatorRole) {
          setStatus(statusEl, "Комната не найдена", "err");
          toast("Комната не найдена или удалена", "error");
          roomText.value = "";
          roomText.disabled = true;
          return;
        }
        set(roomRef, { text: "", createdAt: Date.now(), updatedAt: Date.now() });
        setStatus(statusEl, "Комната создана", "ok");
        return;
      }

      const newText = data.text || "";
      if (roomText.value !== newText) {
        roomText.style.opacity = "0.5";
        roomText.value = newText;
        setTimeout(() => { roomText.style.opacity = "1"; }, 120);
      }
      updateCharCount();
      setStatus(statusEl, "Синхронизировано", "ok");
    },
    (err) => {
      console.error(err);
      setStatus(statusEl, "Ошибка соединения", "err");
    }
  );

  // Toggle редактирования (только для создателя)
  editBtn.addEventListener("click", () => {
    if (!isCreatorRole) return;
    isEditing = !isEditing;

    if (isEditing) {
      roomText.removeAttribute("readonly");
      roomText.focus();
      setIcon(editIcon, "check");
      editBtn.classList.remove("btn-secondary");
      editBtn.classList.add("btn-primary");
      editBtn.title = "Сохранить";
      readonlyHint.classList.add("hidden");
      roleBadge.innerHTML = `<span class="btn-icon">${icon("edit")}</span> Редактирование...`;
      toast("Редактирование включено", "info");
    } else {
      roomText.setAttribute("readonly", "true");
      setIcon(editIcon, "edit");
      editBtn.classList.remove("btn-primary");
      editBtn.classList.add("btn-secondary");
      editBtn.title = "Редактировать";
      readonlyHint.classList.remove("hidden");
      roleBadge.innerHTML = `<span class="btn-icon">${icon("edit")}</span> Создатель`;
      saveNow(roomRef);
    }
  });

  // Автосохранение — только при активном редактировании
  roomText.addEventListener("input", () => {
    updateCharCount();
    if (!isEditing) return;

    if (roomText.value.length > MAX_SIZE) {
      toast("Превышен лимит 100 000 символов", "error");
      roomText.value = roomText.value.slice(0, MAX_SIZE);
      updateCharCount();
      return;
    }

    savedHint.textContent = "Печатаю...";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveNow(roomRef, true), 600);
  });

  // Копировать
  copyBtn.addEventListener("click", async () => {
    if (!roomText.value) {
      toast("Нечего копировать", "error");
      return;
    }
    const ok = await copyToClipboard(roomText.value);
    if (ok) {
      copyBtn.classList.add("copied");
      const btnText = copyBtn.querySelector(".btn-text");
      const original = btnText.textContent;
      btnText.textContent = "Скопировано!";
      setTimeout(() => {
        copyBtn.classList.remove("copied");
        btnText.textContent = original;
      }, 1500);
      toast("Текст скопирован", "success");
    } else {
      toast("Не удалось скопировать", "error");
    }
  });

  // Поделиться
  shareBtn.addEventListener("click", async () => {
    const url = roomLinkInput.value;
    if (navigator.share) {
      try {
        await navigator.share({ title: "ClipSync", text: "Забери текст", url });
      } catch {}
    } else {
      await copyToClipboard(url);
      toast("Ссылка скопирована", "success");
    }
  });

  // Удалить
  deleteBtn.addEventListener("click", async () => {
    if (!isCreatorRole) return;
    if (!confirm("Удалить комнату для всех? Действие необратимо.")) return;
    try {
      await set(roomRef, null);
      toast("Комната удалена", "success");
      setTimeout(() => location.href = "index.html", 800);
    } catch {
      toast("Не удалось удалить", "error");
    }
  });

  // Копировать ссылку
  copyLinkBtn.addEventListener("click", async () => {
    const ok = await copyToClipboard(roomLinkInput.value);
    if (ok) toast("Ссылка скопирована", "success");
    else toast("Не удалось", "error");
  });

  // Автокопирование для читателя при входе
  if (!isCreatorRole) {
    setTimeout(async () => {
      const snap = await get(roomRef);
      const t = snap.val()?.text;
      if (t) {
        const ok = await copyToClipboard(t);
        if (ok) toast("Текст автоматически скопирован", "success");
      }
    }, 900);
  }
}

async function saveNow(roomRef, silent = false) {
  try {
    await set(roomRef, {
      text: roomText.value,
      updatedAt: Date.now(),
    });
    savedHint.textContent = "Сохранено ✓";
    if (!silent) toast("Сохранено", "success");
    setTimeout(() => (savedHint.textContent = ""), 1500);
  } catch (e) {
    savedHint.textContent = "Ошибка сохранения";
    toast("Не удалось сохранить", "error");
  }
}

function updateCharCount() {
  const len = roomText.value.length;
  charCount.textContent = `${len.toLocaleString("ru")} / ${MAX_SIZE.toLocaleString("ru")}`;
  if (len > MAX_SIZE * 0.9) charCount.style.color = "var(--danger)";
  else charCount.style.color = "";
}
