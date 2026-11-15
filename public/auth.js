import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
let client=null, session=null, onChange=()=>{};
export async function initAuth(callback){onChange=callback;try{const status=await fetch('/api/status').then(r=>r.json());if(!status.configured)return onChange(null,false);client=createClient(status.supabaseUrl,status.anonKey,{auth:{flowType:'pkce',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});const info=await client.auth.getSession();session=info.data.session;client.auth.onAuthStateChange((_,s)=>{session=s;onChange(s?.user||null,true)});onChange(session?.user||null,true);}catch(e){console.error('Login',e);onChange(null,false);}}
export async function login(){if(!client)throw Error('Login Google ainda não configurado pelo administrador');const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin+location.pathname}});if(error)throw error;}
export async function logout(){if(client){const {error}=await client.auth.signOut();if(error)throw error;}}
export async function authHeaders(){if(!client)throw Error('Login indisponível');const {data,error}=await client.auth.getSession();if(error||!data.session)throw Error('Entre com Google para continuar');return {Authorization:'Bearer '+data.session.access_token};}
export function currentUser(){return session?.user||null;}
