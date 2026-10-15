// Supabase Configuration
const SUPABASE_URL = 'https://gfwafsvxfbjgrmwcrrhc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Tt_fp9E7bsFyfnZpI-TDUA_un016PrZ';

// Supabase ক্লায়েন্ট ইনিশিয়ালাইজ করা
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
