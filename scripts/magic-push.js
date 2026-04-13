
import fs from 'fs';
import http from 'http';

const allData = JSON.parse(fs.readFileSync('src/data/vinyls-static.json', 'utf8'));
const CHUNK_SIZE = 50;

async function pushChunks() {
    console.log(`🚀 Inizio spedizione frazionata di ${allData.length} vinili...`);
    
    for (let i = 0; i < allData.length; i += CHUNK_SIZE) {
        const chunk = allData.slice(i, i + CHUNK_SIZE);
        const body = JSON.stringify(chunk);
        
        console.log(`📦 Spedizione blocco ${Math.floor(i/CHUNK_SIZE) + 1}...`);
        
        await new Promise((resolve, reject) => {
            const req = http.request({
                hostname: '192.168.0.250',
                port: 8090,
                path: '/api/magic/restore',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(body)
                }
            }, (res) => {
                let resData = '';
                res.on('data', (d) => resData += d);
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        console.log(`✅ Blocco completato.`);
                        resolve();
                    } else {
                        console.error(`❌ Errore blocco: ${resData}`);
                        reject(new Error(resData));
                    }
                });
            });
            
            req.on('error', reject);
            req.write(body);
            req.end();
        });
    }
    
    console.log("🎉 TUTTO INVIATO CON SUCCESSO!");
}

pushChunks().catch(console.error);
