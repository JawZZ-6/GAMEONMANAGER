import { join,resolve } from 'node:path';
import { homedir } from 'node:os';
import { readFile } from 'node:fs/promises';
import express from 'express';
import { JsonStore } from './store';
import { Auth } from './auth';
import { createApp } from './app';
import { createEvent } from '../shared/domain';
import { demoEvent } from './demo';

const demo=process.argv.includes('--demo'),dev=process.argv.includes('--dev');
const port=Number(process.env.PORT||(demo?4311:4310)),host=process.env.HOST||'127.0.0.1';
const origin=process.env.GAMEON_ORIGIN||`http://${host}:${port}`;
if(!['127.0.0.1','localhost','::1'].includes(host)&&!origin.startsWith('https://'))throw new Error('Configure GAMEON_ORIGIN with HTTPS before binding beyond localhost.');
const dir=resolve(process.env.GAMEON_DATA_DIR||join(process.env.LOCALAPPDATA||join(homedir(),'.local','share'),'CISI-GameON',demo?'demo':'event'));
const store=await JsonStore.open(dir,demo?demoEvent():createEvent());const auth=new Auth(dir);
if(process.env.GAMEON_ADMIN_PASSWORD&&!await auth.configured())await auth.setup(process.env.GAMEON_ADMIN_PASSWORD);
const app=createApp({store,auth,origin});
let vite:Awaited<ReturnType<typeof import('vite')['createServer']>>|undefined;
if(dev){const {createServer}=await import('vite');vite=await createServer({server:{middlewareMode:true},appType:'spa'});app.use(vite.middlewares);}
else {app.use(express.static(resolve('dist')));app.get('/{*path}',async(_req,res)=>{try{res.type('html').send(await readFile(resolve('dist/index.html'),'utf8'));}catch{res.status(503).send('Run npm run build before starting GameON.');}});}
const server=app.listen(port,host,()=>{console.log(`GameON ${demo?'DEMO':'event'}: ${origin}/admin`);console.log(`Live viewer: ${origin}/live`);console.log(`Data directory: ${dir}`);});
let closing=false;async function shutdown(){if(closing)return;closing=true;server.close(async()=>{await vite?.close();await store.close();process.exit(0);});server.closeIdleConnections();}
process.on('SIGINT',shutdown);process.on('SIGTERM',shutdown);
server.on('error',async error=>{console.error(error);await store.close();process.exit(1);});
