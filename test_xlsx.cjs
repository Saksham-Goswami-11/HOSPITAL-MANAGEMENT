const XLSX = require('xlsx');
const fs = require('fs');
const csv = 'Item Name,Clinic,Batch Number,Expiry Date,MRP,Stock Level,Threshold\n"Dettol bottle 100ml","Unknown","101",2031-09-01,140,94,10';
fs.writeFileSync('test.csv', csv);

const data = fs.readFileSync('test.csv');
const wb = XLSX.read(data, { type: 'buffer' });
const sheetName = wb.SheetNames[0];
const worksheet = wb.Sheets[sheetName];

const jsonData = XLSX.utils.sheet_to_json(worksheet);

console.log("JSON Output: ", JSON.stringify(jsonData, null, 2));

const insertPayloads = jsonData.map(row => {
    const cleanRow = {};
    Object.keys(row).forEach(key => {
        const cleanKey = key.replace(/^"|"$/g, '').trim();
        let cleanValue = row[key];
        if (typeof cleanValue === 'string') {
            cleanValue = cleanValue.replace(/^"|"$/g, '').trim();
        }
        cleanRow[cleanKey] = cleanValue;
    });
    return cleanRow;
});

console.log("Cleaned: ", JSON.stringify(insertPayloads, null, 2));

