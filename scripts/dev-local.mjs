import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
const python=process.platform==='win32'?'work/routing-venv/Scripts/python.exe':'work/routing-venv/bin/python';
if(!existsSync(python)||!existsSync('work/routing/ready.json')){console.error('Prepare the local router first; see README.md.');process.exit(1);}
const children=[spawn(python,['scripts/routing_server.py'],{stdio:'inherit',windowsHide:true}),spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],{stdio:'inherit',windowsHide:true})];
let stopping=false;
function stop(code=0){if(stopping)return;stopping=true;for(const child of children)child.kill();process.exitCode=code;}
for(const child of children){child.on('error',e=>{console.error(e.message);stop(1);});child.on('exit',code=>stop(code??0));}
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>stop());
