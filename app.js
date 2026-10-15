const script = document.createElement('script');
script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
script.onload = boot;
script.onerror = () => alert('Supabase library load হয়নি। ইন্টারনেট পরীক্ষা করো।');
document.head.appendChild(script);

let db = null;
let mode = 'member';
let user = null;

const $ = id => document.getElementById(id);

function show(id, visible = true) {
  $(id).classList.toggle('hidden', !visible);
}

function msg(text, ok = false) {
  $('authMsg').textContent = text;
  $('authMsg').className = ok ? 'ok' : 'bad';
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[c]);
}

function money(value) {
  return '৳' + Number(value || 0).toFixed(2);
}

async function boot() {
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key || key.includes('তোমার_') ||
      key.includes('PASTE_')) {
    msg('config.js-এ Supabase URL ও Publishable Key বসাও।');
    return;
  }

  db = window.supabase.createClient(url, key);

  $('memberTab').onclick = () => {
    mode = 'member';
    document.querySelectorAll('.signup-only')
      .forEach(el => el.classList.remove('hidden'));
    msg('');
  };

  $('adminTab').onclick = () => {
    mode = 'admin';
    document.querySelectorAll('.signup-only')
      .forEach(el => el.classList.add('hidden'));
    msg('');
  };

  $('loginBtn').onclick = login;
  $('signupBtn').onclick = signup;
  $('logoutBtn').onclick = logout;
  $('activationBtn').onclick = activation;
  $('withdrawBtn').onclick = withdraw;

  const { data, error } = await db.auth.getSession();

  if (error) return msg(error.message);

  if (data.session) await load(data.session.user);
}

async function login() {
  if (!db) return msg('Supabase সংযোগ হয়নি।');

  const email = $('email').value.trim();
  const password = $('password').value;

  if (!email || !password) return msg('Email ও Password দাও।');

  $('loginBtn').disabled = true;

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email,
      password
    });

    if (error) return msg(error.message);

    await load(data.user);
  } catch (e) {
    msg(e.message || 'লগইন করা যায়নি।');
  } finally {
    $('loginBtn').disabled = false;
  }
}

async function signup() {
  if (!db) return msg('Supabase সংযোগ হয়নি।');
  if (mode !== 'member') return msg('Member অপশন নির্বাচন করো।');

  const email = $('email').value.trim();
  const password = $('password').value;
  const name = $('name').value.trim();

  if (!email || !password || !name) {
    return msg('নাম, Email ও Password পূরণ করো।');
  }

  if (password.length < 6) {
    return msg('Password কমপক্ষে ৬ অক্ষরের হতে হবে।');
  }

  $('signupBtn').disabled = true;

  try {
    const { data, error } = await db.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } }
    });

    if (error) return msg(error.message);

    if (data.session && data.user) {
      await load(data.user);
    } else {
      msg('অ্যাকাউন্ট তৈরি হয়েছে। Email verification করে লগইন করো।', true);
    }
  } catch (e) {
    msg(e.message || 'অ্যাকাউন্ট তৈরি করা যায়নি।');
  } finally {
    $('signupBtn').disabled = false;
  }
}

async function load(u) {
  user = u;

  const { data: profile, error } = await db
    .from('profiles')
    .select('*')
    .eq('id', u.id)
    .single();

  if (error || !profile) {
    show('authView');
    show('memberView', false);
    show('adminView', false);
    show('logoutBtn');
    return msg('Profile পাওয়া যায়নি। Supabase SQL Setup পরীক্ষা করো।');
  }

  show('authView', false);
  show('memberView', false);
  show('adminView', false);
  show('logoutBtn');

  if (profile.role === 'admin') {
    await admin();
  } else {
    await member(profile);
  }
}

async function member(profile) {
  show('memberView');
  show('adminView', false);

  $('welcome').textContent =
    'Welcome, ' + (profile.full_name || 'Member');

  $('balance').textContent = money(profile.available_balance);
  $('earnings').textContent = money(profile.total_earnings);
  $('status').textContent =
    profile.activation_status ? 'Active' : 'Inactive';

  const { data: products, error: productError } = await db
    .from('products')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  $('products').innerHTML = productError
    ? '<p>Products load হয়নি: ' + esc(productError.message) + '</p>'
    : (products || []).map(p => {
        const sell = Number(p.sell_price ?? p.price ?? 0);
        const buy = Number(p.buy_price ?? 0);
        const link = String(p.link || '');

        return `<div class="item">
          <b>${esc(p.name)}</b><br>
          বিক্রয়মূল্য: ${money(sell)}<br>
          কেনামূল্য: ${money(buy)}<br>
          সম্ভাব্য পার্থক্য: ${money(sell - buy)}<br>
          কমিশন: ${money(p.commission)}
          ${/^https?:\\/\\//i.test(link)
            ? `<br><a href="${esc(link)}" target="_blank"
                 rel="noopener noreferrer">প্রোডাক্ট দেখুন</a>`
            : ''}
        </div>`;
      }).join('') || 'এখনো কোনো পণ্য যোগ করা হয়নি।';

  const { data: tasks, error: taskError } = await db
    .from('lead_tasks')
    .select('*')
    .eq('active', true)
    .order('created_at', { ascending: false });

  $('leads').innerHTML = taskError
    ? '<p>Lead tasks load হয়নি: ' + esc(taskError.message) + '</p>'
    : (tasks || []).map(t => `
      <div class="item">
        <b>${esc(t.title)}</b><br>
        ${esc(t.description || '')}<br>
        <input id="lead_${esc(t.id)}"
          placeholder="লিডের তথ্য দাও">
        <button class="primary"
          onclick="submitLead('${esc(t.id)}')">Submit Lead</button>
      </div>
    `).join('') || 'এখনো কোনো Lead Task নেই।';
}

