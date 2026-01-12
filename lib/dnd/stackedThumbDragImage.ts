export function setStackedThumbDragImage(args: {
  dataTransfer: DataTransfer;
  entryKeys: string[];
  getThumbSrc: (entryKey: string) => string | null;
}): void {
  const { dataTransfer, entryKeys, getThumbSrc } = args;

  const count = entryKeys.length;
  const ghost = document.createElement("div");
  ghost.style.width = "100px";
  ghost.style.height = "100px";
  ghost.style.position = "fixed";
  ghost.style.left = "-1000px";
  ghost.style.top = "-1000px";
  ghost.style.zIndex = "999999";
  ghost.style.pointerEvents = "none";
  ghost.style.borderRadius = "10px";
  ghost.style.boxSizing = "border-box";

  for (let i = Math.min(count, 10); i >= 1; i--) {
    const d = (12 / (count - 1)) * (i - 1);
    const o = 1 - 0.1 * (i - 1);

    const layer = document.createElement("div");
    layer.style.position = "absolute";
    layer.style.inset = "0";
    layer.style.transform = `translate(${d}px, ${d}px)`;
    layer.style.borderRadius = "10px";
    layer.style.background = "#fff";
    layer.style.border = "1px solid #ccc";
    layer.style.opacity = String(o);
    layer.style.overflow = "hidden";

    const entryKey = entryKeys[i - 1];
    const src = getThumbSrc(entryKey);
    if (src) {
      const thumb = document.createElement("img");
      thumb.src = src;
      thumb.alt = "";
      thumb.draggable = false;
      thumb.style.width = "100%";
      thumb.style.height = "100%";
      thumb.style.objectFit = "cover";
      thumb.style.display = "block";
      layer.appendChild(thumb);
    }

    ghost.appendChild(layer);
  }

  if (count >= 2) {
    const badge = document.createElement("div");
    badge.textContent = `${count}`;
    badge.style.position = "absolute";
    badge.style.right = "8px";
    badge.style.bottom = "8px";
    badge.style.padding = "4px 8px";
    badge.style.borderRadius = "999px";
    badge.style.background = "rgba(0,0,0,0.78)";
    badge.style.color = "#fff";
    badge.style.fontSize = "12px";
    badge.style.fontWeight = "700";
    badge.style.lineHeight = "1";
    ghost.appendChild(badge);
  }

  document.body.appendChild(ghost);

  try {
    dataTransfer.setDragImage(ghost, 4, 4);
  } catch {
    // ignore
  }

  const cleanup = () => {
    ghost.remove();
    window.removeEventListener("dragend", cleanup, true);
  };
  window.addEventListener("dragend", cleanup, true);
  window.setTimeout(cleanup, 0);
}
