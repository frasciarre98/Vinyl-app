import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function debugSort() {
    try {
        console.log("Fetching all records...");
        const records = await pb.collection('vinyls').getFullList({
            requestKey: null
        });

        console.log(`Fetched ${records.length} records.`);

        // Exact logic from VinylGrid.jsx
        const getTimestamp = (record) => {
            // 1. Try system created date
            // Note: In Node script, record.created might be undefined or string. 
            // The issue is created is missing.
            const created = record.created && record.created !== 'Invalid Date' ? new Date(record.created).getTime() : 0;
            if (created > 0) return created;

            // 2. Try extracting from Image Filename
            if (record.image) {
                // Priority A: Known prefixes (cropped_, time_)
                const prefixMatch = record.image.match(/(?:time|cropped|img)_(\d{13})/i);
                if (prefixMatch) {
                    return parseInt(prefixMatch[1], 10);
                }

                // Priority B: Start with 13 digits (but check range)
                const genericMatch = record.image.match(/^(\d{13})/);
                if (genericMatch) {
                    const ts = parseInt(genericMatch[1], 10);
                    // Valid range: 2000 (946684800000) to 2035 (2051222400000)
                    // This filters out "696..." which is far future
                    if (ts > 946684800000 && ts < 2051222400000) {
                        return ts;
                    }
                }
            }

            return 0;
        };

        const sorted = records.sort((a, b) => {
            const dateA = getTimestamp(a);
            const dateB = getTimestamp(b);

            if (dateA !== dateB) {
                return dateB - dateA;
            }
            // Fallback to ID
            return (b.id || '').localeCompare(a.id || '');
        });

        console.log("\n--- TOP 5 AFTER SORT ---");
        sorted.slice(0, 5).forEach((r, i) => {
            console.log(`#${i + 1} [TS: ${getTimestamp(r)}] ${r.artist} - ${r.title} (ID: ${r.id}) Image: ${r.image}`);
        });

        const pattiIndex = sorted.findIndex(r => r.artist.includes('Patti Smith'));
        if (pattiIndex >= 0) {
            const patti = sorted[pattiIndex];
            console.log(`\n✅ Patti Smith is at #${pattiIndex + 1}`);
            console.log(`   [TS: ${getTimestamp(patti)}] ID: ${patti.id} Image: ${patti.image}`);
        } else {
            console.log("\n❌ Patti Smith NOT FOUND in list");
        }

    } catch (e) {
        console.error(e);
    }
}

debugSort();
