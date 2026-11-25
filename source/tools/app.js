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

 /* ---- updater ---- */
 var FEED='https://raw.githubusercontent.com/Nex-Gen-Dev/Siddur-apk-updates/main/latest.json';
 var UP=null;
 try{if(native)UP=Capacitor.registerPlugin('ApkUpdater')}catch(e){}
 var box=$('upd-box'),line=$('upd-line'),btn=$('upd-btn'),bar=$('upd-bar').firstElementChild,auto=$('upd-auto');
 var info=null,pending=null,working=false,listening=false;
 function say(h){line.innerHTML=h}
 function toast(msg,label,fn){
  var t=$('upd-toast');t.firstElementChild.textContent=msg;
  var b=t.lastElementChild;b.textContent=label;b.onclick=function(){t.classList.remove('show');if(fn)fn()};
  t.classList.add('show');setTimeout(function(){t.classList.remove('show')},9000);
 }
 function check(silent){
  if(!UP){say('Updates work in the Android app.');return Promise.resolve(null)}
  if(working)return Promise.resolve(null);
  working=true;btn.disabled=true;if(!silent)say('Checking…');
  return UP.getInfo().then(function(i){
   info=i;
   return fetch(FEED+'?t='+Date.now(),{cache:'no-store'});
  }).then(function(r){if(!r.ok)throw new Error('feed');return r.json()}).then(function(j){
   working=false;btn.disabled=false;
   if(j&&j.versionCode>info.versionCode){
    pending=j;
    say('Update available: <b>'+(j.versionName||j.versionCode)+'</b>'+(j.notes?'<br>'+String(j.notes).replace(/[<>&]/g,''):''));
    btn.textContent='Update now';
    return j;
   }
   pending=null;btn.textContent='Check for updates';
   say('You’re up to date · <b>'+info.versionName+'</b>');
   return null;
  }).catch(function(){
   working=false;btn.disabled=false;
   if(!silent)say('Couldn’t check. Make sure you’re online.');
   return null;
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
 function install(){
  if(!pending||working)return;
  ensurePermissions().then(function(ok){
   if(!ok)return;
   working=true;btn.disabled=true;box.classList.add('busy');bar.style.width='0';say('Downloading update…');
   if(!listening){
    listening=true;
    UP.addListener('progress',function(p){if(p.percent>=0){bar.style.width=p.percent+'%';say('Downloading update… <b>'+p.percent+'%</b>')}});
   }
   return UP.downloadAndInstall({url:pending.apk}).then(function(){
    say('Installing… the app will restart.');
   }).catch(function(e){
    working=false;btn.disabled=false;box.classList.remove('busy');
    say('Update failed ('+((e&&e.message)||'error')+'). Try again.');
   });
  });
 }
 btn.addEventListener('click',function(){
  if(pending)install();else check(false).then(function(j){if(j)install()});
 });
 try{auto.checked=localStorage.getItem('siddur.autoUpdate')!=='0'}catch(e){}
 auto.addEventListener('change',function(){try{localStorage.setItem('siddur.autoUpdate',auto.checked?'1':'0')}catch(e){}});
 if(UP){
  UP.getInfo().then(function(i){info=i;say('Version <b>'+i.versionName+'</b>')}).catch(function(){});
  setTimeout(function(){
   if(!auto.checked)return;
   check(true).then(function(j){
    if(!j)return;
    UP.getInfo().then(function(i){
     if(i.canInstall){install()}
     else toast('Update '+(j.versionName||'')+' is ready','Update',function(){$('settings-open').checked=true});
    });
   });
  },3600);
 }else{say('Updates work in the Android app.');btn.disabled=true}
 statusBar();
})();
