import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const python=path.join(root,'work/routing-venv',process.platform==='win32'?'Scripts/python.exe':'bin/python');
if(!existsSync(python)||!existsSync(path.join(root,'work/routing/ready.json'))){console.error('Local router is not prepared. Follow README: install requirements-routing.txt in work/routing-venv, then run scripts/prepare_routing.py --pbf <regional file>.');process.exit(1);}
const child=spawn(python,['scripts/routing_server.py'],{cwd:root,stdio:'inherit',windowsHide:true});
child.on('error',err=>{console.error(err.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{child.kill();});
