const XLSX = require('xlsx');
const fs = require('fs');
const csv = 'Item Name,Clinic,Batch Number,Expiry Date,MRP,Stock Level,Threshold\n"Dettol bottle 100ml","Unknown","101",2031-09-01,140,94,10';
const wb = XLSX.read(csv, { type: 'string' });
const sheet = wb.Sheets[wb.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(sheet);
console.log(jsonData[0]);
