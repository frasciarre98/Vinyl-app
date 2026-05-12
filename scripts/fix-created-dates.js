import PocketBase from 'pocketbase';
const pb = new PocketBase('http://192.168.0.250:8090');

async function fix() {
    await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH').catch(() => {});
    const records = await pb.collection('vinyls').getFullList({ requestKey: null });
    
    let updatedCount = 0;

    for (const r of records) {
        let newDate = "2026-04-01 10:00:00.000Z";
        
        // Try to extract timestamp from filename
        const match = r.image.match(/(?:cropped_|warped_|IMG_)(\d{13})/);
        if (match && match[1]) {
            const ts = parseInt(match[1], 10);
            if (ts > 1000000000000) {
                newDate = new Date(ts).toISOString();
            }
        }

        // Only update if it's missing or we want to normalize it
        // Actually, since we just added the field, ALL of them are empty
        if (!r.created || r.created === '') {
            try {
                // To bypass API rules or Read-only autodate, we might need to send a direct request
                // BUT PocketBase v0.23 doesn't allow setting autodate fields via regular create/update API!
                // Wait! In v0.23, you CANNOT update autodate fields via HTTP API!
                // The ONLY way to update autodate fields is direct SQLite or by temporarily making them NOT autodate!
                
            } catch(e) {
                console.error("Failed:", e.message);
            }
        }
    }
}
fix();
