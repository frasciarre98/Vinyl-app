async function run() {
    try {
        const createRes = await fetch('http://127.0.0.1:8090/api/collections/vinyls/records', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artist: "Test", title: "Test", average_cost: "1" })
        });
        const created = await createRes.json();
        console.log("Created:", created.id);
        
        const res = await fetch(`http://127.0.0.1:8090/api/collections/vinyls/records/${created.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ average_cost: "€100" })
        });
        const data = await res.json();
        console.log("Update Response:", res.status, data);
    } catch(e) {
        console.error(e);
    }
}
run();
