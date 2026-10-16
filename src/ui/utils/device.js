// Utility to detect if the current device is considered mobile.
// Uses both user‑agent sniffing and viewport width as a fallback.
// Exported constant can be imported throughout the UI code.
export const isMobile = /Android|iPhone|iPad|iPod|iPhone OS|Windows Phone/i.test(
  navigator.userAgent || ""
) || window.innerWidth < 768;
