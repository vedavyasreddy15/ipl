/**
 * IPL Auction - Backend Controller
 * This file handles all Supabase Database, Authentication, and Real-time syncing.
 */

// 1. Initialize Supabase (You will replace these later with keys from Supabase)
const SUPABASE_URL = 'https://nlsruirhrtmnvcemlcwu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5sc3J1aXJocnRtbnZjZW1sY3d1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0ODU4OTIsImV4cCI6MjA5MDA2MTg5Mn0.36PCGVyIyvXCZ28MxoeRTGUDvqW7vHIAMXgqgtPVaT4';

let supabase = null;

// We only initialize if the keys are added, preventing errors in your current local tests
if (SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase Backend Initialized');
} else {
    console.log('⚠️ Running in Local Simulator Mode. Add Supabase keys to backend.js to enable online multi-user mode.');
}

// --- AUTHENTICATION MODULE ---
async function loginUser(username, password) {
    if (!supabase) return { success: true }; // Fallback to local admin test if no DB
    
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: username,
            password: password,
        });
        
        if (error) return { error: error.message };
        return { success: true, user: data.user };
    } catch (err) {
        console.error('Supabase Login Error:', err);
        return { error: 'Network error: Supabase blocked the connection. Check Site URL / CORS.' };
    }
}

// --- REAL-TIME DATABASE SYNC MODULE ---
async function syncAuctionState(roomName, globalState) {
    if (!supabase) return;
    
    const { error } = await supabase
        .from('auction_state')
        .upsert({ room_name: roomName, state_data: globalState, last_updated: new Date() });
        
    if (error) console.error('Error syncing state to server:', error);
}

async function getAuctionState(roomName) {
    if (!supabase) return null;
    const { data, error } = await supabase.from('auction_state').select('state_data').eq('room_name', roomName).single();
    if (error) return null;
    return data?.state_data;
}

async function getAllRooms() {
    if (!supabase) return [];
    const { data, error } = await supabase.from('auction_state').select('room_name');
    if (error) return [];
    return data.map(d => d.room_name);
}

async function deleteAuctionState(roomName) {
    if (!supabase) return;
    await supabase.from('auction_state').delete().eq('room_name', roomName);
}

function subscribeToRoom(roomName, callback) {
    if (!supabase) return null;
    return supabase.channel(`room_${roomName}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_state', filter: `room_name=eq.${roomName}` }, (payload) => {
            callback(payload.new.state_data);
        })
        .subscribe();
}

// Export for the HTML file to use
window.Backend = { loginUser, syncAuctionState, getAuctionState, getAllRooms, deleteAuctionState, subscribeToRoom };
