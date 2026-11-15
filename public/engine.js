export class MiniGame {
 constructor(canvas, onEnd=()=>{}) {this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onEnd=onEnd;this.frame=0;this.game=null;this.active=false;this.paused=false;this.pressed={};this.pointer=null;this.id=0;this.bind();}
 bind(){const c=this.canvas;c.addEventListener('pointerdown',e=>{c.setPointerCapture(e.pointerId);this.target=this.pointerX(e)});c.addEventListener('pointermove',e=>{if(e.buttons||e.pointerType==='touch')this.target=this.pointerX(e)});window.addEventListener('keydown',e=>{if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight',' ','KeyA','KeyD','KeyW'].includes(e.code)){if(this.active && !this.paused)e.preventDefault();this.pressed[e.code]=true}});window.addEventListener('keyup',e=>{this.pressed[e.code]=false});}
 pointerX(e){return (e.clientX-this.canvas.getBoundingClientRect().left)/this.canvas.getBoundingClientRect().width*this.canvas.width;}
 load(game){this.stop();this.game=game;this.frame=0;this.score=0;this.lives=3;this.target=null;this.player={x:195,y:565,w:41,h:41,vy:0,grounded:false};this.items=[];this.particles=[];this.invuln=0;this.spawnTick=0;this.levelWidth=390;this.platforms=[{x:0,y:615,w:390,h:30},{x:70,y:490,w:140,h:17},{x:235,y:355,w:130,h:17},{x:20,y:225,w:145,h:17}];this.player.y=game.type==='platform'?560:572;this.render();}
 start(){if(!this.game)return;this.active=true;this.paused=false;cancelAnimationFrame(this.id);this.last=performance.now();this.id=requestAnimationFrame(t=>this.loop(t));}
 stop(){this.active=false;cancelAnimationFrame(this.id);}
 pause(){this.paused=!this.paused;this.last=performance.now();}
 loop(now){if(!this.active)return;const delta=Math.min((now-this.last)/16.67,2.2);this.last=now;if(!this.paused){this.update(delta);this.render();}this.id=requestAnimationFrame(t=>this.loop(t));}
 hit(a,b,r=24){return Math.abs(a.x-b.x)<r+((b.w||20)/3)&&Math.abs(a.y-b.y)<r+((b.h||20)/3)}
 spawn(type,x,y,v=2){this.items.push({type,x,y,v,ttl:0});}
 damage(){if(this.invuln>0)return;this.lives--;this.invuln=90;this.explode(this.player.x,this.player.y,'#ff6d8b');if(this.lives<=0){this.active=false;cancelAnimationFrame(this.id);this.render();this.onEnd(this.score);}}
 explode(x,y,color){for(let i=0;i<12;i++){let a=Math.random()*Math.PI*2;this.particles.push({x,y,vx:Math.cos(a)*Math.random()*5,vy:Math.sin(a)*Math.random()*5,life:30,color})}}
 update(d){const g=this.game;this.frame+=d;this.invuln=Math.max(0,this.invuln-d);const pace=(g.speed||3)*.9+this.frame/1300;
  if(g.type==='platform'){
    const p=this.player;const direction=(this.pressed.ArrowLeft||this.pressed.KeyA?-1:0)+(this.pressed.ArrowRight||this.pressed.KeyD?1:0);
    if(this.target!==null)p.x+=(this.target-p.x)*.13*d;else p.x+=direction*5*d;
    p.x=Math.max(20,Math.min(370,p.x));const oldY=p.y;p.vy+=.42*d;p.y+=p.vy*d;p.grounded=false;
    for(const platform of this.platforms){if(p.vy>=0&&oldY+20<=platform.y+8&&p.y+20>=platform.y&&p.x>platform.x-15&&p.x<platform.x+platform.w+15){p.y=platform.y-20;p.vy=0;p.grounded=true;}}
    if((this.pressed.Space||this.pressed.ArrowUp||this.pressed.KeyW||this.target!==null)&&p.grounded){p.vy=-11.6;p.grounded=false;this.target=null;}
    if(p.y>720){p.y=590;p.vy=0;this.damage()}
    if(this.frame-this.spawnTick>65){this.spawnTick=this.frame;this.spawn(Math.random()<.75?'good':'bad',30+Math.random()*330,170+Math.random()*410,1+Math.random());}
    for(const it of this.items){it.ttl+=d;it.y+=Math.sin(it.ttl/20)*.2;if(this.hit(p,it,18)){if(it.type==='good'){this.score+=10;this.explode(it.x,it.y,g.palette[2]);}else this.damage();it.ttl=9999}}
  }else{
    const p=this.player;const direction=(this.pressed.ArrowLeft||this.pressed.KeyA?-1:0)+(this.pressed.ArrowRight||this.pressed.KeyD?1:0);
    if(this.target!==null)p.x+=(this.target-p.x)*.18*d;else p.x+=direction*6*d;p.x=Math.max(25,Math.min(365,p.x));
    if(this.frame-this.spawnTick>Math.max(16,47-g.difficulty*5-this.frame/480)){this.spawnTick=this.frame;const good=Math.random()<(g.type==='catch'?.68:g.type==='shooter'?.18:.33);this.spawn(good?'good':'bad',24+Math.random()*340,-40,pace*(.7+Math.random()*.7));}
    if(g.type==='shooter'&&Math.floor(this.frame/10)!==Math.floor((this.frame-d)/10))this.spawn('bullet',p.x,p.y-25,-11);
    for(const it of this.items){it.y+=it.v*d;it.ttl+=d;if(it.type==='bullet')continue;if(this.hit(p,it,23)){if(it.type==='good'){this.score+=10;this.explode(it.x,it.y,g.palette[2]);}else this.damage();it.ttl=9999;}}
    if(g.type==='shooter')for(const shot of this.items.filter(i=>i.type==='bullet'))for(const enemy of this.items.filter(i=>i.type==='bad'&&i.ttl<999)){if(this.hit(shot,enemy,12)){shot.ttl=9999;enemy.ttl=9999;this.score+=15;this.explode(enemy.x,enemy.y,g.palette[1]);break;}}
    this.score+=.025*d;
  }
  this.items=this.items.filter(i=>i.ttl<1000&&i.y<730&&i.y>-150&&(g.type!=='platform'||i.ttl<500));
  for(const p of this.particles){p.x+=p.vx*d;p.y+=p.vy*d;p.life-=d;}
  this.particles=this.particles.filter(p=>p.life>0);
 }
 render(){const g=this.game;if(!g)return;const c=this.ctx,W=390,H=690;const [bg,a,b]=g.palette||['#090b24','#9259ff','#19e6e6'];
  const grad=c.createLinearGradient(0,0,W,H);grad.addColorStop(0,bg);grad.addColorStop(1,'#080616');c.fillStyle=grad;c.fillRect(0,0,W,H);
  c.save();c.globalAlpha=.23;c.strokeStyle=a;c.lineWidth=1;const offset=this.frame*.55%52;
  if(g.type==='dodge'){for(let x=38;x<W;x+=76){c.beginPath();c.moveTo(x,0);c.lineTo(x,H);c.stroke();}for(let y=offset;y<H;y+=52){c.beginPath();c.moveTo(0,y);c.lineTo(W,y);c.stroke();}}
  else if(g.type==='platform'){for(let x=0;x<W;x+=40)for(let y=0;y<H;y+=40){c.fillStyle=b;c.fillRect(x+8,y+8,2,2);}}
  else{for(let i=0;i<55;i++){const x=(i*107)%W,y=((i*173+this.frame*(i%3+1)*.25)%H);c.fillStyle=i%2?a:b;c.fillRect(x,y,i%4===0?3:1,i%4===0?3:1);}}
  c.restore();
  if(g.type==='platform'){for(const p of this.platforms){c.fillStyle=a;c.shadowColor=a;c.shadowBlur=15;c.fillRect(p.x,p.y,p.w,10);c.shadowBlur=0;c.fillStyle='#ffffff36';c.fillRect(p.x,p.y,p.w,2);}}
  for(const it of this.items){if(it.type==='bullet'){c.fillStyle=b;c.shadowColor=b;c.shadowBlur=15;c.fillRect(it.x-3,it.y-11,6,19);c.shadowBlur=0;continue;}c.save();c.shadowColor=it.type==='good'?b:'#ff3a79';c.shadowBlur=14;c.textAlign='center';c.textBaseline='middle';c.font='29px sans-serif';c.fillText(it.type==='good'?g.collectible:g.enemy,it.x,it.y);c.restore();}
  for(const p of this.particles){c.globalAlpha=p.life/30;c.fillStyle=p.color;c.fillRect(p.x,p.y,4,4);}c.globalAlpha=1;
  if(this.invuln<1||Math.floor(this.invuln/6)%2===0){c.save();c.textAlign='center';c.textBaseline='middle';c.font='43px sans-serif';c.shadowColor=a;c.shadowBlur=25;c.fillText(g.player,this.player.x,this.player.y);c.restore();}
  if(this.paused){c.fillStyle='#090715aa';c.fillRect(0,0,W,H);c.fillStyle='#fff';c.font='bold 31px sans-serif';c.textAlign='center';c.fillText('PAUSADO',W/2,H/2);}
 }
}
