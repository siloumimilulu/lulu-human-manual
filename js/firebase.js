// js/firebase.js
//
// Firebase 초기화 + 공용 헬퍼. index.html(벨루미)과 obs/index.html이
// 이 파일 하나를 <script type="module" src="js/firebase.js"> 로 함께 불러온다.
// 번들러 없이 GitHub Pages에 그대로 올라가야 하므로 CDN의 모듈형 SDK를 쓴다.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  collection, query, where, orderBy, onSnapshot,
  runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-firestore.js";
import {
  getAuth, signInAnonymously, onAuthStateChanged,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyDAaecjB0SB2RRAX9h6L9CKy4Bfn0m_wYs",
  authDomain: "lulu-human-manual.firebaseapp.com",
  projectId: "lulu-human-manual",
  storageBucket: "lulu-human-manual.firebasestorage.app",
  messagingSenderId: "2129052804",
  appId: "1:2129052804:web:b4f7c4af1861537e1c2ed1"
};
// 참고: 콘솔에 같이 있던 databaseURL(Realtime Database)은 이 프로젝트에서
// 쓰지 않는다. 전부 Firestore로 간다. 켜져 있어도 비용은 안 든다.

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

/* ============================================================
   인증
   - 벨루미(시청자) 쪽: 익명 인증이면 충분 (누구인지 구분할 필요 없음,
     등록 코드 자체가 접근 키 역할을 한다)
   - 루루(운영자) 쪽: obs/index.html에서만 이메일/비밀번호로 로그인.
     signInAsLulu()를 별도로 호출해야 하며, 호출 전까지는 익명 상태다.
   ============================================================ */
const ready = new Promise(resolve => {
  const off = onAuthStateChanged(auth, user => {
    if (user) { off(); resolve(user); }
    else signInAnonymously(auth).catch(err => console.error('익명 로그인 실패', err));
  });
});

async function signInAsLulu(email, password){
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

/* ============================================================
   등록 코드
   ============================================================ */
function makeRegCode(){
  // 헷갈리는 0/O, 1/I는 뺀다. 화면에 보여주고 손으로 옮겨 적을 수도 있으니까.
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part = () => Array.from({length:4}, () => chars[Math.floor(Math.random()*chars.length)]).join('');
  return `LULU-${part()}-${part()}`;
}

/* ---- 신청 제출 (벨루미) ----
   문서 ID를 등록 코드 그 자체로 쓴다. 그래야 "코드를 아는 사람만
   그 문서를 get할 수 있다"는 보안 규칙을 그대로 걸 수 있다. */
async function submitApplication(data){
  await ready;
  let code, ok = false;
  for (let i = 0; i < 3 && !ok; i++){
    code = makeRegCode();
    const snap = await getDoc(doc(db, 'applications', code));
    ok = !snap.exists();
  }
  if (!ok) throw new Error('코드 생성에 실패했어요. 다시 시도해 주세요.');

  await setDoc(doc(db, 'applications', code), {
    ...data,
    regCode: code,
    status: 'pending',
    createdAt: serverTimestamp()
  });
  return code;
}

/* ---- 코드로 조회 (벨루미 기록 화면) ---- */
async function lookupByCode(rawCode){
  await ready;
  const code = rawCode.trim().toUpperCase();

  const humanSnap = await getDoc(doc(db, 'humans', code));
  if (humanSnap.exists()) return { state: 'certified', code, data: humanSnap.data() };

  const appSnap = await getDoc(doc(db, 'applications', code));
  if (appSnap.exists()) return { state: 'pending', code, data: appSnap.data() };

  return { state: 'not_found', code };
}

/* ============================================================
   OBS(루루) 쪽 — signInAsLulu() 이후에만 정상 동작한다.
   ============================================================ */

/* 약 선반: 아직 인증 안 된 신청서를 실시간으로 구독 */
function subscribeShelf(onChange){
  const q = query(
    collection(db, 'applications'),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'asc')
  );
  return onSnapshot(q, snap => {
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    onChange(list);
  }, err => console.error('선반 구독 실패', err));
}

/* 인증(도장) — HUMAN 번호는 트랜잭션으로만 발급, 중복·경합을 막는다 */
async function certify(regCode, manual){
  const counterRef = doc(db, 'counters', 'humanNumber');
  const humanRef = doc(db, 'humans', regCode);
  const appRef = doc(db, 'applications', regCode);

  const humanNumber = await runTransaction(db, async (tx) => {
    const cSnap = await tx.get(counterRef);
    const next = (cSnap.exists() ? cSnap.data().value : 0) + 1;
    tx.set(counterRef, { value: next }, { merge: true });
    tx.set(humanRef, {
      regCode,
      humanNumber: next,
      nickname: manual.nickname,
      features: manual.features,
      cautions: manual.cautions,
      cares: manual.cares,
      status: 'STABLE',
      certifiedAt: serverTimestamp()
    });
    tx.update(appRef, { status: 'certified', humanNumber: next });
    return next;
  });

  return humanNumber;
}

/* 녹음 파일 업로드 */
async function uploadAudio(regCode, blob, ext){
  const path = `audio/${regCode}/asmr.${ext || 'webm'}`;
  const r = ref(storage, path);
  await uploadBytes(r, blob, { contentType: blob.type });
  const url = await getDownloadURL(r);
  await updateDoc(doc(db, 'humans', regCode), { audioUrl: url });
  return url;
}

/* 지금까지 인증된 인원 수 — 홈/기록 화면 통계용, 민감하지 않은 값이라 누구나 읽는다 */
async function getCertifiedCount(){
  await ready;
  const snap = await getDoc(doc(db, 'counters', 'humanNumber'));
  return snap.exists() ? snap.data().value : 0;
}

window.LuluDB = {
  ready, signInAsLulu,
  submitApplication, lookupByCode, getCertifiedCount,
  subscribeShelf, certify, uploadAudio
};
