const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';s.onload=boot;document.head.appendChild(s);
let supabaseClient, mode='member', user=null;
const $=id=>document.getElementById(id);
function show(id,on=true){$(id).classList.toggle('hidden',!on)}
function msg(t,ok=false){$('authMsg').textContent=t;$('authMsg').className=ok?'ok':'bad'}
async function boot(){
  if(!window.SUPABASE_URL || window.SUPABASE_PUBLISHABLE_KEY.includes('PASTE_')){msg('প্রথমে config.js-এ Publishable Key বসান।');return}
  supabaseClient=supabase.createClient(window.SUPABASE_URL,window.SUPABASE_PUBLISHABLE_KEY);
  $('memberTab').onclick=()=>{mode='member';document.querySelectorAll('.signup-only').forEach(x=>x.classList.remove('hidden'))};
  $('adminTab').onclick=()=>{mode='admin';document.querySelectorAll('.signup-only').forEach(x=>x.classList.add('hidden'))};$('loginBtn').onclick=login;$('signupBtn').onclick=signup;$('logoutBtn').onclick=logout;
  $('activationBtn').onclick=activation;$('withdrawBtn').onclick=withdraw;
  const {data}=await supabaseClient.auth.getSession(); if(data.session) await load(data.session.user);
}
async function login(){const email=$('email').value,password=$('password').value;const r=await supabaseClient.auth.signInWithPassword({email,password});if(r.error)return msg(r.error.message);await load(r.data.user)}
async function signup(){const email=$('email').value,password=$('password').value,name=$('name').value;const r=await supabaseClient.auth.signUp({email,password,options:{data:{full_name:name}}});if(r.error)return msg(r.error.message);msg('Account created. Email verification may be required.',true)}
async function load(u){user=u;const p=await supabaseClient.from('profiles').select('*').eq('id',u.id).single();if(p.error)return msg('Profile not found. Run the SQL setup first.');show('authView',false);show('logoutBtn',true);if(p.data.role==='admin')await admin();else await member(p.data)}
async function member(p){
  show('memberView');
  $('welcome').textContent='Welcome, '+(p.full_name\vert{}\vert{}'Member');$('balance').textContent='৳'+Number(p.available_balance||0).toFixed(2);
  $('earnings').textContent='৳'+Number(p.total_earnings||0).toFixed(2);
  $('status').textContent=p.activation_status?'Active':'Inactive';

  const pr=await supabaseClient.from('products').select('*').eq('active',true).order('created_at',{ascending:false});
  $('products').innerHTML=(pr.data||[]).map(x=>{
    const sellPrice = Number(x.sell_price || x.price || 0);
    const buyPrice = Number(x.buy_price || 0);
    const profit = sellPrice - buyPrice;
    return `<div class="item">
      <b>${esc(x.name)}</b><br>
      বিক্রয়মূল্য: ৳${sellPrice} | কেনামূল্য: ৳${buyPrice}<br>
      <b>লাভ (Profit): ৳${profit}</b><br>
      বিঃদ্রঃ কমিশন: ৳${x.commission || 0}<br>
      <a href="${esc(x.link)}" target="_blank" style="color: #46d391;">প্রোডাক্ট লিংক দেখুন</a>
    </div>`;
  }).join('')||'No products yet.';

  const l=await supabaseClient.from('lead_tasks').select('*').eq('active',true);
  $('leads').innerHTML=(l.data||[]).map(x=>`
    <div class="item">
      <b>${esc(x.title)}</b><br>${esc(x.description||'')}<br>
      <input id="leadInput_${x.id}" placeholder="আপনার লিড তথ্য দিন (যেমন: নাম/নম্বর)" style="margin-top:5px;">
      <button onclick="submitLead('${x.id}')" class="primary" style="padding:8px; margin-top:5px;">Submit Lead</button>
    </div>
  `).join('')||'No lead tasks yet.'
}

window.submitLead = async (taskId) => {
  const leadData = $(`leadInput_${taskId}`).value.trim();
  if(!leadData) return alert('দয়া করে লিডের তথ্য দিন');
  const r = await supabaseClient.from('lead_submissions').insert({task_id: taskId, user_id: user.id, data: leadData});
  alert(r.error ? r.error.message : 'লিড সফলভাবে জমা হয়েছে!');
  $(`leadInput_${taskId}`).value = '';
};

async function activation(){const reference=$('activationRef').value.trim();if(!reference)return alert('Reference দিন');const r=await supabaseClient.from('activation_requests').insert({user_id:user.id,amount:500,reference});alert(r.error?r.error.message:'Activation request submitted. Admin verification pending.')}
async function withdraw(){const amount=Number($('withdrawAmount').value),bkash=$('bkashNumber').value.trim();if(!amount||!bkash)return alert('Amount ও bKash number দিন');const r=await supabaseClient.rpc('request_withdrawal',{p_amount:amount,p_bkash_number:bkash});alert(r.error?r.error.message:'Withdrawal request submitted.')}
async function admin(){show('adminView');const m=await supabaseClient.from('profiles').select('*').order('created_at',{ascending:false});$('members').innerHTML=(m.data||[]).map(x=>`<div class="item">${esc(x.full_name||'')} — ${esc(x.role)} — ${x.activation_status?'Active':'Inactive'} — ৳${x.available_balance}</div>`).join('');const a=await supabaseClient.from('activation_requests').select('*').order('created_at',{ascending:false});$('activations').innerHTML=(a.data||[]).map(x=>`<div class="item">User: ${x.user_id}<br>৳${x.amount} — ${x.status} — ${esc(x.reference||'')}<br>${x.status==='pending'?`<button onclick="act('${x.id}','approved')">Approve</button> <button onclick="act('${x.id}','rejected')">Reject</button>`:''}</div>`).join('')||'None';const w=await supabaseClient.from('withdrawal_requests').select('*').order('created_at',{ascending:false});$('withdrawals').innerHTML=(w.data||[]).map(x=>`<div class="item">User: ${x.user_id}<br>৳${x.amount} — ${x.status} — ${esc(x.bkash_number)}<br>${x.status==='pending'?`<button onclick="wd('${x.id}','approved')">Approve</button> <button onclick="wd('${x.id}','rejected')">Reject</button>`:''}</div>`).join('')||'None'}
window.act=async(id,status)=>{const r=await supabaseClient.rpc('admin_update_activation',{p_request_id:id,p_status:status});if(r.error)alert(r.error.message);else await admin()}
window.wd=async(id,status)=>{const r=await supabaseClient.rpc('admin_update_withdrawal',{p_request_id:id,p_status:status});if(r.error)alert(r.error.message);else await admin()}
async function logout(){await supabaseClient.auth.signOut();location.reload()}
function esc(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
