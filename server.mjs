import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root=resolve('.'), mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server=createServer(async(req,res)=>{try{const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);const path=resolve(root,`.${pathname==='/'?'/index.html':pathname}`);if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403).end('Forbidden');return;}const body=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]??'application/octet-stream','Cache-Control':'no-cache'});res.end(body);}catch{res.writeHead(404).end('Not found');}});
server.listen(Number(process.env.PORT)||8080,'0.0.0.0',()=>console.log(`GDP Web disponible en http://localhost:${server.address().port} (red local incluida)`));
