import{_ as e}from"./lane-oJjY4rTS.js";import{a as t,c as n,i as r,n as i,o as a,r as o,s,t as c}from"./Texture-BaNFWQEg.js";var l=new r,u=new n,d=new n,f=class extends o{constructor(e,{near:t=.1,far:i=100,fov:a=45,aspect:o=1,left:s,right:c,bottom:l,top:u,zoom:d=1}={}){super(),Object.assign(this,{near:t,far:i,fov:a,aspect:o,left:s,right:c,bottom:l,top:u,zoom:d}),this.projectionMatrix=new r,this.viewMatrix=new r,this.projectionViewMatrix=new r,this.worldPosition=new n,this.type=s||c?`orthographic`:`perspective`,this.type===`orthographic`?this.orthographic():this.perspective()}perspective({near:e=this.near,far:t=this.far,fov:n=this.fov,aspect:r=this.aspect}={}){return Object.assign(this,{near:e,far:t,fov:n,aspect:r}),this.projectionMatrix.fromPerspective({fov:Math.PI/180*n,aspect:r,near:e,far:t}),this.type=`perspective`,this}orthographic({near:e=this.near,far:t=this.far,left:n=this.left||-1,right:r=this.right||1,bottom:i=this.bottom||-1,top:a=this.top||1,zoom:o=this.zoom}={}){return Object.assign(this,{near:e,far:t,left:n,right:r,bottom:i,top:a,zoom:o}),n/=o,r/=o,i/=o,a/=o,this.projectionMatrix.fromOrthogonal({left:n,right:r,bottom:i,top:a,near:e,far:t}),this.type=`orthographic`,this}updateMatrixWorld(){return super.updateMatrixWorld(),this.viewMatrix.inverse(this.worldMatrix),this.worldMatrix.getTranslation(this.worldPosition),this.projectionViewMatrix.multiply(this.projectionMatrix,this.viewMatrix),this}updateProjectionMatrix(){return this.type===`perspective`?this.perspective():this.orthographic()}lookAt(e){return super.lookAt(e,!0),this}project(e){return e.applyMatrix4(this.viewMatrix),e.applyMatrix4(this.projectionMatrix),this}unproject(e){return e.applyMatrix4(l.inverse(this.projectionMatrix)),e.applyMatrix4(this.worldMatrix),this}updateFrustum(){this.frustum||=[new n,new n,new n,new n,new n,new n];let e=this.projectionViewMatrix;this.frustum[0].set(e[3]-e[0],e[7]-e[4],e[11]-e[8]).constant=e[15]-e[12],this.frustum[1].set(e[3]+e[0],e[7]+e[4],e[11]+e[8]).constant=e[15]+e[12],this.frustum[2].set(e[3]+e[1],e[7]+e[5],e[11]+e[9]).constant=e[15]+e[13],this.frustum[3].set(e[3]-e[1],e[7]-e[5],e[11]-e[9]).constant=e[15]-e[13],this.frustum[4].set(e[3]-e[2],e[7]-e[6],e[11]-e[10]).constant=e[15]-e[14],this.frustum[5].set(e[3]+e[2],e[7]+e[6],e[11]+e[10]).constant=e[15]+e[14];for(let e=0;e<6;e++){let t=1/this.frustum[e].distance();this.frustum[e].multiply(t),this.frustum[e].constant*=t}}frustumIntersectsMesh(e,t=e.worldMatrix){if(!e.geometry.attributes.position||((!e.geometry.bounds||e.geometry.bounds.radius===1/0)&&e.geometry.computeBoundingSphere(),!e.geometry.bounds))return!0;let n=u;n.copy(e.geometry.bounds.center),n.applyMatrix4(t);let r=e.geometry.bounds.radius*t.getMaxScaleOnAxis();return this.frustumIntersectsSphere(n,r)}frustumIntersectsSphere(e,t){let n=d;for(let r=0;r<6;r++){let i=this.frustum[r];if(n.copy(i).dot(e)+i.constant<-t)return!1}return!0}},p=1.5926,m=.016,h=.059,g=26,_=Math.PI,v=19e5,y=.04,b=.6,x=.16,S=`GestureEvent`in window&&matchMedia(`(pointer: fine)`).matches?250:0,C=.06,w={x:-.13,y:-.36,z:-.035},T=`
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
attribute float side;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
varying float vSide;
void main() {
  vec4 p = modelViewMatrix * vec4(position, 1.0);
  vP = p.xyz;
  vN = normalMatrix * normal;
  vUv = uv;
  vSide = side;
  gl_Position = projectionMatrix * p;
}`,E=`
precision highp float;
uniform sampler2D tFace;
uniform sampler2D tBack;
uniform float uAlpha;
uniform vec2 uShape; // the card's width over its height, and its corner
varying vec3 vN;
varying vec3 vP;
varying vec2 vUv;
varying float vSide;

// The room, seen in the gloss: long soft lights standing around the card. Each is narrow across and
// leans a little, so on the card it is a slanted band that travels as the card turns.
float strip(vec3 d, float at, float width, float soft) {
  float across = abs(atan(d.x, d.z) - at - d.y * 0.42);
  return smoothstep(width + soft, width, across) * smoothstep(-1.0, -0.35, d.y) * smoothstep(1.0, 0.6, d.y);
}
float room(vec3 d) {
  float l = 0.012;
  // the key and its thin companion: at rest they stand just off the card's left edge, so the
  // artwork is clean until the card moves
  l += 1.0 * strip(d, -1.3, 0.045, 0.07);
  l += 0.5 * strip(d, -1.5, 0.012, 0.035);
  l += 0.07 * strip(d, -0.3, 0.1, 0.4);    // a wide soft one: the plastic is never quite matt
  l += 0.8 * strip(d, 0.78, 0.05, 0.08);   // on the right, met when the card leans the other way
  l += 0.5 * strip(d, 2.1, 0.08, 0.12);    // behind: they pass over the card as it spins
  l += 0.5 * strip(d, -2.4, 0.08, 0.12);
  return l;
}

void main() {
  vec3 n = normalize(vN);
  vec3 v = normalize(-vP);
  float facing = max(dot(n, v), 0.0);
  float gloss = room(reflect(-v, n));
  float fresnel = 0.04 + 0.96 * pow(1.0 - facing, 5.0);

  vec3 art = mix(texture2D(tFace, vUv).rgb, texture2D(tBack, vUv).rgb, step(0.5, vSide));
  // the white core of the plastic, seen on the edge
  vec3 base = vSide > 1.5 ? vec3(0.8, 0.81, 0.78) : art;
  // lit from the upper left; the artwork keeps its own colours when it faces the viewer
  float lit = 0.9 + 0.14 * max(dot(n, normalize(vec3(-0.45, 0.55, 0.7))), 0.0);
  vec3 col = base * lit * mix(0.62, 1.0, smoothstep(0.0, 0.5, facing));
  col += vec3(1.0, 1.0, 0.97) * gloss * (0.36 + fresnel * 0.64) * (vSide > 1.5 ? 1.6 : 1.0);
  // the rim of the plastic catches the light: a thin line inside the outline, so a dark card
  // keeps its shape on a dark ground
  vec2 q = abs((vUv - 0.5) * vec2(uShape.x, 1.0)) - (vec2(uShape.x, 1.0) * 0.5 - uShape.y);
  float inside = uShape.y - length(max(q, 0.0)) - min(max(q.x, q.y), 0.0);
  col += vec3(0.17) * smoothstep(0.014, 0.002, inside) * step(vSide, 1.5);
  gl_FragColor = vec4(col * uAlpha, uAlpha);
}`,D=`
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,O=`
precision highp float;
uniform float uAlpha;
uniform float uSpread;
varying vec2 vUv;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  p.x /= mix(0.3, 1.0, uSpread);
  float a = exp(-dot(p, p) * 3.2) * 0.8 * uAlpha;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}`;function k(e){let t=[],n=p/2-h,r=.441;for(let[e,i,a]of[[n,r,0],[-.7373000000000001,r,90],[-.7373000000000001,-.441,180],[n,-.441,270]])for(let n=0;n<=10;n++){let r=(a+90*n/10)*Math.PI/180;t.push({x:e+Math.cos(r)*h,y:i+Math.sin(r)*h,nx:Math.cos(r),ny:Math.sin(r)})}let i=[],a=[],o=[],c=[],l=[],u=(e,t,n,r,s,l,u,d,f)=>(i.push(e,t,n),a.push(r,s,l),o.push(u,d),c.push(f),i.length/3-1),d=t.length,f=u(0,0,m/2,0,0,1,.5,.5,0);for(let e of t)u(e.x,e.y,m/2,0,0,1,e.x/p+.5,.5-e.y,0);for(let e=0;e<d;e++)l.push(f,f+1+e,f+1+(e+1)%d);let g=u(0,0,-.016/2,0,0,-1,.5,.5,1);for(let e of t)u(e.x,e.y,-.016/2,0,0,-1,.5-e.x/p,.5-e.y,1);for(let e=0;e<d;e++)l.push(g,g+1+(e+1)%d,g+1+e);for(let e=0;e<d;e++){let n=t[e],r=t[(e+1)%d],i=u(n.x,n.y,m/2,n.nx,n.ny,0,0,0,2);u(r.x,r.y,m/2,r.nx,r.ny,0,0,0,2),u(r.x,r.y,-.016/2,r.nx,r.ny,0,0,0,2),u(n.x,n.y,-.016/2,n.nx,n.ny,0,0,0,2),l.push(i,i+3,i+2,i,i+2,i+1)}return new s(e,{position:{size:3,data:new Float32Array(i)},normal:{size:3,data:new Float32Array(a)},uv:{size:2,data:new Float32Array(o)},side:{size:1,data:new Float32Array(c)},index:{data:new Uint16Array(l)}})}async function A(e){if(`createImageBitmap`in window)try{return await createImageBitmap(await(await fetch(e)).blob())}catch{}let t=new Image;return t.src=e,await t.decode(),t}var j=()=>new Promise(e=>`requestIdleCallback`in window?requestIdleCallback(()=>e(),{timeout:200}):setTimeout(e,60)),M=class{canvas;opts;renderer;camera;scene=new o;pose=new o;card;shadow;u={tFace:{value:null},tBack:{value:null},uAlpha:{value:0},uShape:{value:[p,h]}};us={uAlpha:{value:0},uSpread:{value:1}};sides=new Map;loading=new Map;read=new Map;busy=!1;first=``;flying=null;awaited=!1;shown=``;wanted=``;zone=0;s={yaw:0,tiltX:0,tiltY:0,lean:0,x:0,y:0,z:0,tumbleX:0,tumbleZ:0,alpha:0};was={...this.s};frame=0;live=!1;cleanup=[];leanX=e.quickTo(this.s,`tiltX`,{duration:.6,ease:`power3.out`,onUpdate:()=>this.invalidate()});leanY=e.quickTo(this.s,`tiltY`,{duration:.6,ease:`power3.out`,onUpdate:()=>this.invalidate()});constructor(e,n){this.canvas=e,this.opts=n,this.renderer=new t({canvas:e,dpr:Math.min(devicePixelRatio,n.maxDpr),alpha:!0,premultipliedAlpha:!0,antialias:!0,depth:!1,preserveDrawingBuffer:n.preserve,powerPreference:`default`});let r=this.renderer.gl;r.clearColor(0,0,0,0),this.camera=new f(r,{fov:g,near:.1,far:50}),this.card=new i(r,{geometry:k(r),program:new a(r,{vertex:T,fragment:E,uniforms:this.u,transparent:!0,depthTest:!1,depthWrite:!1})}),this.card.program.setBlendFunc(r.ONE,r.ONE),this.card.renderOrder=1;let o=new a(r,{vertex:D,fragment:O,uniforms:this.us,transparent:!0,depthWrite:!1,cullFace:!1});this.shadow=new i(r,{geometry:new s(r,{position:{size:3,data:new Float32Array([-1.25,-.2,0,1.25,-.2,0,1.25,.2,0,-1.25,.2,0])},uv:{size:2,data:new Float32Array([0,0,1,0,1,1,0,1])},index:{data:new Uint16Array([0,1,2,0,2,3])}}),program:o}),this.shadow.position.set(0,-.78,-.4),this.shadow.setParent(this.scene),this.pose.setParent(this.scene),this.card.setParent(this.pose);let c=new ResizeObserver(()=>this.resize());c.observe(e),this.cleanup.push(()=>c.disconnect());let l=e=>{e.preventDefault(),this.destroy(),n.onLost()};if(e.addEventListener(`webglcontextlost`,l),this.cleanup.push(()=>e.removeEventListener(`webglcontextlost`,l)),S){let t=!1,n=new IntersectionObserver(([e])=>t=e.isIntersecting);n.observe(e);let r=setInterval(()=>t&&!document.hidden&&this.invalidate(),S);this.cleanup.push(()=>(n.disconnect(),clearInterval(r)))}}load(e,t,n,r=!1){r&&(this.first=e);let i=this.loading.get(e);return i||(i=Promise.all([A(t),A(n)]).then(([t,n])=>new Promise(r=>{this.read.set(e,{face:t,back:n,done:r}),this.upload()})),this.loading.set(e,i)),i}async upload(){if(this.busy)return;this.busy=!0;let e=this.renderer.gl;for(;this.read.size&&this.cleanup.length;){let t=this.read.has(this.first)?this.first:this.read.keys().next().value,{face:n,back:r,done:i}=this.read.get(t);this.read.delete(t);let a=async()=>{this.awaited&&t===this.first||(await this.flying,await j())},o=async t=>{await a();let n=new c(e,{image:t,flipY:!1,anisotropy:8});return this.cleanup.length&&n.update(),n},s={face:await o(n),back:await o(r)};if(await a(),!this.cleanup.length)break;this.sides.set(t,s),this.warm(s),i()}this.busy=!1}warm(e){let t=this.renderer.gl,{tFace:n,tBack:r}=this.u,i={face:n.value,back:r.value};n.value=e.face,r.value=e.back,t.enable(t.SCISSOR_TEST),t.scissor(t.drawingBufferWidth>>1,t.drawingBufferHeight>>1,1,1),this.renderer.render({scene:this.scene,camera:this.camera}),t.disable(t.SCISSOR_TEST),n.value=i.face,r.value=i.back,cancelAnimationFrame(this.frame),this.render()}get current(){return this.shown}get turned(){return Math.round(this.target()/_)%2!=0}show(e,t=!1){if(this.wanted=e,t||!this.shown){this.put(),this.invalidate();return}if(e===this.shown&&!this.turned)return;let n=Math.ceil((this.s.yaw+_-.001)/(2*_))*2*_;this.spin(n,1.15,`power4.out`),this.hop(.42)}flip(){this.spin(this.target()+_,.95,`back.out(1.3)`),this.hop(.3)}enter(){let t=this.s;e.killTweensOf(t,`yaw,lean,x,y,z,tumbleX,tumbleZ,alpha`),this.yawTo=0,e.fromTo(t,{yaw:-3*_,x:1.5,y:-1.1,z:-7,tumbleX:1.3,tumbleZ:-.9},{yaw:0,x:0,y:0,z:0,tumbleX:0,tumbleZ:0,duration:1.6,ease:`expo.out`,onUpdate:this.invalidate}),this.flying=new Promise(e=>setTimeout(e,1700)),e.fromTo(t,{alpha:0},{alpha:1,duration:.35,ease:`power1.out`})}stand(){this.s.alpha=1,this.invalidate()}tilt(e,t){this.leanY(e*.34),this.leanX(t*.2)}release(){this.leanY(0),this.leanX(0)}grab(){e.killTweensOf(this.s,`yaw,lean`)}drag(e,t){this.s.yaw+=e,this.s.lean=Math.max(-.5,Math.min(.5,this.s.lean+t)),this.invalidate()}drop(t){let n=Math.max(-2.2*_,Math.min(2.2*_,t*.28)),r=Math.round((this.s.yaw+n)/_)*_;this.spin(r,.9+Math.min(.5,Math.abs(n)/8),`back.out(1.15)`),e.to(this.s,{lean:0,duration:.9,ease:`power3.out`,overwrite:`auto`,onUpdate:this.invalidate})}yawTo=0;target(){return this.yawTo}spin(t,n,r){this.yawTo=t,e.to(this.s,{yaw:t,duration:n,ease:r,overwrite:`auto`,onUpdate:this.invalidate})}hop(t){e.timeline({onUpdate:this.invalidate}).to(this.s,{z:t,duration:.28,ease:`power2.out`,overwrite:`auto`}).to(this.s,{z:0,duration:.75,ease:`power3.inOut`})}put(){let e=this.sides.get(this.wanted);e&&(this.u.tFace.value=e.face,this.u.tBack.value=e.back,this.shown=this.wanted,this.canvas.dataset.card=this.shown)}resize(){let e=this.canvas.clientWidth,t=this.canvas.clientHeight;if(!e||!t)return;this.renderer.dpr=Math.min(devicePixelRatio,this.opts.maxDpr,Math.sqrt(v/(e*t))),this.renderer.setSize(e,t),this.canvas.style.width=``,this.canvas.style.height=``,this.camera.perspective({aspect:e/t});let n=this.opts.frame,r=Math.min(n.clientWidth*.72,n.clientHeight*.74*p),i=p*e/r;this.camera.position.z=i/e*t/(2*Math.tan(g*Math.PI/360)),this.invalidate()}invalidate=()=>{!this.frame&&this.cleanup.length&&(this.frame=requestAnimationFrame(this.render))};render=()=>{this.frame=0;let e=this.s,t=Math.floor((e.yaw+_/2)/_);if(t!==this.zone&&(this.zone=t,this.wanted!==this.shown&&this.put()),!this.u.tFace.value)return;let n=this.was,r=Math.abs(e.yaw-n.yaw)+Math.abs(e.tumbleX-n.tumbleX)+Math.abs(e.tumbleZ-n.tumbleZ),i=Math.min(this.opts.blur,1+Math.floor(r/y));this.us.uAlpha.value=e.alpha*Math.max(0,1-Math.abs(e.z)*.5-Math.abs(e.y)),this.us.uSpread.value=Math.abs(Math.cos(e.yaw+w.y+e.tiltY)),this.u.uAlpha.value=e.alpha/i;for(let t=0;t<i;t++){let a=t/i*Math.min(b,x/r),o=(e,t)=>e+(t-e)*a;this.pose.position.set(o(e.x,n.x),o(e.y,n.y)+C,o(e.z,n.z)),this.pose.rotation.set(w.x+o(e.tiltX,n.tiltX)+o(e.lean,n.lean),w.y+o(e.tiltY,n.tiltY),w.z),this.card.rotation.set(o(e.tumbleX,n.tumbleX),o(e.yaw,n.yaw),o(e.tumbleZ,n.tumbleZ)),this.shadow.visible=!t,this.renderer.render({scene:this.scene,camera:this.camera,clear:!t})}this.shadow.visible=!0,Object.assign(n,e),this.live||(this.live=!0,this.canvas.dataset.live=`true`)};destroy(){this.live=!1,e.killTweensOf(this.s),cancelAnimationFrame(this.frame);for(let e of this.cleanup)e();this.cleanup=[],this.canvas.dataset.live=`false`}};export{M as ClubCard};