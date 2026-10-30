export const rand = (a, b) => a + Math.random() * (b - a);
export const randi = (a, b) => Math.floor(rand(a, b + 1));
export const pick = a => a[Math.floor(Math.random() * a.length)];
export const lerp = (a, b, t) => a + (b - a) * t;
export const $ = id => document.getElementById(id);

export const DOT = '"DotGothic16","Noto Sans TC",sans-serif';
export const PIX = '"Press Start 2P",monospace';

// the shop is narrower than the plan coordinates: the built set is squeezed left-right by this,
// and anything placed later in plan x (people, cups, cameras) multiplies x by it
export const K = 0.7;

// "{name}來啦" + { name: '阿凱' } -> "阿凱來啦"; unknown placeholders are left as they are
export const fill = (text, vars = {}) => text.replace(/\{(\w+)\}/g, (m, k) => (vars[k] ?? m));
