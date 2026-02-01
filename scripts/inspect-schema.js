import PocketBase from 'pocketbase';

const pb = new PocketBase('http://127.0.0.1:8090');

async function main() {
    try {
        await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH');
        const collection = await pb.collections.getOne('vinyls');
        console.log(JSON.stringify(collection, null, 2));
    } catch (err) {
        console.error(err);
    }
}

main();
