import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {createGameSpec} from './spec.js';

const ROOT=path.dirname(fileURLToPath(import.meta.url)), PUBLIC=path.join(ROOT,'public');
try { for(const line of fs.readFileSync(path.join(ROOT,'.env'),'utf8').split(/\r?\n/)){const m=line.match(/^([A-Z0-9_]+)=(.*)$/); if(m&&!process.env[m[1]])process.env[m[1]]=m[2].replace(/^['"]|['"]$/g,'');} } catch {}
const ENV=process.env, PORT=Number(ENV.PORT||3000), MODEL=ENV.GROQ_MODEL||'openai/gpt-oss-120b';
const SUPA=(ENV.SUPABASE_URL||'').replace(/\/$/,''), SERVICE=ENV.SUPABASE_SERVICE_ROLE_KEY||'', ANON=ENV.SUPABASE_ANON_KEY||'';
const ADMIN_EMAILS=(ENV.ADMIN_EMAILS||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
const READY=!!(SUPA&&SERVICE&&ANON&&ADMIN_EMAILS.length);
const recent=new Map();
const demo=[
{id:'demo-neon',creator:'gamefeed',title:'NEON DRIFT',description:'Desvie dos perigos na pista infinita.',type:'dodge',theme:'neon',player:'🏎️',enemy:'🚧',collectible:'⭐',speed:3,difficulty:2,palette:['#090b24','#9259ff','#19e6e6'],published:true,likes:164},
{id:'demo-galaxy',creator:'pixelwizard',title:'GALAXY BLAST',description:'Sobreviva aos invasores.',type:'shooter',theme:'space',player:'🚀',enemy:'👾',collectible:'💎',speed:3,difficulty:2,palette:['#090b1d','#6f66ff','#ff5ea0'],published:true,likes:97},
{id:'demo-ninja',creator:'ninjacode',title:'NINJA JUMP',description:'Colete moedas e pule plataformas.',type:'platform',theme:'forest',player:'🥷',enemy:'👹',collectible:'🪙',speed:3,difficulty:2,palette:['#092626','#04cc9a','#ffd76a'],published:true,likes:209},
{id:'demo-catch',creator:'gamefeed',title:'CANDY RUSH',description:'Pegue os doces e evite bombas.',type:'catch',theme:'candy',player:'🧺',enemy:'💣',collectible:'🍬',speed:3,difficulty:2,palette:['#240d32','#e96dce','#ffdd68'],published:true,likes:77}
];
function output(res,code,data){res.writeHead(code,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(data));}
function fail(code,message){const e=new Error(message);e.status=code;throw e;}
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>12000)fail(413,'Mensagem muito grande');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{fail(400,'JSON inválido');}}
function rateLimit(key,max,window=3600000){const t=Date.now();const list=(recent.get(key)||[]).filter(x=>x>t-window);if(list.length>=max)fail(429,'Muitas solicitações. Tente novamente mais tarde.');list.push(t);recent.set(key,list);if(recent.size>30000)recent.clear();}
async function db(table,{method='GET',query='',data,prefer='return=representation'}={}){
 if(!READY)fail(503,'Configure Supabase e ADMIN_EMAILS no servidor.');
 const r=await fetch(`${SUPA}/rest/v1/${table}${query?`?${query}`:''}`,{method,headers:{apikey:SERVICE,Authorization:`Bearer ${SERVICE}`,'content-type':'application/json',Prefer:prefer},body:data===undefined?undefined:JSON.stringify(data)});
 const txt=await r.text();let result;try{result=txt?JSON.parse(txt):null;}catch{result=txt;}
 if(!r.ok){console.error('Database request failed',table,r.status);fail(500,'Falha ao consultar banco de dados');}return result;
}
const eq=(value)=>'eq.'+encodeURIComponent(String(value));
async function identity(req,{required=true}={}){
 const raw=req.headers.authorization||'';const match=raw.match(/^Bearer ([A-Za-z0-9_.\-]+)$/);
 if(!match){if(required)fail(401,'Entre com sua conta Google');return null;}
 if(!READY)fail(503,'Login ainda não configurado');
 const r=await fetch(`${SUPA}/auth/v1/user`,{headers:{apikey:ANON,Authorization:`Bearer ${match[1]}`}});
 if(!r.ok)fail(401,'Sessão expirada, entre novamente');const user=await r.json();
 if(!user.id||user.app_metadata?.provider!=='google'||!user.email_confirmed_at)fail(403,'Use uma conta Google verificada');
 const isAdmin=ADMIN_EMAILS.includes(String(user.email).toLowerCase());
 await db('profiles',{method:'POST',query:'on_conflict=id',prefer:'resolution=merge-duplicates,return=minimal',data:{id:user.id,email:user.email,display_name:String(user.user_metadata?.full_name||user.email?.split('@')[0]||'Jogador').slice(0,80)}});
 const profiles=await db('profiles',{query:`id=${eq(user.id)}&select=id,email,display_name,banned_until,permanent_ban`});const profile=profiles[0];
 if(profile?.permanent_ban)fail(403,'Conta banida permanentemente. Solicite revisão ao suporte.');
 if(profile?.banned_until&&new Date(profile.banned_until)>new Date())fail(403,`Conta suspensa até ${new Date(profile.banned_until).toLocaleString('pt-BR')}`);
 return {id:user.id,email:user.email,name:profile?.display_name||'Jogador',admin:isAdmin};
}
function isAdmin(u){if(!u?.admin)fail(403,'Acesso restrito à administração');}
function classify(prompt){const s=prompt.toLowerCase();
 const high=/(?:pornografia infantil|abuso sexual infantil|explosivo real|fabricar bomba real|matar pessoas reais|ataque terrorista|roubar senha|phishing|malware|ransomware|dados bancários roubados)/i.test(s);
 const medium=/\b(?:sangue|gore|nudez|sexo|drogas|suic[ií]dio|arma real|tortura|racismo|cassino|apostas|viol[eê]ncia extrema)\b/i.test(s);
 return {severity:high?'perigo':medium?'medio':'leve',status:high?'blocked':medium?'pending':'allowed',reason:high?'Possível conteúdo de alto risco':medium?'Revisão humana recomendada':'Triagem automática sem alerta'};
}
function publicGame(r){if(!r)return null;return {...r.spec,id:r.id,creator:r.creator_name,title:r.spec.title,description:r.spec.description,published:r.published,likes:r.likes||0};}
async function logAction(actor,target,action,reason,minutes){await db('moderation_actions',{method:'POST',data:{actor_id:actor.id,target_user_id:target,action,reason,duration_minutes:minutes||null}});}
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.ico':'image/x-icon'};
async function handler(req,res){const url=new URL(req.url,'http://local');const p=url.pathname;
 try{
  if(p.startsWith('/api/')){
   res.setHeader('X-Frame-Options','DENY');
   if(req.method==='GET'&&p==='/api/status')return output(res,200,{ok:true,configured:READY,groqConfigured:!!ENV.GROQ_API_KEY,model:MODEL,supabaseUrl:SUPA,anonKey:ANON});
   if(req.method==='GET'&&p==='/api/games'){let all=[...demo];if(READY){const rows=await db('games',{query:'published=eq.true&select=id,creator_name,spec,published,likes&order=created_at.desc&limit=100'});all=[...rows.map(publicGame),...demo];}return output(res,200,{games:all});}
   if(req.method==='GET'&&p==='/api/me'){const u=await identity(req);return output(res,200,{user:{id:u.id,name:u.name,email:u.email,admin:u.admin}});}
   if(req.method==='POST'&&p==='/api/generate'){
    const u=await identity(req);if(!ENV.GROQ_API_KEY)fail(503,'A chave Groq ainda não foi configurada');rateLimit('generate:'+u.id,8);
    const b=await body(req),prompt=String(b.prompt||'').trim();if(prompt.length<12||prompt.length>900)fail(400,'Descreva o jogo entre 12 e 900 caracteres');
    const tag=classify(prompt);
    const records=await db('generation_requests',{method:'POST',data:{user_id:u.id,prompt,severity:tag.severity,status:tag.status,reason:tag.reason,model:MODEL}});const record=records[0];
    if(tag.status!=='allowed')return output(res,422,{error:tag.status==='blocked'?'Pedido bloqueado e enviado à moderação.':'Pedido encaminhado para revisão pela moderação.',severity:tag.severity});
    try{let usage={};const spec=await createGameSpec(prompt,{key:ENV.GROQ_API_KEY,model:MODEL,onUsage:u=>{usage=u}});const games=await db('games',{method:'POST',data:{creator_id:u.id,creator_name:u.name,spec,published:false,request_id:record.id}});await db('generation_requests',{method:'PATCH',query:`id=${eq(record.id)}`,data:{status:'generated',input_tokens:Number(usage.prompt_tokens)||0,output_tokens:Number(usage.completion_tokens)||0,total_tokens:Number(usage.total_tokens)||0}});return output(res,201,{game:publicGame(games[0])});}
    catch(e){await db('generation_requests',{method:'PATCH',query:`id=${eq(record.id)}`,data:{status:'failed'}}).catch(()=>{});console.error('Groq error',e.message);fail(502,'Não foi possível gerar o jogo. Tente novamente.');}
   }
   if(req.method==='POST'&&p==='/api/publish'){const u=await identity(req),b=await body(req);const rows=await db('games',{query:`id=${eq(b.id)}&creator_id=${eq(u.id)}&select=id,creator_name,spec,published,likes`});if(!rows.length)fail(404,'Jogo não encontrado na sua conta');await db('games',{method:'PATCH',query:`id=${eq(b.id)}&creator_id=${eq(u.id)}`,data:{published:true}});return output(res,200,{game:{...publicGame(rows[0]),published:true}});}
   if(req.method==='POST'&&p==='/api/like'){const u=await identity(req),b=await body(req);if(String(b.id).startsWith('demo-'))return output(res,200,{likes:demo.find(x=>x.id===b.id)?.likes||0,liked:true});const result=await db('likes',{method:'POST',query:'on_conflict=user_id,game_id',prefer:'resolution=ignore-duplicates,return=minimal',data:{user_id:u.id,game_id:b.id}});const rows=await db('games',{query:`id=${eq(b.id)}&published=eq.true&select=id,likes`});return output(res,200,{likes:rows[0]?.likes||0,liked:true});}
   if(req.method==='GET'&&p==='/api/comments'){if(String(url.searchParams.get('id')).startsWith('demo-'))return output(res,200,{comments:[]});const rows=await db('comments',{query:`game_id=${eq(url.searchParams.get('id'))}&select=id,author,content,created_at&order=created_at.desc&limit=80`});return output(res,200,{comments:rows});}
   if(req.method==='POST'&&p==='/api/comments'){const u=await identity(req),b=await body(req),content=String(b.content||'').trim();rateLimit('comment:'+u.id,60);if(!content||content.length>280)fail(400,'Comentário deve ter entre 1 e 280 caracteres');if(String(b.id).startsWith('demo-'))fail(400,'Comentários de demonstrações estão desativados');const rows=await db('games',{query:`id=${eq(b.id)}&published=eq.true&select=id`});if(!rows.length)fail(404,'Jogo indisponível');const result=await db('comments',{method:'POST',data:{game_id:b.id,user_id:u.id,author:u.name,content}});return output(res,201,{comment:result[0]});}
   if(p.startsWith('/api/admin/')){
    const u=await identity(req);isAdmin(u);rateLimit('admin:'+u.id,200,3600000);
    if(req.method==='GET'&&p==='/api/admin/overview'){
     const [users,requests,games,actions]=await Promise.all([db('profiles',{query:'select=id,email,display_name,banned_until,permanent_ban,created_at&order=created_at.desc&limit=200'}),db('generation_requests',{query:'select=id,user_id,prompt,severity,status,reason,model,input_tokens,output_tokens,total_tokens,created_at&order=created_at.desc&limit=300'}),db('games',{query:'select=id,creator_id,creator_name,spec,published,created_at&order=created_at.desc&limit=100'}),db('moderation_actions',{query:'select=id,actor_id,target_user_id,action,reason,duration_minutes,created_at&order=created_at.desc&limit=100'})]);
     return output(res,200,{users,requests,games:games.map(x=>({...x,spec:{title:x.spec?.title}})),actions,usage:{inputTokens:requests.reduce((n,x)=>n+(x.input_tokens||0),0),outputTokens:requests.reduce((n,x)=>n+(x.output_tokens||0),0),totalTokens:requests.reduce((n,x)=>n+(x.total_tokens||0),0),requests:requests.length,generated:requests.filter(x=>x.status==='generated').length,failed:requests.filter(x=>x.status==='failed').length,model:MODEL,note:'Tokens declarados pela resposta da Groq para as últimas 300 solicitações; não representam faturamento total.'}});
    }
    if(req.method==='POST'&&p==='/api/admin/moderate'){
     const b=await body(req),target=String(b.userId||''),action=String(b.action||''),reason=String(b.reason||'').trim().slice(0,500),minutes=Number(b.minutes||0);
     if(!['warn','temp_ban','perm_ban','unban'].includes(action)||!target||reason.length<5)fail(400,'Ação, usuário e motivo são obrigatórios');
     if(!['warn','unban'].includes(action)&&(!Number.isSafeInteger(minutes)||minutes<1||minutes>525600)){
      if(action==='temp_ban')fail(400,'Duração deve ter entre 1 e 525600 minutos');
     }
     if(target===u.id)fail(400,'Você não pode moderar sua própria conta');
     const profiles=await db('profiles',{query:`id=${eq(target)}&select=id,email`});if(!profiles.length)fail(404,'Usuário não encontrado');
     if(ADMIN_EMAILS.includes(profiles[0].email?.toLowerCase()))fail(403,'Não é permitido banir outro administrador');
     if(action==='temp_ban')await db('profiles',{method:'PATCH',query:`id=${eq(target)}`,data:{banned_until:new Date(Date.now()+minutes*60000).toISOString(),permanent_ban:false}});
     if(action==='perm_ban')await db('profiles',{method:'PATCH',query:`id=${eq(target)}`,data:{permanent_ban:true,banned_until:null}});
     if(action==='unban')await db('profiles',{method:'PATCH',query:`id=${eq(target)}`,data:{permanent_ban:false,banned_until:null}});
     await logAction(u,target,action,reason,action==='temp_ban'?minutes:null);return output(res,200,{ok:true});
    }
    if(req.method==='POST'&&p==='/api/admin/request'){
     const b=await body(req),status=String(b.status||'');if(!['allowed','blocked','pending'].includes(status))fail(400,'Status inválido');const rows=await db('generation_requests',{query:`id=${eq(b.id)}&select=id`});if(!rows.length)fail(404,'Pedido não encontrado');await db('generation_requests',{method:'PATCH',query:`id=${eq(b.id)}`,data:{status}});return output(res,200,{ok:true});
    }
   }
   fail(404,'Rota desconhecida');
  }
  if(req.method!=='GET'&&req.method!=='HEAD')fail(405,'Método não permitido');
  let filePath;try{filePath=decodeURIComponent(p);}catch{fail(400,'Caminho inválido');}
  if(filePath==='/'||filePath==='/admin')filePath=filePath==='/admin'?'/admin.html':'/index.html';
  const file=path.resolve(PUBLIC,'.'+filePath);if(!file.startsWith(PUBLIC+path.sep))fail(403,'Acesso negado');
  const stat=await fs.promises.stat(file).catch(()=>null);if(!stat?.isFile())fail(404,'Arquivo não encontrado');
  res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','x-content-type-options':'nosniff','referrer-policy':'strict-origin-when-cross-origin','x-frame-options':'DENY','content-security-policy':"default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; connect-src 'self' https://*.supabase.co; img-src 'self' data: https:; frame-ancestors 'none'; base-uri 'none'; object-src 'none'",'cache-control':'no-cache'});
  if(req.method==='HEAD')return res.end();fs.createReadStream(file).pipe(res);
 }catch(e){output(res,e.status||500,{error:e.status?e.message:'Erro interno no servidor'});if(!e.status)console.error(e);}
}
http.createServer(handler).listen(PORT,'0.0.0.0',()=>console.log(`GameFeed AI seguro: porta ${PORT}, configurado=${READY}`));
