const Database = require('better-sqlite3');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dbPath = path.join(os.homedir(), 'AppData', 'Roaming', 'egdesk', 'database', 'financehub.db');
const db = new Database(dbPath, { readonly: true });

try {
  console.log('=== saved_credentials 테이블 분석 ===');
  const creds = db.prepare("SELECT * FROM saved_credentials").all();
  console.log(`총 ${creds.length}개 크레덴셜 존재`);
  creds.forEach(c => {
    console.log(`ID: ${c.id} | provider: ${c.provider} | user_id: ${c.user_id} | name: ${c.name}`);
  });

  console.log('\n=== hometax_connections 테이블 분석 ===');
  const hometax = db.prepare("SELECT * FROM hometax_connections").all();
  console.log(`총 ${hometax.length}개 홈택스 커넥션 존재`);
  hometax.forEach(h => {
    console.log(`ID: ${h.id} | username: ${h.username} | business_number: ${h.business_number}`);
  });

  console.log('\n=== banks 테이블 분석 ===');
  const banks = db.prepare("SELECT * FROM banks").all();
  console.log(`총 ${banks.length}개 은행 존재`);
  banks.forEach(b => {
    console.log(`ID: ${b.id} | name: ${b.name}`);
  });

} catch (e) {
  console.error(e);
} finally {
  db.close();
}
