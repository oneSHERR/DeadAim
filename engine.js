export const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const radians=d=>d*Math.PI/180;
export function sensitivityMetrics(sens,dpi){return {edpi:sens*dpi,cm360:360*2.54/(sens*.022*dpi)};}
export function rotateMouse(yaw,pitch,dx,dy,sens,calibration=1){return {yaw:(yaw+dx*radians(.022)*sens*calibration)%(Math.PI*2),pitch:clamp(pitch-dy*radians(.022)*sens*calibration,-1.48,1.48)};}
export function cameraPoint(p,yaw,pitch){const x=p.x*Math.cos(yaw)-p.z*Math.sin(yaw),z=p.x*Math.sin(yaw)+p.z*Math.cos(yaw);return {x,y:p.y*Math.cos(pitch)-z*Math.sin(pitch),z:p.y*Math.sin(pitch)+z*Math.cos(pitch)};}
export function rayHit(p,r,yaw,pitch){const q=cameraPoint(p,yaw,pitch);return q.z>0&&q.x*q.x+q.y*q.y<=r*r;}
export function project(p,yaw,pitch,w,h,stretched=false){const q=cameraPoint(p,yaw,pitch);if(q.z<.1)return null;const fy=h*2/3,fx=stretched?w/2:fy;return {x:w/2+q.x/q.z*fx,y:h/2-q.y/q.z*fy,z:q.z,fx,fy};}
