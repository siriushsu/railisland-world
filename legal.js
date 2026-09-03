(function(){
  'use strict';
  const KEY='trainmap-language';
  const norm=value=>{const v=String(value||'').toLowerCase();if(v.startsWith('zh'))return'zh-TW';if(v.startsWith('ja'))return'ja';if(v.startsWith('en'))return'en';return''};
  const titles={
    privacy:{'zh-TW':'軌島・世界隱私權政策','en':'Rail Island World Privacy Policy','ja':'軌島・世界 プライバシーポリシー'},
    terms:{'zh-TW':'軌島・世界服務條款','en':'Rail Island World Terms of Use','ja':'軌島・世界 利用規約'},
    support:{'zh-TW':'軌島・世界 App 支援','en':'Rail Island World App Support','ja':'軌島・世界 App サポート'}
  };
  const page=document.body.dataset.page;
  const choose=()=>{try{return norm(new URLSearchParams(location.search).get('lang'))||norm(localStorage.getItem(KEY))||(navigator.languages||[navigator.language]).map(norm).find(Boolean)||'zh-TW'}catch(_){return'zh-TW'}};
  const setLang=(lang,persist)=>{
    lang=norm(lang)||'zh-TW';document.documentElement.dataset.legalLang=lang;document.documentElement.lang=lang==='zh-TW'?'zh-Hant':lang;
    document.querySelectorAll('[data-set-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.setLang===lang)));
    if(titles[page])document.title=titles[page][lang]+'｜Rail Island World';
    if(persist){try{localStorage.setItem(KEY,lang);const url=new URL(location.href);url.searchParams.set('lang',lang);history.replaceState(null,'',url)}catch(_){}}
  };
  document.querySelectorAll('[data-set-lang]').forEach(button=>button.addEventListener('click',()=>setLang(button.dataset.setLang,true)));
  setLang(choose(),false);
})();
