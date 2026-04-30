  async getAccounts() {
    if (!this.page) throw new Error('Browser page not initialized');

    try {
      this.log(`[NH] Current URL: ${this.page.url()}`);
      this.log('Checking for accounts on current page...');
      await this.page.waitForTimeout(2000);

      // First try to extract from dropdown
      let dropdownAccounts = [];
      try {
        const accountDropdown = this.page.locator(`select[id*="Acn"], select[id*="acn"], select#sel_account, ${this.config.xpaths.accountDropdown}`);
        const count = await accountDropdown.count();
        this.log(`Found ${count} potential account dropdowns`);

        if (count > 0) {
          const targetDropdown = accountDropdown.first();
          if (await targetDropdown.isVisible({ timeout: 5000 })) {
            this.log('Found account dropdown, extracting options...');
            dropdownAccounts = await targetDropdown.locator('option').evaluateAll(options => {
              return options
                .filter(opt => opt.value && opt.value !== '' && !opt.textContent.includes('선택'))
                .map(opt => {
                  const text = opt.textContent.trim();
                  // More flexible pattern: look for digits separated by dashes
                  const match = text.match(/([\d-]{10,18})/);
                  return {
                    accountNumber: match ? match[1] : text,
                    accountName: text.replace(match ? match[1] : '', '').trim() || 'NH 계좌',
                    value: opt.value,
                    selected: opt.selected
                  };
                });
            });
            this.log(`Extracted ${dropdownAccounts.length} accounts from dropdown`);
          }
        }
      } catch (dropdownError) {
        this.warn('Failed to extract from dropdown:', dropdownError.message);
      }

      if (dropdownAccounts.length > 0) {
        return dropdownAccounts.map(acc => ({
          accountNumber: acc.accountNumber,
          accountName: acc.accountName || 'NH 계좌',
          bankId: 'nh',
          balance: 0,
          isDefault: acc.selected || false
        }));
      }

      // Fallback: Extract accounts from page text
      this.log('Dropdown extraction failed or empty, falling back to text search...');
      const accounts = await this.page.evaluate(() => {
        const results = [];
        const seenAccounts = new Set();
        
        // Look for account dropdowns, lists, or tables
        // NH Bank account pattern: typically 3-2-6 or 3-3-6 digits
        const accountPatterns = [
          /(\d{3}-\d{2,4}-\d{4,6}-\d{2})/g,
          /(\d{3}-\d{2}-\d{6})/g,
          /(\d{3}-\d{3}-\d{6})/g,
          /(\d{11,18})/g,
        ];
        
        // Search all text nodes
        const walker = document.createTreeWalker(
          document.body,
          NodeFilter.SHOW_TEXT,
          null,
          false
        );
        
        let node;
        while ((node = walker.nextNode())) {
          const text = node.textContent.trim();
          if (!text) continue;
          
          for (const pattern of accountPatterns) {
            const matches = text.matchAll(pattern);
            for (const match of matches) {
              const acc = match[1];
              if (!seenAccounts.has(acc)) {
                seenAccounts.add(acc);
                results.push({
                  accountNumber: acc,
                  accountName: 'NH 계좌 (검색됨)',
                  bankId: 'nh',
                  balance: 0
                });
              }
            }
          }
        }
        return results;
      });

      this.log(`Found ${accounts.length} accounts via text search`);
      return accounts;
    } catch (error) {
      this.error('getAccounts failed:', error.message);
      return [];
    }
  }
