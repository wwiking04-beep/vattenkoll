import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const $ = (id) => document.getElementById(id);
const OMKRETS = 2 * Math.PI * 94;

function enhetsId() {
  let id = localStorage.getItem('vattenkoll.enhet');
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
    localStorage.setItem('vattenkoll.enhet', id);
  }
  return id;
}
const ENHET = enhetsId();
const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { 'x-device-id': ENHET } },
});

let mal = Number(localStorage.getItem('vattenkoll.mal')) || 8;
let glas = []; // { id, t: Date }

const dagnyckel = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const midnatt = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function visaFel(text) {
  const f = $('fel');
  f.textContent = text || '';
  f.hidden = !text;
}

async function hamta() {
  const fran = midnatt();
  fran.setDate(fran.getDate() - 6);
  const { data, error } = await db.from('glas').select('id,created_at').gte('created_at', fran.toISOString()).order('created_at');
  if (error) return visaFel('Kunde inte hämta dina glas. Försök igen om en stund.');
  visaFel('');
  glas = data.map((r) => ({ id: r.id, t: new Date(r.created_at) }));
  rita();
}

function idag() {
  const k = dagnyckel(new Date());
  return glas.filter((g) => dagnyckel(g.t) === k);
}

function statustext(n) {
  if (n === 0) return 'Dags för första glaset.';
  if (n >= mal) return 'Dagens mål är nått. Snyggt!';
  const kvar = mal - n;
  return kvar === 1 ? 'Ett glas kvar till målet.' : `${kvar} glas kvar till målet.`;
}

let forra = -1;
function rita() {
  const n = idag().length;
  const andel = Math.min(n / mal, 1);
  $('fyll').style.strokeDashoffset = String(OMKRETS * (1 - andel));
  const a = $('antal');
  a.textContent = n;
  if (forra !== -1 && forra !== n) { a.classList.remove('studs'); void a.offsetWidth; a.classList.add('studs'); }
  forra = n;
  $('av').textContent = `av ${mal} glas`;
  $('status').textContent = statustext(n);
  $('angra').disabled = n === 0;
  $('malvarde').textContent = mal;
  $('minus').disabled = mal <= 1;
  $('plus').disabled = mal >= 20;
  const d = new Date();
  $('datum').textContent = d.toLocaleDateString('sv-SE', { weekday: 'long', day: 'numeric', month: 'long' });

  // Veckan
  const per = new Map();
  for (const g of glas) per.set(dagnyckel(g.t), (per.get(dagnyckel(g.t)) || 0) + 1);
  const dagar = [];
  for (let i = 6; i >= 0; i--) {
    const x = midnatt(); x.setDate(x.getDate() - i);
    dagar.push({ d: x, n: per.get(dagnyckel(x)) || 0, idag: i === 0 });
  }
  const topp = Math.max(mal, ...dagar.map((x) => x.n));
  $('vecka').innerHTML = dagar.map((x) => {
    const namn = x.d.toLocaleDateString('sv-SE', { weekday: 'short' }).replace('.', '');
    return `<div class="dag"><em>${x.n || ''}</em><div class="stapel${x.n >= mal ? ' nadd' : ''}"><b style="height:${(x.n / topp) * 100}%"></b></div><small class="${x.idag ? 'idag' : ''}">${x.idag ? 'idag' : namn}</small></div>`;
  }).join('');
  const snitt = dagar.reduce((s, x) => s + x.n, 0) / 7;
  $('snitt').textContent = `snitt ${snitt.toLocaleString('sv-SE', { maximumFractionDigits: 1 })} glas`;
}

$('drick').addEventListener('click', async () => {
  const tillfallig = { id: null, t: new Date() };
  glas.push(tillfallig);
  rita();
  navigator.vibrate?.(10);
  const { data, error } = await db.from('glas').insert({ device_id: ENHET }).select('id,created_at').single();
  if (error) {
    glas = glas.filter((g) => g !== tillfallig);
    rita();
    return visaFel('Glaset kunde inte sparas. Kolla uppkopplingen.');
  }
  visaFel('');
  tillfallig.id = data.id;
  tillfallig.t = new Date(data.created_at);
});

$('angra').addEventListener('click', async () => {
  const sista = idag().filter((g) => g.id !== null).at(-1);
  if (!sista) return;
  glas = glas.filter((g) => g !== sista);
  rita();
  const { error } = await db.from('glas').delete().eq('id', sista.id);
  if (error) { glas.push(sista); glas.sort((a, b) => a.t - b.t); rita(); visaFel('Kunde inte ångra. Försök igen.'); }
});

function sattMal(v) {
  mal = Math.max(1, Math.min(20, v));
  localStorage.setItem('vattenkoll.mal', String(mal));
  rita();
}
$('minus').addEventListener('click', () => sattMal(mal - 1));
$('plus').addEventListener('click', () => sattMal(mal + 1));

// Ny dag vid midnatt och när appen öppnas igen
function planeraMidnatt() {
  const nasta = midnatt(); nasta.setDate(nasta.getDate() + 1);
  setTimeout(() => { hamta(); planeraMidnatt(); }, nasta - new Date() + 1000);
}
document.addEventListener('visibilitychange', () => { if (!document.hidden) hamta(); });

rita();
hamta();
planeraMidnatt();
