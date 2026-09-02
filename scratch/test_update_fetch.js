async function run() {
    try {
        const resList = await fetch('http://127.0.0.1:8090/api/collections/vinyls/records?perPage=1');
        const list = await resList.json();
        if (list.items && list.items.length > 0) {
            const id = list.items[0].id;
            console.log("Updating ID:", id);
            const res = await fetch(`http://127.0.0.1:8090/api/collections/vinyls/records/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ average_cost: "€100" })
            });
            const data = await res.json();
            console.log("Response:", res.status, data);
        } else {
            console.log("No records found", list);
        }
    } catch(e) {
        console.error(e);
    }
}
run();
