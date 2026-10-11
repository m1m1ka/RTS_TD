// Screen-space aiming remains aligned with both mouse and touch pointers at any camera zoom.
export class CardAim {
  constructor() {
    const ns = "http://www.w3.org/2000/svg";
    this.svg = document.createElementNS(ns, "svg");
    this.svg.classList.add("card-aim");
    this.svg.setAttribute("aria-hidden", "true");
    this.svg.innerHTML = `<path class="aim-outline"/><path class="aim-line"/><circle class="aim-origin" r="5"/><circle class="aim-target" r="13"/><path class="aim-arrow" d="M 0 0 L -22 -10 L -17 0 L -22 10 Z"/>`;
    [this.outline, this.line, this.origin, this.target, this.arrow] =
      this.svg.children;
    document.body.append(this.svg);
    this.hide();
  }
  update(button, pointer, valid) {
    const rect = button.getBoundingClientRect();
    const x = rect.left + rect.width / 2,
      y = rect.top + 12;
    const endX = pointer.clientX,
      endY = pointer.clientY;
    const distance = Math.hypot(endX - x, endY - y);
    const lift = Math.min(230, Math.max(65, distance * 0.48));
    const bend = Math.min(100, Math.abs(endX - x) * 0.2) * Math.sign(endX - x);
    const c1 = { x: x + bend, y: y - lift };
    const c2 = { x: endX - bend, y: endY + lift * 0.38 };
    const path = `M ${x} ${y} C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${endX} ${endY}`;
    this.svg.setAttribute("viewBox", `0 0 ${innerWidth} ${innerHeight}`);
    this.svg.removeAttribute("hidden");
    this.svg.dataset.valid = String(valid);
    this.outline.setAttribute("d", path);
    this.line.setAttribute("d", path);
    this.origin.setAttribute("cx", x);
    this.origin.setAttribute("cy", y);
    this.target.setAttribute("cx", endX);
    this.target.setAttribute("cy", endY);
    // Align the arrowhead with the final tangent of the cubic Bézier.
    const angle = (Math.atan2(endY - c2.y, endX - c2.x) * 180) / Math.PI;
    this.arrow.setAttribute(
      "transform",
      `translate(${endX} ${endY}) rotate(${angle})`,
    );
  }
  hide() {
    this.svg.setAttribute("hidden", "");
  }
}
