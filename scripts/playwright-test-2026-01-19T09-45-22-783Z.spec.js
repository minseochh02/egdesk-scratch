const { chromium } = require('playwright-core');
const path = require('path');
const os = require('os');
const fs = require('fs');

(async () => {
  console.log('🎬 Starting test replay...');
  
  // Create downloads directory in system Downloads folder
  const downloadsPath = path.join(os.homedir(), 'Downloads', 'EGDesk-Playwright');
  if (!fs.existsSync(downloadsPath)) {
    fs.mkdirSync(downloadsPath, { recursive: true });
  }
  console.log('📥 Downloads will be saved to:', downloadsPath);

  // Create temporary profile directory
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'playwright-profile-'));
  console.log('📁 Using profile directory:', profileDir);

  // Launch browser with persistent context (more reliable in production)
  const context = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    channel: 'chrome', // Uses installed Chrome
    viewport: null,
    permissions: ['clipboard-read', 'clipboard-write'],
    acceptDownloads: true,
    downloadsPath: downloadsPath,
    args: [
      '--window-size=907,944',
      '--window-position=605,0',
      '--no-default-browser-check',
      '--disable-blink-features=AutomationControlled',
      '--no-first-run',
      // Permission handling for localhost and private network access
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--allow-running-insecure-content',
      '--disable-features=PrivateNetworkAccessSendPreflights',
      '--disable-features=PrivateNetworkAccessRespectPreflightResults'
    ]
  });

  // Get or create page
  const pages = context.pages();
  const page = pages.length > 0 ? pages[0] : await context.newPage();

  try {
    await page.goto('https://card.nonghyup.com/servlet/IpCo9151I.act');
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="loginUserId"]').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.fill('[id="loginUserId"]', '//blured username');
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="loginUserPwd"]').click();
    await page.waitForTimeout(1749); // Human-like delay (1x multiplier)
    await page.fill('[id="loginUserPwd"]', 'a1aaa_aaaa');
    await page.locator('.btn_login > span:nth-child(1)').click();
    await page.waitForTimeout(2345); // Human-like delay (1x multiplier)
    await page.locator('button:has-text("배너 자동롤링 멈춤")').click();
    await page.locator('[id="btnPopClose_200"]').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('.pop_wrap > div:nth-child(2)').click();
    await page.waitForTimeout(2465); // Human-like delay (1x multiplier)
    await page.locator('button:has-text("현재 창 닫기") >> nth=4').click();
    await page.locator('button:has-text("배너 자동롤링 시작")').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('a:has-text("마이") >> nth=0').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('a > span:nth-child(1)').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="CrdNbr"]').click();
    await page.waitForTimeout(2312); // Human-like delay (1x multiplier)
    await page.locator('[id="CrdNbr"]').click();
    await page.locator('[id="CrdNbr"]').click();
    await page.waitForTimeout(1364); // Human-like delay (1x multiplier)
    await page.locator('[id="CrdNbr"]').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Select date: today - 1 days
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + -1);
    const year = targetDate.getFullYear().toString();
    const month = (targetDate.getMonth() + 1).toString(); // 1-12
    const day = targetDate.getDate().toString();

    await page.selectOption('[id="start_year"]', year);
    await page.waitForTimeout(1200); // Human-like delay
    await page.selectOption('[id="start_month"]', month);
    await page.waitForTimeout(800); // Human-like delay
    await page.selectOption('[id="start_date"]', day);
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // Select date: today
    const targetDate = new Date();
    const year = targetDate.getFullYear().toString();
    const month = (targetDate.getMonth() + 1).toString(); // 1-12
    const day = targetDate.getDate().toString();

    await page.selectOption('[id="end_year"]', year);
    await page.waitForTimeout(1200); // Human-like delay
    await page.selectOption('[id="end_month"]', month);
    await page.waitForTimeout(800); // Human-like delay
    await page.selectOption('[id="end_date"]', day);
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="btn_search"]').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="btn_search"]').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="CrdNbr"]').click();
    await page.waitForTimeout(1375); // Human-like delay (1x multiplier)
    await page.locator('[id="CrdNbr"]').click();
    await page.waitForTimeout(1724); // Human-like delay (1x multiplier)
    await page.locator('[id="btn_search"]').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="btn_plus"]').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="btn_plus"]').click();
    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // ========================================
    // TABLE CAPTURE - 3 table(s) found
    // ========================================

    // Table 1:
    //   XPath: /html/body/div/div[2]/div/form/table
    //   CSS Selector: div > form > table.tb_row
    //   Row Count: 5
    //   Headers: ["카드번호"]
    //   Sample Row: ["카드번호", "선택하십시오.전체카드전체NH채움카드전체NHBC카드     5461-11**-****-9550 국민내일배움카드(체크)(차*수)     6243-62**-****-2820 라이언 치즈 체크카드(차*수)     5286-64**-****-0771 BIZ WITH POINT체크(차*수)     5286-64**-****-0649 BIZ WITH POINT체크(차*수)   
					
				    	lfSetValueCrdSelectBox();
				     
				             
				         
				         전체발급카드보기
				 
				              
				        
				       정상카드만보기"]
    // Schema:
    //   Column 1: "카드번호" - Example: "카드번호"

    // Table 2:
    //   XPath: /html/body/div/div[2]/div/div[4]/div/table
    //   CSS Selector: div > div.sec_result > table.tb_row
    //   Row Count: 2
    //   Headers: ["총건수", "정상건수", "취소건수"]
    //   Sample Row: ["총건수", "31건", "정상건수", "30건", "취소건수", "1건"]
    // Schema:
    //   Column 1: "총건수" - Example: "총건수"
    //   Column 2: "정상건수" - Example: "31건"
    //   Column 3: "취소건수" - Example: "정상건수"

    // Table 3:
    //   XPath: //*[@id="listTable"]
    //   CSS Selector: [id="listTable"]
    //   Row Count: 31
    //   Headers: ["", "카드 번호", "거래 일자", "승인 번호", "거래 금액", "가맹 점명", "거래 방법", "할부 기간", "취소 여부", "상세 내역"]
    //   Sample Row: ["<data><이용카드><![CDATA[M771]]></이용카드><이용일시><![CDATA[2026/01/19 14:46:51]]></이용일시><승인번호><![CDATA[55192909]]></승인번호><공급금액><![CDATA[3182]]></공급금액><부가세><![CDATA[318]]></부가세><봉사료><![CDATA[0]]></봉사료><보증금><![CDATA[0]]></보증금><이용금액><![CDATA[3500]]></이용금액><가맹점명><![CDATA[컴포즈커피군포첨단산업단지점]]></가맹점명><매출종류><![CDATA[예금인출]]></매출종류><할부기간><![CDATA[]]></할부기간><접수월일><![CDATA[]]></접수월일><취소여부><![CDATA[]]></취소여부><결제일><![CDATA[]]></결제일></data>", "마스터
							
										771", "2026/01/1914:46:51", "55192909", "3,500원", "컴포즈커피군포첨단산업단지점
						
							
									컴포즈커피군포첨단산업단지점", "예금인출", "", "", "매출전표영수증"]
    // Schema:
    //   Column 1: "" - Example: "<data><이용카드><![CDATA[M771]]></이용카드><이용일시><![CDATA[2026/01/19 14:46:51]]></이용일시><승인번호><![CDATA[55192909]]></승인번호><공급금액><![CDATA[3182]]></공급금액><부가세><![CDATA[318]]></부가세><봉사료><![CDATA[0]]></봉사료><보증금><![CDATA[0]]></보증금><이용금액><![CDATA[3500]]></이용금액><가맹점명><![CDATA[컴포즈커피군포첨단산업단지점]]></가맹점명><매출종류><![CDATA[예금인출]]></매출종류><할부기간><![CDATA[]]></할부기간><접수월일><![CDATA[]]></접수월일><취소여부><![CDATA[]]></취소여부><결제일><![CDATA[]]></결제일></data>"
    //   Column 2: "카드 번호" - Example: "마스터
							
										771"
    //   Column 3: "거래 일자" - Example: "2026/01/1914:46:51"
    //   Column 4: "승인 번호" - Example: "55192909"
    //   Column 5: "거래 금액" - Example: "3,500원"
    //   Column 6: "가맹 점명" - Example: "컴포즈커피군포첨단산업단지점
						
							
									컴포즈커피군포첨단산업단지점"
    //   Column 7: "거래 방법" - Example: "예금인출"
    //   Column 8: "할부 기간" - Example: "(no data)"
    //   Column 9: "취소 여부" - Example: "(no data)"
    //   Column 10: "상세 내역" - Example: "매출전표영수증"

    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    // ========================================
    // TABLE CAPTURE - 3 table(s) found
    // ========================================

    // Table 1:
    //   XPath: /html/body/div/div[2]/div/form/table
    //   CSS Selector: div > form > table.tb_row
    //   Row Count: 5
    //   Headers: ["카드번호"]
    //   Sample Row: ["카드번호", "선택하십시오.전체카드전체NH채움카드전체NHBC카드     5461-11**-****-9550 국민내일배움카드(체크)(차*수)     6243-62**-****-2820 라이언 치즈 체크카드(차*수)     5286-64**-****-0771 BIZ WITH POINT체크(차*수)     5286-64**-****-0649 BIZ WITH POINT체크(차*수)   
					
				    	lfSetValueCrdSelectBox();
				     
				             
				         
				         전체발급카드보기
				 
				              
				        
				       정상카드만보기"]
    // Schema:
    //   Column 1: "카드번호" - Example: "카드번호"

    // Table 2:
    //   XPath: /html/body/div/div[2]/div/div[4]/div/table
    //   CSS Selector: div > div.sec_result > table.tb_row
    //   Row Count: 2
    //   Headers: ["총건수", "정상건수", "취소건수"]
    //   Sample Row: ["총건수", "31건", "정상건수", "30건", "취소건수", "1건"]
    // Schema:
    //   Column 1: "총건수" - Example: "총건수"
    //   Column 2: "정상건수" - Example: "31건"
    //   Column 3: "취소건수" - Example: "정상건수"

    // Table 3:
    //   XPath: //*[@id="listTable"]
    //   CSS Selector: [id="listTable"]
    //   Row Count: 31
    //   Headers: ["", "카드 번호", "거래 일자", "승인 번호", "거래 금액", "가맹 점명", "거래 방법", "할부 기간", "취소 여부", "상세 내역"]
    //   Sample Row: ["<data><이용카드><![CDATA[M771]]></이용카드><이용일시><![CDATA[2026/01/19 14:46:51]]></이용일시><승인번호><![CDATA[55192909]]></승인번호><공급금액><![CDATA[3182]]></공급금액><부가세><![CDATA[318]]></부가세><봉사료><![CDATA[0]]></봉사료><보증금><![CDATA[0]]></보증금><이용금액><![CDATA[3500]]></이용금액><가맹점명><![CDATA[컴포즈커피군포첨단산업단지점]]></가맹점명><매출종류><![CDATA[예금인출]]></매출종류><할부기간><![CDATA[]]></할부기간><접수월일><![CDATA[]]></접수월일><취소여부><![CDATA[]]></취소여부><결제일><![CDATA[]]></결제일></data>", "마스터
							
										771", "2026/01/1914:46:51", "55192909", "3,500원", "컴포즈커피군포첨단산업단지점
						
							
									컴포즈커피군포첨단산업단지점", "예금인출", "", "", "매출전표영수증"]
    // Schema:
    //   Column 1: "" - Example: "<data><이용카드><![CDATA[M771]]></이용카드><이용일시><![CDATA[2026/01/19 14:46:51]]></이용일시><승인번호><![CDATA[55192909]]></승인번호><공급금액><![CDATA[3182]]></공급금액><부가세><![CDATA[318]]></부가세><봉사료><![CDATA[0]]></봉사료><보증금><![CDATA[0]]></보증금><이용금액><![CDATA[3500]]></이용금액><가맹점명><![CDATA[컴포즈커피군포첨단산업단지점]]></가맹점명><매출종류><![CDATA[예금인출]]></매출종류><할부기간><![CDATA[]]></할부기간><접수월일><![CDATA[]]></접수월일><취소여부><![CDATA[]]></취소여부><결제일><![CDATA[]]></결제일></data>"
    //   Column 2: "카드 번호" - Example: "마스터
							
										771"
    //   Column 3: "거래 일자" - Example: "2026/01/1914:46:51"
    //   Column 4: "승인 번호" - Example: "55192909"
    //   Column 5: "거래 금액" - Example: "3,500원"
    //   Column 6: "가맹 점명" - Example: "컴포즈커피군포첨단산업단지점
						
							
									컴포즈커피군포첨단산업단지점"
    //   Column 7: "거래 방법" - Example: "예금인출"
    //   Column 8: "할부 기간" - Example: "(no data)"
    //   Column 9: "취소 여부" - Example: "(no data)"
    //   Column 10: "상세 내역" - Example: "매출전표영수증"

    await page.waitForTimeout(3000); // Human-like delay (1x multiplier)
    await page.locator('[id="changeDiv"] > div:nth-child(2)').click();
  } finally {
    await context.close();
    // Clean up profile directory
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch (e) {
      console.warn('Failed to clean up profile directory:', e);
    }
  }
})().catch(console.error);