// ============================================
// EMJ Advertising Service - Configuration
// Supabase-backed centralized database
// ============================================

const CONFIG = {
  COMPANY_NAME: "EMJ Advertising Service",
  TAGLINE: "Time In / Time Out System",

  // Supabase Configuration
  SUPABASE_URL: "https://tbghfzwnjxhxcnwvmxut.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_jG716yOxqbRiRCtN1m2oQg_how-mkGo",

  // Default departments
  DEPARTMENTS: [
    "DBA",
    "Development",
    "Digital Marketing",
    "Trainer",
    "Operation Manager",
    "Managing Director",
    "HR",
    "Finance",
    "Support"
  ],

  // Break types
  BREAK_TYPES: [
    { id: "morning", label: "Morning Break", icon: "fa-mug-hot" },
    { id: "lunch", label: "Lunch Break", icon: "fa-utensils" },
    { id: "evening", label: "Evening Break", icon: "fa-glass-water" }
  ],

  // Admin password (change in production!)
  ADMIN_PASSWORD: "emjadmin2024"
};

// Supabase client (loaded via CDN script tag before this file)
const supabaseClient = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_ANON_KEY
);

function nowHHMM() {
  const n = new Date();
  const h24 = n.getHours();
  const ap = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 || 12;
  return `${String(h12).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")} ${ap}`;
}

function parseHM(s) {
  const m = String(s).match(/(\d+):(\d+)\s*([AP]M)?/i);
  if (!m) return 0;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return h * 60 + min;
}

function hoursBetween(startHHMM, endHHMM) {
  return Math.round(((parseHM(endHHMM) - parseHM(startHHMM)) / 60) * 100) / 100;
}

