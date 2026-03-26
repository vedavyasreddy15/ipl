/**
 * IPL Auction - High-Speed Backend Controller
 * Uses Supabase Broadcast for instant browser-to-browser syncing.
 */

const SUPABASE_URL = 'https://mbrfkhbycgvftqeyazuf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1icmZraGJ5Y2d2ZnRxZXlhenVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MzUxMTQsImV4cCI6MjA5MDExMTExNH0.YvF6DLjbwzv3XabAjkz30o_RM8iZAYyrlzRRSVlhr1A';

let dbClient = null;
let activeChannel = null; // Stores the high-speed tunnel connection

if (SUPABASE_URL && SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
    dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase Backend Initialized');
} else {
    console.log('⚠️ Running in Local Simulator Mode.');
}

// --- AUTHENTICATION MODULE ---
async function loginUser(username, password) {
    if (!dbClient) return { success: true }; 
    
    try {
        const { data, error } = await dbClient.auth.signInWithPassword({
            email: username,
            password: password,
        });
        
        if (error) return { error: error.message };
        return { success: true, user: data.user };
    } catch (err) {
        console.error('Supabase Login Error:', err);
        return { error: 'Network error: Supabase blocked the connection.' };
    }
}

// --- REAL-TIME DATABASE SYNC MODULE (UPGRADED) ---
async function syncAuctionState(roomName, globalState) {
    if (!dbClient) return;
    
    // 1. INSTANT BROADCAST (The Speed Hack)
    // Fires data directly to other browsers in milliseconds, skipping the hard drive
    if (activeChannel) {
        activeChannel.send({
            type: 'broadcast',
            event: 'fast_sync',
            payload: { state_data: globalState }
        }).catch(err => console.error('Broadcast failed:', err));
    }
    
    // 2. BACKGROUND DATABASE BACKUP
    // Silently saves to Oregon so you don't lose data if someone refreshes the page
    dbClient.from('auction_state')
        .upsert({ room_name: roomName, state_data: globalState, last_updated: new Date() })
        .then(({ error }) => { if (error) console.error('DB Sync Error:', error); });
}

async function getAuctionState(roomName) {
    if (!dbClient) return null;
    const { data, error } = await dbClient.from('auction_state').select('state_data').eq('room_name', roomName).single();
    if (error) return null;
    return data?.state_data;
}

async function getAllRooms() {
    if (!dbClient) return [];
    const { data, error } = await dbClient.from('auction_state').select('room_name');
    if (error) return [];
    return data.map(d => d.room_name);
}

async function deleteAuctionState(roomName) {
    if (!dbClient) return;
    await dbClient.from('auction_state').delete().eq('room_name', roomName);
}

function subscribeToRoom(roomName, callback) {
    if (!dbClient) return null;

    // Clean up old tunnels if re-entering
    if (activeChannel) {
        dbClient.removeChannel(activeChannel);
    }

    // Open a new High-Speed channel
    activeChannel = dbClient.channel(`room_${roomName}`, {
        config: { broadcast: { ack: false } } // ack: false prioritizes raw speed
    });

    activeChannel
        // Listen for the instant browser-to-browser broadcasts
        .on('broadcast', { event: 'fast_sync' }, (payload) => {
            callback(payload.payload.state_data);
        })
        // Fallback: Still listen to the database just in case a packet drops
        .on('postgres_changes', { event: '*', schema: 'public', table: 'auction_state', filter: `room_name=eq.${roomName}` }, (payload) => {
            callback(payload.new.state_data);
        })
        .subscribe((status) => {
            if (status === 'SUBSCRIBED') console.log('⚡ High-Speed Broadcast Channel Active');
        });

    return activeChannel;
}

window.Backend = { loginUser, syncAuctionState, getAuctionState, getAllRooms, deleteAuctionState, subscribeToRoom };
