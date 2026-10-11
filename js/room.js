import { db, ref, set, get, onValue, onDisconnect } from "./firebase.js";
import {
  copyToClipboard, setStatus, renderQR, icon, setIcon, toast,
  isCreator, markCreator, getSessionId, initTheme, toggleTheme,
} from "./utils.js";

initTheme();
document.getElementById("themeToggle").addEventListener("click", toggleTheme);

setIcon(document.getElementById("backIcon"), "arrowLeft");
setIcon(document.getElementById("copyIcon"), "copy");
setIcon(document.getElementById("shareIcon"), "share");
setIcon(document.getElementById("deleteIcon"), "x");
setIcon(document.getElementById("copyLinkIcon2"), "copy");
setIcon(document.getElementById("usersIcon"), "users");
setIcon(document.getElementById("usersCloseIcon"), "x");
document.getElementById("lockIcon").innerHTML = icon("lock");

const params = new URLSearchParams(location.search);
const code = (params.get("r") || "").trim();
const meParam = params.get("me") === "1";
const MAX_SIZE = 100000;
const sessionId = getSessionId();

if (meParam && /^\d{4}$/.test(code)) {
  markCreator(code);
  history.replaceState({}, "", `${location.pathname}?r=${code}`);
}

const roomNameLabel = document.getElementById("roomNameLabel");
const roomCodeLabel = document.getElementById("roomCodeLabel");
const roleBadge = document.getElementById("roleBadge");
const roomText = document.getElementById("roomText");
const charCount = document.getElementById("charCount");
const readonlyHint = document.getElementById("readonlyHint");
const liveHint = document.getElementById("liveHint");
const copyBtn = document.getElementById("copyBtn");
const shareBtn = document.getElementById("shareBtn");
const deleteBtn = document.getElementById("deleteBtn");
const savedHint = document.getElementById("savedHint");
const roomLinkInput = document.getElementById("roomLink");
const copyLinkBtn = document.getElementById("copyLinkBtn");
const statusEl = document.getElementById("status");

const usersToggle = document.getElementById("usersToggle");
const usersCount = document.getElementById("usersCount");
const usersPanel = document.getElementById("usersPanel");
const usersList = document.getElementById("usersList");
const usersClose = document.getElementById("usersClose");
const usersHint = document.getElementById("usersHint");

let saveTimer = null;
let isCreatorRole = false;
let isTyping = false;
let currentUsers = {};

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
    roleBadge.innerHTML = `<span class="btn-icon">${icon("crown")}</span> Создатель`;
    roleBadge.classList.remove("reader");
    liveHint.classList.remove("hidden");
    roomText.removeAttribute("readonly");
    deleteBtn.classList.remove("hidden");
    usersHint.textContent = "Нажми ❌ чтобы кикнуть гостя";
  } else {
    roleBadge.innerHTML = `<span class="btn-icon">${icon("eye")}</span> Только чтение`;
    roleBadge.classList.add("reader");
    roomText.setAttribute("readonly", "true");
    readonlyHint.classList.remove("hidden");
    usersHint.textContent = "Ты можешь просматривать участников";
  }

  const basePath = location.pathname.replace(/room\.html$/, "").replace(/\/$/, "");
  const link = `${location.origin}${basePath}/room.html?r=${code}`;
  roomLinkInput.value = link;
  renderQR("qrcode", link);

  const roomRef = ref(db, `rooms/${code}`);
  const nameRef = ref(db, `rooms/${code}/name`);
  const textRef = ref(db, `rooms/${code}/text`);
  const usersRef = ref(db, `rooms/${code}/users`);
  const kickedRef = ref(db, `rooms/${code}/kicked/${sessionId}`);

  // ---- Название комнаты ----
  onValue(nameRef, (snap) => {
    const name = snap.val();
    roomNameLabel.textContent = name || "Комната";
    document.title = `${name || "Комната"} — ClipSync`;
  });

  // ---- Текст ----
  onValue(
    textRef,
    (snap) => {
      const newText = snap.val() || "";
      if (!isTyping && roomText.value !== newText) {
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

  // ---- Присутствие (presence) ----
  const userRef = ref(db, `rooms/${code}/users/${sessionId}`);
  const connectedRef = ref(db, ".info/connected");

  onValue(connectedRef, (snap) => {
    if (snap.val() === true) {
      onDisconnect(userRef).remove().then(() => {
        set(userRef, {
          role: isCreatorRole ? "creator" : "reader",
          joinedAt: Date.now(),
        });
      });
    }
  });

  // ---- Проверка что нас не кикнули ----
  onValue(kickedRef, (snap) => {
    if (snap.val() === true) {
      toast("Вас исключили из комнаты", "error", 3000);
      roomText.disabled = true;
      setTimeout(() => {
        location.href = "index.html";
      }, 1500);
    }
  });

  // ---- Список участников ----
  onValue(usersRef, (snap) => {
    const users = snap.val() || {};
    // Убираем кикнутых из отображения
    currentUsers = users;
    const list = Object.entries(users);
    usersCount.textContent = list.length;
    renderUsers(list);
  });

  // ---- Кнопка toggle users ----
  usersToggle.addEventListener("click", () => {
    usersPanel.classList.toggle("hidden");
  });
  usersClose.addEventListener("click", () => {
    usersPanel.classList.add("hidden");
  });

  // ---- Автосохранение ----
  roomText.addEventListener("input", () => {
    updateCharCount();
    if (!isCreatorRole) return;

    if (roomText.value.length > MAX_SIZE) {
      toast("Превышен лимит 100 000 символов", "error");
      roomText.value = roomText.value.slice(0, MAX_SIZE);
      updateCharCount();
      return;
    }

    isTyping = true;
    savedHint.textContent = "Печатаю...";
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        await set(textRef, roomText.value);
        await set(ref(db, `rooms/${code}/updatedAt`), Date.now());
        savedHint.textContent = "Сохранено ✓";
        setTimeout(() => (savedHint.textContent = ""), 1500);
      } catch (e) {
        savedHint.textContent = "Ошибка сохранения";
        toast("Не удалось сохранить", "error");
      } finally {
        isTyping = false;
      }
    }, 500);
  });

  // ---- Копировать ----
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

  // ---- Поделиться ----
  shareBtn.addEventListener("click", async () => {
    const url = roomLinkInput.value;
    if (navigator.share) {
      try { await navigator.share({ title: "ClipSync", text: "Забери текст", url }); } catch {}
    } else {
      await copyToClipboard(url);
      toast("Ссылка скопирована", "success");
    }
  });

  // ---- Удалить комнату ----
  deleteBtn.addEventListener("click", async () => {
    if (!isCreatorRole) return;
    if (!confirm("Удалить комнату для всех?")) return;
    try {
      await set(roomRef, null);
      toast("Комната удалена", "success");
      setTimeout(() => location.href = "index.html", 800);
    } catch {
      toast("Не удалось удалить", "error");
    }
  });

  // ---- Копировать ссылку ----
  copyLinkBtn.addEventListener("click", async () => {
    const ok = await copyToClipboard(roomLinkInput.value);
    toast(ok ? "Ссылка скопирована" : "Не удалось", ok ? "success" : "error");
  });

  // ---- Авто-копирование для читателя ----
  if (!isCreatorRole) {
    setTimeout(async () => {
      const snap = await get(textRef);
      const t = snap.val();
      if (t) {
        const ok = await copyToClipboard(t);
        if (ok) toast("Текст автоматически скопирован", "success");
      }
    }, 900);
  }
}

