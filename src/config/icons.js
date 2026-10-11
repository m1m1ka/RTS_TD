import { cardArt } from "../card-art.js";
import { unitArt } from "../art.js";
import { builtInIcons } from "./schema.js";
const cache = new Map();
export function iconURL(icon, portrait = false) {
  if (typeof icon === "string" && icon.startsWith("data:image/")) return icon;
  if (cardArt[icon]) return cardArt[icon];
  const key = icon + ":" + portrait;
  if (!cache.has(key))
    cache.set(
      key,
      unitArt(builtInIcons.includes(icon) ? icon : "blue", {
        portrait,
      }).toDataURL(),
    );
  return cache.get(key);
}
