// Shared canvas textures keep movement hints crisp without adding per-cell textures.
export function movementTileArt() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "rgba(255, 255, 255, 0.38)";
  ctx.fillRect(0, 0, 96, 96);
  return canvas;
}

export function heroArrowArt() {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 96;
  const ctx = canvas.getContext("2d");
  ctx.beginPath();
  ctx.moveTo(32,10); ctx.lineTo(64,10); ctx.lineTo(64,42);
  ctx.lineTo(83,42); ctx.lineTo(48,84); ctx.lineTo(13,42); ctx.lineTo(32,42); ctx.closePath();
  ctx.lineJoin = "round"; ctx.strokeStyle = "#28383a"; ctx.lineWidth = 10; ctx.stroke();
  ctx.fillStyle = "#ffcf55"; ctx.fill();
  ctx.strokeStyle = "#fff4ba"; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = "#fff3bd"; ctx.fillRect(39,17,7,28);
  return canvas;
}
