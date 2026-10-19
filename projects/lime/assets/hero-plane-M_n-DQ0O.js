import{_ as e,s as t}from"./lane-oJjY4rTS.js";import{a as n,n as r,o as i,s as a,t as o}from"./Texture-BaNFWQEg.js";var s=class extends a{constructor(e,{attributes:t={}}={}){Object.assign(t,{position:{size:2,data:new Float32Array([-1,-1,3,-1,-1,3])},uv:{size:2,data:new Float32Array([0,0,2,0,0,2])}}),super(e,t)}},c=`
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`,l=`
precision highp float;

uniform sampler2D tA;
uniform sampler2D tB;
uniform vec2 uSizeA;
uniform vec2 uSizeB;
uniform vec2 uRes;
uniform float uMix;      // 0 → 1: A is replaced by B
uniform float uDir;      // +1 the light travels left to right, -1 right to left
uniform float uDevelop;  // 0 → 1: the first photograph settles in
uniform float uScroll;   // 0 → 1: how far the hero has left the screen
uniform float uVel;      // scroll velocity, eased, roughly -1..1
uniform vec2 uPointer;   // eased pointer, -1..1
uniform vec3 uLime;
varying vec2 vUv;

const float BASE_ZOOM = 1.1;

vec2 cover(vec2 uv, vec2 size, float zoom, vec2 shift) {
  float ri = size.x / size.y;
  float rr = uRes.x / uRes.y;
  vec2 s = rr > ri ? vec2(1.0, ri / rr) : vec2(rr / ri, 1.0);
  return (uv - 0.5) * s / zoom + 0.5 + shift * s;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  vec2 uv = vUv;

  // Fast scrolling stretches the plane slightly along the direction of travel.
  uv.y += (uv.y - 0.5) * uVel * 0.045;

  // The light pass: a soft diagonal front crossing the frame.
  float d = uv.x * 0.86 + (1.0 - uv.y) * 0.14;
  d = uDir > 0.0 ? d : 1.0 - d;
  float w = 0.26;
  float p = uMix * (1.0 + w);
  float swept = smoothstep(p, p - w, d);
  float c = d - (p - w * 0.5);
  float core = exp(-(c * c) / (2.0 * 0.0011));
  float skirt = exp(-(c * c) / (2.0 * 0.0085));
  float fade = smoothstep(0.0, 0.1, uMix) * smoothstep(1.0, 0.86, uMix);
  float band = (core * 0.75 + skirt * 0.25) * fade;

  // The front bends what is behind it, like light through a thick edge.
  vec2 bend = vec2(0.86, -0.14) * uDir * band * 0.03;
  vec2 shift = uPointer * vec2(-0.011, 0.008) + vec2(0.0, uScroll * 0.02);
  float settle = (1.0 - uDevelop) * 0.1;

  vec3 a = texture2D(tA, cover(uv + bend, uSizeA, BASE_ZOOM + settle + uMix * 0.03, shift)).rgb;
  vec3 b = texture2D(tB, cover(uv - bend * 0.6, uSizeB, BASE_ZOOM + (1.0 - uMix) * 0.07, shift)).rgb;
  vec3 col = mix(a, b, swept);

  // Lime is the light: a tinted band with a white-hot core.
  col += uLime * (skirt * 0.2 + core * 0.5) * fade + vec3(1.0) * core * core * fade * 0.28;

  // The first frame arrives overexposed and warm, then settles.
  col = mix(col * 1.7 + uLime * 0.16, col, uDevelop);

  float vig = smoothstep(1.3, 0.35, length((vUv - 0.5) * vec2(1.05, 1.0)));
  col *= mix(0.74, 1.0, vig);
  col *= 1.0 - uScroll * 0.35;

  col += (hash(gl_FragCoord.xy) - 0.5) * 0.03;
  gl_FragColor = vec4(col, 1.0);
}`,u=250,d=class{canvas;renderer;mesh;texA;texB;u;pointerTarget={x:0,y:0};velTarget=0;dirty=!0;visible=!0;warm=`GestureEvent`in window&&matchMedia(`(pointer: fine)`).matches?u:0;drawn=0;mixTween=null;pending=null;cleanup=[];constructor(t,a){this.canvas=t,this.renderer=new n({canvas:t,dpr:Math.min(devicePixelRatio,a.maxDpr),alpha:!1,antialias:!1,depth:!1,preserveDrawingBuffer:a.preserve,powerPreference:`default`});let u=this.renderer.gl,d=()=>new o(u,{generateMipmaps:!1,minFilter:u.LINEAR,magFilter:u.LINEAR});this.texA=d(),this.texB=d(),this.u={tA:{value:this.texA},tB:{value:this.texB},uSizeA:{value:[1,1]},uSizeB:{value:[1,1]},uRes:{value:[1,1]},uMix:{value:0},uDir:{value:1},uDevelop:{value:0},uScroll:{value:0},uVel:{value:0},uPointer:{value:[0,0]},uLime:{value:[.705,.84,.18]}};let f=new i(u,{vertex:c,fragment:l,uniforms:this.u,depthTest:!1,depthWrite:!1});this.mesh=new r(u,{geometry:new s(u),program:f});let p=new ResizeObserver(()=>this.resize());p.observe(t),this.cleanup.push(()=>p.disconnect());let m=new IntersectionObserver(([e])=>{this.visible=e.isIntersecting,this.dirty=!0});if(m.observe(t),this.cleanup.push(()=>m.disconnect()),a.pointer){let e=e=>{this.pointerTarget.x=e.clientX/innerWidth*2-1,this.pointerTarget.y=e.clientY/innerHeight*2-1};addEventListener(`pointermove`,e,{passive:!0}),this.cleanup.push(()=>removeEventListener(`pointermove`,e))}let h=e=>{e.preventDefault(),this.destroy(),a.onLost()};t.addEventListener(`webglcontextlost`,h),this.cleanup.push(()=>t.removeEventListener(`webglcontextlost`,h)),e.ticker.add(this.tick),this.cleanup.push(()=>e.ticker.remove(this.tick)),this.resize()}setImage(e){this.texA.image=e,this.u.uSizeA.value=[e.naturalWidth,e.naturalHeight],this.dirty=!0}set develop(e){this.u.uDevelop.value=e,this.dirty=!0}set scroll(e){e!==this.u.uScroll.value&&(this.u.uScroll.value=e,this.dirty=!0)}set velocity(e){this.velTarget=Math.max(-1,Math.min(1,e/90))}transitionTo(n,r,i=!1){if(this.mixTween&&(this.mixTween.kill(),this.commit()),i){this.setImage(n);return}this.pending=n,this.texB.image=n,this.u.uSizeB.value=[n.naturalWidth,n.naturalHeight],this.u.uDir.value=r,this.u.uMix.value=0,this.mixTween=e.to(this.u.uMix,{value:1,duration:t.pass,ease:`power2.inOut`,onUpdate:()=>this.dirty=!0,onComplete:()=>this.commit()})}commit(){this.pending&&this.setImage(this.pending),this.pending=null,this.mixTween=null,this.u.uMix.value=0,this.dirty=!0}resize(){let e=this.canvas.clientWidth,t=this.canvas.clientHeight;if(!e||!t)return;this.renderer.setSize(e,t),this.canvas.style.width=``,this.canvas.style.height=``;let n=this.renderer.gl;this.u.uRes.value=[n.drawingBufferWidth,n.drawingBufferHeight],this.dirty=!0}tick=()=>{if(!this.visible)return;let e=this.u.uPointer.value,t=this.pointerTarget.x-e[0],n=this.pointerTarget.y-e[1];Math.abs(t)+Math.abs(n)>6e-4&&(e[0]+=t*.06,e[1]+=n*.06,this.dirty=!0);let r=this.velTarget-this.u.uVel.value;Math.abs(r)>8e-4&&(this.u.uVel.value+=r*.12,this.dirty=!0),this.velTarget*=.9,(this.dirty||this.warm&&performance.now()-this.drawn>this.warm)&&(this.dirty=!1,this.drawn=performance.now(),this.renderer.render({scene:this.mesh}))};destroy(){this.mixTween?.kill();for(let e of this.cleanup)e();this.cleanup=[]}};export{d as HeroPlane};