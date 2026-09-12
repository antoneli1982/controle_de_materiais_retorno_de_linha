/* MTM EM FOCO — Firebase v10 modular
 * Integração de autenticação, workspace e sincronização do estado local.
 * Coloque este arquivo na mesma pasta do index.html.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, GoogleAuthProvider, signInWithPopup, signOut
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import {
  getDatabase, ref, get, set, onValue, update
} from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js';

const config = window.FIREBASE_CONFIG || {
  apiKey: 'AIzaSyD3cOYgBvYbX8VHeYSe7ilY9c2ozKFtJZY',
  authDomain: 'mtm-em-foco.firebaseapp.com',
  databaseURL: 'https://mtm-em-foco-default-rtdb.firebaseio.com',
  projectId: 'mtm-em-foco',
  storageBucket: 'mtm-em-foco.firebasestorage.app',
  messagingSenderId: '323473561940',
  appId: '1:323473561940:web:ee9f4e4f1f9ea53c5210c1'
};

const app = initializeApp(config);
const auth = getAuth(app);
const db = getDatabase(app);
const WORKSPACE_KEY = 'mtm_workspace_id';
const DEFAULT_WORKSPACE = 'mtm-principal';
const SYNC_KEYS = [
  'mtm_sheets_v3', 'pmgr_v3', 'mtm_client_logos_v1',
  'mtm_active_project_ctx_v1', 'mtm_plan_independentes_v1',
  'mtm_frp_scope_v1', 'mtm_frp_simul_v1', 'mtm_frp_all_v1',
  'mtm_frp_tpp_v1', 'mtm_fad_autosese_migrated'
];

let currentUser = null;
let stopRemote = null;
let lastPayload = '';
let applyingRemote = false;

function id(name){ return document.getElementById(name); }
function workspaceId(){ return localStorage.getItem(WORKSPACE_KEY) || DEFAULT_WORKSPACE; }
function showOverlay(name, on){ const el=id(name); if(el) el.classList.toggle('show',!!on); }
function errorText(err){
  const code = err && err.code || '';
  const map = {
    'auth/invalid-credential':'E-mail ou senha inválidos.',
    'auth/invalid-email':'Informe um e-mail válido.',
    'auth/email-already-in-use':'Este e-mail já está cadastrado.',
    'auth/weak-password':'A senha deve ter pelo menos 6 caracteres.',
    'auth/popup-closed-by-user':'A janela de login foi fechada.',
    'auth/operation-not-allowed':'Ative este método em Authentication > Sign-in method no Firebase.'
  };
  return map[code] || (err && err.message) || 'Não foi possível conectar ao Firebase.';
}
function setError(elementId, message){ const el=id(elementId); if(el){el.textContent=message;el.classList.add('show');} }
function clearError(elementId){ const el=id(elementId); if(el){el.textContent='';el.classList.remove('show');} }
function statePayload(){
  const state={};
  for(const key of SYNC_KEYS){ const value=localStorage.getItem(key); if(value!==null) state[key]=value; }
  return state;
}
function applyState(state){
  if(!state || typeof state!=='object') return;
  applyingRemote=true;
  try{ for(const key of SYNC_KEYS){ if(state[key]===undefined) continue; localStorage.setItem(key,state[key]); } }
  finally{ applyingRemote=false; }
  try{ if(typeof bootSheetsOnce==='function') bootSheetsOnce(); }catch(e){}
  try{ if(typeof pmLoad==='function') pmLoad(); }catch(e){}
  try{ if(typeof showDashboard==='function') showDashboard(); }catch(e){}
}
function syncPath(){ return ref(db, 'workspaces/'+workspaceId()+'/state'); }
async function pushState(){
  if(!currentUser || applyingRemote) return;
  const state=statePayload(); const serial=JSON.stringify(state);
  if(serial===lastPayload) return;
  lastPayload=serial;
  try{ await set(syncPath(), {...state, updatedAt:Date.now(), updatedBy:currentUser.uid}); setSyncStatus('online'); }
  catch(e){ console.warn('MTM Firebase sync:',e); setSyncStatus('error'); }
}
function setSyncStatus(kind){
  document.querySelectorAll('.fb-sync-badge').forEach(el=>{
    el.dataset.kind=kind;
    const label=el.querySelector('.sync-label'); if(label) label.textContent=kind==='online'?'Sincronizado':kind==='syncing'?'Sincronizando…':kind==='error'?'Erro de sincronização':'Offline';
  });
}
function startSync(){
  if(stopRemote) stopRemote();
  setSyncStatus('syncing');
  stopRemote=onValue(syncPath(), snap=>{
    const value=snap.val();
    if(value){ const copy={...value}; delete copy.updatedAt; delete copy.updatedBy; applyState(copy); lastPayload=JSON.stringify(statePayload()); }
    setSyncStatus('online');
  }, err=>{ console.warn('MTM Firebase listener:',err); setSyncStatus('error'); });
  setInterval(()=>pushState(),2000);
}
function buildWorkspaceList(){
  const list=id('fb-ws-list'); if(!list) return;
  list.innerHTML='<button class="fb-btn fb-btn-primary" onclick="fbUseDefaultWorkspace()">Abrir workspace principal</button>';
}

window.fbSwitchTab=function(tab){
  id('fb-panel-login')?.classList.toggle('active',tab==='login');
  id('fb-panel-register')?.classList.toggle('active',tab==='register');
  id('fb-tab-login')?.classList.toggle('active',tab==='login');
  id('fb-tab-register')?.classList.toggle('active',tab==='register');
};
window.fbLogin=async function(){
  clearError('fb-l-err');
  try{ await signInWithEmailAndPassword(auth,id('fb-l-email').value.trim(),id('fb-l-pass').value); }
  catch(e){ setError('fb-l-err',errorText(e)); }
};
window.fbRegister=async function(){
  clearError('fb-r-err');
  const email=id('fb-r-email').value.trim(); const pass=id('fb-r-pass').value;
  if(!email || pass.length<6){ setError('fb-r-err','Informe e-mail e senha com pelo menos 6 caracteres.'); return; }
  try{ await createUserWithEmailAndPassword(auth,email,pass); }
  catch(e){ setError('fb-r-err',errorText(e)); }
};
window.fbLoginGoogle=async function(){
  clearError('fb-l-err');
  try{ await signInWithPopup(auth,new GoogleAuthProvider()); }
  catch(e){ setError('fb-l-err',errorText(e)); }
};
window.fbUseDefaultWorkspace=function(){
  localStorage.setItem(WORKSPACE_KEY,DEFAULT_WORKSPACE);
  showOverlay('fb-workspace-screen',false); startSync();
};
window.fbJoinWorkspace=function(){
  const code=(id('fb-ws-code')?.value||'').trim().toUpperCase();
  if(code.length<3){setError('fb-ws-err','Informe o código do workspace.');return;}
  localStorage.setItem(WORKSPACE_KEY,code); showOverlay('fb-workspace-screen',false); startSync();
};
window.fbCreateWorkspace=function(){
  const name=(id('fb-ws-name')?.value||'').trim();
  if(!name){setError('fb-ws-err','Informe o nome do workspace.');return;}
  const code='MTM'+Math.random().toString(36).slice(2,5).toUpperCase();
  localStorage.setItem(WORKSPACE_KEY,code); showOverlay('fb-workspace-screen',false); startSync();
  alert('Workspace criado: '+code+'\\nCompartilhe este código com sua equipe.');
};
window.fbLogout=async function(){ await signOut(auth); };

onAuthStateChanged(auth, user=>{
  currentUser=user;
  window.MTM_FIREBASE_USER=user||null;
  if(user){
    showOverlay('fb-auth-screen',false);
    buildWorkspaceList();
    if(!localStorage.getItem(WORKSPACE_KEY)) localStorage.setItem(WORKSPACE_KEY,DEFAULT_WORKSPACE);
    startSync();
  } else {
    // A ferramenta continua acessível pela chapa; o Firebase tenta uma sessão anônima.
    signInAnonymously(auth).catch(e=>console.warn('Ative Authentication > Anonymous para sincronização automática.',e));
  }
});

window.addEventListener('online',()=>setSyncStatus('syncing'));
window.addEventListener('offline',()=>setSyncStatus('offline'));
