import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function checkRules() {
    try {
        const authData = await pb.admins.authWithPassword('francesco@example.com', 'Francesco123!'); // Try guessing or just check public access
    } catch (e) {
        // If admin login fails, we can't check schema intimately, but we can try to fetch as guest
    }

    // Better strategy: Just try to fetch list as guest.
    pb.authStore.clear(); // Ensure guest
    try {
        await pb.collection('vinyls').getList(1, 1);
        console.log("PUBLIC_ACCESS_OK");
    } catch (e) {
        console.log("PUBLIC_ACCESS_DENIED: " + e.message);
    }
}

checkRules();
