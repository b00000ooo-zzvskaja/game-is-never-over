const room=document.querySelector('#room'),face=document.querySelector('#face');
const cry=document.querySelector('#cry'),cryTrigger=document.querySelector('#cry-trigger');
const destroyRoom=document.querySelector('#room-destroy');
const rightRoom=document.querySelector('#room-right'),rightDemon=document.querySelector('#pet-right');
const rightDestroyRoom=document.querySelector('#room-right-destroy'),rightDestroy=document.querySelector('#destroy-right');
let activeRoom=room;
const idle=document.querySelector('#idle'),rise=document.querySelector('#rise');
const scene=document.querySelector('.scene'),windowLayer=document.querySelector('.room-window');
const demon=document.querySelector('.pet-target'),loading=document.querySelector('.loading');
const status=document.querySelector('#status'),retry=document.querySelector('#retry');
const artwork=document.querySelector('.artwork');
const roomVideos=[room,rightRoom,destroyRoom,rightDestroyRoom].filter(Boolean);
const videos=[...roomVideos,face,idle,rise,cry].filter(Boolean);
const targets=[demon,rightDemon,cryTrigger,rightDestroy].filter(Boolean);
const enablePet=enabled=>targets.forEach(button=>{button.disabled=!enabled;});
const prealigned=room.dataset.prealigned==='true';
const restTime=prealigned?0:.25,reactionStart=prealigned?4:3.9;
let phase='loading',alignment=null,frameIndex=0,initialSeek=false;
function fail(){
 phase='error';scene.setAttribute('data-state',phase);videos.forEach(v=>v.pause());enablePet(false);
 status.textContent='Не удалось загрузить сцену.';loading.hidden=false;retry.hidden=false;scene.setAttribute('aria-busy','false');
}
function align(time){
 if(!alignment)return;
 const frame=Math.max(0,Math.min(alignment.frames-1,time*alignment.fps));
 while(frameIndex<alignment.indices.length-2&&alignment.indices[frameIndex+1]<frame)frameIndex++;
 while(frameIndex>0&&alignment.indices[frameIndex]>frame)frameIndex--;
 const i=frameIndex,j=Math.min(i+1,alignment.indices.length-1);
 const span=alignment.indices[j]-alignment.indices[i],t=span?Math.max(0,Math.min(1,(frame-alignment.indices[i])/span)):0;
 const m=alignment.matrices[i].map((v,k)=>v+(alignment.matrices[j][k]-v)*t);
 const {width:w,height:h}=windowLayer.getBoundingClientRect();if(!w||!h)return;
 room.style.transform='matrix3d('+[m[0],m[3]*h/w,0,m[6]/w,m[1]*w/h,m[4],0,m[7]/h,0,0,1,0,m[2]*w,m[5]*h,0,m[8]].join(',')+')';
}
function ready(){
 if(phase!=='loading'||(!prealigned&&!alignment)||!artwork.complete||!artwork.naturalWidth||videos.some(v=>v.readyState<3))return;
 if(!prealigned&&!initialSeek){initialSeek=true;room.currentTime=restTime;return;}
 if(room.seeking||Math.abs(room.currentTime-restTime)>.02)return;
 align(restTime);face.pause();face.currentTime=0;phase='idle';scene.setAttribute('data-state',phase);enablePet(true);
 scene.classList.add('ready');scene.setAttribute('aria-busy','false');loading.hidden=true;
 if(idle){idle.classList.add('active');if(!document.hidden)idle.play().catch(fail);}
}
for(const video of [destroyRoom,rightRoom,rightDestroyRoom].filter(Boolean)){
 const fadeRoom=time=>{
  if(activeRoom!==video)return;
  if(video===rightRoom&&phase==='resetting')return;
  const fadeSeconds=video===destroyRoom ? .18 : .34;
  // Finish the dissolve while the heroine is still in her starting pose.
  const openingFade=video===rightRoom ? .55 : fadeSeconds;
  const endingBlend=video===rightRoom ? 1 : (video.duration-time-1/24)/fadeSeconds;
  const blend=Math.max(0,Math.min(1,time/openingFade,endingBlend));
  const opacity=Number.isFinite(blend)?blend*blend*(3-2*blend):0;
  windowLayer.style.setProperty('--destroy-opacity',opacity);
 };
 if('requestVideoFrameCallback' in video){
  const track=(_,frame)=>{
   fadeRoom(frame.mediaTime);
   video.requestVideoFrameCallback(track);
  };
  video.requestVideoFrameCallback(track);
 }else{
  let animationFrame;
  const track=()=>{
   fadeRoom(video.currentTime);
   if(!video.paused&&!video.ended)animationFrame=requestAnimationFrame(track);
  };
  video.addEventListener('playing',()=>{
   cancelAnimationFrame(animationFrame);
   animationFrame=requestAnimationFrame(track);
  });
 }
 video.addEventListener('seeked',()=>fadeRoom(video.currentTime));
}
function syncFace(){
 if(activeRoom&&(activeRoom===destroyRoom||activeRoom===rightDestroyRoom)){
  const target=activeRoom.currentTime-(activeRoom===destroyRoom?4.5:4);
  if(phase!=='playing'||target<0||target>=cry.duration){
   cry.pause();
   cry.hidden=true;
   if(cry.currentTime!==0)cry.currentTime=0;
   return;
  }
  if(Math.abs(cry.currentTime-target)>.15)cry.currentTime=target;
  if(activeRoom.paused)cry.pause();else if(cry.paused)cry.play().catch(fail);
  return;
 }
 const target=activeRoom.currentTime-(activeRoom===rightRoom?6.5:reactionStart);
 if(phase!=='playing'||target<0||target>=face.duration){resetFace();return;}
 if(Math.abs(face.currentTime-target)>.1)face.currentTime=target;
 if(activeRoom.paused)face.pause();else if(face.paused)face.play().catch(fail);
}
function resetFace(){
 face.pause();
 if(cry)face.hidden=true;
 if(face.currentTime!==0)face.currentTime=0;
}
if(cry){
 face.addEventListener('playing',()=>{if(phase==='playing')face.hidden=false;});
 cry.addEventListener('playing',()=>{if(phase==='crying'||(phase==='playing'&&(activeRoom===destroyRoom||activeRoom===rightDestroyRoom)))cry.hidden=false;});
 cryTrigger.addEventListener('click',()=>{
  if(destroyRoom){playPet(destroyRoom);return;}
  if(phase!=='idle')return;
  phase='crying';scene.setAttribute('data-state',phase);enablePet(false);
  idle?.pause();
  cry.play().catch(fail);
 });
 cry.addEventListener('ended',()=>{
  cry.hidden=true;
  cry.currentTime=0;
 });
 cry.addEventListener('seeked',()=>{
  if(phase!=='crying'||!cry.paused||cry.currentTime!==0)return;
  phase='idle';scene.setAttribute('data-state',phase);enablePet(true);
  if(idle&&!document.hidden)idle.play().catch(fail);
 });
}
if(!prealigned)fetch(room.dataset.alignment||'previews/crown-alignment.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{
 if(!d.matrices?.length||d.matrices.length!==d.indices?.length||d.fps<=0)throw Error();alignment=d;ready();
}).catch(fail);
videos.forEach(v=>{v.addEventListener('loadeddata',ready);v.addEventListener('canplay',ready);v.addEventListener('error',fail);});
artwork.addEventListener('load',ready);artwork.addEventListener('error',fail);
function onRoomSeeked(event){
 if(event?.target&&event.target!==activeRoom)return;
 align(room.currentTime);ready();syncFace();
 if(phase==='resetting'){
  if(activeRoom!==room){
   activeRoom=room;
   roomVideos.forEach(video=>{video.hidden=video!==room;});
  }
  rise?.classList.remove('active');phase='idle';
  if(!rise&&idle){idle.currentTime=0;idle.classList.add('active');if(!document.hidden)idle.play().catch(fail);}scene.setAttribute('data-state',phase);enablePet(true);
 }
}
for(const video of roomVideos){
 video.addEventListener('seeked',onRoomSeeked);
 video.addEventListener('timeupdate',syncFace);
}
if('requestVideoFrameCallback'in room){const tick=(_,meta)=>{align(meta.mediaTime);room.requestVideoFrameCallback(tick);};room.requestVideoFrameCallback(tick);}
else room.addEventListener('timeupdate',()=>align(room.currentTime));
window.addEventListener('resize',()=>align(room.currentTime));
async function playPet(video){
 if(phase!=='idle')return;
 phase='playing';scene.setAttribute('data-state',phase);enablePet(false);
 idle?.pause();idle?.classList.remove('active');
 activeRoom=video;
 if(video!==room)windowLayer.style.setProperty('--destroy-opacity',0);
 if(roomVideos.length>1)roomVideos.forEach(layer=>{layer.hidden=video!==layer&&!(video!==room&&layer===room);});
 try{await video.play();}catch{fail();}
}
demon.addEventListener('click',()=>playPet(room));
rightDemon?.addEventListener('click',()=>playPet(rightRoom));
rightDestroy?.addEventListener('click',()=>playPet(rightDestroyRoom));
function onRoomEnded(event){
 if(event?.target&&event.target!==activeRoom)return;
 if(phase!=='playing')return;
 if(!rise){
  phase='resetting';scene.setAttribute('data-state',phase);syncFace();
  if(activeRoom===rightRoom){
   // Blend the settled last frame, so the heroine isn't doubled while sitting down.
   windowLayer.style.setProperty('--destroy-opacity',0);
   setTimeout(()=>{if(phase==='resetting'&&activeRoom===rightRoom)rightRoom.currentTime=restTime;},240);
  }else activeRoom.currentTime=restTime;
  return;
 }
 phase='rising';scene.setAttribute('data-state',phase);resetFace();align(room.currentTime);
 rise.currentTime=0;rise.classList.add('active');idle.currentTime=0;idle.classList.add('active');
 if(!document.hidden)Promise.all([rise.play(),idle.play()]).catch(fail);
}
room.addEventListener('ended',onRoomEnded);
rightRoom?.addEventListener('ended',onRoomEnded);
destroyRoom?.addEventListener('ended',onRoomEnded);
rightDestroyRoom?.addEventListener('ended',onRoomEnded);
rise?.addEventListener('ended',()=>{
 if(phase!=='rising')return;
 phase='resetting';scene.setAttribute('data-state',phase);room.currentTime=restTime;
});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){videos.forEach(v=>v.pause());return;}
 if(phase==='playing')activeRoom.play().then(syncFace).catch(fail);
 else if(phase==='crying')cry.play().catch(fail);
 else if(phase==='rising')Promise.all([rise.play(),idle.play()]).catch(fail);
 else if(idle&&(phase==='idle'||(phase==='resetting'&&rise)))idle.play().catch(fail);
});
retry.addEventListener('click',()=>window.location.reload());
