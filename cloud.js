import { anonymousIdentity } from './identity.js';
import { firebaseConfig } from './firebase-config.js';
import { modeLabels, comparableKey } from './training.js';

export function initCloud() {
  const $ = id => document.getElementById(id);
  const panel = document.createElement('section');
  panel.className = 'lab-panel friends-panel';
  panel.innerHTML = `<div class="section-title"><h3>Тренируйся с друзьями</h3><span>SQUAD STATS</span></div>
    <p id="cloudStatus" role="status">${firebaseConfig?'Введи ник и подключись к друзьям. Почта и пароль не нужны.':'Firebase ещё не подключён. Все тренировки и личная статистика уже работают локально.'}</p>
    <label for="playerName">Твой ник (видят участники группы)</label><input id="playerName" maxlength="24" placeholder="Твой ник" autocomplete="nickname">
    <button id="cloudLogin" class="secondary" ${firebaseConfig?'':'disabled'}>Подключиться по нику</button>
    <div id="cloudAccount" hidden>
    <div class="inline-controls"><button id="createRoom" class="secondary">Создать группу</button><label>Код группы<input id="roomCode" maxlength="32" placeholder="Код от друга" autocomplete="off"></label><button id="joinRoom" class="secondary">Вступить</button></div>
    <p id="activeRoom"></p><button id="leaveRoom" class="secondary" hidden>Покинуть группу</button>
    <div class="inline-controls"><label>Режим<select id="friendsMode">${Object.entries(modeLabels).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select></label><label>Сложность<select id="friendsDifficulty"><option value="normal">Нормально</option><option value="easy">Легко</option><option value="hard">Сложно</option></select></label><label>Серия<select id="friendsDuration"><option value="60">60 сек</option><option value="30">30 сек</option><option value="120">120 сек</option></select></label><button id="refreshFriends" class="secondary">Обновить</button></div>
    <div id="friendsBoard" class="empty">Вступи в группу, чтобы увидеть результаты.</div>
    <p class="field-note">В группу отправляются новые завершённые серии, пока ты подключён к группе. Ник и результаты видны участникам. Старые локальные серии автоматически не загружаются. Это дружеское сравнение без защиты от подделки результатов.</p>
    <button id="retryUpload" class="secondary" hidden>Повторить отправку результатов</button></div>`;
  $('history').parentElement.after(panel);
  let api, user=null, room=null, loading, busy=false, failed=[];
  const status=text=>$('cloudStatus').textContent=text;
  const explain=e=>({
    'auth/operation-not-allowed':'Включи Anonymous в Firebase → Authentication → Sign-in method.',
    'auth/network-request-failed':'Нет связи с Firebase. Проверь интернет и повтори подключение.',
    'auth/unauthorized-domain':'Добавь домен сайта в Firebase Authentication → Settings → Authorized domains.',
    'permission-denied':'Нет доступа. Проверь членство в группе и опубликованные правила Firestore.',
    'unavailable':'Нет связи с Firebase. Локальная тренировка продолжает работать.'
  }[e.code]||e.message||'Не удалось выполнить действие. Повтори позже.');
  async function load() {
    if(api)return api;
    if(!loading)loading=(async()=>{
      const base='https://www.gstatic.com/firebasejs/12.19.0/';
      const [app,a,f]=await Promise.all([import(base+'firebase-app.js'),import(base+'firebase-auth.js'),import(base+'firebase-firestore.js')]);
      const instance=app.initializeApp(firebaseConfig),auth=a.getAuth(instance),db=f.getFirestore(instance);
      api={a,f,auth,db};
      return api;
    })().catch(e=>{loading=null;throw e;});
    return loading;
  }
  async function action(fn) {
    if(busy)return;busy=true;
    try{await fn();}catch(e){status(explain(e));}finally{busy=false;}
  }
  function requireUser(){if(!user)throw new Error('Сначала введи ник и нажми «Подключиться по нику».');}
  function selectedKey(){return `${$('friendsMode').value}|${$('friendsDifficulty').value}|${$('friendsDuration').value}`;}
  async function refresh(){
    requireUser();if(!room)throw new Error('Сначала вступи в группу.');
    const currentRoom=room,currentUser=user.uid,{f,db}=api;
    const snapshot=await f.getDocs(f.query(f.collection(db,'deadaimRooms',room,'results'),f.orderBy('createdAt','desc'),f.limit(200)));
    if(room!==currentRoom||user?.uid!==currentUser)return;
    const best=new Map();
    for(const doc of snapshot.docs){const r=doc.data();if(comparableKey(r)!==selectedKey())continue;const score=r.mode==='track'?r.accuracy:r.hits/r.duration;const old=best.get(r.uid);if(!old||score>old.score||(score===old.score&&r.accuracy>old.accuracy))best.set(r.uid,{...r,score});}
    const board=$('friendsBoard');board.replaceChildren();
    if(!best.size)board.textContent='Для этих параметров пока нет результатов среди последних 200 серий группы.';
    [...best.values()].sort((a,b)=>b.score-a.score||b.accuracy-a.accuracy).forEach((r,i)=>{const row=document.createElement('div');row.className='history-row';for(const value of [`${i+1}. ${r.name}`,r.mode==='track'?`${r.score.toFixed(1)}% удержания`:`${r.score.toFixed(2)} попадания/с`,`${r.accuracy.toFixed(1)}%`,`${r.duration} сек`]){const el=document.createElement('span');el.textContent=value;row.append(el);}board.append(row);});
    status('Таблица обновлена. Лучшие результаты среди последних 200 серий группы.');
  }
  function selectRoom(code){room=code;$('activeRoom').textContent=`Код приглашения: ${code} · передай друзьям`;$('leaveRoom').hidden=false;}
  try { $('playerName').value=localStorage.getItem('deadaim-nickname')||''; } catch {}
  $('playerName').addEventListener('change',()=>{try{localStorage.setItem('deadaim-nickname',$('playerName').value.trim().slice(0,24));}catch{}});
  $('cloudLogin').addEventListener('click',()=>action(async()=>{
    const nickname=$('playerName').value.trim();
    if(!nickname)throw new Error('Сначала введи свой ник.');
    if(!firebaseConfig)throw new Error('Firebase ещё не настроен.');
    status('Подключаю…');
    const {auth,a}=await load();
    user=await anonymousIdentity(auth,a.signInAnonymously);
    try{localStorage.setItem('deadaim-nickname',nickname.slice(0,24));}catch{}
    $('cloudAccount').hidden=false;$('cloudLogin').hidden=true;
    status('Готово! Создай группу или введи код друга. Ник можно менять; твой ID в этом браузере сохраняется.');
  }));
  $('createRoom').addEventListener('click',()=>action(async()=>{requireUser();if(room)throw new Error('Сначала покинь текущую группу.');const code=crypto.randomUUID().replaceAll('-','').slice(0,24),{f,db}=api;await f.setDoc(f.doc(db,'deadaimRooms',code),{members:[user.uid],createdAt:f.serverTimestamp()});selectRoom(code);await refresh();}));
  $('joinRoom').addEventListener('click',()=>action(async()=>{
    requireUser();if(room)throw new Error('Сначала покинь текущую группу.');const code=$('roomCode').value.trim().toLowerCase();if(!/^[a-f0-9]{24}$/.test(code))throw new Error('Код должен содержать 24 символа. Скопируй его у друга.');
    const {f,db}=api,ref=f.doc(db,'deadaimRooms',code),uid=user.uid;
    await f.runTransaction(db,async tx=>{const snap=await tx.get(ref);if(!snap.exists())throw new Error('Группа не найдена. Проверь код.');const members=snap.data().members;if(members.includes(uid))return;if(members.length>=20)throw new Error('В группе уже 20 участников.');tx.update(ref,{members:[...members,uid]});});selectRoom(code);await refresh();
  }));
  $('leaveRoom').addEventListener('click',()=>action(async()=>{requireUser();if(!room)return;await api.f.updateDoc(api.f.doc(api.db,'deadaimRooms',room),{members:api.f.arrayRemove(user.uid)});room=null;$('activeRoom').textContent='Ты покинул группу. Ранее отправленные результаты остаются у её участников.';$('leaveRoom').hidden=true;$('friendsBoard').textContent='Выбери группу.';}));
  $('refreshFriends').addEventListener('click',()=>action(refresh));
  for(const id of ['friendsMode','friendsDifficulty','friendsDuration'])$(id).addEventListener('change',()=>{if(room)action(refresh);});
  async function send(item){const {f,db}=api;if(user?.uid!==item.uid)throw new Error('Исходный профиль недоступен. Результат сохранён локально.');await f.setDoc(f.doc(db,'deadaimRooms',item.room,'results',item.id),{...item.data,createdAt:f.serverTimestamp()});}
  $('retryUpload').addEventListener('click',()=>action(async()=>{const pending=[...failed];for(const item of pending){await send(item);failed=failed.filter(x=>x!==item);}$('retryUpload').hidden=!failed.length;status('Результаты отправлены.');if(room)await refresh();}));
  return {submit(row){
    if(!user||!room)return;
    const item={uid:user.uid,room,id:`${user.uid}_${row.id}`,data:{uid:user.uid,name:($('playerName').value.trim()||'Игрок').slice(0,24),mode:row.mode,difficulty:row.difficulty,duration:row.duration,hits:row.hits,shots:row.shots,accuracy:row.accuracy,avgMs:row.avgMs}};
    send(item).then(()=>status('Результат отправлен в группу. Нажми «Обновить» для сравнения.')).catch(e=>{failed.push(item);$('retryUpload').hidden=false;status(`Результат сохранён локально; отправка не завершена. ${explain(e)}`);});
  }};
}
