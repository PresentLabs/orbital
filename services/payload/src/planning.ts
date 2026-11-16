export type VisionImage = {
  rotation?: number;
  watercolor?: boolean;
  id: string;
  image: string;
  alternate?: string;
  x: number;
  y: number;
  width: number;
};
export type VisionBoard = { images: VisionImage[] };
export type Sprint = {
  id: string;
  name: string;
  start: string;
  end: string;
  initial: number;
  initialScope: number;
  history: { date: string; remaining: number; scope: number }[];
};
const day = (v: unknown) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  Number.isFinite(Date.parse(v + "T12:00:00Z")) &&
  new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v;
export function validVisionBoard(v: any) {
  return (
    v === undefined ||
    (!!v &&
      typeof v === "object" &&
      Array.isArray(v.images) &&
      v.images.length <= 12 &&
      new Set(v.images.map((i: any) => i?.id)).size === v.images.length &&
      v.images.every(
        (i: any) =>
          i &&
          typeof i.id === "string" &&
          /^[\w -]{1,100}$/.test(i.id) &&
          typeof i.image === "string" &&
          i.image.length <= 160000 &&
          /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(i.image) &&
          (i.alternate === undefined || (typeof i.alternate === "string" &&
            i.alternate.length <= 160000 && /^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(i.alternate))) &&
          Number.isFinite(i.x) &&
          i.x >= 0 &&
          i.x <= 1000 &&
          Number.isFinite(i.y) &&
          i.y >= 0 &&
          i.y <= 650 &&
          Number.isFinite(i.width) &&
          i.width >= 100 &&
          i.width <= 600 &&
          (i.rotation === undefined ||
            (Number.isFinite(i.rotation) &&
              i.rotation >= -180 &&
              i.rotation <= 180)) &&
          (i.watercolor === undefined || typeof i.watercolor === "boolean"),
      ) &&
      v.images.reduce((n: number, i: any) => n + i.image.length, 0) <= 1600000)
  );
}
export function validSprints(v: any) {
  return (
    v === undefined ||
    (Array.isArray(v) &&
      v.length <= 24 &&
      v.every(
        (s: any) =>
          s &&
          typeof s.id === "string" &&
          /^[\w-]{1,100}$/.test(s.id) &&
          typeof s.name === "string" &&
          s.name.length <= 80 &&
          day(s.start) &&
          day(s.end) &&
          s.end > s.start &&
          (Date.parse(s.end) - Date.parse(s.start)) / 86400000 <= 31 &&
          Number.isInteger(s.initial) &&
          s.initial >= 0 &&
          s.initial <= 1000 &&
          Number.isInteger(s.initialScope) &&
          s.initialScope >= s.initial &&
          s.initialScope <= 1000 &&
          Array.isArray(s.history) &&
          s.history.length <= 32 &&
          new Set(s.history.map((p: any) => p.date)).size ===
            s.history.length &&
          s.history.every(
            (p: any) =>
              day(p.date) &&
              p.date >= s.start &&
              p.date <= s.end &&
              Number.isInteger(p.remaining) &&
              p.remaining >= 0 &&
              p.remaining <= 1000 &&
              Number.isInteger(p.scope) &&
              p.scope >= p.remaining &&
              p.scope <= 1000,
          ),
      ))
  );
}
export function validPlanningPreferences(v: any) {
  return (
    validVisionBoard(v?.visionBoard) &&
    validDaily(v?.daily) &&
    (v?.overviewMode === undefined ||
      ["goals", "vision"].includes(v.overviewMode)) &&
    (v?.taskDirectoryMode === undefined ||
      ["boards", "scrum"].includes(v.taskDirectoryMode))
  );
}

export type PersonalDaily = {
  date: string;
  done: string;
  plan: string;
  blockers: string;
};
export function validDaily(v: any) {
  return (
    v === undefined ||
    (!!v &&
      typeof v === "object" &&
      day(v.date) &&
      ["done", "plan", "blockers"].every(
        (key) => typeof v[key] === "string" && v[key].length <= 1000,
      ))
  );
}
