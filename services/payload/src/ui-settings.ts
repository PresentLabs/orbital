export const paletteKeys = ['accent','background','surface','text','sidebar','secondary','outline'] as const;
export type PaletteColors = Record<'accent'|'background'|'surface'|'text'|'sidebar',string> & Partial<Record<'secondary'|'outline',string>>;
export type BusinessPalette = { light: PaletteColors; dark: PaletteColors };
export const defaultPalette: BusinessPalette = {
  light:{accent:'#6e00fe',background:'#f5f6f8',surface:'#ffffff',text:'#232630',sidebar:'#eef0f4',secondary:'#e5edf9',outline:'#56627a'},
  dark:{accent:'#b499ff',background:'#14161b',surface:'#20232b',text:'#edf0f6',sidebar:'#191c23',secondary:'#343d50',outline:'#bac4da'},
};
const hex=(v:unknown):v is string=>typeof v==='string' && /^#[0-9a-f]{6}$/i.test(v);
export function luminance(color:string) {
  const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
export function contrast(a:string,b:string) {const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
export const onColor=(color:string)=>contrast(color,'#ffffff')>=contrast(color,'#111111')?'#ffffff':'#111111';
export function validBusinessPalette(value:unknown):value is BusinessPalette {
  if(value===undefined)return true;
  if(!value || typeof value!=='object' || Array.isArray(value) || Object.keys(value).some(k=>!['light','dark'].includes(k)))return false;
  return ['light','dark'].every(mode=>{
    const p=(value as BusinessPalette)[mode as keyof BusinessPalette];
    return p && typeof p==='object' && !Array.isArray(p) && Object.keys(p).every(key=>paletteKeys.includes(key as any)) && ['accent','background','surface','text','sidebar'].every(key=>hex((p as any)[key])) && ['secondary','outline'].every(key=>(p as any)[key]===undefined||hex((p as any)[key])) && contrast(p.text,p.background)>=4.5 && contrast(p.text,p.surface)>=4.5;
  });
}
export function validColumnNames(value:unknown) {
  return value===undefined || (!!value && typeof value==='object' && !Array.isArray(value) && Object.entries(value).length<=3 && Object.entries(value).every(([key,name])=>['todo','doing','done'].includes(key) && typeof name==='string' && !!name.trim() && name.length<=60));
}

export function completePalette(palette?:BusinessPalette):BusinessPalette {return {light:{...defaultPalette.light,...palette?.light},dark:{...defaultPalette.dark,...palette?.dark}};}
