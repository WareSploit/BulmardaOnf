// Генерация 4-значного кода
export function generateCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Копирование в буфер обмена (с fallback для старых браузеров)
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {}
    document.body.removeChild(ta);
    return ok;
  }
}

// Показ статуса в футере
export function setStatus(el, text, type = "") {
  if (!el) return;
  el.textContent = text;
  el.className = "status " + type;
}

// Рисуем QR
export function renderQR(containerId, text) {
  const el = document.getElementById(containerId);
  if (!el || typeof QRCode === "undefined") return;
  el.innerHTML = "";
  new QRCode(el, {
    text,
    width: 160,
    height: 160,
    colorDark: "#000000",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.M,
  });
}