window.submitLead = async function(taskId) {
  if (!user || !db) return alert('আবার লগইন করো।');

  const field = $('lead_' + taskId);
  const value = field?.value.trim();

  if (!value) return alert('লিডের তথ্য দাও।');

  const { error } = await db.from('lead_submissions').insert({
    task_id: taskId,
    user_id: user.id,
    data: value
  });

  if (error) return alert('জমা হয়নি: ' + error.message);

  field.value = '';
  alert('লিড জমা হয়েছে। Admin যাচাই করবেন।');
};

async function activation() {
  if (!user) return alert('আবার লগইন করো।');

  const reference = $('activationRef').value.trim();
  if (!reference) return alert('bKash Transaction ID দাও।');

  const { error } = await db.from('activation_requests').insert({
    user_id: user.id,
    amount: 500,
    reference
  });

  if (error) return alert('অনুরোধ জমা হয়নি: ' + error.message);

  $('activationRef').value = '';
  alert('অনুরোধ জমা হয়েছে। Admin যাচাইয়ের অপেক্ষায় থাকো।');
}

async function withdraw() {
  if (!user) return alert('আবার লগইন করো।');

  const amount = Number($('withdrawAmount').value);
  const bkash = $('bkashNumber').value.trim();

  if (!Number.isFinite(amount) || amount <= 0 || !bkash) {
    return alert('সঠিক Amount ও bKash Number দাও।');
  }

  const { error } = await db.rpc('request_withdrawal', {
    p_amount: amount,
    p_bkash_number: bkash
  });

  if (error) return alert('অনুরোধ জমা হয়নি: ' + error.message);

  $('withdrawAmount').value = '';
  $('bkashNumber').value = '';
  alert('Withdrawal request জমা হয়েছে।');
}

async function admin() {
  show('adminView');
  show('memberView', false);

  const { data: members, error: memberError } = await db
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  $('members').innerHTML = memberError
    ? esc(memberError.message)
    : (members || []).map(m => `
      <div class="item">
        ${esc(m.full_name || 'Member')} —
        ${esc(m.role)} —
        ${m.activation_status ? 'Active' : 'Inactive'} —
        ${money(m.available_balance)}
      </div>
    `).join('') || 'কোনো সদস্য নেই।';

  const { data: acts, error: actError } = await db
    .from('activation_requests')
    .select('*')
    .order('created_at', { ascending: false });

  $('activations').innerHTML = actError
    ? esc(actError.message)
    : (acts || []).map(a => `
      <div class="item">
        User: ${esc(a.user_id)}<br>
        Amount: ${money(a.amount)}<br>
        Reference: ${esc(a.reference)}<br>
        Status: ${esc(a.status)}
        ${a.status === 'pending' ? `
          <button onclick="act('${esc(a.id)}','approved')">Approve</button>
          <button onclick="act('${esc(a.id)}','rejected')">Reject</button>
        ` : ''}
      </div>
    `).join('') || 'কোনো অনুরোধ নেই।';

  const { data: withdrawals, error: withdrawalError } = await db
    .from('withdrawal_requests')
    .select('*')
    .order('created_at', { ascending: false });

  $('withdrawals').innerHTML = withdrawalError
    ? esc(withdrawalError.message)
    : (withdrawals || []).map(w => `
      <div class="item">
        User: ${esc(w.user_id)}<br>
        Amount: ${money(w.amount)}<br>
        bKash: ${esc(w.bkash_number)}<br>
        Status: ${esc(w.status)}
        ${w.status === 'pending' ? `
          <button onclick="wd('${esc(w.id)}','approved')">Approve</button>
          <button onclick="wd('${esc(w.id)}','rejected')">Reject</button>
        ` : ''}
      </div>
    `).join('') || 'কোনো অনুরোধ নেই।';
}

window.act = async (id, status) => {
  if (!confirm('এই অনুরোধের Status পরিবর্তন করবে?')) return;

  const { error } = await db.rpc('admin_update_activation', {
    p_request_id: id,
    p_status: status
  });

  if (error) return alert(error.message);
  await admin();
};

window.wd = async (id, status) => {
  if (!confirm('এই Withdrawal-এর Status পরিবর্তন করবে?')) return;

  const { error } = await db.rpc('admin_update_withdrawal', {
    p_request_id: id,
    p_status: status
  });

  if (error) return alert(error.message);
  await admin();
};

async function logout() {
  if (db) await db.auth.signOut();
  location.reload();
}

boot();
