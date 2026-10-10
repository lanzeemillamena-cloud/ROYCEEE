// ============================================
// EMJ Time Tracker - Optional API Server (Supabase)
// NOTE: Frontend talks directly to Supabase via config.js,
// so this server is optional. It only exists for anyone
// still calling /api/* endpoints.
// ============================================
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('.'));

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://tbghfzwnjxhxcnwvmxut.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_jG716yOxqbRiRCtN1m2oQg_how-mkGo';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function nowHHMM() {
  const n = new Date();
  const h24 = n.getHours();
  const ap = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')} ${ap}`;
}
function todayStr() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
function parseHM(s) {
  const m = String(s).match(/(\d+):(\d+)\s*([AP]M)?/i);
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = (m[3] || '').toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + min;
}
function hoursBetween(s, e) {
  return Math.round(((parseHM(e) - parseHM(s)) / 60) * 100) / 100;
}

// GET /api/entries?date=YYYY-MM-DD&department=xxx
app.get('/api/entries', async (req, res) => {
  try {
    const { date, department } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });
    let q = supabase.from('timeEntries').select('*').eq('date', date).order('timeIn');
    if (department) q = q.eq('department', department);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/entries/range?from=YYYY-MM-DD&to=YYYY-MM-DD&department=xxx
app.get('/api/entries/range', async (req, res) => {
  try {
    const { from, to, department } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'From and To dates required' });
    let q = supabase.from('timeEntries').select('*')
      .gte('date', from).lte('date', to).order('date').order('timeIn');
    if (department) q = q.eq('department', department);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
// GET /api/breaks?date=YYYY-MM-DD&breakType=xxx
app.get('/api/breaks', async (req, res) => {
  try {
    const { date, breakType } = req.query;
    if (!date) return res.status(400).json({ error: 'Date required' });
    let q = supabase.from('breaks').select('*').eq('date', date).order('startTime');
    if (breakType) q = q.eq('breakType', breakType);
    const { data, error } = await q;
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/time-in
app.post('/api/time-in', async (req, res) => {
  try {
    const { employeeName, department, information, reason } = req.body;
    const today = todayStr();
    const { data: existing } = await supabase.from('timeEntries').select('id')
      .eq('employeeName', employeeName).eq('date', today).is('timeOut', null).limit(1);
    if (existing && existing.length > 0) return res.status(400).json({ error: 'Already timed in today' });
    const { data, error } = await supabase.from('timeEntries').insert([{
      employeeName, department: department || 'General', date: today,
      timeIn: nowHHMM(), timeOut: null, status: 'present',
      totalHours: 0, information: information || '-', reason: reason || ''
    }]).select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Time in recorded successfully', entry: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/time-out
app.post('/api/time-out', async (req, res) => {
  try {
    const { employeeName } = req.body;
    const today = todayStr();
    const { data: rows } = await supabase.from('timeEntries').select('*')
      .eq('employeeName', employeeName).eq('date', today).is('timeOut', null).limit(1);
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'No active time-in entry found' });
    const entry = rows[0];
    const out = nowHHMM();
    const totalHours = hoursBetween(entry.timeIn, out);
    const { error } = await supabase.from('timeEntries').update({ timeOut: out, totalHours, status: 'completed' }).eq('id', entry.id);
    if (error) throw error;
    res.json({ message: 'Time out recorded successfully', totalHours });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/break/start & /api/break/end
app.post('/api/break/start', async (req, res) => {
  try {
    const { employeeName, department, breakType } = req.body;
    const today = todayStr();
    const { data: rows } = await supabase.from('breaks').select('id')
      .eq('employeeName', employeeName).eq('breakType', breakType).eq('date', today).is('endTime', null).limit(1);
    if (rows && rows.length > 0) return res.status(400).json({ error: 'Break already started' });
    const { data, error } = await supabase.from('breaks').insert([{
      employeeName, department: department || 'General', date: today,
      breakType, startTime: nowHHMM(), endTime: null, duration: 0
    }]).select().single();
    if (error) throw error;
    await supabase.from('timeEntries').update({ status: 'on-break' })
      .eq('employeeName', employeeName).eq('date', today).is('timeOut', null);
    res.status(201).json({ message: `${breakType} started`, break: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/break/end', async (req, res) => {
  try {
    const { employeeName, breakType } = req.body;
    const today = todayStr();
    const { data: rows } = await supabase.from('breaks').select('*')
      .eq('employeeName', employeeName).eq('breakType', breakType).eq('date', today).is('endTime', null).limit(1);
    if (!rows || rows.length === 0) return res.status(400).json({ error: 'No active break found' });
    const brk = rows[0];
    const end = nowHHMM();
    const duration = hoursBetween(brk.startTime, end);
    const { error } = await supabase.from('breaks').update({ endTime: end, duration }).eq('id', brk.id);
    if (error) throw error;
    await supabase.from('timeEntries').update({ status: 'present' })
      .eq('employeeName', employeeName).eq('date', today).is('timeOut', null);
    res.json({ message: `${breakType} ended`, duration });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/admin/summary
app.get('/api/admin/summary', async (req, res) => {
  try {
    const today = todayStr();
    const { data: entries } = await supabase.from('timeEntries').select('*').eq('date', today);
    const { data: employees } = await supabase.from('employees').select('id');
    const list = entries || [];
    const deptNames = [...new Set(list.map((e) => e.department))];
    res.json({
      date: today,
      totalEmployees: (employees || []).length,
      presentToday: list.filter((e) => e.status === 'completed' || e.status === 'present').length,
      absentToday: list.filter((e) => e.status === 'absent').length,
      onBreak: list.filter((e) => e.status === 'on-break').length,
      departments: deptNames.map((dept) => {
        const d = list.filter((e) => e.department === dept);
        return {
          name: dept,
          present: d.filter((e) => e.status === 'completed' || e.status === 'present').length,
          absent: d.filter((e) => e.status === 'absent').length,
          onBreak: d.filter((e) => e.status === 'on-break').length,
          total: d.length
        };
      }),
      recentEntries: list.slice(-10).reverse()
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET/POST /api/admin/employees
app.get('/api/admin/employees', async (req, res) => {
  const { data, error } = await supabase.from('employees').select('*').order('name');
  if (error) return res.status(500).json({ error: error.message });
  res.json(data || []);
});

app.post('/api/admin/employees', async (req, res) => {
  try {
    const { name, employeeId, department, role } = req.body;
    const { data: dup } = await supabase.from('employees').select('id').eq('employeeId', employeeId).limit(1);
    if (dup && dup.length > 0) return res.status(400).json({ error: 'Employee ID already exists' });
    const { data, error } = await supabase.from('employees')
      .insert([{ name, employeeId, department, role: role || '', isActive: true }]).select().single();
    if (error) throw error;
    res.status(201).json({ message: 'Employee added successfully', employee: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/admin/entries
app.delete('/api/admin/entries', async (req, res) => {
  try {
    const { date, department } = req.body;
    let q = supabase.from('timeEntries').delete().eq('date', date);
    if (department) q = q.eq('department', department);
    const { error } = await q;
    if (error) throw error;
    res.json({ message: 'Entries cleared successfully' });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/departments
app.get('/api/departments', (req, res) => {
  res.json(['DBA','Development','Digital Marketing','Trainer','Operation Manager','Managing Director','HR','Finance','Support']
    .map((name) => ({ name, description: '' })));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Connected to Supabase at ${SUPABASE_URL}`);
});
