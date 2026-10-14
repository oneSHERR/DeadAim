import { project, cameraPoint, rayHit } from './engine.js';
import { wallPanels } from './scenarios.js';

export class ArenaRenderer {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.resize();}
  resize(){const b=this.canvas.getBoundingClientRect();this.w=b.width;this.h=b.height;const ratio=Math.min(globalThis.devicePixelRatio||1,2);this.canvas.width=Math.round(this.w*ratio);this.canvas.height=Math.round(this.h*ratio);this.ctx.setTransform(ratio,0,0,ratio,0,0);}
  draw(game,yaw,pitch,settings,particles=[],flash=0){
    const c=this.ctx,w=this.w,h=this.h,eye=game.eyeX,stretch=settings.aspect==='stretched';
    const local=p=>({...p,x:p.x-eye});
    const pr=p=>project(local(p),yaw,pitch,w,h,stretch);
    const line=(a,b,color)=>{let ca=cameraPoint(local(a),yaw,pitch),cb=cameraPoint(local(b),yaw,pitch);if(ca.z<.1&&cb.z<.1)return;if(ca.z<.1||cb.z<.1){const t=(.1-ca.z)/(cb.z-ca.z),p={x:ca.x+(cb.x-ca.x)*t,y:ca.y+(cb.y-ca.y)*t,z:.1};if(ca.z<.1)ca=p;else cb=p;}const fy=h*2/3,fx=stretch?w/2:fy;c.strokeStyle=color;c.lineWidth=1;c.beginPath();c.moveTo(w/2+ca.x/ca.z*fx,h/2-ca.y/ca.z*fy);c.lineTo(w/2+cb.x/cb.z*fx,h/2-cb.y/cb.z*fy);c.stroke();};
    // Clip polygons in camera space so cover continues to occlude while turning.
    const polygon=(points,fill,stroke)=>{let pts=points.map(p=>cameraPoint(local(p),yaw,pitch)),out=[];for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],ia=a.z>=.1,ib=b.z>=.1;if(ia)out.push(a);if(ia!==ib){const t=(.1-a.z)/(b.z-a.z);out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:.1});}}if(out.length<3)return;const fy=h*2/3,fx=stretch?w/2:fy;c.beginPath();out.forEach((p,i)=>{const x=w/2+p.x/p.z*fx,y=h/2-p.y/p.z*fy;i?c.lineTo(x,y):c.moveTo(x,y);});c.closePath();c.fillStyle=fill;c.fill();if(stroke){c.strokeStyle=stroke;c.lineWidth=1;c.stroke();}};
    c.fillStyle='#141b17';c.fillRect(0,0,w,h);const glow=c.createRadialGradient(w/2,h*.4,0,w/2,h/2,w*.75);glow.addColorStop(0,'#2b382b');glow.addColorStop(1,'#101611');c.fillStyle=glow;c.fillRect(0,0,w,h);
    for(let x=-24;x<=24;x+=2){line({x,y:-4,z:-20},{x,y:-4,z:24},'#354432');line({x,y:-4,z:24},{x,y:12,z:24},'#33412f');}
    for(let z=-20;z<=24;z+=2)line({x:-24,y:-4,z},{x:24,y:-4,z},'#354432');
    for(let y=-4;y<=12;y+=2)line({x:-24,y,z:24},{x:24,y,z:24},'#33412f');
    if(['wall3','clear50','six'].includes(game.mode)){
      polygon([{x:-10,y:-3.8,z:15.7},{x:10,y:-3.8,z:15.7},{x:10,y:4.4,z:15.7},{x:-10,y:4.4,z:15.7}],'#1b2721','#6f8c49');
      for(let x=-9;x<=9;x+=1.5)line({x,y:-3.8,z:15.65},{x,y:4.4,z:15.65},'#334137');
      for(let y=-3;y<=4;y+=1.4)line({x:-10,y,z:15.65},{x:10,y,z:15.65},'#334137');
    }
    const ordered=[...game.targets].sort((a,b)=>cameraPoint(local(b),yaw,pitch).z-cameraPoint(local(a),yaw,pitch).z);
    for(const t of ordered){const p=pr(t);if(!p)continue;const rx=t.r/p.z*p.fx,ry=t.r/p.z*p.fy;if(p.x+rx<0||p.x-rx>w||p.y+ry<0||p.y-ry>h)continue;const active=game.mode==='track'&&game.held&&rayHit(local(t),t.r,yaw,pitch);c.save();c.translate(p.x,p.y);c.scale(rx/ry,1);const wall=game.mode==='wall3'||game.mode==='clear50';c.shadowColor=wall||active?'#b8e678':'#ed7042';c.shadowBlur=wall?7:12;const g=c.createRadialGradient(-ry*.3,-ry*.35,ry*.05,0,0,ry);g.addColorStop(0,wall||active?'#e6ffb4':'#ffc096');g.addColorStop(.6,wall||active?'#a8d969':'#f88352');g.addColorStop(1,wall||active?'#5d8534':'#a84029');c.fillStyle=g;c.beginPath();c.arc(0,0,ry,0,6.29);c.fill();c.shadowBlur=0;c.strokeStyle=wall?'#d9ff9e':'#ffb98a';c.stroke();if(wall){c.fillStyle='#23321c';c.beginPath();c.arc(0,0,Math.max(1,ry*.14),0,6.29);c.fill();}c.restore();}
    for(const p of particles){const q=pr(p);if(!q)continue;c.strokeStyle=`rgba(197,249,107,${p.life/.3})`;c.beginPath();c.arc(q.x,q.y,(.3-p.life)*80+7,0,6.29);c.stroke();}
    for(const p of wallPanels(game.mode))polygon([{x:p.x1,y:p.y1,z:p.z},{x:p.x2,y:p.y1,z:p.z},{x:p.x2,y:p.y2,z:p.z},{x:p.x1,y:p.y2,z:p.z}],'#202b24','#68824b');
    if(flash>0){c.strokeStyle=`rgba(255,255,255,${flash*5})`;c.beginPath();for(const [x,y]of [[-1,-1],[1,-1],[-1,1],[1,1]]){c.moveTo(w/2+x*10,h/2+y*10);c.lineTo(w/2+x*16,h/2+y*16);}c.stroke();}
  }
}
