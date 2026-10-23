const fs=require('node:fs');const path=require('node:path');const {Readable}=require('node:stream');const tiny=require('tinyglobby');
function options(o={},patterns=[]){return {...o,absolute:o.absolute||[patterns].flat().some(p=>path.isAbsolute(p)),onlyFiles:o.onlyFiles!==false,onlyDirectories:o.onlyDirectories,expandDirectories:false};}
function entries(paths,o={}){if(!o.objectMode&&!o.stats)return paths;return paths.map(p=>{const full=path.resolve(o.cwd||process.cwd(),p);const stats=fs.statSync(full);return {name:path.basename(p),path:p,dirent:stats,...(o.stats?{stats}:{})};});}
async function glob(patterns,o={}){return entries(await tiny.glob(patterns,options(o,patterns)),o);}
glob.sync=(patterns,o={})=>entries(tiny.globSync(patterns,options(o,patterns)),o);
glob.stream=(patterns,o={})=>Readable.from((async function*(){yield* await glob(patterns,o)})());
glob.isDynamicPattern=tiny.isDynamicPattern;
function patternBase(pattern){
  let base=path.posix.dirname(pattern+'a');
  while(tiny.isDynamicPattern(base)||/(^|[^\\])(?:\\\\)*[({[]/.test(base))base=path.posix.dirname(base);
  return base.replace(/\\([!*?|[\](){}])/g,'$1');
}
glob.generateTasks=(patterns,o={})=>{
  const all=typeof patterns==='string'?[patterns]:patterns;
  if(!Array.isArray(all)||all.some(p=>typeof p!=='string'||!p.length))throw new TypeError('Glob patterns must be non-empty strings');
  const isNegative=p=>p.startsWith('!')&&!p.startsWith('!(');
  const positive=all.filter(p=>!isNegative(p));
  const negative=all.filter(isNegative).map(p=>p.slice(1)).concat(o.ignore||[]);
  const tasks=[];
  for(const dynamic of [false,true]){
    const selected=positive.filter(p=>tiny.isDynamicPattern(p,o)===dynamic);
    const outside=selected.filter(p=>p.startsWith('../'));
    const inside=selected.filter(p=>!p.startsWith('../'));
    for(const patterns of [outside,inside]){
      const groups=new Map();
      const root=patterns===inside&&patterns.some(p=>patternBase(p)==='.');
      for(const pattern of patterns){
        const base=root?'.':patternBase(pattern);
        if(!groups.has(base))groups.set(base,[]);
        groups.get(base).push(pattern);
      }
      for(const [base,positive] of groups)tasks.push({dynamic,positive,negative:[...negative],base,patterns:positive.concat(negative.map(p=>'!'+p))});
    }
  }
  return tasks;
};
glob.escapePath=tiny.escapePath;
glob.convertPathToPattern=p=>tiny.escapePath(p.replaceAll('\\','/'));
module.exports=glob;
