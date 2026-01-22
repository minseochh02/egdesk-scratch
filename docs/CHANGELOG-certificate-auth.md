# Certificate Authentication UI Update

## Date: 2026-01-16

## Summary
Updated Finance Hub UI to support certificate-based authentication (공동인증서) for business/corporate bank accounts (법인).

## Changes Made

### 1. Type Definitions (`src/renderer/components/FinanceHub/types.ts`)

**Added certificate password field:**
```typescript
export interface BankCredentials {
  bankId: string;
  userId: string;
  password: string;
  certificatePassword?: string; // 공동인증서 비밀번호 (for corporate accounts)
  accountType?: 'personal' | 'corporate'; // 개인 or 법인
}
```

### 2. Component State (`src/renderer/components/FinanceHub/FinanceHub.tsx`)

**Updated credentials state initialization:**
```typescript
const [credentials, setCredentials] = useState<BankCredentials>({
  bankId: '',
  userId: '',
  password: '',
  certificatePassword: '', // NEW
  accountType: 'personal'
});
```

**Updated all credential reset locations:**
- `handleCloseModal()`
- `handleBackToList()`
- `handleSelectBank()` - Now loads and saves certificatePassword from saved credentials

### 3. Connection Logic

**Updated `handleConnect()` function:**
- ✅ Validates based on account type:
  - Personal (개인): Requires `userId` + `password`
  - Corporate (법인): Requires `certificatePassword` only
- ✅ Passes appropriate credentials to backend:
  ```typescript
  const loginCredentials = credentials.accountType === 'corporate'
    ? { certificatePassword: credentials.certificatePassword }
    : { userId: credentials.userId, password: credentials.password };
  ```

### 4. UI Changes

#### A. Enabled Corporate Account Button
**Before:**
```tsx
<button disabled={true} title="법인 계정은 준비 중입니다">
```

**After:**
```tsx
<button disabled={isConnecting}>
```

#### B. Conditional Input Fields
The form now shows different input fields based on account type:

**For Personal Accounts (개인):**
- 아이디 (User ID)
- 비밀번호 (Password)
- Checkbox: "아이디 및 비밀번호 저장"

**For Corporate Accounts (법인):**
- 📢 Info notice: "법인 인터넷뱅킹 - 공동인증서(구 공인인증서)를 사용하여 인증합니다."
- 공동인증서 비밀번호 (Certificate Password)
- Checkbox: "인증서 비밀번호 저장"

#### C. Updated Submit Button Validation
```tsx
disabled={
  isConnecting ||
  (credentials.accountType === 'corporate'
    ? !credentials.certificatePassword
    : (!credentials.userId || !credentials.password))
}
```

## User Flow

### Corporate Account Login Flow

1. **User clicks "은행 연결하기" (Connect Bank)**
2. **User selects a bank** (e.g., NH농협은행)
3. **User clicks "법인" (Corporate) button** 🏢
4. **UI updates to show:**
   - Blue info box explaining certificate authentication
   - Single password field: "공동인증서 비밀번호"
   - Updated checkbox label
5. **User enters certificate password**
6. **User clicks "은행 연결하기"**
7. **Backend receives:**
   ```javascript
   {
     certificatePassword: "user's certificate password"
   }
   ```

### Visual Changes

```
┌─────────────────────────────────────────┐
│  계정 유형                                │
│  ┌──────────┐  ┌──────────┐             │
│  │ 👤 개인  │  │ 🏢 법인  │  ← NOW ENABLED
│  └──────────┘  └──────────┘             │
└─────────────────────────────────────────┘

When 법인 is selected:
┌─────────────────────────────────────────┐
│  🏢 법인 인터넷뱅킹                       │
│  공동인증서(구 공인인증서)를 사용하여      │
│  인증합니다.                              │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│  공동인증서 비밀번호                      │
│  [••••••••••••]                          │
└─────────────────────────────────────────┘
☑ 인증서 비밀번호 저장
```

## Backend Integration

The backend should now handle both credential types:

**Personal Account:**
```javascript
{
  userId: "username",
  password: "password"
}
```

**Corporate Account:**
```javascript
{
  certificatePassword: "cert-password"
}
```

## Testing Checklist

- [ ] Switch between 개인/법인 buttons - UI updates correctly
- [ ] Personal account: userId + password fields shown
- [ ] Corporate account: certificatePassword field shown
- [ ] Validation works for both account types
- [ ] Submit button enables/disables correctly
- [ ] Checkbox label changes based on account type
- [ ] Saved credentials load correctly (including certificatePassword)
- [ ] Certificate password saves when checkbox is checked
- [ ] Connection to NH Business Bank works with certificate auth

## Next Steps

1. ✅ UI Updated - Certificate password field added
2. ⏳ Backend Integration - Ensure NH Business Bank automator receives certificate password
3. ⏳ Virtual Keyboard Implementation - Certificate password entry via virtual keyboard
4. ⏳ Certificate Selection - Allow users to select which certificate to use
5. ⏳ Testing - End-to-end testing with actual NH Business Bank account

## Related Files

- `src/renderer/components/FinanceHub/types.ts` - Type definitions
- `src/renderer/components/FinanceHub/FinanceHub.tsx` - Main component
- `src/main/financehub/banks/nh-business/` - NH Business Bank automator

## Notes

- The certificate password field uses `type="password"` for security
- The UI provides clear visual feedback about certificate authentication
- All credential fields (including certificate password) are encrypted when saved
- The corporate account flow is separate from personal account flow
