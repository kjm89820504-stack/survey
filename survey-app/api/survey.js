import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {validateSurvey,validateAnswers} from '../lib/model.js';
const sign=s=>createHmac('sha256',process.env.FIREBASE_PRIVATE_KEY).update(s).digest('base64url');
const VERSION='SV2';
function safeLogMessage(error,req){
 let message=String(error?.message||'Unknown error');
 // Never log credentials, request bodies, or authorization headers.
 const secrets=Object.entries(process.env).filter(([k,v])=>v&&(k.startsWith('FIREBASE_')||k==='ADMIN_UIDS')).flatMap(([,v])=>[v,v.replace(/\\n/g,'\n')]);
 if(req.headers?.authorization)secrets.push(req.headers.authorization,req.headers.authorization.replace(/^Bearer /,''));
 for(const secret of secrets.sort((a,b)=>b.length-a.length))if(secret.length>3)message=message.split(secret).join('[REDACTED]');
 return message.replace(/-----BEGIN[^]*?-----END[^\n]*?-----/g,'[REDACTED KEY]').replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[REDACTED EMAIL]').slice(0,1500);
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Survey-API-Version',VERSION);
 let stage='INIT';
 try{
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'지원하지 않는 요청입니다.'});
  if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')}),databaseURL:process.env.FIREBASE_DATABASE_URL});
  const db=getDatabase(),op=req.query.op,id=req.query.id;
  if(id&&!/^[a-zA-Z0-9_-]{1,60}$/.test(id))return res.status(400).json({error:'잘못된 설문 주소입니다.'});
  stage='BODY';
  let body=req.body??{};
  if(Buffer.isBuffer(body))body=body.toString('utf8');
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{return res.status(400).json({error:'[SV2-BODY] 요청 형식을 읽지 못했습니다. 페이지를 새로고침해 주세요.'});}}
  if(!body||typeof body!=='object'||Array.isArray(body))return res.status(400).json({error:'[SV2-BODY] 요청 형식이 올바르지 않습니다.'});
  if(JSON.stringify(body).length>150000)return res.status(413).json({error:'요청이 너무 큽니다.'});
  if(op==='public'&&req.method==='GET'){
   stage='PUBLIC_READ';
   const s=(await db.ref(`surveys/${id}`).get()).val();
   if(!s||s.status!=='open')return res.status(404).json({error:'응답을 받지 않는 설문입니다.'});
   return res.json(s);
  }
  let user;try{user=await getAuth().verifyIdToken((req.headers.authorization||'').replace(/^Bearer /,''));}catch{return res.status(401).json({error:'로그인이 필요합니다.'});}
  if(['start','submit'].includes(op)){
   stage=op==='start'?'START':'SUBMIT';
   if(req.method!=='POST'||!id)return res.status(400).json({error:'잘못된 요청'});
   const s=(await db.ref(`surveys/${id}`).get()).val();
   if(!s||s.status!=='open')return res.status(409).json({error:'설문이 마감되었습니다.'});
   if(op==='start'){
    if((await db.ref(`responses/${id}/${user.uid}`).get()).exists())return res.status(409).json({error:'이미 제출한 설문입니다.'});
    const payload=Buffer.from(JSON.stringify({id,u:user.uid,t:Date.now()})).toString('base64url');
    return res.json({ticket:`${payload}.${sign(payload)}`});
   }
   const [payload,sig]=String(body.ticket||'').split('.');const expected=sign(payload||'');
   if(!sig||sig.length!==expected.length||!timingSafeEqual(Buffer.from(sig),Buffer.from(expected)))return res.status(400).json({error:'시작 정보가 유효하지 않습니다.'});
   const ticket=JSON.parse(Buffer.from(payload,'base64url').toString());const elapsed=Date.now()-ticket.t;
   if(ticket.id!==id||ticket.u!==user.uid||elapsed<0||elapsed>86400000)return res.status(400).json({error:'응답 시간이 만료되었습니다. 새로 시작해 주세요.'});
   let a;try{a=validateAnswers(s,body.a);}catch(e){return res.status(400).json({error:e.message});}
   const record={a,d:Math.round(elapsed/1000),t:Math.floor(Date.now()/1000)};
   const result=await db.ref(`responses/${id}/${user.uid}`).transaction(old=>old?undefined:record);
   return res.json({ok:true,duplicate:!result.committed});
  }
  if(!(process.env.ADMIN_UIDS||'').split(',').map(x=>x.trim()).includes(user.uid))return res.status(403).json({error:'관리자 권한이 없습니다.'});
  if(op==='list'&&req.method==='GET'){stage='LIST';return res.json((await db.ref('surveys').get()).val()||{});}
  if(op==='save'&&req.method==='POST'&&id){
   stage='SAVE';
   let s;try{s=validateSurvey(body);}catch(e){return res.status(400).json({error:e.message});}
   const result=await db.ref(`surveys/${id}`).transaction(old=>old?.locked?undefined:{title:s.title,description:s.description,questions:s.questions,status:'draft',locked:false});
   if(!result.committed)return res.status(409).json({error:'배포한 설문은 복제 후 수정하세요.'});return res.json({ok:true});
  }
  if(op==='status'&&req.method==='POST'&&id){
   stage='STATUS';
   if(!['open','closed'].includes(body.status))return res.status(400).json({error:'[SV2-STATUS-INPUT] 수집 상태 값이 올바르지 않습니다. 페이지를 새로고침해 주세요.'});
   // A cold SDK cache can initially supply null even when the survey exists.
   // Returning null permits server conflict detection and retry; undefined aborts early.
   const result=await db.ref(`surveys/${id}`).transaction(old=>old?{...old,status:body.status,locked:true}:null);
   if(!result.committed||!result.snapshot.exists())return res.status(404).json({error:'설문을 찾을 수 없습니다. 목록을 새로고침해 주세요.'});
   return res.json({ok:true});
  }
  if(op==='responses'&&req.method==='GET'&&id){
   stage='RESULTS';
   let q=db.ref(`responses/${id}`).orderByKey();if(req.query.after){if(!/^[\w-]{1,128}$/.test(req.query.after))throw Error('페이지 오류');q=q.startAfter(req.query.after);}
   const snap=await q.limitToFirst(201).get(),entries=[];snap.forEach(c=>entries.push([c.key,c.val()]));
   const more=entries.length>200;const page=entries.slice(0,200);return res.json({rows:page.map(([key,v])=>({key,...v})),next:more?page.at(-1)[0]:null});
  }
  return res.status(404).json({error:'요청을 찾을 수 없습니다.'});
 }catch(e){
  const rawCode=String(e.code||'UNKNOWN');
  const code=/^[a-zA-Z0-9_/-]{1,80}$/.test(rawCode)?rawCode:'UNKNOWN';
  const reference=`${VERSION}-${stage}-${code}`;
  console.error(JSON.stringify({reference,message:safeLogMessage(e,req)}));
  const message=String(e.message||'');
  let help='서버 처리 중 오류가 발생했습니다. 이 식별번호에 해당하는 Vercel Logs 내용을 확인해 주세요.';
  if(/private key|PEM|credential|invalid_grant/i.test(message))help='서버 인증 정보를 확인해 주세요. Vercel의 FIREBASE_PRIVATE_KEY 및 서비스 계정 설정을 확인한 뒤 재배포해 주세요.';
  else if(/database.*url|parse.*url|invalid.*url/i.test(message))help='FIREBASE_DATABASE_URL 값이 Realtime Database의 주소인지 확인해 주세요.';
  else if(/permission.?denied|insufficient.permission/i.test(message+' '+code))help='서버의 데이터베이스 접근 권한을 확인해 주세요. 서비스 계정과 데이터베이스가 같은 프로젝트인지 확인해 주세요.';
  else if(/network|offline|timeout|timed out|ECONN|ENOTFOUND/i.test(message+' '+code))help='데이터베이스 연결에 실패했습니다. 잠시 후 다시 시도하고 데이터베이스 주소와 상태를 확인해 주세요.';
  return res.status(500).json({error:`[${reference}] ${help}`});
 }
}
