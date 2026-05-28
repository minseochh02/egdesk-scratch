# Bank Session Management

Documents the session timer and extension button details for each bank's automation script.
Used to build keepalive logic that clicks the extend button before the session expires.

---

## NH Bank (ibz.nonghyup.com)

- **Session duration**: 10 minutes (`sessionTime = 10 * 60`)
- **Timer element**: `<span class="session" id="left_time">09:59</span>`
- **Extend button**: `<a href="javascript:continueLoginLeft();" id="headerContinued" class="timeadd" title="로그인 시간 연장">`
- **Selector (timer)**: `#left_time`
- **Selector (button)**: `#headerContinued`
- **JS function called**: `continueLoginLeft()`
- **Location**: Top header (`#session_info_new` inside `#header_2023`)
- **Notes**: Timer counts down MM:SS. Clicking the anchor resets it via `continueLoginLeft()` which calls `continueLogin()` internally.

---

## Shinhan Bank

- **Session duration**: TBD
- **Timer element**: TBD
- **Extend button**: TBD
- **Selector (timer)**: TBD
- **Selector (button)**: TBD
- **JS function called**: TBD
- **Location**: TBD
- **Notes**: TBD

---

## Woori Bank

- **Session duration**: TBD
- **Timer element**: TBD
- **Extend button**: TBD
- **Selector (timer)**: TBD
- **Selector (button)**: TBD
- **JS function called**: TBD
- **Location**: TBD
- **Notes**: TBD

---

## Hana Bank

- **Session duration**: TBD
- **Timer element**: TBD
- **Extend button**: TBD
- **Selector (timer)**: TBD
- **Selector (button)**: TBD
- **JS function called**: TBD
- **Location**: TBD
- **Notes**: TBD

---

## KB Bank (obiz.kbstar.com)

- **Session duration**: TBD
- **Timer element**: None visible in header (no countdown shown)
- **Extend button**: `<li class="h_btn h_extend"><a href="javascript:void(0);" onclick="session.extend()">연장</a></li>`
- **Selector (timer)**: N/A
- **Selector (button)**: `li.h_extend a`
- **JS function called**: `session.extend()`
- **Location**: Top header alongside 로그아웃 button
- **Notes**: No visible countdown timer. Just a plain 연장 link. Click interval should be set conservatively (e.g. every 5 minutes).

---

## IBK Bank

- **Session duration**: TBD
- **Timer element**: TBD
- **Extend button**: TBD
- **Selector (timer)**: TBD
- **Selector (button)**: TBD
- **JS function called**: TBD
- **Location**: TBD
- **Notes**: TBD
