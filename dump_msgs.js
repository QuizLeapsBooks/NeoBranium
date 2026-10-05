import dotenv from 'dotenv';
dotenv.config();
const { rtdb } = await import('./firebaseAdmin.js');
async function run() {
  if (!rtdb) { console.log('no rtdb'); return; }
  const snap = await rtdb.ref('neolearn_direct_messages').once('value');
  console.log(JSON.stringify(snap.val(), null, 2));
  process.exit(0);
}
run();
