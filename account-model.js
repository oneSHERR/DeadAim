import { modeLabels } from './training.js';
export function normalizeNickname(value){const name=String(value).trim().toLowerCase();if(!/^[a-z0-9_]{3,20}$/.test(name))throw new Error('Ник: 3–20 латинских букв, цифр или _. Например, alisher_7.');return name;}
export async function registerIdentity(api,email,password){
  if(password.length<8)throw new Error('Пароль должен содержать минимум 8 символов.');
  const {a,auth}=api;await auth.authStateReady();
  const result=auth.currentUser?.isAnonymous?await a.linkWithCredential(auth.currentUser,a.EmailAuthProvider.credential(email,password)):await a.createUserWithEmailAndPassword(auth,email,password);
  await result.user.getIdToken(true);return result.user;
}
// Explicit allowlist: never upload browser state, passwords or Firebase credentials.
export function cloudResult(row){
  if(!row||!modeLabels[row.mode]||![30,60,120].includes(row.duration))throw new Error('Неизвестный формат тренировки.');
  const d={mode:row.mode,difficulty:row.difficulty||'normal',duration:row.duration,hits:row.hits,shots:row.shots??row.hits,accuracy:row.accuracy,avgMs:row.avgMs||0,elapsedMs:row.elapsedMs||row.duration*1000,completed:!!row.completed,variant:row.variant||'standard',challengeKey:row.variant==='challenge'?String(row.challengeKey||'').slice(0,32):'',missed:row.missed||0,reactionMs:row.reactionMs||0,firstHits:row.firstHits||0,version:row.version||2,timestamp:row.timestamp||0,date:String(row.date||'').slice(0,60)};
  if(!['easy','normal','hard'].includes(d.difficulty)||!['standard','adaptive','challenge'].includes(d.variant)||d.hits<0||d.hits>10000||d.shots<d.hits||d.shots>10000||d.accuracy<0||d.accuracy>100)throw new Error('Некорректный результат.');
  for(const k of ['hits','shots','avgMs','elapsedMs','missed','reactionMs','firstHits','version','timestamp'])if(!Number.isInteger(d[k]))throw new Error('Некорректный результат.');
  if(!Number.isFinite(d.accuracy))throw new Error('Некорректная точность.');return d;
}
