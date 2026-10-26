import {initializeApp} from 'firebase/app';
import {getAuth,signInAnonymously,signInWithEmailAndPassword,signOut,onAuthStateChanged} from 'firebase/auth';
import template from './template.json';
import {validateSurvey,validateAnswers} from '../lib/model.js';
export const configured=!!(import.meta.env.VITE_FIREBASE_API_KEY&&import.meta.env.VITE_FIREBASE_AUTH_DOMAIN&&import.meta.env.VITE_FIREBASE_PROJECT_ID);
export const demo=!configured&&(import.meta.env.DEV||import.meta.env.VITE_DEMO_MODE==='true');
export const auth=!configured?null:getAuth(initializeApp({apiKey:import.meta.env.VITE_FIREBASE_API_KEY,authDomain:import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,projectId:import.meta.env.VITE_FIREBASE_PROJECT_ID}));
export {signInWithEmailAndPassword,signOut,onAuthStateChanged,template};
export const newSurvey=(phase='post')=>({...structuredClone(template),title:template.title+` · ${phase==='pre'?'사전':'사후'}`,questions:structuredClone(template.questions.filter(q=>phase!=='pre'||!['S','U'].includes(q.id.replace(/\d+/g,''))))});
const read=()=>JSON.parse(localStorage.getItem('survey-note-demo')||'{"surveys":{},"responses":{}}');
export async function api(op,id,body,after){
 if(demo){
  const d=read(),s=d.surveys[id];let out;
  if(op==='list')return d.surveys;
  if(op==='save'){validateSurvey(body);if(s?.locked)throw Error('배포 후에는 복제하여 수정하세요.');d.surveys[id]=body;out={ok:true};}
  if(op==='status'){s.status=body.status;s.locked=true;out={ok:true};}
  if(op==='public'){if(!s||s.status!=='open')throw Error('응답을 받지 않는 설문입니다.');return s;}
  if(op==='start')return {ticket:String(Date.now())};
  if(op==='submit'){if(s?.status!=='open')throw Error('마감된 설문입니다.');validateAnswers(s,body.a);d.responses[id]||=[];d.responses[id].push({a:body.a,d:Math.round((Date.now()-Number(body.ticket))/1000),t:Math.floor(Date.now()/1000),key:crypto.randomUUID()});out={ok:true};}
  if(op==='responses')return {rows:d.responses[id]||[],next:null};
  localStorage.setItem('survey-note-demo',JSON.stringify(d));return out;
 }
 await auth.authStateReady();
 if(['start','submit'].includes(op)&&!auth.currentUser)await signInAnonymously(auth);
 const token=await auth.currentUser?.getIdToken();
 const p=new URLSearchParams({op,...(id?{id}:{}),...(after?{after}:{})});
 const response=await fetch(`/api/survey?${p}`,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const result=await response.json();if(!response.ok)throw Error(result.error||'요청에 실패했습니다.');return result;
}
export const duration=s=>s==null?'—':`${Math.floor(s/60)}분 ${Math.round(s%60)}초`;
