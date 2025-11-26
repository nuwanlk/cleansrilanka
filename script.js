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
  if(name === 'insert' && insert) {
    insert.style.display = 'block';
    // Fetch and show last token number
    const lastTokenRow = document.getElementById('last-token-row');
    lastTokenRow.textContent = 'Loading last token...';
    supabase.from('cleansrilankadb').select('token').order('id', { ascending: false }).limit(1)
      .then(({ data, error }) => {
        if(error || !data || data.length === 0) {
          lastTokenRow.textContent = 'Last token not found.';
        } else {
          lastTokenRow.textContent = 'Last token No: ' + data[0].token;
        }
      });
    // Fetch institute list and populate dropdown
    const instituteSelect = document.getElementById('institute');
    if (instituteSelect) {
      instituteSelect.innerHTML = '<option value="">-- ආයතනය තෝරන්න / Select Institute --</option>';
      supabase.from('institutelist').select('institute').order('institute', { ascending: true })
        .then(({ data, error }) => {
          if (error) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'Institute list fetch error';
            instituteSelect.appendChild(opt);
          } else if (!data || data.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = 'No institutes found';
            instituteSelect.appendChild(opt);
          } else {
            data.forEach(inst => {
              const opt = document.createElement('option');
              opt.value = inst.institute;
              opt.textContent = inst.institute;
              instituteSelect.appendChild(opt);
            });
          }
        });
    }
  }
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
        <div><strong>ඉදිරිපත් වූ ගැටළු සංඛ්‍යාව</strong><br>${total}</div>
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
  let institute = '';
  if (manualInput && manualInput.style.display !== 'none' && manualInput.value.trim()) {
    institute = manualInput.value.trim();
  } else {
    institute = instituteSelect.value.trim();
  }
  const statusEl = document.getElementById('entry-status');
  if(!token || !name || !address || !problem || !institute){ setStatus(statusEl,'Please fill required fields',false); return; }

  // Check duplicate token
  try{
    const { data: existing, error: checkErr } = await supabase.from('cleansrilankadb').select('id').eq('token', token).limit(1);
    if(checkErr){ setStatus(statusEl, 'Error checking token: ' + checkErr.message, false); console.error(checkErr); return; }
    if(existing && existing.length > 0){ setStatus(statusEl, 'Token already added', false); return; }
  }catch(err){ console.error('Token check failed', err); setStatus(statusEl, 'Token check failed', false); return; }

  const { data, error } = await supabase.from('cleansrilankadb').insert([{ token, nic, phone, name, address, problem, institute, status: 'new' }]).select();
  if(error){ setStatus(statusEl, 'Error: ' + error.message, false); console.error(error); return; }
  setStatus(statusEl, 'Saved');
  document.getElementById('entry-form').reset();
  manualInput.style.display = 'none';
  instituteSelect.disabled = false;
  manualBtn.textContent = 'Institute not in list?';
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
  showSection('insert');
});
if(gotoSearchBtn) gotoSearchBtn.addEventListener('click', async ()=>{
  
  showSection('search'); await performSearch('');
});
// Top-left Home button
const topHomeBtn = document.getElementById('top-home-btn');
if(topHomeBtn) topHomeBtn.addEventListener('click', async ()=>{
  showSection('home');
  await fetchSummaryAndRender();
});

