// Initialize Supabase client (safe global checks)
let supabase = null;
try{
  if(typeof supabasejs !== 'undefined' && supabasejs && typeof supabasejs.createClient === 'function'){
    supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if(typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function'){
    supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if(typeof createClient === 'function'){
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if(window && window.supabase && typeof window.supabase.createClient === 'function'){
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    setDiag('Supabase client not found. Check CDN and config.js.', false);
    console.error('Supabase client not found. Make sure the supabase-js CDN is loaded.');
  }
}catch(err){
  setDiag('Error initializing Supabase client', false);
  console.error('Error initializing Supabase client', err);
}

// Helper to show status messages
function setStatus(el, msg, success=true){
  el.textContent = msg;
  el.style.color = success ? 'green' : 'crimson';
  setTimeout(()=> el.textContent='', 4000);
}

// Show/hide diagnostics banner
function setDiag(msg, success=true){
  const diag = document.getElementById('diagnostics');
  if(!diag) return;
  diag.textContent = msg;
  diag.style.display = msg ? 'block' : 'none';
  diag.style.background = success ? '#e0ffe0' : '#ffe0e0';
  diag.style.color = success ? '#006400' : '#b00020';
}

// Simple view toggling: 'home', 'insert', 'search', 'detail'
function showSection(name){
  const home = document.getElementById('home-card');
  const insert = document.getElementById('insert-card');
  const search = document.getElementById('search-card');
  const detail = document.getElementById('detail-card');
  const login = document.getElementById('login-card');
  const all = [home, insert, search, detail, login];
  all.forEach(el=>{ if(!el) return; el.style.display = 'none'; });
  if(name === 'home' && home) home.style.display = 'block';
  if(name === 'insert' && insert) insert.style.display = 'block';
  if(name === 'search' && search) search.style.display = 'block';
  if(name === 'detail' && detail) detail.style.display = 'block';
  if(name === 'login' && login) login.style.display = 'block';
}

// Chart instance
let summaryChart = null;

function isSupabaseConfigured() {
  let diagMsg = '';
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    diagMsg = 'Supabase URL or anon key missing.';
    setDiag(diagMsg, false);
    return false;
  }
  if (!supabase || typeof supabase.from !== 'function') {
    diagMsg = 'Supabase client not initialized.';
    setDiag(diagMsg, false);
    return false;
  }
  return true;
}

async function fetchSummaryAndRender(){
  if (!isSupabaseConfigured()) {
    return;
  }
  let dbConnected = false;
  try{
    const { data, error } = await supabase.from('cleansrilankadb').select('*');
    if(error){
      setDiag('Database connection failed: ' + error.message, false);
      console.error('Summary fetch error', error);
      return;
    }
    dbConnected = true;
    setDiag('Database is connected', true);
    const total = data.length;
    const solved = data.filter(r => r.status === 'solved').length;
    const notSolved = data.filter(r => r.status === 'not solved').length;
    // Update dashboard stats
    const statsEl = document.getElementById('dashboard-stats');
    if(statsEl){
      statsEl.innerHTML = `
        <div><strong>මුළු ගැටළු සංඛ්‍යාව</strong><br>${total}</div>
        <div><strong>විසඳන ලද සංඛ්‍යාව</strong><br>${solved}</div>
        <div><strong>නොවිසඳුණු ගැටළු සංඛ්‍යාව</strong><br>${notSolved}</div>
      `;
    }
    const counts = data.reduce((acc, r)=>{ const s = r.status || 'unknown'; acc[s] = (acc[s]||0)+1; return acc; }, {});
    const labels = Object.keys(counts);
    const values = labels.map(l => counts[l]);
    const ctx = document.getElementById('summaryChart').getContext('2d');
    if(summaryChart) summaryChart.destroy();
    summaryChart = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Reports', data: values, backgroundColor: '#2b7a78' }] },
      options: { responsive: true, maintainAspectRatio: false }
    });
  }catch(err){
    setDiag('Database connection failed: ' + err.message, false);
    console.error(err);
  }
}

// Insert new report
document.getElementById('entry-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const token = document.getElementById('token').value.trim();
  const nic = document.getElementById('nic').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const name = document.getElementById('name').value.trim();
  const address = document.getElementById('address').value.trim();
  const problem = document.getElementById('problem').value.trim();
  const statusEl = document.getElementById('entry-status');
  if(!token || !name || !address || !problem){ setStatus(statusEl,'Please fill required fields',false); return; }

  // Check duplicate token
  try{
    const { data: existing, error: checkErr } = await supabase.from('cleansrilankadb').select('id').eq('token', token).limit(1);
    if(checkErr){ setStatus(statusEl, 'Error checking token: ' + checkErr.message, false); console.error(checkErr); return; }
    if(existing && existing.length > 0){ setStatus(statusEl, 'Token already added', false); return; }
  }catch(err){ console.error('Token check failed', err); setStatus(statusEl, 'Token check failed', false); return; }

  const { data, error } = await supabase.from('cleansrilankadb').insert([{ token, nic, phone, name, address, problem, status: 'new' }]).select();
  if(error){ setStatus(statusEl, 'Error: ' + error.message, false); console.error(error); return; }
  setStatus(statusEl, 'Saved');
  document.getElementById('entry-form').reset();
});

