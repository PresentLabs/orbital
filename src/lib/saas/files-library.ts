import {
  workspaceFileCategory,
  workspaceFileTypes,
} from "../../../services/payload/src/workspace-file-policy.ts";
export type LibraryFile = {
  id: string;
  title: string;
  filename: string;
  mime: string;
  createdAt: string;
  folderId?: string;
  deletedAt?: string;
};
export function libraryFiles<T extends LibraryFile>(
  files: T[],
  options: {
    trash: boolean;
    folderId: string;
    recent: boolean;
    query: string;
    type: string;
  },
) {
  const query = options.query.trim().toLocaleLowerCase("es");
  return files
    .filter(
      (f) =>
        !!f.deletedAt === options.trash &&
        (options.trash ||
          options.recent ||
          (f.folderId || "") === options.folderId) &&
        (f.title + " " + f.filename).toLocaleLowerCase("es").includes(query) &&
        (options.type === "all" ||
          workspaceFileCategory(f.mime) === options.type),
    )
    .sort(
      (a, b) =>
        b.createdAt.localeCompare(a.createdAt) ||
        a.title.localeCompare(b.title, "es"),
    );
}
const extensions = [
  "pdf",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "gif",
  "txt",
  "md",
  "csv",
  "zip",
  "docx",
  "xlsx",
  "pptx",
  "mp3",
  "wav",
  "ogg",
  "mp4",
  "webm",
];
const mimes = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/zip",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "video/mp4",
  "video/webm",
];
const hues = [
  350, 210, 22, 35, 270, 320, 48, 175, 150, 60, 225, 130, 12, 285, 245, 165,
  300, 195,
];
export function fileFormat(filename: string, mime: string) {
  const ext = (
      filename.includes(".") ? filename.split(".").pop()! : ""
    ).toLowerCase(),
    i = extensions.indexOf(ext);
  return {
    extension: ext.slice(0, 8).toUpperCase() || "ARCHIVO",
    hue:
      i >= 0
        ? hues[i]
        : Array.from(ext || mime).reduce(
            (n, c) => (n * 31 + c.charCodeAt(0)) % 360,
            0,
          ),
  };
}
export function fileMime(filename: string, mime: string) {
  if (workspaceFileTypes.includes(mime as any)) return mime;
  const i = extensions.indexOf(filename.split(".").pop()?.toLowerCase() || "");
  return i >= 0 ? mimes[i] : mime;
}