// Search Data Page: Only search by token no and show result
document.getElementById('search-btn').addEventListener('click', async () => {
  const token = document.getElementById('search-input').value.trim();
  const resultEl = document.getElementById('search-result');
  const updateForm = document.getElementById('search-update-form');
  resultEl.innerHTML = '';
  updateForm.style.display = 'none';
  if(!token){
    resultEl.innerHTML = '<div style="color:crimson;font-weight:500;">Please enter a token number</div>';
    return;
  }
  try {
    const { data, error } = await supabase.from('cleansrilankadb').select('*').eq('token', token).limit(1);
    if(error){
      resultEl.innerHTML = '<div style="color:crimson;font-weight:500;">Search failed: ' + error.message + '</div>';
      return;
    }
    if(!data || data.length === 0){
      resultEl.innerHTML = '<div style="color:crimson;font-weight:500;">No results found</div>';
      return;
    }
    // Show result and expanded details immediately
    const r = data[0];
    const summary = document.createElement('div');
    summary.style.padding = '12px 0';
    summary.style.fontSize = '1.2em';
    summary.style.color = '#205072';
    summary.innerHTML = `<strong>${r.token}</strong> - ${r.name} (${r.status || 'new'})`;
    resultEl.appendChild(summary);
    // Expand and show all related data
    const expanded = document.createElement('div');
    expanded.style.marginTop = '10px';
    expanded.style.background = '#f7f7f7';
    expanded.style.borderRadius = '8px';
    expanded.style.padding = '14px';
    expanded.innerHTML = `
      <div><strong>Token No:</strong> ${r.token}</div>
      <div><strong>Name:</strong> ${r.name}</div>
      <div><strong>NIC:</strong> ${r.nic || '-'}</div>
      <div><strong>Phone:</strong> ${r.phone || '-'}</div>
      <div><strong>Address:</strong> ${r.address || '-'}</div>
      <div><strong>Institute:</strong> ${r.institute || '-'}</div>
      <div><strong>Problem:</strong> ${r.problem || '-'}</div>
      <div><strong>Status:</strong> ${r.status || '-'}</div>
      <div><strong>Note:</strong> ${r.note || '-'}</div>
    `;
    // Remove previous expanded if any
    const prev = resultEl.querySelector('.expanded-details');
    if(prev) prev.remove();
    expanded.className = 'expanded-details';
    resultEl.appendChild(expanded);
    // Show update form and populate fields
    updateForm.style.display = 'block';
    document.getElementById('search-status').value = r.status || '';
    document.getElementById('search-note').value = r.note || '';
    updateForm.onsubmit = async function(e){
      e.preventDefault();
      const status = document.getElementById('search-status').value;
      const note = document.getElementById('search-note').value.trim();
      const statusEl = document.getElementById('search-update-status');
      statusEl.textContent = '';
      try {
        const { error: updateErr } = await supabase.from('cleansrilankadb').update({ status, note }).eq('id', r.id);
        if(updateErr){
          statusEl.textContent = 'Update failed: ' + updateErr.message;
          statusEl.style.color = 'crimson';
          return;
        }
        statusEl.textContent = 'Updated';
        statusEl.style.color = 'green';
      } catch(err){
        statusEl.textContent = 'Update failed: ' + err.message;
        statusEl.style.color = 'crimson';
      }
    };
  } catch(err) {
    resultEl.innerHTML = '<div style="color:crimson;font-weight:500;">Search failed: ' + err.message + '</div>';
  }
});

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

