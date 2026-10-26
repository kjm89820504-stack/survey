import {initializeApp,getApps,cert} from 'firebase-admin/app';
import {getAuth} from 'firebase-admin/auth';
import {getDatabase} from 'firebase-admin/database';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {validateSurvey,validateAnswers} from '../lib/model.js';
const sign=s=>createHmac('sha256',process.env.FIREBASE_PRIVATE_KEY).update(s).digest('base64url');
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 try{
  if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'지원하지 않는 요청입니다.'});
  if(!getApps().length)initializeApp({credential:cert({projectId:process.env.FIREBASE_PROJECT_ID,clientEmail:process.env.FIREBASE_CLIENT_EMAIL,privateKey:process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g,'\n')}),databaseURL:process.env.FIREBASE_DATABASE_URL});
  const db=getDatabase(),op=req.query.op,id=req.query.id;
  if(id&&!/^[a-zA-Z0-9_-]{1,60}$/.test(id))return res.status(400).json({error:'잘못된 설문 주소입니다.'});
  const body=req.body||{};
  if(JSON.stringify(body).length>150000)return res.status(413).json({error:'요청이 너무 큽니다.'});
  if(op==='public'&&req.method==='GET'){
   const s=(await db.ref(`surveys/${id}`).get()).val();
   if(!s||s.status!=='open')return res.status(404).json({error:'응답을 받지 않는 설문입니다.'});
   return res.json(s);
  }
  let user;try{user=await getAuth().verifyIdToken((req.headers.authorization||'').replace(/^Bearer /,''));}catch{return res.status(401).json({error:'로그인이 필요합니다.'});}
  if(['start','submit'].includes(op)){
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
   const a=validateAnswers(s,body.a),record={a,d:Math.round(elapsed/1000),t:Math.floor(Date.now()/1000)};
   const result=await db.ref(`responses/${id}/${user.uid}`).transaction(old=>old?undefined:record);
   return res.json({ok:true,duplicate:!result.committed});
  }
  if(!(process.env.ADMIN_UIDS||'').split(',').map(x=>x.trim()).includes(user.uid))return res.status(403).json({error:'관리자 권한이 없습니다.'});
  if(op==='list'&&req.method==='GET')return res.json((await db.ref('surveys').get()).val()||{});
  if(op==='save'&&req.method==='POST'&&id){
   const s=validateSurvey(body);const result=await db.ref(`surveys/${id}`).transaction(old=>old?.locked?undefined:{title:s.title,description:s.description,questions:s.questions,status:'draft',locked:false});
   if(!result.committed)return res.status(409).json({error:'배포한 설문은 복제 후 수정하세요.'});return res.json({ok:true});
  }
  if(op==='status'&&req.method==='POST'&&id){
   if(!['open','closed'].includes(body.status))throw Error('상태 오류');
   // A cold SDK cache can initially supply null even when the survey exists.
   // Returning null permits server conflict detection and retry; undefined aborts early.
   const result=await db.ref(`surveys/${id}`).transaction(old=>old?{...old,status:body.status,locked:true}:null);
   if(!result.committed||!result.snapshot.exists())return res.status(404).json({error:'설문을 찾을 수 없습니다. 목록을 새로고침해 주세요.'});
   return res.json({ok:true});
  }
  if(op==='responses'&&req.method==='GET'&&id){
   let q=db.ref(`responses/${id}`).orderByKey();if(req.query.after){if(!/^[\w-]{1,128}$/.test(req.query.after))throw Error('페이지 오류');q=q.startAfter(req.query.after);}
   const snap=await q.limitToFirst(201).get(),entries=[];snap.forEach(c=>entries.push([c.key,c.val()]));
   const more=entries.length>200;const page=entries.slice(0,200);return res.json({rows:page.map(([key,v])=>({key,...v})),next:more?page.at(-1)[0]:null});
  }
  return res.status(404).json({error:'요청을 찾을 수 없습니다.'});
 }catch(e){console.error(e.code||e.name);return res.status(400).json({error:e.message?.includes('문항')||e.message?.includes('선택')||e.message?.includes('척도')?e.message:'처리하지 못했습니다. 설정과 입력을 확인해 주세요.'});}
}
