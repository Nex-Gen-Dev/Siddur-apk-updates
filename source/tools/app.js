(function(){
 'use strict';
 var $=function(id){return document.getElementById(id)};
 var KEY='siddur.settings.v1';
 var groups=['theme','size','space','font'];
 var native=!!(window.Capacitor&&Capacitor.isNativePlatform&&Capacitor.isNativePlatform());

 /* ---- remember settings ---- */
 try{
  var st=JSON.parse(localStorage.getItem(KEY)||'{}');
  groups.forEach(function(g){if(st[g]&&$(st[g]))$(st[g]).checked=true});
  if('headings' in st&&$('headings-on'))$('headings-on').checked=!!st.headings;
 }catch(e){}
 function save(){
  try{
   var o={};
   groups.forEach(function(g){var c=document.querySelector('input.state[name='+g+']:checked');if(c)o[g]=c.id});
   o.headings=$('headings-on').checked;
   localStorage.setItem(KEY,JSON.stringify(o));
  }catch(e){}
  statusBar();
 }

 /* ---- status bar icon colour follows theme ---- */
 var SB=null;
 try{if(native)SB=Capacitor.registerPlugin('SystemBars')}catch(e){}
 function isDark(){
  if($('theme-dark').checked)return true;
  if($('theme-light').checked)return false;
  return !!(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches);
 }
 function statusBar(){
  if(!SB||!SB.setStyle)return;
  try{SB.setStyle({style:isDark()?'DARK':'LIGHT'}).catch(function(){})}catch(e){}
 }

 /* ---- navigation: scroll handling ---- */
 var homeY=0,wasHome=true;
 document.addEventListener('change',function(e){
  var t=e.target;if(!t||!t.classList||!t.classList.contains('state'))return;
  if(t.name==='nav'){
   if(wasHome)homeY=window.scrollY;
   wasHome=(t.id==='nav-home');
   var y=wasHome?homeY:0;
   requestAnimationFrame(function(){window.scrollTo(0,y)});
  }else if(t.id!=='settings-open'&&t.id!=='intro-open'){save()}
 });

 /* ---- splash: auto-continue ---- */
 setTimeout(function(){var i=$('intro-open');if(i)i.checked=false},3000);

 /* ---- Android back button ---- */
 if(native){
  try{
   var App=Capacitor.registerPlugin('App');
   App.addListener('backButton',function(){
    if($('settings-open').checked){$('settings-open').checked=false;return}
    var open=document.querySelector('.jump-menu[open]');
    if(open){open.removeAttribute('open');return}
    if(!$('nav-home').checked){
     $('nav-home').checked=true;
     $('nav-home').dispatchEvent(new Event('change',{bubbles:true}));
     return;
    }
    App.exitApp();
   });
  }catch(e){}
 }

 /* ---- updater: content updates (instant) + app updates (fallback) ---- */
 var FEED='https://raw.githubusercontent.com/Nex-Gen-Dev/Siddur-apk-updates/main/latest.json';
 var WEBV=window.SIDDUR_WEB||0;
 var UP=null,WV=null;
 try{if(native){UP=Capacitor.registerPlugin('ApkUpdater');WV=Capacitor.registerPlugin('WebView')}}catch(e){}
 var box=$('upd-box'),line=$('upd-line'),btn=$('upd-btn'),bar=$('upd-bar').firstElementChild,auto=$('upd-auto');
 var info=null,pending=null,working=false,listening=false;
 function say(h){line.innerHTML=h}
 function ver(){return info?'Version <b>'+info.versionName+'</b> · content '+WEBV:''}
 function toast(msg,label,fn){
  var t=$('upd-toast');t.firstElementChild.textContent=msg;
  var b=t.lastElementChild;b.textContent=label;b.onclick=function(){t.classList.remove('show');if(fn)fn()};
  t.classList.add('show');setTimeout(function(){t.classList.remove('show')},9000);
 }
 function busy(on){working=on;btn.disabled=on;box.classList[on?'add':'remove']('busy')}
 function check(silent){
  if(!UP){say('Updates work in the Android app.');return Promise.resolve(null)}
  if(working)return Promise.resolve(null);
  busy(true);btn.disabled=true;if(!silent)say('Checking…');
  return UP.getInfo().then(function(i){
   info=i;
   return fetch(FEED+'?t='+Date.now(),{cache:'no-store'});
  }).then(function(r){if(!r.ok)throw new Error('feed');return r.json()}).then(function(j){
   busy(false);
   if(j&&j.webUrl&&j.webVersion>WEBV){pending={type:'web',j:j};return pending}
   if(j&&j.apk&&j.versionCode>info.versionCode){
    pending={type:'apk',j:j};
    say('App update available: <b>'+(j.versionName||j.versionCode)+'</b>');
    btn.textContent='Update now';
    return pending;
   }
   pending=null;btn.textContent='Check for updates';
   say('You’re up to date · '+ver());
   return null;
  }).catch(function(){
   busy(false);
   if(!silent)say('Couldn’t check. Make sure you’re online.');
   return null;
  });
 }
 /* content update: download new page, switch to it (page reloads itself) */
 function applyWeb(j){
  busy(true);box.classList.remove('busy');say('Updating…');
  return UP.downloadWeb({url:j.webUrl,sha256:j.webSha256||'',version:j.webVersion}).then(function(r){
   say('Restarting…');
   return WV.setServerBasePath({path:r.path});
  }).catch(function(e){
   busy(false);
   say('Update failed ('+((e&&e.message)||'error')+'). Try again.');
  });
 }
 function ensurePermissions(){
  return UP.getInfo().then(function(i){
   if(!i.canInstall){
    say('Allow <b>Install unknown apps</b> for this app, then come back and tap again.');
    return UP.openInstallSettings().then(function(){return false});
   }
   var asked=false;try{asked=localStorage.getItem('siddur.overlayAsked')==='1'}catch(e){}
   if(!i.canOverlay&&!asked){
    try{localStorage.setItem('siddur.overlayAsked','1')}catch(e){}
    say('One last permission: <b>Display over other apps</b>. It lets the app reopen by itself after updating. Allow it, then tap again.');
    return UP.openOverlaySettings().then(function(){return false});
   }
   return true;
  });
 }
 function applyApk(j){
  ensurePermissions().then(function(ok){
   if(!ok)return;
   busy(true);bar.style.width='0';say('Downloading update…');
   if(!listening){
    listening=true;
    UP.addListener('progress',function(p){if(p.percent>=0){bar.style.width=p.percent+'%';say('Downloading update… <b>'+p.percent+'%</b>')}});
   }
   return UP.downloadAndInstall({url:j.apk}).then(function(){
    say('Installing… the app will restart.');
   }).catch(function(e){
    busy(false);
    say('Update failed ('+((e&&e.message)||'error')+'). Try again.');
   });
  });
 }
 function go(p){if(!p)return;if(p.type==='web')applyWeb(p.j);else applyApk(p.j)}
 btn.addEventListener('click',function(){
  if(pending&&!working)go(pending);else check(false).then(go);
 });
 try{auto.checked=localStorage.getItem('siddur.autoUpdate')!=='0'}catch(e){}
 auto.addEventListener('change',function(){try{localStorage.setItem('siddur.autoUpdate',auto.checked?'1':'0')}catch(e){}});
 if(UP){
  UP.getInfo().then(function(i){info=i;say(ver())}).catch(function(){});
  setTimeout(function(){
   if(!auto.checked)return;
   check(true).then(function(p){
    if(!p)return;
    if(p.type==='web'){applyWeb(p.j);return}
    UP.getInfo().then(function(i){
     if(i.canInstall){applyApk(p.j)}
     else toast('App update '+(p.j.versionName||'')+' is ready','Update',function(){$('settings-open').checked=true});
    });
   });
  },400);
 }else{say('Updates work in the Android app.');btn.disabled=true}
 statusBar();
})();
