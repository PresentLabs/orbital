export const directoryKeys = ['spaces','tasks','notes','private-spaces','private-tasks','private-notes'] as const;
export type DirectoryKey = typeof directoryKeys[number];
export type DirectorySetting = {view:'grid'|'list';pageSize:number};
export type DirectorySettings = Partial<Record<DirectoryKey,DirectorySetting>>;
export function validDirectoryPreferences(favorites: unknown, settings: unknown) {
  if (favorites !== undefined && (!Array.isArray(favorites) || favorites.length > 1000 || new Set(favorites).size !== favorites.length || favorites.some(k=>typeof k !== 'string'||!/^(spaces|boards|pages):[a-zA-Z0-9 _-]{1,100}$/.test(k)))) return false;
  if (settings === undefined) return true;
  return !!settings && typeof settings === 'object' && !Array.isArray(settings) && Object.entries(settings).every(([key,value])=>directoryKeys.includes(key as DirectoryKey) && !!value && typeof value === 'object' && ['grid','list'].includes(value.view) && (key.startsWith('private-')?[3,6,9]:[6,9,18,36]).includes(value.pageSize));
}
