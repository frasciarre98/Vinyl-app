import PocketBase from 'pocketbase';
const pb = new PocketBase('http://192.168.0.250:8090');
async function test() {
    await pb.admins.authWithPassword('frasciarre@gmail.com', 'Q3WLitXAKm5k2VH').catch(() => {});
    const records = await pb.collection('vinyls').getList(1, 1);
    console.log(records.items[0]);
}
test();
