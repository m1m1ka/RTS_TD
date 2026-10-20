import { campaignLayout, materializeRoutes } from "../campaign.js";

export class RouteGraphEditor {
  constructor(root, getConfig, changed, render, message) {
    Object.assign(this, { root, getConfig, changed, render, message });
    this.source = null; this.edge = null;
    root.addEventListener("click", event => {
      const edge = event.target.closest("[data-route-from]");
      if (edge) {
        event.preventDefault(); event.stopImmediatePropagation();
        this.source = null; this.edge = [edge.dataset.routeFrom, edge.dataset.routeTo];
        this.refresh(); return;
      }
      const node = event.target.closest("[data-route-node]");
      if (!node || !this.source) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const target = node.dataset.routeNode, config = getConfig();
      const positions = this.options().layoutOverride.nodes;
      const from = positions.find(n => n.day.id === this.source), to = positions.find(n => n.day.id === target);
      if (!from || !to || to.depth !== from.depth + 1) {
        message("只能连接到下一天的关卡；按 Esc 取消连线。", true); return;
      }
      materializeRoutes(config);
      const day = config.days.find(d => d.id === this.source);
      if (day.next.includes(target)) { message("这两个关卡已经连接。", true); return; }
      day.next.push(target);
      this.source = null; this.edge = null; changed(); this.refresh();
      message("已添加连线，请保存配置。");
    }, true);
    root.addEventListener("contextmenu", event => {
      if (!event.target.closest(".campaign-editor")) return;
      event.preventDefault();
      const node = event.target.closest("[data-route-node]"), edge = event.target.closest("[data-route-from]");
      if (node) {
        this.source = node.dataset.routeNode; this.edge = null; this.refresh();
        message("请选择下一天的目标关卡，按 Esc 取消连线。"); return;
      }
      if (edge) {
        const pair = [edge.dataset.routeFrom, edge.dataset.routeTo];
        if (!this.edge || this.edge.some((id,i) => id !== pair[i])) {
          this.source = null; this.edge = pair; this.refresh();
          message("已选中连线，再次右键该连线即可删除。"); return;
        }
        const config = getConfig(); materializeRoutes(config);
        const from = config.days.find(d => d.id === pair[0]);
        from.next = from.next.filter(id => id !== pair[1]);
        this.edge = null; changed(); this.refresh();
        message("已删除连线。若出现孤立关卡，请重新连接后保存。");
      }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && (this.source || this.edge)) {
        this.source = null; this.edge = null; this.refresh(); message("");
      }
    });
  }
  options() {
    const config = this.getConfig(), ids = config.days.map(d => d.id).join("|");
    // Keep day columns stable while an edge is removed and its destination is disconnected.
    if (config !== this.config || ids !== this.ids) {
      this.config = config; this.ids = ids; this.layout = campaignLayout(config);
      this.source = null; this.edge = null;
    }
    const layoutOverride = { ...this.layout, nodes: this.layout.nodes.map(n => ({ ...n, day: config.days.find(d => d.id === n.day.id) })) };
    return { layoutOverride, linkSource: this.source, selectedEdge: this.edge };
  }
  refresh() {
    const scroller = this.root.querySelector(".route-scroll");
    const left = scroller?.scrollLeft || 0, top = scroller?.scrollTop || 0;
    this.render();
    this.root.querySelector(".route-scroll")?.scrollTo(left, top);
  }
}