// API Helper Functions using Supabase
const API = {
  async getEntriesRange(from, to, department) {
    let query = supabaseClient.from("timeEntries").select("*")
      .gte("date", from).lte("date", to)
      .order("date", { ascending: true }).order("timeIn", { ascending: true });
    if (department) query = query.eq("department", department);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async getEntries(date, department) {
    let query = supabaseClient.from("timeEntries").select("*").eq("date", date).order("timeIn", { ascending: true });
    if (department) query = query.eq("department", department);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async timeIn(data) {
    const today = getToday();
    const { data: existing, error: checkErr } = await supabaseClient
      .from("timeEntries").select("id")
      .eq("employeeName", data.employeeName).eq("date", today).is("timeOut", null).limit(1);
    if (checkErr) throw new Error(checkErr.message);
    if (existing && existing.length > 0) return { error: "Already timed in today" };

    const { data: result, error } = await supabaseClient.from("timeEntries").insert([{
      employeeName: data.employeeName,
      department: data.department || "General",
      date: today,
      timeIn: nowHHMM(),
      timeOut: null,
      status: "present",
      totalHours: 0,
      information: data.information || "-",
      reason: data.reason || "",
      photoUrl: data.photoUrl || null
    }]).select().single();
    if (error) throw new Error(error.message);
    return { message: "Time in recorded successfully", entry: result };
  },

  async timeOut(data) {
    const today = getToday();
    const { data: rows, error: findErr } = await supabaseClient
      .from("timeEntries").select("*")
      .eq("employeeName", data.employeeName).eq("date", today).is("timeOut", null).limit(1);
    if (findErr) throw new Error(findErr.message);
    if (!rows || rows.length === 0) return { error: "No active time-in entry found" };

    const entry = rows[0];
    const out = nowHHMM();
    const totalHours = hoursBetween(entry.timeIn, out);
    const { error: updErr } = await supabaseClient.from("timeEntries")
      .update({ timeOut: out, totalHours, status: "completed" }).eq("id", entry.id);
    if (updErr) throw new Error(updErr.message);
    return { message: "Time out recorded successfully", totalHours };
  },

  async startBreak(data) {
    const today = getToday();
    const { data: rows, error: findErr } = await supabaseClient
      .from("breaks").select("id")
      .eq("employeeName", data.employeeName).eq("breakType", data.breakType)
      .eq("date", today).is("endTime", null).limit(1);
    if (findErr) throw new Error(findErr.message);
    if (rows && rows.length > 0) return { error: "Break already started" };

    const { data: result, error } = await supabaseClient.from("breaks").insert([{
      employeeName: data.employeeName,
      department: data.department || "General",
      date: today,
      breakType: data.breakType,
      startTime: nowHHMM(),
      endTime: null,
      duration: 0
    }]).select().single();
    if (error) throw new Error(error.message);

    await supabaseClient.from("timeEntries").update({ status: "on-break" })
      .eq("employeeName", data.employeeName).eq("date", today).is("timeOut", null);
    return { message: `${data.breakType} started`, break: result };
  },

  async endBreak(data) {
    const today = getToday();
    const { data: rows, error: findErr } = await supabaseClient
      .from("breaks").select("*")
      .eq("employeeName", data.employeeName).eq("breakType", data.breakType)
      .eq("date", today).is("endTime", null).limit(1);
    if (findErr) throw new Error(findErr.message);
    if (!rows || rows.length === 0) return { error: "No active break found" };

    const brk = rows[0];
    const end = nowHHMM();
    const duration = hoursBetween(brk.startTime, end);
    const { error: updErr } = await supabaseClient.from("breaks")
      .update({ endTime: end, duration }).eq("id", brk.id);
    if (updErr) throw new Error(updErr.message);

    await supabaseClient.from("timeEntries").update({ status: "present" })
      .eq("employeeName", data.employeeName).eq("date", today).is("timeOut", null);
    return { message: `${data.breakType} ended`, duration };
  },

  async getAdminSummary() {
    const today = getToday();
    const { data: entries, error } = await supabaseClient.from("timeEntries").select("*").eq("date", today);
    if (error) throw new Error(error.message);
    const list = entries || [];

    const { data: employees, error: empErr } = await supabaseClient.from("employees").select("id");
    if (empErr) throw new Error(empErr.message);

    const deptNames = [...new Set(list.map((e) => e.department))];
    const departments = deptNames.map((dept) => {
      const d = list.filter((e) => e.department === dept);
      return {
        name: dept,
        present: d.filter((e) => e.status === "completed" || e.status === "present").length,
        absent: d.filter((e) => e.status === "absent").length,
        onBreak: d.filter((e) => e.status === "on-break").length,
        total: d.length
      };
    });

    return {
      date: today,
      totalEmployees: (employees || []).length,
      presentToday: list.filter((e) => e.status === "completed" || e.status === "present").length,
      absentToday: list.filter((e) => e.status === "absent").length,
      onBreak: list.filter((e) => e.status === "on-break").length,
      departments,
      recentEntries: list.slice(-10).reverse()
    };
  },

  async getEmployees() {
    const { data, error } = await supabaseClient.from("employees").select("*").order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  async addEmployee(data) {
    const { data: dup, error: dupErr } = await supabaseClient.from("employees")
      .select("id").eq("employeeId", data.employeeId).limit(1);
    if (dupErr) throw new Error(dupErr.message);
    if (dup && dup.length > 0) return { error: "Employee ID already exists" };

    const { data: result, error } = await supabaseClient.from("employees").insert([{
      name: data.name,
      employeeId: data.employeeId,
      department: data.department,
      role: data.role || "",
      isActive: true
    }]).select().single();
    if (error) throw new Error(error.message);
    return { message: "Employee added successfully", employee: result };
  },

  async clearEntries(data) {
    let query = supabaseClient.from("timeEntries").delete().eq("date", data.date);
    if (data.department) query = query.eq("department", data.department);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return { message: "Entries cleared successfully" };
  },

  async getDepartments() {
    return CONFIG.DEPARTMENTS.map((dept) => ({ name: dept, description: "" }));
  },

  async uploadSelfie(blob, path) {
    const { error } = await supabaseClient.storage
      .from("attendance-photos")
      .upload(path, blob, { contentType: "image/jpeg", upsert: false });
    if (error) throw new Error(error.message);
    const { data } = supabaseClient.storage.from("attendance-photos").getPublicUrl(path);
    return data.publicUrl;
  },

  async getBreaks(date, breakType) {
    let query = supabaseClient.from("breaks").select("*").eq("date", date).order("startTime", { ascending: true });
    if (breakType) query = query.eq("breakType", breakType);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return data || [];
  },

  async seedDepartments() {
    return { message: "Departments already configured", count: CONFIG.DEPARTMENTS.length };
  }
};

// Utility Functions
function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function getToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function showNotification(message, type = "success") {
  const notif = document.createElement("div");
  notif.className = `notification ${type}`;
  notif.textContent = message;
  document.body.appendChild(notif);
  setTimeout(() => notif.classList.add("show"), 10);
  setTimeout(() => {
    notif.classList.remove("show");
    setTimeout(() => notif.remove(), 300);
  }, 3000);
}