// Search
document.getElementById('search-btn').addEventListener('click', ()=> performSearch());
document.getElementById('search-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); performSearch(); }});
// Remove live search while typing
// document.getElementById('search-input').addEventListener('input', ()=> performSearch());

let isAuthenticated = false;

function showLogin(){
  showSection('login');
  document.getElementById('login-status').textContent = '';
}

// Simple login logic (replace with real auth as needed)
document.getElementById('login-form').addEventListener('submit', async function(e){
  e.preventDefault();
  const user = document.getElementById('login-username').value.trim();
  const pass = document.getElementById('login-password').value;
  // Check credentials from Supabase 'logins' table
  try {
    const { data, error } = await supabase.from('logins').select('password').eq('username', user).limit(1);
    if(error){
      document.getElementById('login-status').textContent = 'Login error: ' + error.message;
      document.getElementById('login-status').style.color = 'crimson';
      return;
    }
    if(data && data.length > 0 && data[0].password === pass){
      isAuthenticated = true;
      showSection('home');
      document.getElementById('login-form').reset();
    }else{
      document.getElementById('login-status').textContent = 'Invalid credentials';
      document.getElementById('login-status').style.color = 'crimson';
    }
  } catch(err) {
    document.getElementById('login-status').textContent = 'Login error: ' + err.message;
    document.getElementById('login-status').style.color = 'crimson';
  }
});

// Navigation buttons from home
const gotoInsertBtn = document.getElementById('goto-insert');
const gotoSearchBtn = document.getElementById('goto-search');
if(gotoInsertBtn) gotoInsertBtn.addEventListener('click', ()=>{
  if(!isAuthenticated){ showSection('login'); return; }
  showSection('insert');
});
if(gotoSearchBtn) gotoSearchBtn.addEventListener('click', async ()=>{
  if(!isAuthenticated){ showSection('login'); return; }
  showSection('search'); await performSearch('');
});
// Top-left Home button
const topHomeBtn = document.getElementById('top-home-btn');
if(topHomeBtn) topHomeBtn.addEventListener('click', async ()=>{
  showSection('home');
  await fetchSummaryAndRender();
});

async function performSearch(query=''){
  const q = (query === undefined || query === null) ? document.getElementById('search-input').value.trim() : query.trim();
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';
  try{
    let res;
    if(!q){
      res = await supabase.from('cleansrilankadb').select('*').order('created_at', { ascending: false });
    } else {
      // Search by token or name, match whole text
      res = await supabase.from('cleansrilankadb').select('*').or(`token.ilike.%${q}%,name.ilike.%${q}%`).order('created_at', { ascending: false });
    }
    if(res.error){
      setDiag('Search failed: ' + res.error.message, false);
      return;
    }
    let data = res.data || [];
    // Deduplicate by unique id
    const seenIds = new Set();
    data = data.filter(r => {
      if(seenIds.has(r.id)) return false;
      seenIds.add(r.id);
      return true;
    });
    if(data.length === 0){ resultsEl.innerHTML = '<li>No results found</li>'; return; }
    data.forEach(r=>{
      const li = document.createElement('li');
      li.textContent = `${r.token} - ${r.name} (${r.status || 'new'})`;
      li.className = 'result-item';
      li.addEventListener('click', ()=> showDetail(r));
      resultsEl.appendChild(li);
    });
  }catch(err){
    setDiag('Search failed: ' + err.message, false);
    console.error(err);
  }
}

// show detail and populate update form
let currentRecord = null;
function showDetail(r){
  currentRecord = r;
  document.getElementById('detail-card').style.display = 'block';
  const d = document.getElementById('detail');
  d.innerHTML = '';
  const fields = ['token','name','nic','phone','address','problem','status','note','created_at'];
  fields.forEach(k => {
    const div = document.createElement('div'); div.className='field';
    const label = document.createElement('strong'); label.textContent = k.replace('_',' ') + ': ';
    const span = document.createElement('span'); span.textContent = r[k] ?? '';
    div.appendChild(label); div.appendChild(span); d.appendChild(div);
  });
  // populate update form
  document.getElementById('status').value = r.status || '';
  document.getElementById('note').value = r.note || '';
}

// Update status/note
document.getElementById('update-form').addEventListener('submit', async (e)=>{
  e.preventDefault();
  if(!currentRecord) return;
  const status = document.getElementById('status').value;
  const note = document.getElementById('note').value.trim();
  const updateStatusEl = document.getElementById('update-status');
  try{
    const { data, error } = await supabase.from('cleansrilankadb').update({ status, note, updated_at: new Date().toISOString() }).eq('id', currentRecord.id).select();
    if(error){ updateStatusEl.textContent = 'Update failed: ' + error.message; updateStatusEl.style.color = 'crimson'; return; }
    updateStatusEl.textContent = 'Updated'; updateStatusEl.style.color = 'green';
    await performSearch();
  }catch(err){ updateStatusEl.textContent = 'Update failed: ' + err.message; updateStatusEl.style.color = 'crimson'; }
});

// Initialize UI on load
document.addEventListener('DOMContentLoaded', async ()=>{
  showSection('home');
  await fetchSummaryAndRender();
  // refresh summary periodically (optional)
});
