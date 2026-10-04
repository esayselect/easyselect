let supabaseClient = null;
let currentUser = null;
let currentProfile = null;

const $ = id => document.getElementById(id);
const money = n => `৳${Number(n || 0).toFixed(2)}`;

function show(id) {
  ["authView","memberView","adminView"].forEach(x => $(x).classList.add("hidden"));
  $(id).classList.remove("hidden");
}

function msg(t) {
  $("authMsg").textContent = t || "";
}

async function init() {
  const { createClient } = window.supabase;

  supabaseClient = createClient(
    window.SUPABASE_URL,
    window.SUPABASE_PUBLISHABLE_KEY
  );

  $("loginBtn").onclick = login;
  $("signupBtn").onclick = signup;
  $("logoutBtn").onclick = logout;
  $("activationBtn").onclick = submitActivation;
  $("withdrawBtn").onclick = withdraw;

  const { data } = await supabaseClient.auth.getSession();

  if (data.session) await loadUser(data.session.user);
}

async function login() {
  msg("Signing in...");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email: $("email").value.trim(),
    password: $("password").value
  });

  if (error) return msg(error.message);

  await loadUser(data.user);
}

async function signup() {
  msg("Creating account...");

  const email = $("email").value.trim();
  const password = $("password").value;
  const name = $("name").value.trim();

  if (!email || !password || !name)
    return msg("Name, email and password are required.");

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: { data: { full_name: name } }
  });

  if (error) return msg(error.message);

  if (data.session) await loadUser(data.user);
  else msg("Account created. Check your email.");
}

async function loadUser(user) {
  currentUser = user;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) return msg("Profile not found. Run supabase.sql first.");

  currentProfile = data;
  $("logoutBtn").classList.remove("hidden");

  if (data.role === "admin") {
    show("adminView");
    await loadAdmin();
  } else {
    show("memberView");
    await loadMember();
  }
}

async function loadMember() {
  $("welcome").textContent =
    `Welcome, ${currentProfile.full_name || currentUser.email}`;

  $("balance").textContent = money(currentProfile.available_balance);
  $("earnings").textContent = money(currentProfile.total_earnings);
  $("status").textContent =
    currentProfile.activation_status ? "Active" : "Inactive";

  const { data: products } = await supabaseClient
    .from("products")
    .select("*")
    .eq("active", true);

  $("products").innerHTML = products?.length
    ? products.map(p => `
      <div class="item">
        <b>${p.name}</b>
        <div>Commission: ${money(p.commission)}</div>
        <a href="${p.link}" target="_blank">Open Product</a>
      </div>
    `).join("")
    : "No products available.";

  const { data: leads } = await supabaseClient
    .from("lead_tasks")
    .select("*")
    .eq("active", true);

  $("leads").innerHTML = leads?.length
    ? leads.map(l => `
      <div class="item">
        <b>${l.title}</b>
        <div>${l.description || ""}</div>
        <div>Commission: ${money(l.commission)}</div>
      </div>
    `).join("")
    : "No lead tasks available.";
}

async function submitActivation() {
  const reference = $("activationRef").value.trim();

  if (!reference)
    return alert("Enter bKash Transaction ID / Reference.");

  const { error } = await supabaseClient
    .from("activation_requests")
    .insert({
      user_id: currentUser.id,
      amount: 500,
      reference
    });

  if (error) return alert(error.message);

  $("activationRef").value = "";
  alert("Activation request submitted.");
}

async function withdraw() {
  const amount = Number($("withdrawAmount").value);
  const number = $("bkashNumber").value.trim();

  if (!amount || !number)
    return alert("Enter amount and bKash number.");

  const { error } = await supabaseClient.rpc(
    "request_withdrawal",
    {
      p_amount: amount,
      p_bkash_number: number
    }
  );

  if (error) return alert(error.message);

  alert("Withdrawal request submitted.");
  await loadUser(currentUser);
}

async function loadAdmin() {
  const { data: members } = await supabaseClient
    .from("profiles")
    .select("*");

  $("members").innerHTML = members?.length
    ? members.map(m => `
      <div class="item">
        <b>${m.full_name || "Member"}</b>
        <div>Status: ${m.activation_status ? "Active" : "Inactive"}</div>
        <div>Balance: ${money(m.available_balance)}</div>
      </div>
    `).join("")
    : "No members.";

  const { data: activations } = await supabaseClient
    .from("activation_requests")
    .select("*")
    .eq("status", "pending");

  $("activations").innerHTML = activations?.length
    ? activations.map(r => `
      <div class="item">
        <b>৳${r.amount}</b>
        <div>Reference: ${r.reference || ""}</div>
        <button class="primary"
          onclick="adminActivation(${r.id},'approved')">
          Approve
        </button>
        <button class="secondary"
          onclick="adminActivation(${r.id},'rejected')">
          Reject
        </button>
      </div>
    `).join("")
    : "No pending activation requests.";

  const { data: withdrawals } = await supabaseClient
    .from("withdrawal_requests")
    .select("*")
    .eq("status", "pending");

  $("withdrawals").innerHTML = withdrawals?.length
    ? withdrawals.map(r => `
      <div class="item">
        <b>৳${r.amount}</b>
        <div>bKash: ${r.bkash_number}</div>
        <button class="primary"
          onclick="adminWithdrawal(${r.id},'approved')">
          Approve
        </button>
        <button class="secondary"
          onclick="adminWithdrawal(${r.id},'rejected')">
          Reject
        </button>
      </div>
    `).join("")
    : "No pending withdrawal requests.";
}

window.adminActivation = async (id, status) => {
  const { error } = await supabaseClient.rpc(
    "admin_update_activation",
    {
      p_request_id: id,
      p_status: status
    }
  );

  if (error) return alert(error.message);

  await loadAdmin();
};

window.adminWithdrawal = async (id, status) => {
  const { error } = await supabaseClient.rpc(
    "admin_update_withdrawal",
    {
      p_request_id: id,
      p_status: status
    }
  );

  if (error) return alert(error.message);

  await loadAdmin();
};

async function logout() {
  await supabaseClient.auth.signOut();
  $("logoutBtn").classList.add("hidden");
  show("authView");
}

const script = document.createElement("script");

script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";

script.onload = init;

document.head.appendChild(script);
