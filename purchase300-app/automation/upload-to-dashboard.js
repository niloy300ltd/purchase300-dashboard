/**
 * Auto-upload script for Purchase Ledger 300 Limited.
 *
 * What it does:
 *  1. Reads the Excel file from FILE_PATH below.
 *  2. Parses it the same way the dashboard expects (Date, Supplier, Item, Qty, Rate, UOM, Amount).
 *  3. Sends it to your deployed site's /api/upload endpoint using a secret key
 *     (no browser / login needed).
 *
 * Setup:
 *  1. Install Node.js from https://nodejs.org (if not already installed) - LTS version.
 *  2. Open a terminal / Command Prompt in this "automation" folder and run:
 *       npm install xlsx
 *  3. Edit the CONFIG section below with your real values.
 *  4. Test it manually once:
 *       node upload-to-dashboard.js
 *  5. Once it works, schedule it with Windows Task Scheduler (see README-automation.md).
 */

const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

/* ==================== CONFIG - EDIT THESE ==================== */
const CONFIG = {
  // Full path to the Excel file on this computer. Use double backslashes on Windows.
  FILE_PATH: 'C:\\Users\\YourName\\Documents\\Purchase\\Purchase300.xlsx',

  // Your deployed site's base URL (no trailing slash).
  SITE_URL: 'https://purchase300-dashboard.vercel.app',

  // The secret key you set as UPLOAD_API_KEY in Vercel's Environment Variables.
  UPLOAD_KEY: 'PUT-THE-SAME-SECRET-KEY-HERE',
};
/* =============================================================== */

function normalizeHeader(h) {
  return String(h || '').trim().toLowerCase();
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  return new Date(utcValue * 1000);
}

function parseDateCell(val) {
  if (val instanceof Date && !isNaN(val)) return val;
  if (typeof val === 'number') return excelSerialToDate(val);
  if (typeof val === 'string') {
    const s = val.trim();
    const m = s.match(/^(\d{1,2})[-\/ ]([A-Za-z]{3,})[-\/ ](\d{4})$/);
    if (m) {
      const months = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
      const mo = months[m[2].slice(0, 3).toLowerCase()];
      if (mo !== undefined) return new Date(Date.UTC(parseInt(m[3]), mo, parseInt(m[1])));
    }
    const generic = new Date(s);
    if (!isNaN(generic)) return generic;
  }
  return null;
}

function toYMD(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

function parseWorkbook(wb) {
  const sheetName = wb.SheetNames.includes('Report') ? 'Report' : wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  if (!rows.length) throw new Error('Sheet is empty.');

  const header = rows[0].map(normalizeHeader);
  const idx = {
    date: header.findIndex((h) => h === 'date'),
    supplier: header.findIndex((h) => h.includes('supplier')),
    item: header.findIndex((h) => h.includes('item')),
    qty: header.findIndex((h) => h.includes('qty') || h.includes('quantity')),
    rate: header.findIndex((h) => h === 'rate' || h.includes('rate')),
    uom: header.findIndex((h) => h === 'uom' || h.includes('unit')),
    amount: header.findIndex((h) => h.includes('amount')),
  };
  const missing = Object.entries(idx).filter(([k, v]) => v === -1 && k !== 'uom');
  if (missing.length) throw new Error('Missing expected column(s): ' + missing.map((m) => m[0]).join(', '));

  const records = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row.length) continue;
    const rawDate = row[idx.date];
    if (rawDate === null || rawDate === undefined) continue;
    if (typeof rawDate === 'string' && rawDate.trim().toLowerCase() === 'total') continue;
    const d = parseDateCell(rawDate);
    if (!d) continue;

    const item = row[idx.item];
    if (!item) continue;
    const qty = row[idx.qty] !== null && row[idx.qty] !== undefined ? parseFloat(row[idx.qty]) : null;
    const rate = row[idx.rate] !== null && row[idx.rate] !== undefined ? parseFloat(row[idx.rate]) : null;
    let amount = idx.amount !== -1 && row[idx.amount] !== null && row[idx.amount] !== undefined ? parseFloat(row[idx.amount]) : null;
    if (amount === null && qty !== null && rate !== null) amount = qty * rate;
    if (amount === null || isNaN(amount)) continue;

    records.push({
      date: toYMD(d),
      supplier: idx.supplier !== -1 ? row[idx.supplier] || 'Unknown' : 'Unknown',
      item: item,
      qty: isNaN(qty) ? null : qty,
      rate: isNaN(rate) ? null : rate,
      uom: idx.uom !== -1 ? row[idx.uom] || '' : '',
      amount: amount,
    });
  }
  if (!records.length) throw new Error('No valid data rows found in this file.');
  return records;
}

function log(msg) {
  const stamp = new Date().toLocaleString();
  console.log(`[${stamp}] ${msg}`);
}

async function main() {
  log('Starting auto-upload...');

  if (!fs.existsSync(CONFIG.FILE_PATH)) {
    throw new Error('File not found: ' + CONFIG.FILE_PATH);
  }

  const buf = fs.readFileSync(CONFIG.FILE_PATH);
  const wb = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const records = parseWorkbook(wb);
  log(`Parsed ${records.length} rows from ${path.basename(CONFIG.FILE_PATH)}`);

  const res = await fetch(CONFIG.SITE_URL + '/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-upload-key': CONFIG.UPLOAD_KEY,
    },
    body: JSON.stringify({ records, fileName: path.basename(CONFIG.FILE_PATH) }),
  });

  const json = await res.json();
  if (!res.ok) throw new Error(json.error || ('Upload failed with status ' + res.status));

  log(`Success! Published ${json.rows} rows to the dashboard.`);
}

main().catch((err) => {
  log('ERROR: ' + err.message);
  process.exitCode = 1;
});
