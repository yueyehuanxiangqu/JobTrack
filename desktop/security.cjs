const APP_ORIGIN = "http://127.0.0.1:3737";

function classifyUrl(value) {
  try {
    const url = new URL(value);
    if (url.username || url.password) return "blocked";
    if (url.origin === APP_ORIGIN) return "internal";
    if (["https:", "http:", "mailto:"].includes(url.protocol)) return "external";
  } catch { /* Invalid and privileged schemes are never opened. */ }
  return "blocked";
}

function permissionAllowed(permission, origin) {
  return permission === "clipboard-sanitized-write" && classifyUrl(origin) === "internal";
}

module.exports = { APP_ORIGIN, classifyUrl, permissionAllowed };
