const fs=require('fs');
const path=require('path');
const root=path.resolve('src');
const roots=[path.join(root,'App.tsx'),path.join(root,'main.tsx')];
const exts=['.ts','.tsx','.js','.jsx','.css'];
const seen=new Set();
const assets=new Set();
const importRe=/import\s+(?:[^'\"]+from\s+)?['\"]([^'\"]+)['\"]/g;
const dynImportRe=/import\((['\"])([^'\"]+)\1\)/g;
const requireRe=/require\((['\"])([^'\"]+)\1\)/g;
const cssUrlRe=/url\((['\"]?)([^'\"\)]+)\1\)/g;
function resolveImport(fromFile, spec){
  if(!spec.startsWith('.')) return null;
  const base=path.resolve(path.dirname(fromFile),spec);
  for(const ext of exts){
    const p=base+ext;
    if(fs.existsSync(p)) return p;
  }
  for(const ext of ['.ts','.tsx','.js','.jsx']){
    const p=path.join(base,'index'+ext);
    if(fs.existsSync(p)) return p;
  }
  return null;
}
function walk(file){
  if(seen.has(file)) return;
  if(!fs.existsSync(file)) return;
  seen.add(file);
  const text=fs.readFileSync(file,'utf8');
  let m;
  importRe.lastIndex=0;
  while((m=importRe.exec(text))){
    const spec=m[1];
    const res=resolveImport(file,spec);
    if(res) walk(res);
  }
  dynImportRe.lastIndex=0;
  while((m=dynImportRe.exec(text))){
    const spec=m[2];
    const res=resolveImport(file,spec);
    if(res) walk(res);
  }
  requireRe.lastIndex=0;
  while((m=requireRe.exec(text))){
    const spec=m[2];
    const res=resolveImport(file,spec);
    if(res) walk(res);
  }
  if(file.endsWith('.css')){
    cssUrlRe.lastIndex=0;
    while((m=cssUrlRe.exec(text))){
      const spec=m[2];
      if(spec.startsWith('data:')||spec.startsWith('http')) continue;
      const assetPath=path.resolve(path.dirname(file),spec);
      if(fs.existsSync(assetPath)) assets.add(assetPath);
    }
  }
}
roots.forEach(walk);
const allFiles=[];
(function list(dir){
  for(const ent of fs.readdirSync(dir,{withFileTypes:true})){
    const p=path.join(dir,ent.name);
    if(ent.isDirectory()) list(p);
    else allFiles.push(p);
  }
})(root);
const reachable=new Set([...seen,...assets]);
const unused=allFiles.filter(f=>!reachable.has(f));
console.log('UNUSED');
unused.sort().forEach(f=>console.log(f));