function attachHandlers() {
  document.getElementById('search-btn').addEventListener('click', async () => {
    const token = document.getElementById('search-input').value.trim();
    const resultEl = document.getElementById('search-result');
    const updateForm = document.getElementById('search-update-form');
    resultEl.innerHTML = '';
    updateForm.style.display = 'none';
    if(!token){
      resultEl.innerHTML = '<div style="color:crimson;font-weight:500;">Please enter a token number</div>';
      return;
    }
    try {
      const { data, error } = await supabase.from('cleansrilankadb').select('*').eq('token', token).limit(1);
      if(error){
        resultEl.innerHTML = '<div style="color:crimson;font-weight:500;">Search failed: ' + error.message + '</div>';
        return;
      }
      if(!data || data.length === 0){
        resultEl.innerHTML = '<div style="color:crimson;font-weight:500;">No results found</div>';
        return;
      }
      // Show result and expanded details immediately
      const r = data[0];
      const summary = document.createElement('div');
      summary.style.padding = '12px 0';
      summary.style.fontSize = '1.2em';
      summary.style.color = '#205072';
      summary.innerHTML = `<strong>${r.token}</strong> - ${r.name} (${r.status || 'new'})`;
      resultEl.appendChild(summary);
      // Expand and show all related data
      const expanded = document.createElement('div');
      expanded.style.marginTop = '10px';
      expanded.style.background = '#f7f7f7';
      expanded.style.borderRadius = '8px';
      expanded.style.padding = '14px';
      expanded.innerHTML = `
        <div><strong>Token No:</strong> ${r.token}</div>
        <div><strong>Name:</strong> ${r.name}</div>
        <div><strong>NIC:</strong> ${r.nic || '-'}</div>
        <div><strong>Phone:</strong> ${r.phone || '-'}</div>
        <div><strong>Address:</strong> ${r.address || '-'}</div>
        <div><strong>Institute:</strong> ${r.institute || '-'}</div>
        <div><strong>Problem:</strong> ${r.problem || '-'}</div>
        <div><strong>Status:</strong> ${r.status || '-'}</div>
        <div><strong>Note:</strong> ${r.note || '-'}</div>
      `;
      // Remove previous expanded if any
      const prev = resultEl.querySelector('.expanded-details');
      if(prev) prev.remove();
      expanded.className = 'expanded-details';
      resultEl.appendChild(expanded);
      // Show update form and populate fields
      updateForm.style.display = 'block';
      document.getElementById('search-status').value = r.status || '';
      document.getElementById('search-note').value = r.note || '';
      updateForm.onsubmit = async function(e){
        e.preventDefault();
        const status = document.getElementById('search-status').value;
        const note = document.getElementById('search-note').value.trim();
        const statusEl = document.getElementById('search-update-status');
        statusEl.textContent = '';
        try {
          const { error: updateErr } = await supabase.from('cleansrilankadb').update({ status, note }).eq('id', r.id);
          if(updateErr){
            statusEl.textContent = 'Update failed: ' + updateErr.message;
            statusEl.style.color = 'crimson';
            return;
          }
          statusEl.textContent = 'Updated';
          statusEl.style.color = 'green';
        } catch(err){
          statusEl.textContent = 'Update failed: ' + err.message;
          statusEl.style.color = 'crimson';
        }
      };
    } catch(err) {
      resultEl.innerHTML = '<div style="color:crimson;font-weight:500;">Search failed: ' + err.message + '</div>';
    }
  });

  document.getElementById('filter-all').addEventListener('click', async function() {
    document.getElementById('search-input').value = '';
    document.getElementById('search-update-form').style.display = 'none';
    const resultEl = document.getElementById('search-result');
    resultEl.innerHTML = '<span>Loading...</span>';
    try {
      const { data, error } = await supabase.from('cleansrilankadb').select('*').order('token', { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) {
        resultEl.innerHTML = '<span>No data found.</span>';
        return;
      }
      // Render all results with expanded details
      resultEl.innerHTML = data.map(r => {
        return `<div style='margin-bottom:18px;padding:14px;background:#f7f7f7;border-radius:8px;'>
          <div><strong>Token No:</strong> ${r.token}</div>
          <div><strong>Name:</strong> ${r.name}</div>
          <div><strong>NIC:</strong> ${r.nic || '-'}</div>
          <div><strong>Phone:</strong> ${r.phone || '-'}</div>
          <div><strong>Address:</strong> ${r.address || '-'}</div>
          <div><strong>Institute:</strong> ${r.institute || '-'}</div>
          <div><strong>Problem:</strong> ${r.problem || '-'}</div>
          <div><strong>Status:</strong> ${r.status || '-'}</div>
          <div><strong>Note:</strong> ${r.note || '-'}</div>
        </div>`;
      }).join('');
    } catch (err) {
      resultEl.innerHTML = `<span style='color:red;'>Error: ${err.message}</span>`;
    }
  });
  // Attach Solved button handler
  const solvedBtn = document.getElementById('filter-solved');
  if (solvedBtn) {
    solvedBtn.addEventListener('click', async function() {
      document.getElementById('search-input').value = '';
      document.getElementById('search-update-form').style.display = 'none';
      const resultEl = document.getElementById('search-result');
      resultEl.innerHTML = '<span>Loading...</span>';
      try {
        const { data, error } = await supabase.from('cleansrilankadb').select('*').eq('status', 'solved').order('token', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          resultEl.innerHTML = '<span>No data found.</span>';
          return;
        }
        resultEl.innerHTML = data.map(r => {
          return `<div style='margin-bottom:18px;padding:14px;background:#e6ffe6;border-radius:8px;'>
            <div><strong>Token No:</strong> ${r.token}</div>
            <div><strong>Name:</strong> ${r.name}</div>
            <div><strong>NIC:</strong> ${r.nic || '-'}</div>
            <div><strong>Phone:</strong> ${r.phone || '-'}</div>
            <div><strong>Address:</strong> ${r.address || '-'}</div>
            <div><strong>Institute:</strong> ${r.institute || '-'}</div>
            <div><strong>Problem:</strong> ${r.problem || '-'}</div>
            <div><strong>Status:</strong> ${r.status || '-'}</div>
            <div><strong>Note:</strong> ${r.note || '-'}</div>
          </div>`;
        }).join('');
      } catch (err) {
        resultEl.innerHTML = `<span style='color:red;'>Error: ${err.message}</span>`;
      }
    });
  }
  // Attach Not Solved button handler
  const notSolvedBtn = document.getElementById('filter-not-solved');
  if (notSolvedBtn) {
    notSolvedBtn.addEventListener('click', async function() {
      document.getElementById('search-input').value = '';
      document.getElementById('search-update-form').style.display = 'none';
      const resultEl = document.getElementById('search-result');
      resultEl.innerHTML = '<span>Loading...</span>';
      try {
        const { data, error } = await supabase.from('cleansrilankadb').select('*').eq('status', 'not solved').order('token', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          resultEl.innerHTML = '<span>No data found.</span>';
          return;
        }
        resultEl.innerHTML = data.map(r => {
          return `<div style='margin-bottom:18px;padding:14px;background:#fffbe6;border-radius:8px;'>
            <div><strong>Token No:</strong> ${r.token}</div>
            <div><strong>Name:</strong> ${r.name}</div>
            <div><strong>NIC:</strong> ${r.nic || '-'}</div>
            <div><strong>Phone:</strong> ${r.phone || '-'}</div>
            <div><strong>Address:</strong> ${r.address || '-'}</div>
            <div><strong>Institute:</strong> ${r.institute || '-'}</div>
            <div><strong>Problem:</strong> ${r.problem || '-'}</div>
            <div><strong>Status:</strong> ${r.status || '-'}</div>
            <div><strong>Note:</strong> ${r.note || '-'}</div>
          </div>`;
        }).join('');
      } catch (err) {
        resultEl.innerHTML = `<span style='color:red;'>Error: ${err.message}</span>`;
      }
    });
  }
  // Attach New button handler
  const newBtn = document.getElementById('filter-new');
  if (newBtn) {
    newBtn.addEventListener('click', async function() {
      document.getElementById('search-input').value = '';
      document.getElementById('search-update-form').style.display = 'none';
      const resultEl = document.getElementById('search-result');
      resultEl.innerHTML = '<span>Loading...</span>';
      try {
        const { data, error } = await supabase.from('cleansrilankadb').select('*').eq('status', 'new').order('token', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          resultEl.innerHTML = '<span>No data found.</span>';
          return;
        }
        resultEl.innerHTML = data.map(r => {
          return `<div style='margin-bottom:18px;padding:14px;background:#e3f2fd;border-radius:8px;'>
            <div><strong>Token No:</strong> ${r.token}</div>
            <div><strong>Name:</strong> ${r.name}</div>
            <div><strong>NIC:</strong> ${r.nic || '-'}</div>
            <div><strong>Phone:</strong> ${r.phone || '-'}</div>
            <div><strong>Address:</strong> ${r.address || '-'}</div>
            <div><strong>Institute:</strong> ${r.institute || '-'}</div>
            <div><strong>Problem:</strong> ${r.problem || '-'}</div>
            <div><strong>Status:</strong> ${r.status || '-'}</div>
            <div><strong>Note:</strong> ${r.note || '-'}</div>
          </div>`;
        }).join('');
      } catch (err) {
        resultEl.innerHTML = `<span style='color:red;'>Error: ${err.message}</span>`;
      }
    });
  }
  // Attach Export to Excel button handler (only once)
  const exportBtn = document.getElementById('export-excel');
  if (exportBtn && !exportBtn._handlerAttached) {
    exportBtn._handlerAttached = true;
    exportBtn.addEventListener('click', async function() {
      exportBtn.disabled = true;
      exportBtn.textContent = 'Exporting...';
      try {
        const { data, error } = await supabase.from('cleansrilankadb').select('*').order('token', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          alert('No data to export.');
          exportBtn.disabled = false;
          exportBtn.textContent = 'Export to Excel';
          return;
        }
        // Convert data to CSV with UTF-8 BOM for Excel compatibility
        const headers = Object.keys(data[0] || {token:'',name:'',nic:'',phone:'',address:'',problem:'',status:'',note:''});
        const csvRows = [headers.join(',')];
        data.forEach(row => {
          csvRows.push(headers.map(h => '"' + (row[h] ?? '').toString().replace(/"/g, '""') + '"').join(','));
        });
        const csvContent = '\uFEFF' + csvRows.join('\r\n');
        // Download as .csv (Excel compatible)
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        if (window.navigator.msSaveOrOpenBlob) {
          window.navigator.msSaveOrOpenBlob(blob, 'cleansrilanka_export.csv');
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'cleansrilanka_export.csv';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      } catch (err) {
        alert('Export failed: ' + err.message);
      }
      exportBtn.disabled = false;
      exportBtn.textContent = 'Export to Excel';
    });
  }
}

// Manual institute entry logic
const manualBtn = document.getElementById('manual-institute-btn');
const manualInput = document.getElementById('manual-institute');
const instituteSelect = document.getElementById('institute');
if (manualBtn && manualInput && instituteSelect) {
  manualBtn.addEventListener('click', () => {
    if (manualInput.style.display === 'none') {
      manualInput.style.display = 'block';
      instituteSelect.disabled = true;
      manualInput.focus();
      manualBtn.textContent = 'Use dropdown list';
    } else {
      manualInput.style.display = 'none';
      instituteSelect.disabled = false;
      manualBtn.textContent = 'Institute not in list?';
    }
  });
}

// Initialize UI on load
document.addEventListener('DOMContentLoaded', async ()=>{
  showSection('home');
  await fetchSummaryAndRender();
  // Attach All button handler after DOM is ready and Supabase is initialized
  const allBtn = document.getElementById('filter-all');
  if (allBtn) {
    allBtn.addEventListener('click', async function() {
      document.getElementById('search-input').value = '';
      document.getElementById('search-update-form').style.display = 'none';
      const resultEl = document.getElementById('search-result');
      resultEl.innerHTML = '<span>Loading...</span>';
      try {
        const { data, error } = await supabase.from('cleansrilankadb').select('*').order('token', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          resultEl.innerHTML = '<span>No data found.</span>';
          return;
        }
        resultEl.innerHTML = data.map(r => {
          return `<div style='margin-bottom:18px;padding:14px;background:#f7f7f7;border-radius:8px;'>
            <div><strong>Token No:</strong> ${r.token}</div>
            <div><strong>Name:</strong> ${r.name}</div>
            <div><strong>NIC:</strong> ${r.nic || '-'}</div>
            <div><strong>Phone:</strong> ${r.phone || '-'}</div>
            <div><strong>Address:</strong> ${r.address || '-'}</div>
            <div><strong>Institute:</strong> ${r.institute || '-'}</div>
            <div><strong>Problem:</strong> ${r.problem || '-'}</div>
            <div><strong>Status:</strong> ${r.status || '-'}</div>
            <div><strong>Note:</strong> ${r.note || '-'}</div>
          </div>`;
        }).join('');
      } catch (err) {
        resultEl.innerHTML = `<span style='color:red;'>Error: ${err.message}</span>`;
      }
    });
  }
  // Attach Solved button handler
  const solvedBtn = document.getElementById('filter-solved');
  if (solvedBtn) {
    solvedBtn.addEventListener('click', async function() {
      document.getElementById('search-input').value = '';
      document.getElementById('search-update-form').style.display = 'none';
      const resultEl = document.getElementById('search-result');
      resultEl.innerHTML = '<span>Loading...</span>';
      try {
        const { data, error } = await supabase.from('cleansrilankadb').select('*').eq('status', 'solved').order('token', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          resultEl.innerHTML = '<span>No data found.</span>';
          return;
        }
        resultEl.innerHTML = data.map(r => {
          return `<div style='margin-bottom:18px;padding:14px;background:#e6ffe6;border-radius:8px;'>
            <div><strong>Token No:</strong> ${r.token}</div>
            <div><strong>Name:</strong> ${r.name}</div>
            <div><strong>NIC:</strong> ${r.nic || '-'}</div>
            <div><strong>Phone:</strong> ${r.phone || '-'}</div>
            <div><strong>Address:</strong> ${r.address || '-'}</div>
            <div><strong>Institute:</strong> ${r.institute || '-'}</div>
            <div><strong>Problem:</strong> ${r.problem || '-'}</div>
            <div><strong>Status:</strong> ${r.status || '-'}</div>
            <div><strong>Note:</strong> ${r.note || '-'}</div>
          </div>`;
        }).join('');
      } catch (err) {
        resultEl.innerHTML = `<span style='color:red;'>Error: ${err.message}</span>`;
      }
    });
  }
  // Attach Not Solved button handler
  const notSolvedBtn = document.getElementById('filter-not-solved');
  if (notSolvedBtn) {
    notSolvedBtn.addEventListener('click', async function() {
      document.getElementById('search-input').value = '';
      document.getElementById('search-update-form').style.display = 'none';
      const resultEl = document.getElementById('search-result');
      resultEl.innerHTML = '<span>Loading...</span>';
      try {
        const { data, error } = await supabase.from('cleansrilankadb').select('*').eq('status', 'not solved').order('token', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          resultEl.innerHTML = '<span>No data found.</span>';
          return;
        }
        resultEl.innerHTML = data.map(r => {
          return `<div style='margin-bottom:18px;padding:14px;background:#fffbe6;border-radius:8px;'>
            <div><strong>Token No:</strong> ${r.token}</div>
            <div><strong>Name:</strong> ${r.name}</div>
            <div><strong>NIC:</strong> ${r.nic || '-'}</div>
            <div><strong>Phone:</strong> ${r.phone || '-'}</div>
            <div><strong>Address:</strong> ${r.address || '-'}</div>
            <div><strong>Institute:</strong> ${r.institute || '-'}</div>
            <div><strong>Problem:</strong> ${r.problem || '-'}</div>
            <div><strong>Status:</strong> ${r.status || '-'}</div>
            <div><strong>Note:</strong> ${r.note || '-'}</div>
          </div>`;
        }).join('');
      } catch (err) {
        resultEl.innerHTML = `<span style='color:red;'>Error: ${err.message}</span>`;
      }
    });
  }
  // Attach New button handler
  const newBtn = document.getElementById('filter-new');
  if (newBtn) {
    newBtn.addEventListener('click', async function() {
      document.getElementById('search-input').value = '';
      document.getElementById('search-update-form').style.display = 'none';
      const resultEl = document.getElementById('search-result');
      resultEl.innerHTML = '<span>Loading...</span>';
      try {
        const { data, error } = await supabase.from('cleansrilankadb').select('*').eq('status', 'new').order('token', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          resultEl.innerHTML = '<span>No data found.</span>';
          return;
        }
        resultEl.innerHTML = data.map(r => {
          return `<div style='margin-bottom:18px;padding:14px;background:#e3f2fd;border-radius:8px;'>
            <div><strong>Token No:</strong> ${r.token}</div>
            <div><strong>Name:</strong> ${r.name}</div>
            <div><strong>NIC:</strong> ${r.nic || '-'}</div>
            <div><strong>Phone:</strong> ${r.phone || '-'}</div>
            <div><strong>Address:</strong> ${r.address || '-'}</div>
            <div><strong>Institute:</strong> ${r.institute || '-'}</div>
            <div><strong>Problem:</strong> ${r.problem || '-'}</div>
            <div><strong>Status:</strong> ${r.status || '-'}</div>
            <div><strong>Note:</strong> ${r.note || '-'}</div>
          </div>`;
        }).join('');
      } catch (err) {
        resultEl.innerHTML = `<span style='color:red;'>Error: ${err.message}</span>`;
      }
    });
  }
  // refresh summary periodically (optional)
});
