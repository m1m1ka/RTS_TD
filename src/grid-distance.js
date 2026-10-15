// Eight-direction grid distance: orthogonal and diagonal neighbors both cost one cell.
export const gridDistance = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y));
