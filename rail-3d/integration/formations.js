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
// 世界版：紐約、東京沒有逐班派車資料，一律用路線標準編組（推估）。兩城全部路線都用當地車型網格（tools/fleet），
// 同線多車型依車次號碼固定分配；路線色部位由 map3d.js 的 tint 換色。逐條出處見 FORMATIONS-world.md。
const NYC='路線標準編組（推估）；車型依 NYCT 配車表推估分配（依車次號碼固定），外觀依照片簡化建模，路線圓標為路線色';
const FLEET='路線標準編組（推估）；車型依該線主力／少數車型推估分配（依車次號碼固定），外觀依照片簡化建模';
const WORLD_STOCK={
  // 紐約 A 系統（數字線）51 ft 車 10 節、7 線 11 節；B 系統（字母線）60 ft 車，依路線常態節數
  nyc_sched:{
    narrow:[15.6,2.67],wide:[18.4,3.05],r160:[18.35,2.98],r62a:[15.56,2.62],r142:[15.65,2.68],r211:[18.35,3.05],r68:[22.77,3.05],
    routes:{
      // NYCT 2025-11 配車表（catalog 的 main 權重 1、minor 0.3）；每班依車次號碼固定分配一款。
      // R68A 與 R68、R142A／R188 與 R142、R179／R143 與 R160、R211S 與 R211 外觀相近，共用同一份網格。
      '1':['r62a',10,'r62a',NYC],'3':['r62a',10,'r62a',NYC],'6':['r62a',10,'r62a',NYC],'6X':['r62a',10,'r62a',NYC],'S_42St':['r62a',6,'r62a',NYC],
      '2':['r142',10,'r142',NYC],'4_Utica':['r142',10,'r142',NYC],'4_NewLots':['r142',10,'r142',NYC],
      '5_BowlingGreen':['r142',10,'r142',NYC],'5_Flatbush':['r142',10,'r142',NYC],'5_Nereid':['r142',10,'r142',NYC],
      '7':['r142',11,'r142',NYC],'7X':['r142',11,'r142',NYC],
      A_FarRockaway:['r211',10,[['r211',1],['r160',1]],NYC],A_Lefferts:['r211',10,[['r211',1],['r160',1]],NYC],A_RockawayPark:['r211',10,[['r211',1],['r160',1]],NYC],
      C:['r211',10,[['r211',1],['r160',1]],NYC],G:['r211',5,'r211',NYC],S_Rockaway:['r211',4,[['r211',1],['r160',0.3]],NYC],
      E:['r160',10,'r160',NYC],F_53:['r160',10,'r160',NYC],F_63:['r160',10,'r160',NYC],FX:['r160',10,'r160',NYC],R:['r160',10,'r160',NYC],
      J:['r160',8,'r160',NYC],Z:['r160',8,'r160',NYC],M:['r160',8,'r160',NYC],L:['r160',8,'r160',NYC],
      // 75 呎車：B、D 線 8 節，N、Q、W 線 8 節（R68／R68A 為主、R46 汰換中）
      B:['r68',8,[['r68',1],['r211',0.3,'r211',10]],NYC],D:['r68',8,[['r68',1],['r211',0.3,'r211',10]],NYC],
      N_Bridge:['r68',8,[['r68',1],['r46',0.3]],NYC],N_Tunnel:['r68',8,[['r68',1],['r46',0.3]],NYC],Q:['r68',8,[['r68',1],['r46',0.3]],NYC],W:['r68',8,[['r68',1],['r46',0.3]],NYC],
      S_Franklin:['r68',2,'r68',NYC],
      SIR:['r211',4,'r211',NYC],
    },
    fallback:['wide',10],
  },
  // TOKYO-FLEET 開始（tools/fleet/map_tokyo_fleet.py 產生，請勿手改）
  tokyo_sched:{
    ginza:[16,2.55],maru:[18,2.78],oedo:[16.5,2.5],asakusa:[18,2.8],std:[20,2.85],tram:[13,2.2],agt:[9,2.5],setagaya:[8.25,2.5],mo:[15.2,3.0],tt:[14.6,2.98],
    routes:{
      "G":['ginza',6,'tm1000',FLEET],"M":['maru',6,'tm2000',FLEET],"Mb":['maru',3,'tm2000',FLEET],"E":['oedo',8,[['toei12600',1],['toei12000',0.3]],FLEET],
      "A":['asakusa',8,[['toei5500',1],['hokuso7300',0.3],['hokuso7500',0.3],['hokuso9100',0.3],['keikyu1000',0.3],['keikyu600',0.3],['keisei3000',0.3],['keisei3100',0.3],['keisei3700',0.3]],FLEET],"I":['std',8,[['toei6300',1],['toei6500',1],['sotetsu21000',0.3],['tm9000',0.3],['tokyu3000',0.3],['tokyu3020',0.3],['tokyu5080',0.3]],FLEET],"S":['std',10,[['keio9000',1],['toei10300',1],['keio5000',0.3]],FLEET],"H":['std',7,[['tm13000',1],['tobu70000',1]],FLEET],
      "T":['std',10,[['tm05',1],['tm15000',1],['jre231800',0.3],['tm07',0.3],['toyo2000',0.3]],FLEET],"C":['std',10,[['tm16000',1],['jre2332000',0.3],['odakyu4000',0.3]],FLEET],"Y":['std',10,[['tm10000',1],['tm17000',1],['seibu40000',0.3],['seibu6000',0.3],['sotetsu20000',0.3],['tobu50000',0.3],['tobu9000',0.3],['tokyu5050',0.3]],FLEET],"Z":['std',10,[['tm18000',1],['tobu50050',1],['tokyu2020',1],['tokyu5000',1],['tm08',0.3],['tm8000',0.3]],FLEET],
      "N":['std',6,[['tm9000',1],['saitama2000',0.3],['sotetsu21000',0.3],['toei6300',0.3],['toei6500',0.3],['tokyu3000',0.3],['tokyu3020',0.3],['tokyu5080',0.3]],FLEET],"F":['std',10,[['tm10000',1],['tm17000',1],['seibu40000',0.3],['seibu6000',0.3],['sotetsu20000',0.3],['tobu50000',0.3],['tobu9000',0.3],['tokyu5050',0.3],['yokohamay500',0.3]],FLEET],"SA":['tram',1,[['toden7700',1],['toden8800',1],['toden8900',1],['toden9000',0.3]],FLEET],"NT":['agt',5,[['nt300',1],['nt330',1]],FLEET],
      "JY":['std',11,'e235',FLEET],"JK":['std',10,'e233',FLEET],"JC":['std',10,'e233',FLEET],"JB":['std',10,[['jre231500',1],['e231',0.3],['e235',0.3],['jre231800',0.3]],FLEET],
      "JA":['std',10,[['e233',1],['sotetsu12000',0.3],['twr70000',0.3],['twr71000',0.3]],FLEET],"JL":['std',10,[['jre2332000',1],['tm16000',1],['odakyu4000',0.3]],FLEET],"JJ":['std',15,[['e231',1],['jre531',1]],FLEET],"JO":['std',15,'jre2351000',FLEET],
      "JE":['std',10,[['e233',1],['jr209500',0.3]],FLEET],"JT":['std',15,[['jre2311000',1],['jre2333000',1]],FLEET],"JU":['std',15,[['jre2311000',1],['jre2333000',1]],FLEET],"JS":['std',15,[['jre2311000',1],['jre2333000',1]],FLEET],
      "JN":['std',6,'jre2338000',FLEET],"JM":['std',8,[['e231',1],['jr209500',1],['e233',0.3]],FLEET],"JH":['std',8,[['jre2336000',1],['jre131500',0.3]],FLEET],"JCO":['std',10,'e233',FLEET],
      "JCI":['std',6,'e233',FLEET],"JHK":['std',4,[['jr2093500',1],['jre2313000',1],['e233',0.3]],FLEET],"TY":['std',8,[['tokyu5050',1],['seibu40000',0.3],['seibu6000',0.3],['sotetsu20000',0.3],['tm10000',0.3],['tm17000',0.3],['tobu50000',0.3],['tobu9000',0.3],['yokohamay500',0.3]],FLEET],"MG":['std',8,[['tm9000',1],['tokyu3000',1],['tokyu3020',1],['tokyu5080',1],['saitama2000',0.3],['sotetsu21000',0.3],['toei6300',0.3],['toei6500',0.3]],FLEET],
      "DT":['std',10,[['tm18000',1],['tokyu2020',1],['tokyu5000',1],['tm08',0.3],['tobu50050',0.3],['tokyu6000',0.3],['tokyu6020',0.3]],FLEET],"OM":['std',5,[['tokyu6000',1],['tokyu6020',1],['tokyu9000',0.3]],FLEET],"IK":['asakusa',3,[['tokyu1000',1],['tokyu7000',1]],FLEET],"TM":['asakusa',3,[['tokyu1000',1],['tokyu7000',1]],FLEET],
      "SG":['setagaya',2,'tokyu300',FLEET],"OH":['std',10,[['odakyu3000',1],['odakyu5000',1],['jre2332000',0.3],['odakyu1000',0.3],['odakyu4000',0.3],['odakyu8000',0.3],['tm16000',0.3]],FLEET],"OT":['std',10,[['odakyu3000',1],['jre2332000',0.3],['odakyu1000',0.3],['odakyu4000',0.3],['odakyu5000',0.3],['odakyu8000',0.3],['tm16000',0.3]],FLEET],"KO":['std',10,[['keio5000',1],['keio8000',1],['keio9000',1],['keio2000',0.3],['keio7000',0.3],['toei10300',0.3]],FLEET],
      "KON":['std',10,[['keio9000',1],['toei10300',1],['keio5000',0.3]],FLEET],"IN":['std',5,'keio1000',FLEET],"KOS":['std',10,[['keio8000',1],['keio9000',1],['keio5000',0.3],['keio7000',0.3],['toei10300',0.3]],FLEET],"KOT":['std',10,[['keio8000',1],['keio7000',0.3],['keio9000',0.3]],FLEET],
      "KOK":['std',6,'keio7000',FLEET],"KOD":['std',4,'keio7000',FLEET],"SI":['std',10,[['seibu20000',1],['seibu30000',1],['seibu40000',1],['seibu6000',1],['sotetsu20000',0.3],['tm10000',0.3],['tm17000',0.3],['tokyu5050',0.3]],FLEET],"SS":['std',10,[['seibu2000',1],['seibu20000',1],['seibu30000',1],['seibu40000',0.3]],FLEET],
      "SSH":['std',10,[['seibu2000',1],['seibu30000',1],['seibu20000',0.3]],FLEET],"SK":['std',6,[['seibu8000',1],['seibu2000',0.3]],FLEET],"ST":['std',4,[['seibu9000',1],['seibu2000',0.3]],FLEET],"SW":['std',4,'seibu101',FLEET],
      "SIT":['std',4,[['seibu20000',0.3],['seibu30000',0.3],['seibu6000',0.3]],FLEET],"SIY":['std',10,[['seibu40000',0.3],['seibu6000',0.3],['tm10000',0.3],['tm17000',0.3],['tokyu5050',0.3]],FLEET],"SSE":['std',4,[['seibu2000',1],['seibu9000',0.3]],FLEET],"TS":['std',10,[['tm18000',1],['tobu10000',1],['tobu50050',1],['tobu70000',1],['tm08',0.3],['tm13000',0.3],['tokyu2020',0.3],['tokyu5000',0.3]],FLEET],
      "TSO":['std',10,[['tm18000',1],['tobu50050',1],['tm08',0.3],['tokyu2020',0.3],['tokyu5000',0.3]],FLEET],"TSK":['std',2,'tobu10000',FLEET],"TSD":['std',2,'tobu10000',FLEET],"TJ":['std',10,[['tobu30000',1],['tobu50000',1],['sotetsu20000',0.3],['tm10000',0.3],['tm17000',0.3],['tobu10000',0.3],['tobu50090',0.3],['tobu9000',0.3],['tobu90000',0.3],['tokyu5050',0.3]],FLEET],
      "KS":['asakusa',8,[['keisei3000',1],['keisei3700',1],['keikyu1000',0.3],['keisei3100',0.3],['keisei3200',0.3],['keisei3400',0.3],['keisei3500',0.3],['keisei3600',0.3],['toei5500',0.3]],FLEET],"KSO":['asakusa',8,[['keisei3000',1],['keisei3700',1],['toei5500',1],['hokuso7300',0.3],['hokuso7500',0.3],['hokuso9100',0.3],['keikyu1000',0.3],['keikyu600',0.3],['keisei3100',0.3]],FLEET],"KSK":['asakusa',4,[['keisei3200',1],['keisei3000',0.3],['keisei3500',0.3]],FLEET],"HS":['asakusa',8,[['hokuso7500',1],['keisei3100',1],['hokuso7300',0.3],['hokuso9100',0.3],['keikyu1000',0.3],['keisei3000',0.3],['keisei3700',0.3],['toei5500',0.3]],FLEET],
      "KK":['asakusa',8,[['keikyu1000',1],['hokuso7300',0.3],['hokuso7500',0.3],['hokuso9100',0.3],['keikyu1500',0.3],['keikyu2100',0.3],['keikyu600',0.3],['keisei3000',0.3],['keisei3100',0.3],['keisei3700',0.3],['toei5500',0.3]],FLEET],"KKA":['asakusa',8,[['keikyu1000',1],['keikyu1500',0.3],['keikyu2100',0.3],['keikyu600',0.3],['keisei3100',0.3],['keisei3700',0.3],['toei5500',0.3]],FLEET],"TX":['std',6,[['tx1000',1],['tx2000',1],['tx3000',1]],FLEET],"R":['std',10,[['twr70000',1],['twr71000',1],['e233',0.3],['sotetsu12000',0.3]],FLEET],
      "MO":['mo',6,[['mo10000',1],['mo1000',0.3]],FLEET],"TT":['tt',4,'tt1000',FLEET],"U":['agt',6,[['u7300',1],['u7500',1]],FLEET],
    },
    fallback:['std',8],
  },
  // TOKYO-FLEET 結束
};
const worldFormations=new Map();
// 同一條線有多種車型時（mesh 為 [[網格, 權重], …]），依車次號碼雜湊固定挑一種：同一班車每次都是同一款，
// 各款出現比例約等於權重。沒有逐班派車資料，所以是推估，不代表當班實際車型。
function pickMesh(mesh,label){
  if(!Array.isArray(mesh))return [mesh];
  let h=2166136261;for(const ch of String(label||''))h=Math.imul(h^ch.charCodeAt(0),16777619);
  h^=h>>>16;h=Math.imul(h,0x85ebca6b);h^=h>>>13;h=Math.imul(h,0xc2b2ae35);h^=h>>>16;   // 收尾混合，車次號碼相近時分配仍平均
  const total=mesh.reduce((a,[,w])=>a+w,0);let x=((h>>>0)/4294967296)*total;
  for(const e of mesh){if((x-=e[1])<0)return [e[0],e[2],e[3]];}const e=mesh.at(-1);return [e[0],e[2],e[3]];
}
function worldFormation(v){
  const stock=WORLD_STOCK[v.systemId];if(!stock)return null;
  const [routeKind,routeCount,meshes='c381',quality='路線標準編組（推估）；外觀示意，色帶為路線色']=stock.routes[v.routeId]||stock.fallback;
  // 網格項目可另帶 [網格, 權重, 車種, 節數]：同線混跑車長不同的車型時（例如 B 線的 75 呎 R68 與 60 呎 R211）各用各的編組
  const [mesh,kind=routeKind,count=routeCount]=pickMesh(meshes,v.publicLabel);
  const [carM,widthM]=stock[kind],key=[v.systemId,v.routeId,v.color,mesh,kind,count].join('|');
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
  // 世界版程序化網格（tools/fleet）本身就是實際寬度：用網格寬，避免同線混跑不同寬度車型時被拉寬或壓扁（寬度比例也會套在高度）。
  const own=template.appearance==='procedural-v1'?catalog.meshes[template.parts[0].mesh]:null,widthM=own?+(own.max[1]-own.min[1]).toFixed(3):spec.widthM;
  return {...template,...spec,widthM,displayWidthM:widthM,lengthM,parts,illustrative:true,lengthScale:1};
}
