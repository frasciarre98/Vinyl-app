import PocketBase from 'pocketbase';
import fs from 'fs';

const pb = new PocketBase('http://192.168.0.250:8090');

async function fix() {
    await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH').catch(() => {});
    
    // Find Raye
    const records = await pb.collection('vinyls').getFullList({ filter: "artist~'Raye'" });
    if (records.length === 0) return console.log("Not found");
    const raye = records[0];
    
    // Download image
    const imgUrl = `http://192.168.0.250:8090/api/files/vinyls/${raye.id}/${raye.image}`;
    const imgRes = await fetch(imgUrl);
    const imgBuffer = await imgRes.arrayBuffer();
    const blob = new Blob([imgBuffer], { type: 'image/jpeg' });
    
    // Create new record
    const formData = new FormData();
    formData.append('artist', raye.artist);
    formData.append('title', raye.title);
    formData.append('year', raye.year);
    formData.append('genre', raye.genre);
    formData.append('format', raye.format);
    formData.append('label', raye.label);
    formData.append('catalog_number', raye.catalog_number);
    formData.append('edition', raye.edition);
    formData.append('condition', raye.condition);
    formData.append('purchase_price', raye.purchase_price);
    formData.append('purchase_year', raye.purchase_year);
    formData.append('rating', raye.rating);
    formData.append('sort_priority', raye.sort_priority);
    formData.append('image', blob, raye.image);
    formData.append('locked_fields', JSON.stringify(raye.locked_fields));
    
    const newRecord = await pb.collection('vinyls').create(formData);
    console.log("Created new:", newRecord.id);
    
    // Delete old
    await pb.collection('vinyls').delete(raye.id);
    console.log("Deleted old:", raye.id);
}
fix();
