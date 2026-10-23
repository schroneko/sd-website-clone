const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const glob=require('fast-glob');const match=require('micromatch');
test('file discovery preserves braces, ignore, sync, async, stream and object metadata',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'glob-migration-'));try{fs.mkdirSync(path.join(dir,'docs'));for(const name of ['a.md','b.mdx','skip.md','c.txt'])fs.writeFileSync(path.join(dir,'docs',name),'fixture');const patterns=['docs/*.{md,mdx}','!**/skip.md'];const options={cwd:dir};assert.deepEqual(glob.sync(patterns,options).sort(),['docs/a.md','docs/b.mdx']);assert.deepEqual((await glob(patterns,options)).sort(),['docs/a.md','docs/b.mdx']);const stream=[];for await(const s of glob.stream(patterns,options))stream.push(s);assert.deepEqual(stream.sort(),['docs/a.md','docs/b.mdx']);const objects=await glob(patterns,{...options,objectMode:true,stats:true});assert.ok(objects.every(x=>x.dirent.isFile()&&x.stats.isFile()));assert.equal(glob.isDynamicPattern('docs/*.md'),true);}finally{fs.rmSync(dir,{recursive:true})}});
test('matching preserves the Docusaurus and proxy APIs and bounds nesting',()=>{assert.deepEqual(match(['a.md','b.txt'],'*.md'),['a.md']);assert.deepEqual(match(['a.md','b.md'],['*.md','!b.md']),['a.md']);assert.deepEqual(match.not(['a.md','b.txt'],'*.md'),['b.txt']);assert.equal(match.isMatch('docs/a.mdx','**/*.{md,mdx}'),true);assert.equal(match.makeRe('**/*.md').test('docs/a.md'),true);assert.throws(()=>match.makeRe('{'.repeat(4000)+'x'+'}'.repeat(4000)),SyntaxError);});

test('generateTasks preserves task fields, global exclusions and base grouping',()=>{
  const patterns=['docs/index.html','docs/*.html','components/**/*.jsx','!**/skip.html','../shared/*.html','!(draft).html'];
  const options={ignore:['**/ignored.html']};
  const negative=['**/skip.html','**/ignored.html'];
  const task=(base,dynamic,positive)=>({base,dynamic,positive,negative,patterns:positive.concat(negative.map(p=>'!'+p))});
  assert.deepEqual(glob.generateTasks(patterns,options),[
    task('docs',false,['docs/index.html']),
    task('../shared',true,['../shared/*.html']),
    task('.',true,['docs/*.html','components/**/*.jsx','!(draft).html'])
  ]);
  assert.deepEqual(glob.generateTasks(['docs/*.html','components/**/*.jsx']),[
    {dynamic:true,positive:['docs/*.html'],negative:[],base:'docs',patterns:['docs/*.html']},
    {dynamic:true,positive:['components/**/*.jsx'],negative:[],base:'components',patterns:['components/**/*.jsx']}
  ]);
  for(const pattern of ['{docs,components}/**/*.html','{docs/a,components/b}.html','docs/[ab]/*.html','docs/@(a|b)/*.html']){
    const [task]=glob.generateTasks(pattern);
    assert.equal(task.base,pattern.startsWith('docs/')?'docs':'.');
    assert.deepEqual(task.positive,[pattern]);
  }
  const absolute=path.posix.join(os.tmpdir(),'glob-tasks','*.html');
  assert.equal(glob.generateTasks(absolute)[0].base,path.posix.dirname(absolute));
  assert.equal(glob.generateTasks('docs/index.html',{caseSensitiveMatch:false})[0].dynamic,true);
  assert.deepEqual(glob.generateTasks([]),[]);
  assert.deepEqual(glob.generateTasks(['!**/*.html']),[]);
  assert.throws(()=>glob.generateTasks(['docs/*.html',null]),TypeError);
  assert.deepEqual(patterns,['docs/index.html','docs/*.html','components/**/*.jsx','!**/skip.html','../shared/*.html','!(draft).html']);
  assert.deepEqual(options,{ignore:['**/ignored.html']});
});

test('generated tasks discover fixtures and Tailwind compiles only included content',async()=>{
  const postcss=require('postcss');
  const tailwind=require('tailwindcss');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'tailwind-glob-'));
  try{
    const fixtures={
      'site/index.html':'<div class="underline"></div>',
      'site/pages/card.html':'<div class="flex p-4"></div>',
      'site/pages/skip.html':'<div class="italic"></div>',
      'site/pages/ignored.html':'<div class="uppercase"></div>',
      'site/components/button.jsx':'<div className="grid gap-2" />',
      'site/components/draft.jsx':'<div className="lowercase" />',
      'shared/banner.html':'<div class="font-bold"></div>',
      'shared/skip.html':'<div class="line-through"></div>'
    };
    for(const [file,content] of Object.entries(fixtures)){
      fs.mkdirSync(path.dirname(path.join(dir,file)),{recursive:true});
      fs.writeFileSync(path.join(dir,file),content);
    }
    const patterns=['index.html','{pages,components}/**/*.{html,jsx}','../shared/*.html','!**/skip.html','!../shared/skip.html','!components/draft.jsx'];
    const options={cwd:path.join(dir,'site'),ignore:['**/ignored.html']};
    const expected=['../shared/banner.html','components/button.jsx','index.html','pages/card.html'];
    const tasks=glob.generateTasks(patterns,options);
    assert.deepEqual([...new Set(tasks.flatMap(task=>glob.sync(task.patterns,{cwd:options.cwd})))].sort(),expected);
    assert.deepEqual(glob.sync(patterns,options).sort(),expected);
    const files=patterns.concat('!**/ignored.html').map(p=>p.startsWith('!')?'!'+options.cwd+'/'+p.slice(1):options.cwd+'/'+p);
    const result=await postcss([tailwind({content:files,corePlugins:{preflight:false}})]).process('@tailwind utilities;',{from:path.join(dir,'input.css')});
    const selectors=new Set();
    result.root.walkRules(rule=>selectors.add(rule.selector));
    for(const utility of ['underline','flex','p-4','grid','gap-2','font-bold'])assert.ok(selectors.has('.'+utility),utility);
    for(const utility of ['italic','uppercase','lowercase','line-through'])assert.ok(!selectors.has('.'+utility),utility);
    assert.match(result.css,/padding: 1rem/);
    assert.match(result.css,/font-weight: 700/);
  }finally{
    fs.rmSync(dir,{recursive:true});
  }
});

