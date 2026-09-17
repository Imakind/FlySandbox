// Geometry and dynamics are model assumptions, not fitted physiology.
export const W=1000,H=650;
export const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class Simulation{
 constructor(edgeWeight=6362){this.visualGain=Math.log1p(edgeWeight)/10;this.reset()}
 reset(){this.time=0;this.fly={x:420,y:340,angle:-.3,speed:0,turn:0};this.objects=[{kind:'food',x:740,y:205,id:1},{kind:'obstacle',x:580,y:450,id:2}];this.nextId=3;this.light=false;this.predator=false;this.temperature=25;this.hunter={x:850,y:100};this.touch=null;this.eating=0;this.sensors={odor:0,vision:0,touch:0,heat:0,light:0};this.dn=0;this.motor={left:0,right:0};this.reason='explore';this.drive=0;this.path=[];this.history=[];this.lastSample=-1;this.collision=false;this.seed=73;this.wander=0;this.nextWander=0;this.notice=null}
 random(){this.seed=(1664525*this.seed+1013904223)>>>0;return this.seed/4294967296}
 blocked(x,y,pad=12){return x<pad||x>W-pad||y<pad||y>H-pad||this.objects.some(o=>o.kind==='obstacle'&&Math.abs(x-o.x)<55+pad&&Math.abs(y-o.y)<35+pad)}
 place(kind,x,y){if(!['food','obstacle','object','touch','erase'].includes(kind)||!Number.isFinite(x)||!Number.isFinite(y)||x<0||x>W||y<0||y>H)throw Error('Некорректный инструмент или координаты');
  if(kind==='touch'){const hit=distance({x,y},this.fly)<65;if(hit)this.touch={x,y,until:this.time+1.5};return hit?'Прикосновение к мухе':'Касание не попало: нажмите ближе к мухе'}
  if(kind==='erase'){let i=-1,best=75;this.objects.forEach((o,n)=>{let d=distance(o,{x,y});if(d<best){best=d;i=n}});if(i>=0){this.objects.splice(i,1);return 'Объект удалён'}return 'Здесь нет объекта'}
  if(this.objects.length>=60)return 'Лимит: 60 объектов. Удалите лишние.';
  if(kind==='obstacle'&&(Math.abs(x-this.fly.x)<90&&Math.abs(y-this.fly.y)<70))return 'Барьер слишком близко к мухе';
  if(this.blocked(x,y,kind==='obstacle'?65:25))return 'Выберите свободное место дальше от края';
  if(kind==='obstacle'&&this.objects.some(o=>Math.abs(o.x-x)<85&&Math.abs(o.y-y)<65))return 'Барьер перекрывает другой объект';
  this.objects.push({kind,x,y,id:this.nextId++,vx:70,vy:35});return {food:'Добавлена еда',obstacle:'Добавлено препятствие',object:'Добавлен движущийся объект'}[kind]
 }
 step(dt=1/60){if(!(dt>0&&dt<=.1))throw Error('Шаг должен быть от 0 до 0.1 с');this.time+=dt;const f=this.fly;
  for(const o of this.objects.filter(o=>o.kind==='object')){let x=o.x+o.vx*dt,y=o.y+o.vy*dt;if(this.blocked(x,o.y,20))o.vx*=-1;else o.x=x;if(this.blocked(o.x,y,20))o.vy*=-1;else o.y=y}
  if(this.predator){const a=Math.atan2(f.y-this.hunter.y,f.x-this.hunter.x);this.hunter.x=clamp(this.hunter.x+Math.cos(a)*47*dt,25,W-25);this.hunter.y=clamp(this.hunter.y+Math.sin(a)*47*dt,25,H-25)}
  let nearestFood=null,fd=Infinity;for(const o of this.objects.filter(o=>o.kind==='food')){const d=distance(f,o);if(d<fd){fd=d;nearestFood=o}}
  let nearestThreat=null,td=Infinity;for(const o of [...this.objects.filter(o=>o.kind==='object'),...(this.predator?[this.hunter]:[])]){const d=distance(f,o);if(d<td){td=d;nearestThreat=o}}
  const raw={odor:nearestFood?Math.exp(-fd/280):0,vision:nearestThreat?clamp(1-td/380):0,touch:this.touch&&this.touch.until>this.time?clamp((this.touch.until-this.time)/1.5):0,heat:clamp((this.temperature-29)/11),light:this.light?.65:0};
  for(const k of Object.keys(raw))this.sensors[k]+=(raw[k]-this.sensors[k])*(1-Math.exp(-dt/.12));
  this.dn+=(clamp(this.sensors.vision*this.visualGain)-this.dn)*(1-Math.exp(-dt/.18));
  const s=this.sensors;let target=f.angle,reason='explore',drive=.2;
  if(this.time>=this.nextWander){this.wander=(this.random()-.5)*1.5;this.nextWander=this.time+.8}target=f.angle+this.wander;
  if(s.light>.1){target=Math.atan2(95-f.y,820-f.x);reason='light';drive=s.light*.45}
  if(nearestFood&&s.odor>drive){target=Math.atan2(nearestFood.y-f.y,nearestFood.x-f.x);reason='food';drive=s.odor}
  if(nearestThreat&&this.dn*2.8>drive&&this.dn>.08){target=Math.atan2(f.y-nearestThreat.y,f.x-nearestThreat.x);reason='escape';drive=this.dn*2.8}
  if(s.touch>.18){target=this.touch?Math.atan2(f.y-this.touch.y,f.x-this.touch.x):f.angle+Math.PI;if(this.touch&&distance(f,this.touch)<1)target=f.angle+Math.PI/2;reason='touch';drive=s.touch*3}
  let avoid=null;for(const o of this.objects.filter(o=>o.kind==='obstacle')){const q={x:clamp(f.x,o.x-55,o.x+55),y:clamp(f.y,o.y-35,o.y+35)};if(distance(f,q)<55&&Math.cos(wrap(Math.atan2(q.y-f.y,q.x-f.x)-f.angle))>-.15){avoid=q;break}}
  if(f.x<48)avoid={x:0,y:f.y};else if(f.x>W-48)avoid={x:W,y:f.y};else if(f.y<48)avoid={x:f.x,y:0};else if(f.y>H-48)avoid={x:f.x,y:H};
  if(avoid){target=Math.atan2(f.y-avoid.y,f.x-avoid.x);reason='barrier';drive=1}
  let speed=52*clamp(1+(this.temperature-25)*.035,.35,1.35);if(reason==='escape'||reason==='touch')speed*=1.9;if(s.heat>.1)speed*=1-.55*s.heat;
  if(nearestFood&&fd<24&&reason==='food'){this.objects=this.objects.filter(o=>o!==nearestFood);this.eating=this.time+1.2;this.notice='Еда достигнута и съедена'}
  if(this.eating>this.time&&!['escape','touch','barrier'].includes(reason)){speed=0;reason='eat'}
  const error=wrap(target-f.angle),desiredTurn=reason==='eat'?0:clamp(error*3,-3,3),base=speed/140,diff=desiredTurn/8;
  this.motor.left=clamp(base+diff);this.motor.right=clamp(base-diff);f.turn=(this.motor.left-this.motor.right)*4;f.angle=wrap(f.angle+f.turn*dt);
  const actualSpeed=(this.motor.left+this.motor.right)*70,x=f.x+Math.cos(f.angle)*actualSpeed*dt,y=f.y+Math.sin(f.angle)*actualSpeed*dt;this.collision=this.blocked(x,y);
  if(!this.collision){f.x=x;f.y=y;f.speed=actualSpeed}else{f.speed=0;reason='barrier'}this.reason=reason;this.drive=clamp(drive);this.target=target;this.error=error;
  if(this.time-this.lastSample>=.1-1e-8){this.lastSample=this.time;this.path.push({x:f.x,y:f.y,t:this.time});this.history.push({t:this.time,sensory:Math.max(...Object.values(s)),integration:this.reason==='escape'?this.dn:this.drive,motor:(this.motor.left+this.motor.right)/2});this.path=this.path.filter(p=>p.t>this.time-16);this.history=this.history.filter(p=>p.t>this.time-20)}
 }
}
