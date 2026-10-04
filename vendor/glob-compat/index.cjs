const fs=require('node:fs');const path=require('node:path');const {Readable}=require('node:stream');const tiny=require('tinyglobby');
function options(o={},patterns=[]){return {...o,absolute:o.absolute||[patterns].flat().some(p=>path.isAbsolute(p)),onlyFiles:o.onlyFiles!==false,onlyDirectories:o.onlyDirectories,expandDirectories:false};}
function entries(paths,o={}){if(!o.objectMode&&!o.stats)return paths;return paths.map(p=>{const full=path.resolve(o.cwd||process.cwd(),p);const stats=fs.statSync(full);return {name:path.basename(p),path:p,dirent:stats,...(o.stats?{stats}:{})};});}
async function glob(patterns,o={}){return entries(await tiny.glob(patterns,options(o,patterns)),o);}
glob.sync=(patterns,o={})=>entries(tiny.globSync(patterns,options(o,patterns)),o);
glob.stream=(patterns,o={})=>Readable.from((async function*(){yield* await glob(patterns,o)})());
glob.isDynamicPattern=tiny.isDynamicPattern;
glob.escapePath=tiny.escapePath;
glob.convertPathToPattern=p=>tiny.escapePath(p.replaceAll('\\','/'));
module.exports=glob;
