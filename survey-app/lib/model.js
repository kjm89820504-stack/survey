export function validateSurvey(s){
 if(!s||typeof s.title!=='string'||!s.title.trim()||s.title.length>200)throw Error('설문 제목은 1~200자로 입력하세요.');
 if(typeof s.description!=='string'||s.description.length>5000)throw Error('설명은 5,000자 이내입니다.');
 if(!Array.isArray(s.questions)||s.questions.length<1||s.questions.length>150)throw Error('문항은 1~150개여야 합니다.');
 const ids=new Set();
 for(const q of s.questions){
  if(!q.id||!/^[\w-]{1,40}$/.test(q.id)||ids.has(q.id))throw Error('문항 ID 오류');ids.add(q.id);
  if(typeof q.title!=='string'||!q.title.trim()||q.title.length>1000)throw Error('문항 내용을 확인하세요.');
  if(typeof q.required!=='boolean'||(q.section!=null&&(typeof q.section!=='string'||q.section.length>100))||(q.hint!=null&&(typeof q.hint!=='string'||q.hint.length>1000)))throw Error('문항 설정 오류');
  if(!['choice','multi','text','number','scale'].includes(q.type))throw Error('문항 유형 오류');
  if(q.upper!=null&&(!Number.isFinite(q.upper)||q.upper<0||q.upper>1000000))throw Error('문항 숫자 범위 오류');
  if(['choice','multi'].includes(q.type)&&(!Array.isArray(q.options)||q.options.length<2||q.options.length>30||q.options.some(x=>typeof x!=='string'||!x.trim()||x.length>200)))throw Error('선택지는 2~30개, 각 200자 이내입니다.');
  if(q.type==='scale'&&(!Number.isInteger(q.min)||!Number.isInteger(q.max)||q.min<0||q.max>10||q.max<=q.min))throw Error('척도 범위 오류');
 }
 return s;
}
export function validateAnswers(s,a){
 if(!Array.isArray(a)||a.length!==s.questions.length)throw Error('응답 문항 수가 일치하지 않습니다.');
 return s.questions.map((q,i)=>{const v=a[i];if(v===''||v===null||(typeof v==='string'&&!v.trim())||(Array.isArray(v)&&!v.length)){if(q.required)throw Error(`${i+1}번 문항에 응답해 주세요.`);return '';}
 if(q.type==='text'&&(typeof v!=='string'||v.length>2000))throw Error('주관식은 2,000자 이내입니다.');
 if(q.type==='number'&&(typeof v!=='number'||!Number.isFinite(v)||v<0||v>(q.upper??1000000)||(q.integer&&!Number.isInteger(v))))throw Error(`${i+1}번 숫자 범위를 확인하세요 (0~${q.upper??1000000}${q.integer?', 정수':''}).`);
 if(q.type==='scale'&&(!Number.isInteger(v)||v<q.min||v>q.max))throw Error('척도 값 오류');
 if(q.type==='choice'&&(!Number.isInteger(v)||v<0||v>=q.options.length))throw Error('선택 값 오류');
 if(q.type==='multi'&&(!Array.isArray(v)||v.length>q.options.length||new Set(v).size!==v.length||v.some(x=>!Number.isInteger(x)||x<0||x>=q.options.length)))throw Error('복수 선택 값 오류');
 return v;
 });
}
export const mean=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
export function scores(s,a){
 const items=Object.fromEntries(s.questions.map((q,i)=>[q.id,a[i]]));
 const nums=ids=>ids.map(id=>items[id]).filter(v=>typeof v==='number');
 const pos=Array.from({length:8},(_,i)=>`POS${i+1}`);
 const p=pos.map(id=>typeof items[id]==='number'?([ 'POS2','POS3','POS5','POS7'].includes(id)?8-items[id]:items[id]):null);
 const bo=Array.from({length:7},(_,i)=>`BO${i+1}`);
 const burnout=ids=>{const v=ids.filter(id=>typeof items[id]==='number').map(id=>id==='BO7'?(items[id]-1)*25:(5-items[id])*25);return v.length>=4?mean(v):null;};
 return {POS:p.every(x=>x!==null)?mean(p):null,CBI7:burnout(bo),CBI6:burnout(bo.filter(id=>id!=='BO2')),UWES:nums(Array.from({length:9},(_,i)=>`WE${i+1}`)).length===9?mean(nums(Array.from({length:9},(_,i)=>`WE${i+1}`))):null};
}