function renderUsers(list) {
  usersList.innerHTML = "";

  if (list.length === 0) {
    usersList.innerHTML = `<p class="users-empty">Пока никого</p>`;
    return;
  }

  // Сортируем: создатель первый, потом по времени входа
  list.sort((a, b) => {
    const aC = a[1].role === "creator" ? 0 : 1;
    const bC = b[1].role === "creator" ? 0 : 1;
    if (aC !== bC) return aC - bC;
    return (a[1].joinedAt || 0) - (b[1].joinedAt || 0);
  });

  list.forEach(([id, data]) => {
    const isMe = id === sessionId;
    const isCreatorUser = data.role === "creator";

    const item = document.createElement("div");
    item.className = "user-item" + (isMe ? " user-item-me" : "");

    const label = isCreatorUser
      ? `Создатель${isMe ? " (ты)" : ""}`
      : `Гость${isMe ? " (ты)" : ""} #${id.slice(0, 4)}`;

    const avatarIcon = isCreatorUser ? "crown" : "users";

    item.innerHTML = `
      <div class="user-info">
        <span class="user-avatar ${isCreatorUser ? "creator" : ""}">
          <span class="btn-icon">${icon(avatarIcon)}</span>
        </span>
        <span class="user-name">${label}</span>
      </div>
    `;

    // Кнопка кика: только создатель, только для других
    if (isCreatorRole && !isMe && !isCreatorUser) {
      const kickBtn = document.createElement("button");
      kickBtn.className = "user-kick";
      kickBtn.title = "Кикнуть";
      kickBtn.innerHTML = `<span class="btn-icon">${icon("x")}</span>`;
      kickBtn.addEventListener("click", async () => {
        if (!confirm("Кикнуть этого гостя?")) return;
        try {
          await set(ref(db, `rooms/${code}/kicked/${id}`), true);
          toast("Гость исключён", "success");
        } catch {
          toast("Не удалось кикнуть", "error");
        }
      });
      item.appendChild(kickBtn);
    }

    usersList.appendChild(item);
  });
}

function updateCharCount() {
  const len = roomText.value.length;
  charCount.textContent = `${len.toLocaleString("ru")} / ${MAX_SIZE.toLocaleString("ru")}`;
  if (len > MAX_SIZE * 0.9) charCount.style.color = "var(--danger)";
  else charCount.style.color = "";
}
