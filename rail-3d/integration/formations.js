// 原有程序式外觀另存 v2；編組依可辨識的車型／路線規格，不猜當班派車。來源：FORMATIONS.md。
const repeat=(n,x)=>Array(n).fill(x);
const spec=(id,lengths,widthM,quality='車型標準編組',extra={})=>({id,lengths,widthM,quality,countBasis:'standard',lengthKnown:true,...extra});
const approximate={lengthKnown:false};
// 推估編組：節數有出處，但班表分不出當班是哪一代車／掛幾組，所以不是當班實測值。
// 逐條出處、信心與重驗期限寫在 FORMATIONS.md；閘門 verify_formations.mjs 有獨立的一桶在守。
const estimated=(id,lengths,widthM,quality)=>spec(id,lengths,widthM,quality,{countBasis:'estimated',lengthKnown:false});
export const FORMATIONS={
  '700t':spec('700t',[27,...repeat(10,25),27],3.38),
  emu3000:spec('emu3000',[21.35,...repeat(10,20.3),21.35],2.91),
  taroko:spec('temu1000',repeat(8,21),2.9,'車型標準 8 節；長度暫用近似值',approximate),
  puyuma:spec('temu2000',[22.095,...repeat(6,20.7),22.095],2.9),
  // 前後各一部 E1000＋12 節客車。台鐵官方售票說明寫「PP推拉式自強號第12車親子車廂」，
  // 班表車種名也出現「自強(PP障12)」，兩邊都指向 12 節客車；長度仍是近似值。
  pp:spec('e1000',[17.4,...repeat(12,20),17.4],2.9,'車型標準編組：前後機車＋12 節客車；長度暫用近似值',approximate),
  dr1000:estimated('dr1000',repeat(3,20),2.8,'支線柴聯車平日 2~3 輛，假日加掛 1 輛；班表看不出當班輛數，取平日常態 3 輛'),
  dr3100:estimated('dr3100',repeat(3,20),2.9,'柴聯自強固定 3 輛一組，連假最多 5 組重聯；班表看不出當班組數，取單組 3 輛'),
  // 無當班派車資料者以代表編組推估；來源與限制見 FORMATIONS.md（2026-09-14）。
  commuter:estimated('emu800',repeat(8,20),2.9,'以 EMU700／800 的 8 輛推估；當班可能使用 4／8／10 輛等其他編組'),
  chukuang:estimated('e200',[17,...repeat(8,20)],2.9,'推估機車 1 輛＋客車 8 輛；當班掛車數未提供'),
  blue:estimated('blue',[17,...repeat(4,20)],2.9,'推估機車 1 輛＋客車 4 輛；實際依當班調度'),
  haifeng:spec('haifeng',repeat(4,20),2.9,'官方 4 輛編組；單車長度暫用近似值',approximate),
  shanlan:spec('shanlan',repeat(4,20),2.9,'官方 4 輛編組；單車長度暫用近似值',approximate),
  mingri:estimated('mingri',[17,...repeat(5,20)],2.9,'推估機車 1 輛＋客車 5 輛；鳴日廚房與包車可能採其他編組'),
  star:estimated('e500',[17,...repeat(6,20)],2.9,'推估機車 1 輛＋客車 6 輛；當班掛車數未提供'),
  forest:estimated('dl25',[10,...repeat(5,12)],2,'以林鐵包車資料推估機車 1 輛＋客車 5 輛；本線、園區支線與專列實際編組可能不同'),
  wenhu:spec('wenhu',repeat(4,13.78),2.54,'路線標準編組'),
  c321:spec('c321',repeat(6,23.5),3.2,'路線標準編組'),
  c381:spec('c381',repeat(6,23.5),3.2,'路線標準編組'),
  'metro-short':spec('c381',repeat(3,23.5),3.2,'支線標準編組'),
  y100:spec('y100',repeat(4,68.4/4),2.65,'路線標準編組；單車均分示意'),
  sanying:spec('sanying',repeat(2,17.5),2.6,'路線標準編組；單車均分示意'),
  taichung:spec('taichung',repeat(2,22.17),2.98,'路線標準編組'),
  kaohsiung:spec('kaohsiung',repeat(3,65.45/3),3.15,'路線標準編組；單車均分示意'),
  airportlocal:spec('airportlocal',repeat(4,82/4),3.03,'普通車標準編組；總長約 82 m，單車均分'),
  airportexpress:spec('airportexpress',repeat(5,102/5),3.03,'直達車標準編組；總長約 102 m，單車均分'),
  airportunknown:estimated('airportlocal',repeat(4,20.5),3.03,'缺少官方車種時暫以普通車 4 輛推估；不代表已確認為普通車'),
  danhai:spec('danhai',repeat(5,34.45/5),2.65,'路線標準 5 分節；單節長度示意',{articulated:true}),
  ankeng:spec('ankeng',repeat(5,34.45/5),2.65,'路線標準 5 分節；單節長度示意',{articulated:true}),
  caf:spec('caf',repeat(5,34/5),2.65,'路線標準 5 分節；CAF 代表外觀、長度約值',{articulated:true}),
};
// 世界版：紐約、東京沒有逐班派車資料，一律用路線標準編組（推估）。主力車型已建模的路線用當地車型網格
// （tools/fleet：紐約 R160、R62A、R142，東京 E233、E235、E231），其餘借 C381 圓弧車頭網格；色帶換成路線色（map3d.js 的 tint），
// 標示為外觀示意。逐條出處見 FORMATIONS-world.md。
const R160='路線標準編組（推估）；R160 外觀依照片簡化建模，路線圓標為路線色';
const E233='路線標準編組（推估）；E233 系外觀依照片簡化建模，色帶為路線色';
const R62A='路線標準編組（推估）；R62A／R62 外觀依照片簡化建模，路線圓標為路線色';
const R142='路線標準編組（推估）；R142／R142A 外觀依照片簡化建模，路線圓標為路線色';
const E231='路線標準編組（推估）；E231 系通勤型外觀依照片簡化建模，色帶為路線色';
const E235='路線標準編組（推估）；E235 系外觀依照片簡化建模，車頭與門邊為路線色';
const WORLD_STOCK={
  // 紐約 A 系統（數字線）51 ft 車 10 節、7 線 11 節；B 系統（字母線）60 ft 車，依路線常態節數
  nyc_sched:{
    narrow:[15.6,2.67],wide:[18.4,3.05],sir:[22.9,3.05],r160:[18.35,2.98],r62a:[15.56,2.62],r142:[15.65,2.68],
    routes:{
      // 1、6、6X、42 街接駁線為 R62A，3 線為外觀相同的 R62（NYCT 2025-11 配車表）
      // 2、4、5 線為 R142（4 線另有外觀相近的 R142A）
      '1':['r62a',10,'r62a',R62A],'2':['r142',10,'r142',R142],'3':['r62a',10,'r62a',R62A],'4_Utica':['r142',10,'r142',R142],'4_NewLots':['r142',10,'r142',R142],
      '5_BowlingGreen':['r142',10,'r142',R142],'5_Flatbush':['r142',10,'r142',R142],'5_Nereid':['r142',10,'r142',R142],'6':['r62a',10,'r62a',R62A],'6X':['r62a',10,'r62a',R62A],
      '7':['narrow',11],'7X':['narrow',11],'S_42St':['r62a',6,'r62a',R62A],
      G:['wide',5],J:['r160',8,'r160',R160],Z:['r160',8,'r160',R160],L:['wide',8],M:['r160',8,'r160',R160],S_Franklin:['wide',2],S_Rockaway:['wide',4],SIR:['sir',4],
      // R160 為主力車型的路線（NYCT 2025-11 配車表）
      E:['r160',10,'r160',R160],F_53:['r160',10,'r160',R160],F_63:['r160',10,'r160',R160],FX:['r160',10,'r160',R160],R:['r160',10,'r160',R160],
    },
    fallback:['wide',10],
  },
  // 東京：銀座線 16 m×6、丸之內線 18 m×6（方南町支線 3 節）、大江戶線 16.5 m×8、淺草線 18 m×8，其餘 20 m 級
  tokyo_sched:{
    ginza:[16,2.55],maru:[18,2.78],oedo:[16.5,2.5],asakusa:[18,2.8],std:[20,2.85],e233:[20,2.95],e235:[20,2.95],e231:[20,2.95],tram:[13,2.2],apm:[9,2.5],lrt:[12.5,2.5],mono:[16,3],
    routes:{
      G:['ginza',6],M:['maru',6],Mb:['maru',3],E:['oedo',8],A:['asakusa',8],I:['std',8],S:['std',10],
      H:['std',7],T:['std',10],C:['std',10],Y:['std',10],Z:['std',10],N:['std',6],F:['std',10],
      SA:['tram',1,'c381','路線標準 1 節；外觀示意'],NT:['apm',5,'wenhu','路線標準 5 節；外觀借文湖線網格示意'],
      // JR 東日本（20 m 級；中距離線含綠色車廂取 15 節）
      // 山手線用 E235 網格；中央・總武各停、常磐快速、武藏野、八高線用 E231 網格（500／3000 番台與 209 系簡化成同一款）；
      // E233 系為主力的路線用 E233 網格（中央快速、青梅、五日市 0 番台；京濱東北 1000；東海道・宇都宮・高崎・湘南新宿 3000〔湘南色以單一路線色示意〕；
      // 京葉 5000；橫濱 6000；埼京 7000；南武 8000）
      JY:['e235',11,'e235',E235],JK:['e233',10,'e233',E233],JC:['e233',10,'e233',E233],JB:['e231',10,'e231',E231],JA:['e233',10,'e233',E233],JL:['std',10],JJ:['e231',15,'e231',E231],JO:['std',15],JE:['e233',10,'e233',E233],
      JT:['e233',15,'e233',E233],JU:['e233',15,'e233',E233],JS:['e233',15,'e233',E233],JN:['e233',6,'e233',E233],JM:['e231',8,'e231',E231],JH:['e233',8,'e233',E233],JCO:['e233',10,'e233',E233],JCI:['e233',6,'e233',E233],JHK:['e231',4,'e231',E231],
      // 私鐵（東急池上・多摩川、東武龜戶・大師、京成、京急為 18 m 級）
      TY:['std',8],MG:['std',8],DT:['std',10],OM:['std',5],IK:['asakusa',3],TM:['asakusa',3],SG:['lrt',2,'c381','路線標準 2 節連接車；外觀示意'],
      OH:['std',10],OT:['std',10],KO:['std',10],KON:['std',10],IN:['std',5],KOS:['std',10],KOT:['std',10],KOK:['std',6],KOD:['std',4],
      SI:['std',10],SS:['std',10],SSH:['std',10],SK:['std',6],ST:['std',4],SW:['std',4],SIT:['std',4],SIY:['std',10],SSE:['std',4],
      TS:['std',10],TSO:['std',10],TSK:['asakusa',2],TSD:['asakusa',2],TJ:['std',10],
      KS:['asakusa',8],KSO:['asakusa',8],KSK:['asakusa',4],HS:['asakusa',8],KK:['asakusa',8],KKA:['asakusa',8],
      TX:['std',6],R:['std',10],
      MO:['mono',6,'wenhu','路線標準 6 節；單軌車外觀借文湖線網格示意'],TT:['mono',4,'wenhu','路線標準 4 節；單軌車外觀借文湖線網格示意'],
      U:['apm',6,'wenhu','路線標準 6 節；外觀借文湖線網格示意'],
    },
    fallback:['std',8],
  },
};
const worldFormations=new Map();
function worldFormation(v){
  const stock=WORLD_STOCK[v.systemId];if(!stock)return null;
  const [kind,count,mesh='c381',quality='路線標準編組（推估）；外觀示意，色帶為路線色']=stock.routes[v.routeId]||stock.fallback;
  const [carM,widthM]=stock[kind],key=[v.systemId,v.routeId,v.color].join('|');
  if(!worldFormations.has(key))worldFormations.set(key,estimated(mesh,repeat(count,carM),widthM,quality));
  const f=worldFormations.get(key);f.tint=v.color||null;return f;
}
function baseFormation(v){
  if(WORLD_STOCK[v.systemId])return worldFormation(v);
  if(v.systemId==='thsr_sched')return FORMATIONS['700t'];
  if(v.systemId==='tra_sched'){
    const cn=v.carName||'',stock=v.stockId;
    // 名冊有固定車次的具名列車都要在這裡有一列，漏一列就默默退到下面的 emu800 代表外觀
    // （2026-07-25 環島之星補了 trainNos、這裡沒跟上，它就被畫成通勤電聯車七週）。
    // 山海號／平原號是本站虛構的環島觀光列車（兄弟車，在枋寮擦肩），沿用鳴日號那組機車＋
    // 觀景客車外觀——鳴日號本身無固定車次，這個外觀沒有任何實際班次在用，不會撞到真車。
    const named={'blue-train':'blue',haifeng:'haifeng',shanlan:'shanlan',mingri:'mingri',
      star:'star',shanhai:'mingri',pingyuan:'mingri'}[v.namedId];if(named)return FORMATIONS[named];
    if(stock==='emu3000'||/^自強\(3000|^110[KM]$/.test(cn))return FORMATIONS.emu3000;
    if(stock==='taroko'||cn.includes('(太,'))return FORMATIONS.taroko;
    if(stock==='puyuma'||cn.includes('(普,'))return FORMATIONS.puyuma;
    if(stock==='pp'||cn.includes('(PP'))return FORMATIONS.pp;
    if(stock==='dr3100'||cn.includes('(D31'))return FORMATIONS.dr3100;
    if(stock==='chukuang'||/莒光|普通車/.test(cn))return FORMATIONS.chukuang;
    if(/區間/.test(cn)&&['pingxi','shenao','jiji','neiwan'].includes(v.branchId))return FORMATIONS.dr1000;
    return FORMATIONS.commuter;
  }
  if(v.systemId==='afr_sched')return FORMATIONS.forest;
  if(['mrt','trtc'].includes(v.systemId)){
    if(v.routeId==='BR')return FORMATIONS.wenhu;if(v.routeId==='Y')return FORMATIONS.y100;
    if(['R_XBT','G_XBT'].includes(v.routeId))return FORMATIONS['metro-short'];
    if(v.routeId==='BL')return FORMATIONS.c321;
    if(/^(R|G|O_XINZHUANG|O_LUZHOU)$/.test(v.routeId))return FORMATIONS.c381;
  }
  if(v.systemId==='sanying')return FORMATIONS.sanying;if(v.systemId==='tmrt')return FORMATIONS.taichung;
  if(v.systemId==='tymc')return FORMATIONS['airport'+(v.airportService||'unknown')];
  if(v.systemId==='ntdlrt')return FORMATIONS.danhai;if(v.systemId==='ntalrt')return FORMATIONS.ankeng;
  if(v.systemId==='krtc')return v.routeId==='C'?FORMATIONS.caf:['R','O','KR','KO'].includes(v.routeId)?FORMATIONS.kaohsiung:null;
  return null;
}
const variants=new WeakMap();
export function formationFor(v,mode='actual'){
  const base=baseFormation(v);if(!base)return null;
  let pair=variants.get(base);if(!pair){pair={};variants.set(base,pair);}mode=mode==='three'?'three':'actual';if(pair[mode])return pair[mode];
  // 三節示意取首、中、尾；本來就不到三節的（臺中捷運、三鶯線各 2 節）維持原節數——
  // 示意模式是把長列車縮短，不該反而多長一節出來。
  const compact=(mode==='three'||base.countBasis==='unknown')&&base.lengths.length>3,
    lengths=compact?[base.lengths[0],base.lengths[Math.floor(base.lengths.length/2)],base.lengths.at(-1)]:base.lengths;
  const countBasis=base.countBasis,actualCarCount=countBasis==='unknown'?null:base.lengths.length;
  return pair[mode]={...base,lengths,compact,mode,countBasis,actualCarCount,key:[base.id,base.lengths.length,mode,countBasis,base.tint||''].join(':'),
    caption:mode==='three'?'3 節示意':countBasis==='unknown'?'3 節示意 · 當班編組待確認'
      :`${base.lengths.length} ${base.articulated?'分節':'節'} · ${countBasis==='estimated'?'推估編組':'標準編組'}`};
}
// 環線回到起站不代表反向；用逐站的小幅前進判斷，真正折返的混合序列交回動態軌跡。
export function stationDirection(a,b,count,loop=false){let d=b-a;if(!Number.isFinite(d))return null;if(loop&&count>1){if(d>count/2)d-=count;if(d<-count/2)d+=count;}return Math.sign(d)||null;}
export function tripDirection(tr,count,loop=false){if(!Array.isArray(tr))return null;const signs=new Set();for(let i=2;i<tr.length;i+=2){const d=stationDirection(tr[i-2],tr[i],count,loop);if(d)signs.add(d);}return signs.size===1?[...signs][0]:null;}
export function assembleFormation(spec,catalog){
  const template=catalog.models[spec.id];if(!template)throw Error('缺少列車外觀 '+spec.id);
  let lengths=spec.lengths;
  // 鉸接外觀原本有長短節，照原節比例分配已知總長；短編組拿首、中、尾，不塞入三整列輕軌。
  const sources=spec.articulated?(spec.compact?[template.parts[0],template.parts[2],template.parts[4]]:template.parts):lengths.map((_,i)=>i===0?template.parts[0]:i===lengths.length-1?template.parts.at(-1):template.parts[1]);
  if(spec.articulated){const full=template.parts.map(p=>{const m=catalog.meshes[p.mesh];return m.max[0]-m.min[0];}),scale=(spec.compact?FORMATIONS[spec.id].lengths:spec.lengths).reduce((a,b)=>a+b,0)/full.reduce((a,b)=>a+b,0);lengths=sources.map(p=>{const m=catalog.meshes[p.mesh];return (m.max[0]-m.min[0])*scale;});}
  // 鉸接輕軌的無轉向架車節，網格底部原本就比整列軌面高。這些 section 是從同一個
  // 完整模型切出來的，Z 仍共用同一座標系；不能在載入時把每節的 minZ 各自歸零。
  const sharedGroundZ=spec.articulated?Math.min(...sources.map(p=>catalog.meshes[p.mesh].min[2])):null;
  const lengthM=lengths.reduce((a,b)=>a+b,0);let front=lengthM/2;
  const parts=lengths.map((lengthM,i)=>{const first=i===0,last=i===lengths.length-1,source=sources[i],offsetM=front-lengthM/2;front-=lengthM;
    const gap=spec.articulated?.04:.16,leftGap=last?0:gap,rightGap=first?0:gap,groundAnchorZ=sharedGroundZ??catalog.meshes[source.mesh].min[2];
    return {...source,lengthM,bodyLengthM:lengthM-leftGap-rightGap,bodyShiftM:(leftGap-rightGap)/2,offsetM,groundAnchorZ};});
  return {...template,...spec,displayWidthM:spec.widthM,lengthM,parts,illustrative:true,lengthScale:1};
}
