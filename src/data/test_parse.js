const data = require('./vinyls-static.json');
let arr = [];
data.forEach(v => {
    let costStr = String(v.average_cost || '');
    let parsedValue = 0;
    let mc = 0;
    if (v.average_cost) {
        mc = parseFloat(v.average_cost.toString().replace('€', '').replace(',', '.').trim());
    }
    if (!isNaN(mc) && mc > 0) arr.push({ title: v.title, costStr: costStr, mc });
});
arr.sort((a,b) => b.mc - a.mc);
console.log(arr.slice(0, 10));
