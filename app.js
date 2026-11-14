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
const portraitPreview=document.documentElement?.classList.contains('portrait-preview');
let portraitCryLayer;
let preparePortraitCry;
if(portraitPreview){
 document.querySelector('.portrait-artwork').srcset='previews/portrait-game-window-preview.png';
 cry.src='previews/portrait-cry-neutral-end.mp4';
 portraitCryLayer=document.createElement('canvas');
 portraitCryLayer.className='portrait-cry-layer';
 portraitCryLayer.setAttribute('aria-hidden','true');
 cry.after(portraitCryLayer);

 // Use the same decoder for the neutral and moving frames, so only motion
 // transfers to the portrait and the video's color conversion cancels out.
 const x=100,y=460,width=530,height=389;
 portraitCryLayer.width=width;
 portraitCryLayer.height=height;
 const output=portraitCryLayer.getContext('2d');
 const sampler=document.createElement('canvas');
 sampler.width=width;
 sampler.height=height;
 const sample=sampler.getContext('2d',{willReadFrequently:true});
 let neutral, portrait;
 const result=output.createImageData(width,height);
 const read=(source,fullWidth)=>{
  sample.drawImage(source,-x,-y,fullWidth,972);
  return sample.getImageData(0,0,width,height).data;
 };
 let preparing=false;
 preparePortraitCry=()=>{
  if(neutral)return true;
  if(preparing)return false;
  preparing=true;
  portrait=read(artwork,729);
  cry.addEventListener('seeked',()=>{
   neutral=read(cry,730);
   cry.addEventListener('seeked',ready,{once:true});
   cry.currentTime=0;
  },{once:true});
  cry.currentTime=cry.duration-0.12;
  return false;
 };
 const drawReaction=(time)=>{
  if(cry.hidden||cry.seeking||!neutral)return;
  const remaining=Math.min(cry.duration-time,activeRoom.duration-activeRoom.currentTime);
  // Show the untouched portrait for the final part of the reaction.
  if(remaining<=.38){
   portraitCryLayer.style.opacity=0;
   output.clearRect(0,0,width,height);
   return;
  }
  const frame=read(cry,730);
  for(let i=0;i<frame.length;i+=4){
   const column=x+(i/4)%width;
   const row=y+Math.floor(i/(4*width));
   // Keep the left lower lid and lash line on the original portrait.
   const eyelidRegion=Math.max(0,Math.min(1,
    (column-132)/9,(304-column)/9,(row-554)/7,(615-row)/12));
   if(eyelidRegion===1){
    result.data[i+3]=0;
    continue;
   }
   let changed=false;
   for(let channel=0;channel<3;channel++){
    const index=i+channel;
    const difference=frame[index]-neutral[index];
    const motion=Math.sign(difference)*Math.max(0,Math.abs(difference)-3);
    result.data[index]=portrait[index]+motion;
    changed ||= motion!==0;
   }
   result.data[i+3]=changed?255*(1-eyelidRegion):0;
  }
  output.putImageData(result,0,0);
  const opening=Math.max(0,Math.min(1,(time-.18)/.42));
  portraitCryLayer.style.opacity=Math.min(opening,(remaining-.38)/.45);
 };
 if('requestVideoFrameCallback' in cry){
  const drawFrame=(_,frame)=>{
   drawReaction(frame.mediaTime);
   cry.requestVideoFrameCallback(drawFrame);
  };
  cry.requestVideoFrameCallback(drawFrame);
 }else cry.addEventListener('timeupdate',()=>drawReaction(cry.currentTime));
}
const roomVideos=[room,rightRoom,destroyRoom,rightDestroyRoom].filter(Boolean);
const videos=[...roomVideos,face,idle,rise,cry].filter(Boolean);
const targets=[demon,rightDemon,cryTrigger,rightDestroy].filter(Boolean);
const enablePet=enabled=>targets.forEach(button=>{button.disabled=!enabled;});
const prealigned=room.dataset.prealigned==='true';
const restTime=prealigned?0:.25,reactionStart=prealigned?4:3.9;
let phase='loading',alignment=null,frameIndex=0,initialSeek=false;
let portraitCryStarted=false;
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
 if(portraitPreview&&!artwork.currentSrc.endsWith('/portrait-game-window-preview.png'))return;
 if(!prealigned&&!initialSeek){initialSeek=true;room.currentTime=restTime;return;}
 if(room.seeking||Math.abs(room.currentTime-restTime)>.02)return;
 if(portraitPreview&&(!preparePortraitCry()||cry.seeking))return;
 align(restTime);resetFace();phase='idle';scene.setAttribute('data-state',phase);enablePet(true);
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
   portraitCryStarted=false;
   cry.pause();
   cry.hidden=true;
   if(portraitCryLayer)portraitCryLayer.style.opacity=0;
   if(cry.currentTime!==0)cry.currentTime=0;
   return;
  }
  if(portraitPreview){
   if(activeRoom.paused){
    cry.pause();
   }else if(!portraitCryStarted){
    portraitCryStarted=true;
    cry.play().catch(fail);
   }else if(cry.paused&&!cry.ended){
    cry.play().catch(fail);
   }
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
  if(portraitPreview)return;
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
