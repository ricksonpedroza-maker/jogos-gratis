const TYPES=['dodge','shooter','platform','catch'];
const THEMES=['neon','space','forest','candy','desert','ocean','city'];
const COLORS=/^#[0-9a-fA-F]{6}$/;
const SCHEMA={type:'object',additionalProperties:false,required:['title','description','type','theme','player','enemy','collectible','speed','difficulty','palette'],properties:{title:{type:'string'},description:{type:'string'},type:{type:'string',enum:TYPES},theme:{type:'string',enum:THEMES},player:{type:'string'},enemy:{type:'string'},collectible:{type:'string'},speed:{type:'integer'},difficulty:{type:'integer'},palette:{type:'array',items:{type:'string'}}}};
export const templates={types:TYPES,themes:THEMES};
export function validateSpec(g){
 if(!g||typeof g!=='object')throw new Error('Configuração inválida da IA.');
 const cleaned={title:String(g.title||'Meu jogo').slice(0,35),description:String(g.description||'Jogue e divirta-se!').slice(0,160),type:TYPES.includes(g.type)?g.type:'dodge',theme:THEMES.includes(g.theme)?g.theme:'neon',player:String(g.player||'🚀').slice(0,8),enemy:String(g.enemy||'👾').slice(0,8),collectible:String(g.collectible||'⭐').slice(0,8),speed:Math.max(1,Math.min(6,Math.round(Number(g.speed)||3))),difficulty:Math.max(1,Math.min(5,Math.round(Number(g.difficulty)||2))),palette:Array.isArray(g.palette)?g.palette.filter(s=>COLORS.test(s)).slice(0,3):[]};
 while(cleaned.palette.length<3)cleaned.palette.push(['#100e24','#9569ff','#32e6e2'][cleaned.palette.length]);
 return cleaned;
}
export async function createGameSpec(prompt,{model,key,onUsage}){
 const system=`Você cria especificações PARA UM MOTOR REAL DE MINIJOGOS 2D. Responda APENAS JSON conforme o esquema. Escolha o tipo mais próximo do pedido: dodge=desviar de obstáculos andando lateralmente; shooter=nave ou personagem que atira automaticamente, movimenta lateralmente; platform=plataforma com pulo; catch=pegar itens que caem e desviar de itens ruins. Escolha nome curto e descrição atraente em português, emojis temáticos para jogador/inimigo/colecionável, velocidade e dificuldade 1 a 5, e 3 cores hexadecimais. Não prometa mecânicas não suportadas pelo motor: só esses quatro arquétipos. Adaptar conceitos criativamente ao modelo mecânico mais próximo. Não gere JS nem HTML.`;
 const ctrl = new AbortController(); const timer=setTimeout(()=>ctrl.abort(),45000);
 try{
  const response=await fetch('https://api.groq.com/openai/v1/chat/completions',{method:'POST',signal:ctrl.signal,headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({model,temperature:0.6,max_completion_tokens:1400,reasoning_effort:'low',messages:[{role:'system',content:system},{role:'user',content:prompt}],response_format:{type:'json_schema',json_schema:{name:'game_spec',strict:true,schema:SCHEMA}}})});
  const payload=await response.json();if(!response.ok)throw new Error(`Erro da Groq: ${payload.error?.message||response.status}`);
  if(onUsage)onUsage(payload.usage||{});
  const content=payload.choices?.[0]?.message?.content;if(!content)throw new Error('A IA não retornou uma configuração de jogo.');
  return validateSpec(JSON.parse(content));
 } catch(err){if(err.name==='AbortError')throw new Error('A Groq demorou demais para responder. Tente novamente.');throw err;}finally{clearTimeout(timer);}
}
