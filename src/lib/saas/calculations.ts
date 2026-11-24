/** A bounded arithmetic parser: calculation text is never executed as JavaScript. */
export type CalculationLine = { expression: string; value?: number; unit?: string; error?: string };
type Value = { n: number; percent?: boolean };
const key = (name: string) => name.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const units: Record<string, [string, number]> = {
 mm:['length',.001],cm:['length',.01],m:['length',1],km:['length',1000],
 g:['mass',1],kg:['mass',1000],lb:['mass',453.59237],oz:['mass',28.349523125],
 ml:['volume',.001],l:['volume',1],s:['time',1],min:['time',60],h:['time',3600],dias:['time',86400],
};
function expression(source: string, variables: Map<string, Value>): Value {
 const tokens = source.match(/(?:\d+(?:[.,]\d+)?|[.,]\d+)(?:e[+-]?\d+)?|[\p{L}_][\p{L}\d_]*|[+\-*/^()%]/gu) || [];
 if (tokens.length > 240 || tokens.join('') !== source.replace(/\s/g,'')) throw Error('Revisa la expresión');
 let i=0, depth=0;
 const finite=(n:number):Value=>{if(!Number.isFinite(n))throw Error('Resultado fuera de rango');return {n};};
 const atom=():Value=>{
  if(++depth>32)throw Error('Demasiados paréntesis');
  const token=tokens[i++];let result:Value;
  if(token==='('){result=add();if(tokens[i++]!==')')throw Error('Falta cerrar paréntesis');}
  else if(token && /^(?:\d|[.,])/.test(token)) result=finite(Number(token.replace(',','.')));
  else if(token && variables.has(key(token)))result={...variables.get(key(token))!};
  else if(token==='pi')result={n:Math.PI};
  else throw Error(token ? `No definido: ${token}` : 'Completa la expresión');
  depth--;if(tokens[i]==='%'){i++;result={n:result.n/100,percent:true};}return result;
 };
 const power=():Value=>{const a=atom();return tokens[i]==='^'?(i++,finite(a.n**unary().n)):a;};
 const unary=():Value=>tokens[i]==='+'?(i++,unary()):tokens[i]==='-'?(i++,{...unaryNegative()}):power();
 const unaryNegative=():Value=>{const a=unary();return {...a,n:-a.n};};
 const multiply=():Value=>{let a=unary();while(tokens[i]==='*'||tokens[i]==='/'){const op=tokens[i++],b=unary();if(op==='/'&&b.n===0)throw Error('No se puede dividir por cero');a=finite(op==='*'?a.n*b.n:a.n/b.n);}return a;};
 const add=():Value=>{let a=multiply();while(tokens[i]==='+'||tokens[i]==='-'){const op=tokens[i++],b=multiply(),n=b.percent?a.n*b.n:b.n;a=finite(op==='+'?a.n+n:a.n-n);}return a;};
 const result=add();if(i!==tokens.length)throw Error('Revisa la expresión');return result;
}
export function calculateLines(source: string): CalculationLine[] {
 const variables=new Map<string,Value>(),values:number[]=[];
 return source.slice(0,30000).split('\n').slice(0,400).map(line=>{
  const row:CalculationLine={expression:line};let text=line.split(/#|\/\//)[0].trim();if(!text)return row;
  try {
   const assignment=text.match(/^([\p{L}_][\p{L}\d_]*)\s*=\s*(.+)$/u);
   if(assignment)text=assignment[2];
   const conversion=text.match(/^(.+?)\s+([\p{L}]+)\s+(?:en|a|in|to)\s+([\p{L}]+)$/u);
   let result:Value;
   if(conversion){const from=units[key(conversion[2])],to=units[key(conversion[3])];if(!from||!to||from[0]!==to[0])throw Error('Unidades incompatibles');result={n:expression(conversion[1],variables).n*from[1]/to[1]};row.unit=conversion[3];}
   else if(!variables.has(key(text))&&/^(sum|suma|total|avg|promedio|prev|anterior)$/i.test(key(text))){
    if(!values.length)throw Error('Añade un cálculo primero');
    result={n:/^(prev|anterior)$/.test(key(text))?values.at(-1)!:values.reduce((a,b)=>a+b,0)/(/^(avg|promedio)$/.test(key(text))?values.length:1)};
   }else result=expression(text,variables);
   if(!Number.isFinite(result.n))throw Error('Resultado fuera de rango');
   row.value=result.n;values.push(result.n);if(assignment)variables.set(key(assignment[1]),result);
  }catch(error){row.error=error instanceof Error?error.message:'Revisa la expresión';}
  return row;
 });
}
export function formatCalculation(row: CalculationLine) {
 return row.value===undefined ? row.error || '' : new Intl.NumberFormat('es-CL',{maximumFractionDigits:8}).format(row.value)+(row.unit?' '+row.unit:'');
}
