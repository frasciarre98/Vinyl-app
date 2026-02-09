import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function check() {
    try {
        const users = await pb.collection('users').getFullList();
        console.log("Found", users.length, "users.");
        users.forEach(u => {
            console.log(`User: ${u.email}`);
            console.log(`Key Present: ${!!u.gemini_api_key}`);
            if (u.gemini_api_key) console.log(`Key Start: ${u.gemini_api_key.substring(0, 10)}...`);
        });
    } catch (e) {
        console.error(e);
    }
}

check();
