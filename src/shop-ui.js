import { fusionOptions, skillDefinition, skillEffectText } from "./skill-cards.js";
import { heroRarityClass, heroGradeLabel } from "./hero-grades.js";
import { iconURL } from "./config/icons.js";
import { escapeHTML as esc } from "./config/schema.js";
import { cardTypes } from "./cards.js";
import { categoryCards, packNames, shopPrices } from "./shop.js";
import "./shop.css";

const packIcons = { hero: "blue", resource: "coin_purse", equipment: "guard" };
export class ShopUI {
  constructor(game, onChange) {
    Object.assign(this, { game, onChange, dialog: document.getElementById("shop-dialog"), busy: false, token: 0, signature: "", selected: -1 });
    this.dialog.addEventListener("cancel", e => e.preventDefault());
    this.dialog.addEventListener("click", e => {
      const button = e.target.closest("button");
      if (!button || button.disabled || this.busy) return;
      if (button.dataset.shopHero !== undefined) this.buyHero(Number(button.dataset.shopHero));
      else if (button.dataset.shopPack !== undefined) this.openPack(Number(button.dataset.shopPack));
      else if (button.dataset.skillFuse) {
        if (game.fuseSkillCards(button.dataset.skillFuse, Number(button.dataset.tier))) { this.signature = ""; this.update(); onChange(); }
      }
      else if (button.hasAttribute("data-shop-refresh")) this.refresh();
      else if (button.hasAttribute("data-shop-leave")) { if (game.leaveShop()) { this.reset(); onChange(); } }
      else if (button.dataset.packChoice !== undefined) {
        this.selected = Number(button.dataset.packChoice);
        for (const b of this.dialog.querySelectorAll("[data-pack-choice]")) {
          const picked = Number(b.dataset.packChoice) === this.selected;
          b.classList.toggle("picked", picked); b.setAttribute("aria-pressed", String(picked));
        }
        this.dialog.querySelector("[data-pack-claim]").disabled = false;
      } else if (button.hasAttribute("data-pack-claim")) this.claim();
    });
  }
  card(key, attributes, extra = "") {
    const card = this.game.config.cards[key];
    return `<button class="hand-card reward-card ${card.category} ${heroRarityClass(card)} ${extra}" ${attributes} aria-label="${esc(card.name)}：${esc(card.text)}"><strong class="card-title">${esc(card.name)}</strong><div class="card-picture"><img src="${iconURL(card.icon, true)}" alt="" draggable="false"></div><span class="card-kind">${heroGradeLabel(card) || cardTypes[card.category] + "牌"}</span><small class="card-description">${esc(card.text)}</small><span class="reward-tick">✓</span><span class="card-flourish">◆</span></button>`;
  }
  update() {
    if (this.game.phase !== "shop") { if (this.dialog.open) this.reset(); return; }
    if (this.busy) return;
    const { shop, gold, config, day } = this.game, prices = shopPrices(this.game);
    const keys = [...shop.heroes, ...(shop.opening?.options || [])].filter(Boolean);
    const fusions = fusionOptions(this.game);
    const signature = JSON.stringify([fusions, fusions.map(g => config.cards[g.cardId]), shop, gold, prices, config.days[day].name, keys.map(k => config.cards[k])]);
    if (signature === this.signature && this.dialog.open) return;
    this.signature = signature; this.selected = -1;
    const header = `<header class="shop-heading"><div class="shop-sign"><span>${esc(config.days[day].name)}</span><h2>商店</h2></div><b class="shop-purse" aria-label="持有金币">◉ ${gold}</b></header>`;
    if (shop.opening) {
      this.dialog.innerHTML = header + `<div class="pack-reveal"><h3>${packNames[shop.opening.category]}</h3><p>三选一</p><div class="reward-draft pack-choices">${shop.opening.options.map((key,i) => `<div class="reward-deal" style="--deal:${i}">${this.card(key, `data-pack-choice="${i}" aria-pressed="false"`)}</div>`).join("")}</div><button class="shop-action" data-pack-claim disabled>收下这张</button></div>`;
    } else {
      this.dialog.innerHTML = header + `<div class="shop-stock"><section class="shop-heroes"><div class="shop-section-heading"><h3>旅途伙伴</h3><button class="shop-action refresh-stock" data-shop-refresh ${gold < prices.refreshCost || !categoryCards(this.game,"hero").length ? "disabled" : ""}>↻ <span>◉ ${prices.refreshCost}</span></button></div><div class="shop-shelf">${shop.heroes.map((key,i) => `<article class="shop-item">${key && config.cards[key] ? this.card(key, `data-shop-hero="${i}" ${gold < prices.heroPrice ? "disabled" : ""}`, "shop-hero") + `<span class="shop-price">◉ ${prices.heroPrice}</span>` : '<div class="sold-slot"><span>✓</span>已招募</div>'}</article>`).join("")}</div></section><section class="shop-packs"><div class="shop-section-heading"><h3>封存卡包</h3><small>限购 · 三选一</small></div><div class="shop-shelf">${shop.packs.map((pack,i) => `<article class="shop-item">${pack.sold ? '<div class="sold-slot"><span>✧</span>已售罄</div>' : `<button class="booster ${pack.category}" data-shop-pack="${i}" aria-label="购买${packNames[pack.category]}，${prices[pack.category+"PackPrice"]}金币" ${gold < prices[pack.category+"PackPrice"] || !categoryCards(this.game,pack.category).length ? "disabled" : ""}><span class="booster-rays"></span><span class="booster-lid"></span><span class="booster-seal"><img src="${iconURL(packIcons[pack.category],true)}" alt=""></span><strong>${packNames[pack.category]}</strong><small>◆ Ⅲ ◆</small></button><span class="shop-price">◉ ${prices[pack.category+"PackPrice"]}</span>`}</article>`).join("")}</div></section></div>${this.fusionShelf(fusions)}<footer class="shop-footer"><button class="shop-action" data-shop-leave>继续旅程 →</button></footer>`;
    }
    if (!this.dialog.open) this.dialog.showModal();
  }
  fusionShelf(groups) {
    return '<section class="skill-forge"><div class="shop-section-heading"><h3>技能合成</h3><small>同名同阶 · 三合一 · 免费</small></div>' +
      (groups.length ? '<div class="fusion-list">' + groups.map(group => {
        const card = this.game.config.cards[group.cardId];
        const next = !group.maxed && skillDefinition(card, group.tier + 1);
        return '<article class="fusion-recipe"><img src="' + iconURL(card.icon, true) + '" alt=""><div><strong>' + esc(card.name) + ' · ' + group.tier + ' 阶</strong><small>持有 ' + group.copies.length + ' 张' + (group.maxed ? ' · 已达最高阶' : ' → ' + (group.tier + 1) + ' 阶 ×1') + '</small>' + (next ? '<p>' + esc(skillEffectText(next)) + ' · CD ' + next.cooldown + ' 秒</p>' : '') + '</div><button class="shop-action" data-skill-fuse="' + group.cardId + '" data-tier="' + group.tier + '" ' + (group.maxed || group.copies.length < 3 ? 'disabled' : '') + '>' + (group.maxed ? '最高阶' : group.copies.length < 3 ? '还差 ' + (3 - group.copies.length) + ' 张' : '合成 ' + (group.tier + 1) + ' 阶') + '</button></article>';
      }).join('') + '</div>' : '<p class="fusion-empty">获得战斗牌后，可在这里将三张相同的技能牌合成升阶。</p>') + '</section>';
  }
  async animate(element, frames, duration = 350) {
    if (!element) return;
    const animation = element.animate(frames, { duration: matchMedia("(prefers-reduced-motion: reduce)").matches ? 40 : duration, easing: "cubic-bezier(.2,.7,.3,1)", fill: "forwards" });
    await animation.finished.catch(() => {});
  }
  lock() { this.busy = true; this.dialog.setAttribute("aria-busy", "true"); return ++this.token; }
  finish(token) {
    if (token !== this.token) return;
    this.busy = false; this.signature = ""; this.dialog.removeAttribute("aria-busy");
    this.update(); this.onChange();
  }
  async buyHero(index) {
    const token = this.lock(), element = this.dialog.querySelector(`[data-shop-hero="${index}"]`);
    if (this.game.buyShopHero(index)) await this.collect(element);
    this.finish(token);
  }
  async refresh() {
    const token = this.lock();
    if (this.game.refreshShop()) await Promise.all([...this.dialog.querySelectorAll(".shop-heroes .shop-item")].map((element,i) => this.animate(element,[{transform:"none",opacity:1},{transform:`translateY(40px) rotate(${i ? 15 : -15}deg) scale(.7)`,opacity:0}],250)));
    this.finish(token);
  }
  async openPack(index) {
    const token = this.lock(), element = this.dialog.querySelector(`[data-shop-pack="${index}"]`);
    if (!this.game.buyShopPack(index)) { this.finish(token); return; }
    const rect = element.getBoundingClientRect(), bounds = this.dialog.getBoundingClientRect();
    const x = bounds.x + bounds.width / 2 - rect.x - rect.width / 2, y = bounds.y + bounds.height / 2 - rect.y - rect.height / 2;
    element.style.zIndex = "20";
    for (const item of this.dialog.querySelectorAll(".shop-item")) if (!item.contains(element)) this.animate(item,[{opacity:1},{opacity:.12}],250);
    await this.animate(element,[{transform:"none"},{transform:`translate(${x}px, ${y}px) rotate(-7deg) scale(1.2)`,offset:.65},{transform:`translate(${x}px, ${y}px) rotate(6deg) scale(1.25)`,offset:.82},{transform:`translate(${x}px, ${y}px) rotate(0deg) scale(1.2)`}],620);
    if (token !== this.token) return;
    element.classList.add("ripping");
    await this.animate(element,[{transform:`translate(${x}px, ${y}px) scale(1.2)`,opacity:1,filter:"brightness(1)"},{transform:`translate(${x}px, ${y}px) scale(1.35)`,opacity:1,filter:"brightness(1.5)",offset:.5},{transform:`translate(${x}px, ${y+30}px) scale(1.1)`,opacity:0,filter:"brightness(1.1)"}],520);
    this.finish(token);
  }
  async collect(element) {
    const rect = element.getBoundingClientRect();
    await this.animate(element,[{transform:"translateY(-15px) scale(1.04)",opacity:1},{transform:"translateY(-35px) scale(1.12)",opacity:1,offset:.25},{transform:`translate(${innerWidth/2-rect.x-rect.width/2}px,${innerHeight-rect.y}px) rotate(10deg) scale(.2)`,opacity:0}],650);
  }
  async claim() {
    if (this.selected < 0 || !this.game.shop.opening?.options[this.selected]) return;
    const token = this.lock(), index = this.selected;
    const opening = this.game.shop.opening, key = opening.options[index];
    for (const card of this.dialog.querySelectorAll("[data-pack-choice]")) if (Number(card.dataset.packChoice) !== index) this.animate(card,[{opacity:1},{opacity:0,transform:"translateY(25px) scale(.8)"}],300);
    await this.collect(this.dialog.querySelector(`[data-pack-choice="${index}"]`));
    if (token !== this.token) return;
    if (this.game.shop?.opening === opening) this.game.choosePackCard(opening.options.indexOf(key));
    this.finish(token);
  }
  reset() {
    this.token++; this.busy = false; this.signature = ""; this.selected = -1;
    for (const a of this.dialog.getAnimations({subtree:true})) a.cancel();
    this.dialog.removeAttribute("aria-busy"); this.dialog.close();
  }
}
