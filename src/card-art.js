// Small, outlined illustrations share the battlefield's muted palette.
const drawings = {
  parts: '<path fill="#b7ad83" d="m34 12 8 2 5-8 12 5-1 9 8 5 8-3 7 12-6 6 1 10 8 5-5 13-10-1-7 6 1 9-13 5-5-8-10-1-6 7-12-7 3-9-4-9-9-2 1-14 9-3 5-8z"/><circle cx="47" cy="39" r="14" fill="#6f8978"/><circle cx="47" cy="39" r="6" fill="#d8d5ad"/><path fill="#9fae9a" d="m51 81 14-27-2-13 11-9 2 13 8 3 9-9 1 13-12 8-15 28z"/><path stroke="#d9d5b2" d="m59 77 11-20"/>',
  coin_purse: '<path fill="#b18b59" d="m32 19 10 12-21 23c-14 30 5 34 27 34s42-5 28-33L55 31l9-13-18 4z"/><path stroke="#e4c784" stroke-width="6" d="M34 34h27"/><circle fill="#e4bd64" cx="48" cy="62" r="17"/><path stroke="#ffe3a0" stroke-width="5" d="M48 52v20m-6-17h10"/>',
  war_drum: '<path fill="#9b695b" d="M23 34v38c0 14 50 14 50 0V34"/><ellipse fill="#e4d3a2" cx="48" cy="33" rx="25" ry="11"/><path fill="none" stroke="#d0b987" d="m26 45 11 30 12-28 11 28 11-30"/><path stroke="#b29363" stroke-width="6" d="m19 13 23 16m38-16L55 29"/><circle fill="#dbc792" cx="43" cy="29" r="5"/><circle fill="#dbc792" cx="54" cy="29" r="5"/>',
  level_swap: '<path fill="#9bad8c" d="M13 34h51V22l22 20-22 18V48H13z"/><path fill="#c5ac80" d="M83 64H32V52L10 72l22 18V77h51z"/><path stroke="#e5e0b6" d="M21 40h32m22 31H43"/>',
  legacy: '<path fill="#738e72" d="M16 79h20V50H16zm45 0h21V38H61z"/><path fill="#c28c5f" d="M47 9c18 13 7 20 18 26 4 19-14 30-26 18-11-12 0-20 8-44Z"/><path fill="#efd291" d="M47 31c14 14 2 24-5 17-4-5 0-9 5-17Z"/><path fill="none" stroke="#d7c18c" stroke-width="6" d="m32 65 14 11 19-20"/><path fill="#dcc58c" d="m58 52 15-3-3 16z"/>',
  siphon: '<path fill="#9682a3" d="m48 22 17 24-17 28-17-28z"/><path fill="#ddd1a8" d="m48 34 8 12-8 14-8-14z"/><path fill="none" stroke="#91b69c" stroke-width="5" d="M11 20c1 20 5 27 17 27m57-27c-1 20-5 27-17 27M21 84c0-15 8-20 15-21m39 21c0-15-8-20-15-21"/><path fill="#b6cba0" d="m19 40 11 7-11 7m58-14-11 7 11 7M29 70l8-10 4 13m26-3-8-10-4 13"/>',
  training:
    '<path fill="#c7bc8a" d="M22 20h40l8 9v49H22z"/><path fill="#8b845b" d="M62 20v13h12"/><path fill="#b5d47e" d="m29 50 19-21 20 21H56v22H40V50z"/>',
  coffee:
    '<path fill="none" stroke="#d0b68a" stroke-width="9" d="M67 41h9c17 0 12 25-7 25"/><path fill="#d2bc91" d="M20 36h49v28c0 20-49 20-49 0z"/><ellipse fill="#715038" cx="44" cy="37" rx="24" ry="8"/><path fill="none" stroke="#cbddbc" d="m31 25-3-7 5-7m18 14-3-7 4-7"/><path stroke="#789564" d="M44 49v18m-9-9h18"/><path stroke="#d8c39b" d="M17 79h56"/>',
  fireball:
    '<path fill="#c97f4e" d="M52 8c30 16 10 33 23 41l8-18c15 27 2 54-29 57C22 92 9 70 19 49l9-20c12 9 15 17 11 28C62 43 65 28 52 8Z"/><path fill="#f1d89a" d="M48 48c14 12 2 18 13 20l9-7c1 17-13 24-24 18-14-8-7-19 2-31Z"/><path fill="none" stroke="#775c3b" stroke-width="2" d="m12 28-3-7m69-6 5 5M10 74l-5 4m74 8 6 2"/>',
  lightning:
    '<path fill="#e0c875" d="M48 11h26L58 39h21L33 87l8-35H21z"/><path fill="#f5e7aa" stroke="none" d="m53 17-19 30h18L43 65l26-21H48l16-27z"/>',
  frost:
    '<path fill="none" stroke="#a1cbd0" stroke-width="9" d="M48 13v70M18 30l60 36M18 66l60-36"/><path fill="none" stroke="#b9e4df" stroke-width="5" d="m36 19 12 12 12-12M36 77l12-12 12 12M17 45l16-6-2-16m34 50-2-16 16-6M17 51l16 6-2 16m34-50-2 16 16 6"/><path fill="#ddede0" d="m48 36 11 12-11 12-11-12z"/>',
  quiver:
    '<path fill="none" stroke="#d2bd85" stroke-width="6" d="m35 59 9-40m4 43 14-40m-3 44 19-38"/><path fill="#b9cead" d="m43 12-9 14 9 3 8-7zm20 3-11 12 9 4 9-5zm16 7-12 11 8 6 10-5z"/><path fill="#92724d" d="m25 44 38 13-10 28-31-11z"/><path fill="#ceb783" d="m24 41 43 13-4 10-43-13z"/><path fill="#526e43" d="m39 60 8 7-10 8-4-8z"/>',
  haste:
    '<path fill="#c7b87b" d="m49 14 31 18v34L49 84 19 65V32z"/><path fill="#829d91" d="m49 23 23 13v25L49 75 27 61V37z"/><path fill="none" stroke="#d5e0b3" stroke-width="6" d="M35 40h20c14 0 11-11 4-9M33 50h25M34 60h14c12 0 10 10 3 10"/>',
  vampire:
    '<path fill="none" stroke="#b6a37e" stroke-width="6" d="M26 15c-2 35 14 43 22 42 12 0 24-19 24-42"/><path fill="#b29d76" d="m48 43 20 19-20 26-20-26z"/><path fill="#a55d69" d="m48 51 12 13-12 16-12-16z"/><path stroke="#dba2a0" d="m47 59-4 6"/>',
  guard:
    '<path fill="#bfb184" d="M48 10c10 9 23 12 34 12l-4 34c-6 16-17 25-30 33-15-9-28-20-31-37l-3-29c14 0 24-6 34-13Z"/><path fill="#8eaa8e" d="M48 19c9 7 19 11 27 10l-4 26C66 68 59 75 48 81 35 74 27 63 25 50l-3-21c11-1 19-5 26-10Z"/><path fill="none" stroke="#587c67" stroke-width="4" d="M48 27v42M31 47h35"/><path fill="#edcf87" d="m48 32 11 18-11 17-11-17z"/><path fill="none" stroke="#4b604b" stroke-width="2" d="m28 36 5-2m-4 7 5-2m29 20-4 5m5 0-4 5"/>',
  arcane:
    '<path fill="none" stroke="#baa176" stroke-width="9" d="m26 82 36-56"/><path fill="#9680b5" d="m64 11 12 17-14 19-12-19z"/><path fill="#e0cef0" d="m64 18 5 10-7 10-5-10z"/><path fill="none" stroke="#ceb982" stroke-width="5" d="m47 26 2 19 18 8 15-13"/><path stroke="#e4d7a3" d="M27 21v12m-6-6h12M79 68v10m-5-5h10"/>',
};
export const cardArt = Object.fromEntries(
  Object.entries(drawings).map(([key, drawing]) => [
    key,
    "data:image/svg+xml," +
      encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 96 96"><g stroke="#414635" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`,
      ),
  ]),
);
