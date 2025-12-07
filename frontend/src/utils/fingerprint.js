// Anonymous fingerprint generation, SHA-256 hash storage, leak prevention
const PEPPER = "pepper_v1_change_before_production";

async function getCanvasFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    ctx.textBaseline = "top";
    ctx.font = "16px Arial";
    ctx.fillStyle = "#f60";
    ctx.fillText("campus_fingerprint", 2, 2);
    return canvas.toDataURL();
  } catch {
    return "";
  }
}

async function getWebGLFingerprint() {
  try {
    const canvas = document.createElement("canvas");
    const gl =
      canvas.getContext("webgl") ||
      canvas.getContext("experimental-webgl");
    if (!gl) return "";
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const vendor = gl.getParameter(dbg?.UNMASKED_VENDOR_WEBGL) || "";
    const renderer = gl.getParameter(dbg?.UNMASKED_RENDERER_WEBGL) || "";
    return `${vendor}|${renderer}`;
  } catch {
    return "";
  }
}

function getAudioFingerprint() {
  try {
    const ctx = new (window.OfflineAudioContext ||
      window.webkitOfflineAudioContext)(1, 5000, 44100);
    const oscillator = ctx.createOscillator();
    oscillator.type = "triangle";
    oscillator.frequency.value = 6000;
    const compressor = ctx.createDynamicsCompressor();
    oscillator.connect(compressor);
    compressor.connect(ctx.destination);
    oscillator.start(0);
    return ctx.startRendering().then((buffer) => {
      const data = buffer.getChannelData(0);
      let sum = 0;
      for (let i = 0; i < data.length; i += 100) sum += Math.abs(data[i]);
      return sum.toString();
    });
  } catch {
    return Promise.resolve("");
  }
}

function collectBase() {
  return [
    navigator.userAgent,
    navigator.platform,
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    navigator.language,
    navigator.languages?.join(",") || "",
    navigator.hardwareConcurrency || "",
    "touch:" + ("ontouchstart" in window),
    Intl.DateTimeFormat().resolvedOptions().timeZone,
  ].join("|");
}

async function hashData(message) {
  const msgWithPepper = message + PEPPER;
  const data = new TextEncoder().encode(msgWithPepper);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 🚀 Main function exposed
export async function getFingerprintHash() {
  try {
    const [canvas, webgl, audio] = await Promise.all([
      getCanvasFingerprint(),
      getWebGLFingerprint(),
      getAudioFingerprint(),
    ]);

    const combined = [collectBase(), canvas, webgl, audio].join("|");

    // Return deterministic 64‑char SHA-256 hex
    return await hashData(combined);
  } catch (err) {
    console.warn("Fingerprint generation failed:", err);
    // Fallback: anonymous random token
    return `fp_${Math.random().toString(36).slice(2, 14)}`;
  }
}
