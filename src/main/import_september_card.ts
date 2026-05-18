import { getSQLiteManager } from './sqlite/manager';
import * as path from 'path';

const downloadsDir = path.join(process.env.USERPROFILE || '', 'Downloads');
const excelPath = path.join(downloadsDir, '9월.xls');

async function main() {
  try {
    console.log('🏁 9월 카드 결제 내역 재반영(Import) 시작...');
    console.log(`📂 파일 경로: ${excelPath}`);

    // Initialize Database manager
    const manager = getSQLiteManager();
    const financeHubDb = manager.getFinanceHubManager();

    // Import BC Card Automator using relative path
    const BCCardAutomator = require('./financehub/cards/bc-card/BCCardAutomator');
    const automator = new BCCardAutomator.BCCardAutomator({
      headless: true,
      outputDir: path.join(process.cwd(), 'output', 'temp-card-import')
    });

    console.log('🔍 엑셀 파일 파싱 중...');
    const extractedData = await automator.parseDownloadedExcel(excelPath);
    const transactionsData = extractedData.transactions || [];
    console.log(`📊 엑셀에서 추출한 거래 건수: ${transactionsData.length}건`);

    if (transactionsData.length === 0) {
      console.error('❌ 거래 내역이 발견되지 않았습니다.');
      return;
    }

    // 1. Group transactions by card number
    const transactionsByCard = new Map<string, any[]>();
    transactionsData.forEach((tx: any) => {
      const txCardNumber = tx.cardNumber || tx['카드번호'] || tx['이용카드'] || tx.cardUsed || 'MANUAL-IMPORT';
      if (!transactionsByCard.has(txCardNumber)) {
        transactionsByCard.set(txCardNumber, []);
      }
      transactionsByCard.get(txCardNumber)!.push(tx);
    });

    // 2. Get existing accounts for matching
    const cardCompanyId = 'bc-card';
    const existingAccounts = financeHubDb.getAccountsByBank(cardCompanyId);

    let totalInserted = 0;
    let totalSkipped = 0;

    // 3. Import each card group separately
    for (const [txCardNumber, cardTransactions] of transactionsByCard.entries()) {
      const cleanedTxNumber = String(txCardNumber).replace(/[^\d]/g, '');
      const last6 = cleanedTxNumber.length >= 6 ? cleanedTxNumber.slice(-6) : cleanedTxNumber;

      let matchedAccount = existingAccounts.find(acc => 
        acc.accountNumber === txCardNumber || 
        (last6 && acc.accountNumber.replace(/[^\d]/g, '').endsWith(last6))
      );

      const accountNumber = matchedAccount ? matchedAccount.accountNumber : txCardNumber;
      const accountName = matchedAccount ? matchedAccount.accountName : (extractedData.metadata?.cardName || '수동 업로드 카드');

      const cardData = {
        accountNumber: accountNumber,
        accountName: accountName,
        customerName: extractedData.metadata?.customerName || '',
        balance: 0,
        availableBalance: 0,
        openDate: ''
      };

      const dates = cardTransactions
        .map(tx => tx.approvalDate || tx['승인일'] || tx['이용일시']?.split(' ')[0] || '')
        .filter(d => d);
      const queryPeriodStart = dates.length > 0 ? String(Math.min(...dates.map(d => parseInt(d.replace(/[^0-9]/g, ''))))) : 'unknown';
      const queryPeriodEnd = dates.length > 0 ? String(Math.max(...dates.map(d => parseInt(d.replace(/[^0-9]/g, ''))))) : 'unknown';

      console.log(`💳 카드번호 [${txCardNumber}] -> [${accountNumber}] (${cardTransactions.length}건) 임포트 중...`);

      const result = financeHubDb.importTransactions(
        cardCompanyId,
        cardData,
        cardTransactions,
        {
          queryPeriodStart,
          queryPeriodEnd,
          filePath: excelPath
        },
        true // isCard = true
      );

      console.log(`✅ 카드번호 [${txCardNumber}] 완료: ${result.inserted}건 삽입, ${result.skipped}건 건너뜀`);
      totalInserted += result.inserted;
      totalSkipped += result.skipped;
    }

    console.log('==================================================');
    console.log('🎉 9월 카드 내역 재임포트 완료!');
    console.log(`📊 총 삽입 건수: ${totalInserted}건, 건너뜀 건수: ${totalSkipped}건`);
    console.log('==================================================');

  } catch (error: any) {
    console.error('❌ 재임포트 실행 중 오류 발생:', error.stack || error.message);
  }
}

main();
