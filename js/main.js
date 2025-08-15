// Production main.js (debug & cheat code removed)
let game=null;

document.addEventListener('DOMContentLoaded',()=>{
  game=new Game();
  setupGlobalEvents();
  setupResponsiveCanvas();
  setupMobileFullscreenButton();
  forceUiVisibleAndDisplayApply();
});

function setupGlobalEvents(){
  let audioEnabled=false; const enableAudio=()=>{ if(!audioEnabled&&game){ audioEnabled=true; if(game.soundManager){ game.soundManager.playMusic('game_intro',0.5,true);} try{ if(document && !document.fullscreenElement && game.toggleFullscreen){ game.toggleFullscreen(); } }catch(_){} document.removeEventListener('click',enableAudio); document.removeEventListener('touchstart',enableAudio); document.removeEventListener('keydown',enableAudio);} };
  document.addEventListener('click',enableAudio);
  document.addEventListener('touchstart',enableAudio);
  document.addEventListener('keydown',enableAudio);
  setupUniversalTouchSupport();
  document.addEventListener('keydown',e=>{
    if(game&&game.detectKeyboardControllerUsage) game.detectKeyboardControllerUsage();
    switch(e.code){
      case 'KeyH': if(e.shiftKey&&game){ e.preventDefault(); } break; // debug visibility removed
      case 'KeyF': if(e.shiftKey&&game){ e.preventDefault(); game.toggleFullscreen(); } break;
      case 'KeyR': if(e.ctrlKey&&game&&game.gameState==='gameOver'){ e.preventDefault(); game.restartGame(); } break;
      case 'Space': if(game&&game.gameState==='gameOver'){ e.preventDefault(); game.restartGame(); } break;
    }
  });
  document.addEventListener('visibilitychange',()=>{});
  window.addEventListener('blur',()=>{});
  window.addEventListener('focus',()=>{});
  const canvas=document.getElementById('gameCanvas');
  if(canvas){ canvas.addEventListener('contextmenu',e=>e.preventDefault()); }
}

function setupUniversalTouchSupport(){
  const selectors=['button','.mp-btn','.room-input','.copy-btn','.touch-toggle-btn','input[type="button"]','[onclick]','.clickable'];
  selectors.forEach(sel=>{ document.querySelectorAll(sel).forEach(el=>{ el.addEventListener('touchstart',e=>{e.preventDefault(); el.classList.add('touching');}); el.addEventListener('touchend',e=>{e.preventDefault(); el.classList.remove('touching'); el.click();}); el.addEventListener('touchcancel',()=>el.classList.remove('touching')); }); });
  const style=document.createElement('style'); style.textContent=`.touching{transform:scale(.95)!important;filter:brightness(1.2)!important;transition:all .1s!important}button,.mp-btn{min-height:44px!important;min-width:44px!important;touch-action:manipulation;-webkit-tap-highlight-color:rgba(0,255,255,.3)}`; document.head.appendChild(style);
}

function setupResponsiveCanvas(){ const canvas=document.getElementById('gameCanvas'); const container=document.getElementById('gameContainer'); if(!canvas||!container) return; resizeCanvas(); window.addEventListener('resize',resizeCanvas); window.addEventListener('orientationchange',()=>setTimeout(resizeCanvas,100)); }
function resizeCanvas(){ const canvas=document.getElementById('gameCanvas'); if(!canvas) return; const maxWidth=window.innerWidth*0.98; const maxHeight=window.innerHeight*0.8; const aspect=4/3; let w=maxWidth; let h=w/aspect; if(h>maxHeight){ h=maxHeight; w=h*aspect;} canvas.style.width=w+'px'; canvas.style.height=h+'px'; }

window.getGame=()=>game;

// Performance monitor minimal
const perf={c:0,last:Date.now(),update(){this.c++;const n=Date.now(); if(n-this.last>=5000){ this.c=0; this.last=n; }}};
function animate(){ requestAnimationFrame(animate); perf.update(); if(game&&game.isRunning){ game.updateGame(); }}
animate();
// Periodic power-up spawning hook & fullscreen UI fix for production too
['fullscreenchange','webkitfullscreenchange','mozfullscreenchange','MSFullscreenChange'].forEach(ev=>{
  document.addEventListener(ev,()=>{
    ['gameUI','touchControls'].forEach(id=>{const el=document.getElementById(id); if(el){ el.classList.remove('hidden'); el.style.display=''; el.style.visibility='visible'; el.style.opacity='1'; }});
  });
});
const _origUpdateGameProd = Game.prototype.updateGame;
Game.prototype.updateGame = function(...a){ try{ this.updatePowerUpSpawning(performance.now()); }catch(e){} return _origUpdateGameProd.apply(this,a); };

// Ensure UI is always visible and apply display settings like F2+Enter
function forceUiVisibleAndDisplayApply(){
  ['gameUI','touchControls'].forEach(id=>{const el=document.getElementById(id); if(el){ el.classList.remove('hidden'); el.style.display=''; el.style.visibility='visible'; el.style.opacity='1'; }});
  // Apply display once more on DOM ready (safety)
  try{ if(game && game.applyResolutionSettings){ game.applyResolutionSettings(); } }catch(_){}
}

function setupMobileFullscreenButton(){
  const btn=document.getElementById('mobileFsBtn');
  if(!btn) return;
  // Show on touch-first devices only
  try{ if(window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches){ btn.style.display='block'; } }catch(_){ /* noop */ }
  const toggle=()=>{
    if(!game) return;
    // If not in real fullscreen, request it; else toggle borderless mode
    if(!document.fullscreenElement){
      try{ game.toggleFullscreen && game.toggleFullscreen(); }catch(_){}
    } else {
      // Switch borderless flag and re-apply scaling
      game.borderlessFullscreen = !game.borderlessFullscreen;
      try{ game.applyResolutionSettings(); }catch(_){}
    }
  };
  ['click','touchstart'].forEach(ev=>btn.addEventListener(ev,(e)=>{ e.preventDefault(); toggle(); }));
}
