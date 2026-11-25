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
    if(closeTop())return;
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

 /* ---- auto-scroll (double-tap the text) ---- */
 var AS={speeds:{slow:18,medium:34,fast:62},names:{slow:'איטי',medium:'בינוני',fast:'מהיר'},order:['slow','medium','fast'],
         speed:'medium',on:false,hold:false,raf:0,last:0,acc:0,lock:null,lastToggle:0};
 try{var sv=localStorage.getItem('siddur.scrollSpeed');if(AS.speeds[sv])AS.speed=sv}catch(e){}
 var pill=$('as-pill'),asLabel=$('as-label'),asSpeedBtn=$('as-speed');
 function inReader(){return !$('nav-home').checked}
 function paintSpeed(){
  var bs=document.querySelectorAll('.as-btn');
  for(var i=0;i<bs.length;i++)bs[i].classList[bs[i].getAttribute('data-speed')===AS.speed?'add':'remove']('on');
  asSpeedBtn.textContent=AS.names[AS.speed];
 }
 function setSpeed(k){
  AS.speed=k;try{localStorage.setItem('siddur.scrollSpeed',k)}catch(e){}
  paintSpeed();
 }
 function wake(on){
  try{
   if(on&&navigator.wakeLock){navigator.wakeLock.request('screen').then(function(l){AS.lock=l}).catch(function(){})}
   else if(AS.lock){AS.lock.release();AS.lock=null}
  }catch(e){}
 }
 function atBottom(){return window.innerHeight+window.scrollY>=document.documentElement.scrollHeight-3}
 function tick(t){
  if(!AS.on)return;
  var dt=Math.min(t-AS.last,64);AS.last=t;
  if(!AS.hold){
   AS.acc+=AS.speeds[AS.speed]*dt/1000;
   var step=Math.floor(AS.acc);
   if(step>0){AS.acc-=step;window.scrollBy(0,step);if(atBottom()){asStop();return}}
  }
  AS.raf=requestAnimationFrame(tick);
 }
 function asStart(){
  if(AS.on||!inReader())return;
  AS.on=true;AS.acc=0;AS.last=performance.now();
  asLabel.textContent='גלילה אוטומטית';pill.classList.add('show');wake(true);
  AS.raf=requestAnimationFrame(tick);
 }
 function asStop(){
  if(!AS.on)return;
  AS.on=false;cancelAnimationFrame(AS.raf);pill.classList.remove('show');wake(false);
 }
 function asToggle(){AS.lastToggle=Date.now();AS.on?asStop():asStart();try{getSelection().removeAllRanges()}catch(e){}}
 Array.prototype.forEach.call(document.querySelectorAll('.as-btn'),function(b){
  b.addEventListener('click',function(){setSpeed(b.getAttribute('data-speed'))});
 });
 asSpeedBtn.addEventListener('click',function(){setSpeed(AS.order[(AS.order.indexOf(AS.speed)+1)%3])});
 $('as-stop').addEventListener('click',asStop);
 paintSpeed();

 var tapT=0,tapX=0,tapY=0,sx=0,sy=0,moved=false,SKIP='a,button,label,input,select,summary,details,.topbar,.jump-menu,.settings-overlay,.as-pill,.cp,.upd-toast,.home-top';
 function okTarget(el){return inReader()&&!(el&&el.closest&&el.closest(SKIP))}
 document.addEventListener('touchstart',function(e){
  if(e.touches.length>1)return;
  sx=e.touches[0].clientX;sy=e.touches[0].clientY;moved=false;AS.hold=true;
 },{passive:true});
 document.addEventListener('touchmove',function(e){
  var t=e.touches[0];if(Math.abs(t.clientX-sx)>10||Math.abs(t.clientY-sy)>10)moved=true;
 },{passive:true});
 function release(){AS.hold=false;AS.last=performance.now()}
 document.addEventListener('touchcancel',function(){setTimeout(release,700)},{passive:true});
 document.addEventListener('touchend',function(e){
  if(moved){setTimeout(release,900);tapT=0;return}
  release();
  if(!okTarget(e.target)){tapT=0;return}
  var now=Date.now(),t=e.changedTouches[0];
  if(now-tapT<320&&Math.abs(t.clientX-tapX)<36&&Math.abs(t.clientY-tapY)<36){tapT=0;asToggle()}
  else{tapT=now;tapX=t.clientX;tapY=t.clientY}
 },{passive:true});
 document.addEventListener('dblclick',function(e){
  if(Date.now()-AS.lastToggle<700)return;  /* already handled by touch */
  if(okTarget(e.target))asToggle();
 });
 document.addEventListener('change',function(e){var t=e.target;if(t&&t.name==='nav')asStop()});
 document.addEventListener('visibilitychange',function(){if(document.hidden)asStop()});
 $('settings-open').addEventListener('change',function(){if(this.checked)asStop()});

 /* one-time hint when first opening a prayer */
 var hint=$('as-hint');
 document.addEventListener('change',function(e){
  var t=e.target;if(!t||t.name!=='nav'||t.id==='nav-home')return;
  var seen=false;try{seen=localStorage.getItem('siddur.hintAS')==='1'}catch(x){}
  if(seen)return;
  try{localStorage.setItem('siddur.hintAS','1')}catch(x){}
  setTimeout(function(){hint.classList.add('show');setTimeout(function(){hint.classList.remove('show')},4200)},700);
 });

 /* ---- compass: direction of Jerusalem ---- */
 var JER={lat:31.7767,lon:35.2345};
 var CITIES=[['ניו יורק',40.71,-74.01],['ברוקלין',40.65,-73.95],['לוס אנג׳לס',34.05,-118.24],['מיאמי',25.76,-80.19],['שיקגו',41.88,-87.63],
  ['טורונטו',43.65,-79.38],['מונטריאול',45.50,-73.57],['לונדון',51.51,-0.13],['מנצ׳סטר',53.48,-2.24],['פריז',48.86,2.35],
  ['אנטוורפן',51.22,4.40],['ציריך',47.37,8.54],['מוסקבה',55.76,37.62],['בואנוס איירס',-34.60,-58.38],['יוהנסבורג',-26.20,28.05],['סידני',-33.87,151.21]];
 var cp=$('compass'),dial=$('cp-dial'),jerM=$('cp-jer'),cpMsg=$('cp-msg'),cpSub=$('cp-sub'),cpDeg=$('cp-deg'),citySel=$('cp-city');
 var CP={open:false,loc:null,bearing:null,dist:null,head:null,smooth:null,raf:0,got:0,watch:0};
 var D2R=Math.PI/180;
 function bearingTo(a,b,c,d){
  var p1=a*D2R,p2=c*D2R,dl=(d-b)*D2R;
  var y=Math.sin(dl)*Math.cos(p2),x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return (Math.atan2(y,x)/D2R+360)%360;
 }
 function distKm(a,b,c,d){
  var p1=a*D2R,p2=c*D2R,dp=(c-a)*D2R,dl=(d-b)*D2R;
  var h=Math.sin(dp/2)*Math.sin(dp/2)+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)*Math.sin(dl/2);
  return 12742*Math.asin(Math.sqrt(h));
 }
 function setLoc(lat,lon,save){
  CP.loc={lat:lat,lon:lon};
  CP.dist=distKm(lat,lon,JER.lat,JER.lon);
  CP.bearing=CP.dist<0.3?null:bearingTo(lat,lon,JER.lat,JER.lon);
  if(save){try{localStorage.setItem('siddur.loc',JSON.stringify({lat:lat,lon:lon}))}catch(e){}}
  jerM.style.display=CP.bearing==null?'none':'block';
  if(CP.bearing!=null)jerM.style.transform='rotate('+CP.bearing+'deg)';
 }
 function fmtKm(k){return k>=100?Math.round(k).toLocaleString('he-IL'):k.toFixed(1)}
 function heading(a,b,g){
  var x=b*D2R,y=g*D2R,z=a*D2R,h;
  if(Math.abs(b)<50){
   /* phone held flat: direction its top edge points */
   h=Math.atan2(-Math.sin(z)*Math.cos(x),Math.cos(z)*Math.cos(x));
  }else{
   /* phone held upright: direction the back camera points */
   var cY=Math.cos(y),cZ=Math.cos(z),sX=Math.sin(x),sY=Math.sin(y),sZ=Math.sin(z);
   h=Math.atan2(-cZ*sY-sZ*sX*cY,-sZ*sY+cZ*sX*cY);
  }
  if(h<0)h+=2*Math.PI;
  var ang=(screen.orientation&&screen.orientation.angle)||0;
  return (h/D2R+ang)%360;
 }
 function onOrient(e){
  if(e.alpha==null)return;
  if(e.type==='deviceorientation'&&e.absolute===false&&CP.got===2)return; /* prefer absolute */
  var h=(typeof e.webkitCompassHeading==='number')?e.webkitCompassHeading:heading(e.alpha,e.beta||0,e.gamma||0);
  CP.head=h;CP.got=e.type==='deviceorientationabsolute'?2:1;
 }
 function render(){
  if(!CP.open)return;
  if(CP.head!=null){
   if(CP.smooth==null)CP.smooth=CP.head;
   var d=((CP.head-CP.smooth+540)%360)-180;CP.smooth=(CP.smooth+d*0.18+360)%360;
   dial.style.transform='rotate('+(-CP.smooth)+'deg)';
   cpDeg.textContent=Math.round(CP.smooth)+'°';
   if(CP.bearing!=null){
    var diff=((CP.bearing-CP.smooth+540)%360)-180,ad=Math.abs(diff);
    var ok=ad<=5;cp.classList[ok?'add':'remove']('ok');
    if(ok){cpMsg.textContent='✓ פונים לירושלים'}
    else cpMsg.textContent=(diff>0?'סובבו ימינה ':'סובבו שמאלה ')+Math.round(ad)+'°';
   }
  }
  CP.raf=requestAnimationFrame(render);
 }
 function locInfo(){
  if(!CP.loc){cpSub.textContent='מאתר מיקום…';return}
  if(CP.bearing==null){cpMsg.textContent='אתם בירושלים';cpSub.textContent='';return}
  cpSub.textContent='ירושלים: '+Math.round(CP.bearing)+'° · '+fmtKm(CP.dist)+' ק״מ';
 }
 function findMe(){
  cpSub.textContent='מאתר מיקום…';
  if(!navigator.geolocation){cpSub.textContent='לא ניתן לאתר מיקום, בחרו עיר למטה';return}
  navigator.geolocation.getCurrentPosition(function(p){
   citySel.value='';setLoc(p.coords.latitude,p.coords.longitude,true);locInfo();
  },function(){
   if(!CP.loc)cpSub.textContent='אין גישה למיקום. בחרו עיר למטה';
  },{enableHighAccuracy:false,timeout:12000,maximumAge:3600000});
 }
 function openCompass(){
  asStop();CP.open=true;CP.head=null;CP.smooth=null;CP.got=0;
  cp.classList.add('open');cp.classList.remove('ok');
  cpMsg.textContent='מכיילים…';cpDeg.textContent='';
  var saved=null;try{saved=JSON.parse(localStorage.getItem('siddur.loc')||'null')}catch(e){}
  if(saved&&saved.lat!=null){setLoc(saved.lat,saved.lon,false);locInfo()}
  findMe();
  window.addEventListener('deviceorientationabsolute',onOrient,true);
  window.addEventListener('deviceorientation',onOrient,true);
  CP.raf=requestAnimationFrame(render);
  setTimeout(function(){
   if(CP.open&&CP.head==null){cpMsg.textContent='אין חיישן כיוון';cpSub.textContent='המכשיר לא מאפשר גישה לחיישן המצפן'}
  },2500);
 }
 function closeCompass(){
  CP.open=false;cancelAnimationFrame(CP.raf);cp.classList.remove('open');
  window.removeEventListener('deviceorientationabsolute',onOrient,true);
  window.removeEventListener('deviceorientation',onOrient,true);
 }
 function closeTop(){
  if(CP.open){closeCompass();return true}
  if(AS.on){asStop();return true}
  return false;
 }
 CITIES.forEach(function(c,i){var o=document.createElement('option');o.value=i;o.textContent=c[0];citySel.appendChild(o)});
 citySel.addEventListener('change',function(){
  if(citySel.value==='')return;
  var c=CITIES[+citySel.value];setLoc(c[1],c[2],true);locInfo();
 });
 $('cp-find').addEventListener('click',findMe);
 $('cp-close').addEventListener('click',closeCompass);
 $('compass-open').addEventListener('click',openCompass);

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
