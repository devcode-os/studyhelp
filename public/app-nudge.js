/* app-nudge: after login/trial/purchase, push Android phone users (esp. Instagram/Meta browser) to the app */
(function(){
  var ua=navigator.userAgent||'';
  if(!/Android/i.test(ua)||window.Capacitor)return;
  if(/^\/(signup|login|forgot-passcode)/.test(location.pathname))return;
  var K='sh_app_nudge',P='sh_nudge_pending';
  try{if(localStorage.getItem(K)==='never')return;}catch(e){}
  var q=location.search,path=location.pathname;
  var signal=/[?&](trial_started|bundle_success|ca_success)=1/.test(q)||path.indexOf('/payment-processing')===0;
  try{
    if(signal)localStorage.setItem(P,String(Date.now()));
    var p=Number(localStorage.getItem(P)||0);
    if(!p||Date.now()-p>10*60*1000)return;
  }catch(e){if(!signal)return;}
  if(path.indexOf('/payment-processing')===0)return;
  function show(){
    var o=document.createElement('div');
    o.style.cssText='position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.55);display:flex;align-items:flex-end;justify-content:center;padding:0;';
    o.innerHTML='<div style="background:#fff;border-radius:18px 18px 0 0;padding:22px 20px 24px;max-width:480px;width:100%;text-align:center;font-family:inherit;">'+
     '<h2 style="margin:0 0 8px;font-size:1.15rem;color:#1a1a2e;">Install the StudyHelp app</h2>'+
     '<p style="margin:0 0 16px;font-size:.92rem;color:#555;line-height:1.45;">For faster, smoother practice. Open it any time and log in with the same phone number to continue.</p>'+
     '<button type="button" id="shn-i" style="width:100%;padding:13px;border:0;border-radius:10px;background:#4F46E5;color:#fff;font-weight:700;font-size:1rem;">Install on Google Play</button>'+
     '<p style="margin:12px 0 0;"><a href="#" id="shn-x" style="color:#666;text-decoration:underline;font-size:.9rem;">Not now</a></p></div>';
    document.body.appendChild(o);
    try{localStorage.setItem(K,String(Date.now()));}catch(e){}
    o.querySelector('#shn-i').onclick=function(){
      try{localStorage.setItem(K,'never');}catch(e){}
      location.href='intent://details?id=com.fdaytalk.studyhelp#Intent;scheme=market;package=com.android.vending;S.browser_fallback_url='+encodeURIComponent('https://play.google.com/store/apps/details?id=com.fdaytalk.studyhelp')+';end';
    };
    o.querySelector('#shn-x').onclick=function(e){e.preventDefault();o.remove();};
  }
  setTimeout(function(){try{localStorage.removeItem(P);}catch(e){}show();},2500);
})();
