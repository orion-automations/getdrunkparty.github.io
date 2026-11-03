const supabase = window.supabase.createClient('https://tkkttmktnfhlvfiwnofy.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRra3R0bWt0bmZobHZmaXdub2Z5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2NDM1MjcsImV4cCI6MjEwOTIxOTUyN30.kNy68vcXMeZGNFNDKOQbIn53DaCh5AqZYP6YbBAlKLM');

window.gdpSupabase = supabase;
export { supabase };
export default supabase;
