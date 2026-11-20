import catalog from './i18n-catalog.json' with {type:'json'};
export const LANGS=Object.entries(catalog.locales);
export const S=catalog.messages;

export function detectLang(){
  if(typeof __DS5_LANG!=='undefined'&&__DS5_LANG)return __DS5_LANG;   /* 测试/调试可强制语言 */
  try{
    const saved=localStorage.getItem('ds5.lang');
    if(saved&&LANGS.some(([c])=>c===saved))return saved;
  }catch(e){}
  const nav=(typeof navigator!=='undefined'&&navigator.language)||'';
  if(!nav)return 'zh-CN';                       /* 测试环境/无语言信息 */
  const low=nav.toLowerCase();
  if(low.startsWith('zh'))return /(?:^|-)(?:hant|tw|hk|mo)(?:-|$)/.test(low)?'zh-TW':'zh-CN';
  const exact=LANGS.find(([c])=>c.toLowerCase()===low);
  if(exact)return exact[0];
  const base=low.split('-')[0];
  const hit=LANGS.find(([c])=>c.toLowerCase().split('-')[0]===base);
  return hit?hit[0]:'en';
}

export function makeT(getLang){
  return (key,params)=>{
    const entry=S[key];
    if(!entry)return key;
    let out=entry[getLang()]||entry.en||entry['zh-CN']||key;
    if(params)out=out.replace(/\{(\w+)\}/g,(placeholder,key)=>Object.hasOwn(params,key)?String(params[key]):placeholder);
    return out;
  };
}
