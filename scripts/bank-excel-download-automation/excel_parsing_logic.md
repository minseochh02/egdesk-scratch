for each excel download, here is what must happen
"1) get the currently selected bank and parse it into 은행	계좌번호	계좌별칭"
shinhan format acount-no-format(accountname)
hana format acount-no-format | accountname [optional거래중지]
nh format account-no-format-no
kb format account-no-format:accounttype-accountname
ibk format account-no-format-no:accountname(optionalaccounttype)
woori format accpimt-no-format | accountname

"2) map out each excel  {source header : target header}, ""적요2"" Meta-Object
For every bank, any source column not mapped to a primary target (A-K) should be bundled into the 적요2 object.

Example for IBK:
적요2: { ""거래구분"": ""이자"", ""CMS코드"": ""000"", ""상대은행"": ""신한"" }"
"shinhan: {
  ""거래일시"": [""거래일자"", ""거래시간""],
  ""적요"": ""적요1"",
  ""입금액"": ""입금"",
  ""출금액"": ""출금"",
  ""잔액"": ""잔액"",
  ""거래점명"": ""취급지점"",
  ""내용"": ""적요2""
}Split Logic: 거래일시 (YYYYMMDDHHMMSS) splits into Date and Time."
"Hana:{
  ""거래일시"": [""거래일자"", ""거래시간""],
  ""적요"": ""적요1"",
  ""입금"": ""입금"",
  ""출금"": ""출금"",
  ""거래후잔액"": ""잔액"",
  ""거래점"": ""취급지점"",
  ""의뢰인/수취인"": ""상대계좌예금주명"",
  ""거래특이사항"": ""적요2"",
  ""추가메모"": ""적요2"",
  ""구분"": ""적요2""
}Split Logic: 거래일시 (YYYY-MM-DD HH:MM) splits at the space."
"nh: {
  ""거래일자"": ""거래일자"",
  ""거래시간"": ""거래시간"",
  ""거래기록사항"": ""적요1"",
  ""입금금액(원)"": ""입금"",
  ""출금금액(원)"": ""출금"",
  ""거래 후 잔액(원)"": ""잔액"",
  ""거래점"": ""취급지점"",
  ""거래내용"": ""적요2"",
  ""이체메모"": ""적요2""
}"
"kb: {
  ""거래일시"": [""거래일자"", ""거래시간""],
  ""보낸분/받는분"": ""상대계좌예금주명"",
  ""적요"": ""적요1"",
  ""입금액(원)"": ""입금"",
  ""출금액(원)"": ""출금"",
  ""잔액(원)"": ""잔액"",
  ""처리점"": ""취급지점"",
  ""내 통장 표시"": ""적요2"",
  ""구분"": ""적요2""
}Split Logic: 거래일시 (YYYY.MM.DD HH:MM) splits at the space."
"ibk:{
  ""거래일시"": ""거래일자"",
  ""거래시간"": ""거래시간"",
  ""거래내용"": ""적요1"",
  ""입금"": ""입금"",
  ""출금"": ""출금"",
  ""거래후 잔액"": ""잔액"",
  ""상대계좌번호"": ""상대계좌"",
  ""상대계좌예금주명"": ""상대계좌예금주명"",
  ""거래구분"": ""적요2"",
  ""수표어음금액"": ""적요2"",
  ""CMS코드"": ""적요2"",
  ""상대은행"": ""적요2""
}"
"woori:{
  ""거래일시"": [""거래일자"", ""거래시간""],
  ""적요"": ""적요1"",
  ""입금(원)"": ""입금"",
  ""지급(원)"": ""출금"",
  ""거래후 잔액(원)"": ""잔액"",
  ""취급점"": ""취급지점"",
  ""기재내용"": ""적요2"",
  ""표·어음·증권금액(원)"": ""적요2""
}, Split Logic: 거래일시 (YYYY.MM.DD HH:MM:SS) splits at the space."