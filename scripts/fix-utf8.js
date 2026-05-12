import PocketBase from 'pocketbase';
const pb = new PocketBase('http://192.168.0.250:8090');

async function fix() {
    await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH').catch(() => {});
    const records = await pb.collection('vinyls').getFullList();
    let fixedCount = 0;

    for (const r of records) {
        let updated = false;
        const newRecord = {};

        const fixText = (text) => {
            if (!text) return text;
            let original = text;
            let clean = text
                .replace(/Ã /g, 'à').replace(/Ã¡/g, 'à')
                .replace(/Ã¨/g, 'è').replace(/Ã©/g, 'é')
                .replace(/Ã¬/g, 'ì').replace(/Ã­/g, 'ì')
                .replace(/Ã²/g, 'ò').replace(/Ã³/g, 'ò')
                .replace(/Ã¹/g, 'ù').replace(/Ãº/g, 'ù')
                .replace(/â€™/g, "'").replace(/â€/g, '"')
                .replace(/â€œ/g, '"').replace(/â€ /g, '"')
                .replace(/lâ€™/g, "l'").replace(/dâ€™/g, "d'")
                .replace(/unâ€™/g, "un'").replace(/dellâ€™/g, "dell'")
                .replace(/â€“/g, '-').replace(/â€”/g, '-')
                .replace(/Ã/g, 'à');
            
            if (original !== clean) return clean;
            return null;
        };

        const fields = ['liner_notes', 'notes', 'title', 'artist'];
        for (const field of fields) {
            const fixed = fixText(r[field]);
            if (fixed !== null) {
                newRecord[field] = fixed;
                updated = true;
            }
        }

        if (updated) {
            try {
                await pb.collection('vinyls').update(r.id, newRecord);
                fixedCount++;
                console.log(`Fixed: ${r.title}`);
            } catch (e) {
                console.error(`Failed to fix ${r.id}:`, e.message);
            }
        }
    }
    console.log(`Finished fixing ${fixedCount} records.`);
}
fix();
