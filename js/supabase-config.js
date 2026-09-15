// ---------- Supabase config ----------
// Fill these in from your Supabase project (Settings -> API).
// SUPABASE_URL looks like: https://xxxxxxxxxxxx.supabase.co
// SUPABASE_ANON_KEY is the long "anon public" key (safe to expose in frontend code).
const SUPABASE_URL = "https://syswfuuosozomnfnwaiv.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN5c3dmdXVvc296b21uZm53YWl2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYzNDUwNjEsImV4cCI6MjEwMTkyMTA2MX0.hTgtR4nG4ghX1TLoDtrAuwq9hyPJj4xjeKpdSctiR-I";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Must match the emails used in the SQL policies in supabase-setup.sql —
// only these accounts can see/use the /admin.html upload page.
const OWNER_EMAILS = ["mphtech20@gmail.com", "lesedimonareng32@gmail.com"];
