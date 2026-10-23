from pathlib import Path
import json,zipfile,hashlib
root=Path(__file__).resolve().parents[1]
version=json.loads((root/'package.json').read_text())['version']
out=root.parent/'bundles'/'ai-coworker';out.mkdir(parents=True,exist_ok=True)
files=[]
allowed_dirs={'bridge','lib','ui','scripts','learner','teaching','checkpoints','test','docs','.github','samples'}
allowed_root={'.env.example','.gitignore','package.json','package-lock.json','requirements.lock','README.md','LICENSE','NOTICE','LICENSING.md','server.mjs','CONTRIBUTORS.md'}
for file in sorted(root.rglob('*')):
 if not file.is_file(): continue
 if file.is_symlink(): raise ValueError('Symlinks cannot be packaged')
 rel=file.relative_to(root)
 if rel.parts[0] not in allowed_dirs and str(rel) not in allowed_root: continue
 if '__pycache__' in rel.parts or file.suffix=='.pyc': continue
 # README media is for the GitHub page only; downloads stay small.
 if rel.parts[:2]==('docs','media'): continue
 files.append(str(rel))
variants={}
for variant in ['reference','starter']:
 filename=f'ai-coworker-{variant}-{version}.zip'
 with zipfile.ZipFile(out/filename,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  for rel in files:
   source=root/rel
   if variant=='starter' and rel.startswith('learner/'):
    source=root/'teaching/starter'/Path(rel).name
   info=zipfile.ZipInfo('ai-coworker/'+rel,(2026,1,1,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16
   z.writestr(info,source.read_bytes())
  if variant=='starter': z.writestr(zipfile.ZipInfo('ai-coworker/starter.json',(2026,1,1,0,0,0)),json.dumps({'project':'ai-coworker','version':version,'exercises':['brief','skills','result']}))
 data=(out/filename).read_bytes()
 variants[variant]={'filename':filename,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'files':files+(['starter.json'] if variant=='starter' else [])}
manifest={'project':'ai-coworker','version':version,**variants['reference'],'variants':variants}
(out/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
print(json.dumps({v:{k:d[k] for k in ['filename','bytes','sha256']} for v,d in variants.items()},indent=2))
