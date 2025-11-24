// Initialize Supabase client (safe global checks)
let supabase = null;
try{
  if(typeof supabasejs !== 'undefined' && supabasejs && typeof supabasejs.createClient === 'function'){
    supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if(typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function'){
    // some builds expose a `supabase` namespace
    supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if(typeof createClient === 'function'){
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Supabase client not found. Make sure the supabase-js CDN is loaded.');
  }
}catch(err){
  console.error('Error initializing Supabase client', err);
}

// Helper to show status messages
function setStatus(el, msg, success=true){
  el.textContent = msg;
  el.style.color = success ? 'green' : 'crimson';
  setTimeout(()=> el.textContent='', 4000);
}

// Simple view toggling: 'home', 'insert', 'search', 'detail'
function showSection(name){
  const home = document.getElementById('home-card');
  const insert = document.getElementById('insert-card');
  const search = document.getElementById('search-card');
  const detail = document.getElementById('detail-card');
  const all = [home, insert, search, detail];
  all.forEach(el=>{ if(!el) return; el.style.display = 'none'; });
  if(name === 'home' && home) home.style.display = 'block';
  if(name === 'insert' && insert) insert.style.display = 'block';
  if(name === 'search' && search) search.style.display = 'block';
  if(name === 'detail' && detail) detail.style.display = 'block';
}

// Chart instance
let summaryChart = null;

async function fetchSummaryAndRender(){
  try{
    const { data, error } = await supabase.from('reports').select('*');
    if(error){ console.error('Summary fetch error', error); return; }
    const total = data.length;
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
  }catch(err){ console.error(err); }
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
    const { data: existing, error: checkErr } = await supabase.from('reports').select('id').eq('token', token).limit(1);
    if(checkErr){ setStatus(statusEl, 'Error checking token: ' + checkErr.message, false); console.error(checkErr); return; }
    if(existing && existing.length > 0){ setStatus(statusEl, 'Token already added', false); return; }
  }catch(err){ console.error('Token check failed', err); setStatus(statusEl, 'Token check failed', false); return; }

  const { data, error } = await supabase.from('reports').insert([{ token, nic, phone, name, address, problem, status: 'new' }]).select();
  if(error){ setStatus(statusEl, 'Error: ' + error.message, false); console.error(error); return; }
  setStatus(statusEl, 'Saved');
  document.getElementById('entry-form').reset();
});

// Search
document.getElementById('search-btn').addEventListener('click', ()=> performSearch());
document.getElementById('search-input').addEventListener('keydown', (e)=>{ if(e.key==='Enter'){ e.preventDefault(); performSearch(); }});

// Navigation buttons from home
const gotoInsertBtn = document.getElementById('goto-insert');
const gotoSearchBtn = document.getElementById('goto-search');
if(gotoInsertBtn) gotoInsertBtn.addEventListener('click', ()=>{ showSection('insert'); });
if(gotoSearchBtn) gotoSearchBtn.addEventListener('click', async ()=>{ showSection('search'); await performSearch(''); });
// Top-left Home button
const topHomeBtn = document.getElementById('top-home-btn');
if(topHomeBtn) topHomeBtn.addEventListener('click', async ()=>{ showSection('home'); await fetchSummaryAndRender(); });

async function performSearch(query=''){
  const q = (query === undefined || query === null) ? document.getElementById('search-input').value.trim() : query.trim();
  const resultsEl = document.getElementById('results');
  resultsEl.innerHTML = '';
  // if no query provided, fetch all
  try{
    let res;
    if(!q){
      res = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    } else {
      const pattern = `%${q}%`;
      res = await supabase.from('reports').select('*').or(`nic.ilike.${pattern},phone.ilike.${pattern},name.ilike.${pattern},token.ilike.${pattern}`);
    }
    const { data, error } = res;
    if(error){ resultsEl.innerHTML = `<li class="status">Error: ${error.message}</li>`; return; }
    if(!data || data.length===0){ resultsEl.innerHTML = '<li class="status">No results</li>'; return; }
    data.forEach(r => {
      const li = document.createElement('li');
      li.textContent = `${r.token || ''} — ${r.name} — ${r.nic || ''} — ${r.phone || ''}`;
      li.dataset.id = r.id;
      li.addEventListener('click', ()=> showDetail(r));
      resultsEl.appendChild(li);
    });
  }catch(err){ resultsEl.innerHTML = `<li class="status">Error: ${err.message}</li>`; }
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
  if(!currentRecord){ alert('Select a report first'); return; }
  const status = document.getElementById('status').value;
  const note = document.getElementById('note').value.trim();
  const stEl = document.getElementById('update-status');
  if(!status){ setStatus(stEl,'Choose a status',false); return; }

  const { data, error } = await supabase.from('reports').update({ status, note, updated_at: new Date().toISOString() }).eq('id', currentRecord.id).select();
  if(error){ setStatus(stEl,'Error: ' + error.message,false); console.error(error); return; }
  setStatus(stEl,'Updated');
  // refresh detail view from returned data
  if(data && data[0]){ showDetail(data[0]); }
});

// Initialize UI on load
document.addEventListener('DOMContentLoaded', async ()=>{
  showSection('home');
  await fetchSummaryAndRender();
  // refresh summary periodically (optional)
});
