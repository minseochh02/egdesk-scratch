import { fetchCertificates, downloadTaxBills } from '../../src/main/hometax-automation';
import readline from 'readline';

async function test() {
  console.log('🚀 Starting Hometax Tax Bills Test...');
  
  // 1. Open browser and initialize session
  const certRes = await fetchCertificates();
  if (!certRes.success) {
    console.error('❌ Failed to fetch certificates:', certRes.error);
    process.exit(1);
  }

  console.log('\n✅ Browser opened.');
  console.log('1. In the browser, select your certificate and enter password.');
  console.log('2. Log in completely until you reach the Hometax main dashboard.');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\nPress ENTER once you are logged in and on the home page...', async () => {
    console.log('\n🏃 Triggering downloadTaxBills automation...');
    
    // Call the method. 
    // It will use the existing globalPage session created by fetchCertificates.
    const result = await downloadTaxBills(
      {}, // dummy certificateData (nav only uses session)
      '', // dummy password
      2022, 1,  // startYear, startMonth
      2023, 12, // endYear, endMonth
      (msg) => console.log(`[Progress] ${msg}`)
    );

    console.log('\n🏁 Final Scrape Result:');
    console.log(JSON.stringify(result, null, 2));
    
    console.log('\nTest finished. Inspect the browser, then press Ctrl+C to close.');
    rl.close();
  });
}

test().catch(console.error);
