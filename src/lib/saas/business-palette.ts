import {defaultPalette,completePalette,onColor,contrast,validBusinessPalette,type BusinessPalette} from '../../../services/payload/src/ui-settings';
export function applyBusinessPalette(value?:BusinessPalette) {
  const palette=completePalette(validBusinessPalette(value) && value?value:defaultPalette);
  const body=document.body;
  for(const mode of ['light','dark'] as const){
    for(const [key,color] of Object.entries(palette[mode]))body.style.setProperty(`--ui-${mode}-${key}`,color);
    let whiteBackground=palette[mode].accent;
    for(let step=0;contrast(whiteBackground,'#ffffff')<4.5 && step<30;step++)whiteBackground='#'+[1,3,5].map(i=>Math.floor(parseInt(whiteBackground.slice(i,i+2),16)*.9).toString(16).padStart(2,'0')).join('');
    body.style.setProperty(`--ui-${mode}-primary-white-background`,whiteBackground);
    body.style.setProperty(`--ui-${mode}-secondary-ink`,onColor(palette[mode].secondary!));
    body.style.setProperty(`--ui-${mode}-accent-ink`,onColor(palette[mode].accent));
    body.style.setProperty(`--ui-${mode}-sidebar-ink`,onColor(palette[mode].sidebar));
    body.style.setProperty(`--ui-${mode}-accent-text`,contrast(palette[mode].accent,palette[mode].surface)>=4.5?palette[mode].accent:palette[mode].text);
    body.style.setProperty(`--ui-${mode}-chart`,contrast(palette[mode].accent,palette[mode].surface)>=3?palette[mode].accent:palette[mode].text);
  }
}
