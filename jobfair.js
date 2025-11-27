// Job Fair Registration - Supabase Insert
let supabase = null;
try {
  if (typeof supabasejs !== 'undefined' && supabasejs && typeof supabasejs.createClient === 'function') {
    supabase = supabasejs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if (typeof supabase !== 'undefined' && supabase && typeof supabase.createClient === 'function') {
    supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if (typeof createClient === 'function') {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else if (window && window.supabase && typeof window.supabase.createClient === 'function') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
} catch (err) {
  console.error('Supabase client not found. Make sure the supabase-js CDN is loaded.', err);
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('jobfair-form');
  const statusEl = document.getElementById('jf-status');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('jf-token').value.trim();
    const name = document.getElementById('jf-name').value.trim();
    const nic = document.getElementById('jf-nic').value.trim();
    const phone = document.getElementById('jf-phone').value.trim();
    const address = document.getElementById('jf-address').value.trim();
    const jobinstitute = document.getElementById('jf-job').value.trim();
    if (!token || !name || !address || !jobinstitute) {
      statusEl.textContent = 'Please fill required fields.';
      statusEl.style.color = 'crimson';
      return;
    }
    try {
      const { data, error } = await supabase.from('jobfair').insert([{ token, name, nic, phone, address, jobinstitute }]).select();
      if (error) {
        statusEl.textContent = 'Error: ' + error.message;
        statusEl.style.color = 'crimson';
        return;
      }
      statusEl.textContent = 'Registration successful!';
      statusEl.style.color = 'green';
      form.reset();
    } catch (err) {
      statusEl.textContent = 'Error: ' + err.message;
      statusEl.style.color = 'crimson';
    }
  });
});
