/*****************************************************************************************
* 업무명 : 공통
* 세부업무명 : 공통
* 설명 : 계좌길이, 카드길이 체크
*        날짜유효성 체크
*        주민등록번호, 사업자번호 체크
* 작성자 : 공통팀
* 작성일 : 2013.01.30 
* -----------------------------------------------------------------------------------------
*  변경이력 
* -----------------------------------------------------------------------------------------
*  No 날짜       작성자  내용
*  1  2013.01.30 공통팀  최초작성
******************************************************************************************/

/**
 * 계좌번호 검증 DIGIT
 */
var validation_DEFINE_ACCOUNT_CHECKDIGIT1 = "00175399357117C"; //3-2-6,4-2-6 (첫번째 검증시 안될경우 아래것으로)
var validation_DEFINE_ACCOUNT_CHECKDIGIT2 = "01522467896789C"; //6-2-6 (첫번째 검증)
var validation_DEFINE_ACCOUNT_CHECKDIGIT3 = "00137913791379C"; //3-2-6,4-2-6 (두번째 검증)
var validation_DEFINE_ACCOUNT_CHECKDIGIT4 = "02345678923456C"; //6-2-6 (두번째 검증)
var validation_DEFINE_ACCOUNT_CHECKDIGIT5 = "23456789234567C"; //6-3-6,4-3-6
var validation_DEFINE_ACCOUNT_CHECKDIGIT6 = "0098765434567C8"; //3-4-4-2 신계좌
var validation_DEFINE_ACCOUNT_CHECKDIGIT7 = "002345678923C00"; //3-2-5-3 구축협 
var validation_DEFINE_ACCOUNT_CHECKDIGIT8 = "09876543456789C"; // 3-10-1 가상계좌


/**
 * <pre>
 * 특수문자 체크
 * </pre>
 * @param _str : 문자 
 * @return true/false
 */
function isInputCheckSpecial(_str){
	var strobj = _str;
	var re =/^[0-9a-zA-Zㄱ-힣\s,]*$/;
	if(!re.test(strobj)){
		return false;
	}
}

/**
 * <pre>
 * 특수문자 체크
 * </pre>
 * @param _obj : selector 
 * @return true/false
 */
function checkSpecialStr(_obj){
	var msg = "";
    if( isInputCheckSpecial(_obj.val()) == false ){
       alert("특수문자를 입력할 수 없습니다.");
       return false;
   }
}

/**
 * <pre>
 * 계좌번호 자릿수 체크
 * </pre>
 * @param No : 계좌번호 TextField
 * @return true/false
 */
function validation_cfAccNoSet(No) {
	var resultVar = false;
    if (No.value.length == 11 || No.value.length == 12 || No.value.length == 13 || No.value.length == 14 || No.value.length == 16) {
        resultVar = true;
    }
    else {
    	resultVar = false;
    }
    return resultVar;
}

/**
 * <pre>
 * 계좌번호 유효성 체크
 * </pre>
 * @param sAccount : 계좌번호
 * @param sCheckDigit : validation_DEFINE_ACCOUNT_CHECKDIGIT1 ~ validation_DEFINE_ACCOUNT_CHECKDIGIT8
 * @param iDiv : 
 * @param iFlag : 
 * @return true/false
 */
function validation_cfCheckAccount(sAccount,sCheckDigit,iDiv,iFlag) {
  var   sCD         = "";
  var   sAcct       = "";
  var   iSum        = 0;
  var   iQuotient   = 0;
  var   iTempValue1 = 0;
  var   iTempValue2 = 0;
  var   resultVar = false;

  sAccount = $.trim(sAccount);
  for(var i = 0; i < 15; i++) {
    sCD   = sCheckDigit.substring(i,i+1);
    sAcct = sAccount.substring(i,i+1);

    if(sCD == "C") {
      iTempValue2 = 1*(sAcct);
      continue;
    }
    iSum = iSum + (1*(sCD)) * (1*(sAcct));
  }
  iQuotient = iSum % iDiv;
  if(iFlag !=0) {
    if(iQuotient == 0) iTempValue1 = 1;
    else if(iQuotient == 1) iTempValue1 = 0;
    else iTempValue1 = iDiv - iQuotient;
  } else {
    iTempValue1 = iDiv - iQuotient;
  }
  if(iTempValue1 != iTempValue2)resultVar = false;
  else resultVar = true;
  
  return resultVar;
}

/**
 * <pre>
 * 날짜간 크기 체크
 * date1이 date2보다 크면 false
 * </pre>
 * @param date1 : 비교날짜1
 * @param date2 : 비교날짜2
 * @return true/false
 */
function validation_cfCheckDateNo( date1,date2) {
	var   resultVar = false;	
    Int_data1=parseInt(date1,10);
    Int_data2=parseInt(date2,10);
    if(Int_data1>Int_data2) {
    	 resultVar = false;	
    } else {
    	resultVar = true;
    }
    
    return resultVar;
}

/**
 * <pre>
 * 계좌길이 체크
 * </pre>
 * @param acct : 계좌번호
 * @return true/false
 */
function validation_cfIsAccountLen(fl,acct){
	var resultVar = false;	
	var ACCMINLEN = 10 ;
	var ACCMAXLEN = 15 ;

	if(fl=='1'){
		ACCMAXLEN =  parseInt(ACCMAXLEN) - 1 ;
	}
	if(fl=='2'){
		ACCMINLEN =  parseInt(ACCMINLEN) + 1 ;
	}
	
	if( acct.length < ACCMINLEN  || acct.length > ACCMAXLEN){
		resultVar = false;	
	}else{
		resultVar = true;	
	}
	return resultVar;
}
  
/**
 * <pre>
 * 카드길이 체크
 * </pre>
 * @param acct : 카드번호
 * @return true/false
 */
function validation_cfIsCardLen(acct){
	var resultVar = false;
	var	CARDMINLEN = 16 ;
	if(acct.length != CARDMINLEN){
		resultVar = false;	
	}else{
		resultVar = true;	
	}
	return resultVar;
}

/**
 * <pre>
 * 계좌번호가 신계좌번호인지 체크한다.
 * </pre>
 * @param sAccount : 계좌번호
 * @return true/false
 */
function validation_cfIsNewAccount(sAccount) {
  var   bValid        = false;
  var   sFullAccount  = "";
  
  sAccount = $.trim(sAccount);
  if(sAccount.length == 13) {
    sFullAccount = format_cfFillZeroAccount(sAccount);
    bValid = validation_cfCheckAccount(sFullAccount,validation_DEFINE_ACCOUNT_CHECKDIGIT6,11,1);
  }
  return bValid;
}

/**
 * <pre>
 * 주민등록번호/사업자번호 유효성체크 
 * </pre>
 * @param field : 주민등록번호/사업자번호 Field
 * @return true/false
 */
function validation_cfCheckRegNo( field ) {
    var Data;
    var Length;
    var Digit=0;
    var Sum = 0;
    var resultVar = false;
    var Resident = new util_cfMakeArray('2','3','4','5','6','7','8','9','2','3','4','5');
    Data = field.value;
    Length = Data.length;
    if(Length == 10) {
        if(validation_cfCheckDigit(Data,Length) == false) {
        	return false;
        } else {
        	return true;
        }    
    }
    else if(Length == 13) {
        if(validation_cfCheckDigit(Data,Length) == false)
        {
            return false;
        }
        for(var i = 0 ; i < 12 ; i++)
        {
            Sum += Data.charAt(i) * Resident[i];
        }
        Digit = 11 - (Sum % 11) % 10;
        if((Sum % 11) % 10 == 0)
            Digit = 1;
        if((Sum % 11) % 10 == 1)
            Digit = 0;
        if(Data.charAt(12) != Digit) {
            return false;
        }
        else {
            return true;
        }    
    }
    else {
        return false;
    }
    return true;
}

/**
 * <pre>
 * 가상계좌번호여부 체크
 * - 14자리 계좌중 새로 생긴 가상계좌번호는 790,791,792
 * </pre>
 * @param sAccount : 계좌번호
 * @return true/false
 */
function validation_cfIsVirtualAccount(sAccount) {
  var   bValid      = false;
  var   sNewGwamok  = "";

  sAccount = $.trim(sAccount);
  if(sAccount.length == 14) {
      sNewGwamok = sAccount.substring(0,3);
      if(sNewGwamok == "790" || sNewGwamok == "791" || sNewGwamok == "792") bValid = true;
      else bValid = false;
  }
  return bValid;
}

/**
 * <pre>
 * 해당달의 마지막일을 초과하였는지 체크하는 함수
 * </pre>
 * @param sYear : 년필드값
 * @param sMonth : 달필드값
 * @param sDay : 날필드값
 * @param bCheckOk : 체크구분값
 * @return true/false
 */
function validation_cfCheckLastDay(sYear, sMonth, sDay, bCheckOk)
{
    var res = true;
    var LastDay = date_cfGetMaxDay(sYear, sMonth);
    if (sDay > LastDay)
    {
        if (!bCheckOk) {
            res = bCheckOk;
        }
    }
    return res;
}

/**
 * 맞춤번호 여부 판단
 * - 10자리 13자리 계좌중 새로 생긴 맞춤계좌번호는 끝자리 중조Bit 8 9 일 경우
 * @param sAccount : 계좌번호
 * @return true/false
 */
function validation_cfIsMyAccount(sAccount) {
  var   bValid      = false;
  var   sJoongJoBit = "";
  sAccount = $.trim(sAccount);
  if(sAccount.length == 10) {
      sJoongJoBit = sAccount.substring(9);
  } else if(sAccount.length == 13) {
      sJoongJoBit = sAccount.substring(12);
  }
  if( sJoongJoBit == "8" || sJoongJoBit == "9" ) bValid = true;
  else                                           bValid = false;

  return bValid;
}

/**
 * 숫자여부 확인
 * @param str : 입력문자
 * @param len : 체크길이
 * @return true/false
 */
function validation_cfCheckDigit(str, length) {
	for (var i = 0; i < str.length; i++) {
	   if (!util_reDigit.test(str.charAt(i))) {
		   return false;
	   }
	}
	return true;
}

/**
 * 특수문자 있는지 확인(괄호 제외)
 * @param str : 입력문자
 * @param len : 체크길이
 * @return true/false
 */
function validation_cfCheckSpecialChar(ch) {
    if( ( ch == "~" ) || ( ch == "`" ) || ( ch == "!" ) || ( ch == "@" ) ||
        ( ch == "#" ) || ( ch == "$" ) || ( ch == "%" ) || ( ch == "^" ) ||
        ( ch == "&" ) || ( ch == "*" ) || ( ch == "-" ) || ( ch == "_" ) ||
        ( ch == "+" ) || ( ch == "=" ) || ( ch == "|" ) || ( ch == "\\" ) ||
        ( ch == "{" ) || ( ch == "}" ) || ( ch == "[" ) || ( ch == "]" ) ||
        ( ch == ";" ) || ( ch == ":" ) || ( ch == "\"" ) || ( ch == "'" ) ||
        ( ch == "<" ) || ( ch == ">" ) || ( ch == "," ) || ( ch == "." ) ||
        ( ch == "?" ) || ( ch == "/" ) )
        return true;
    else
        return false;
}

/**
 * <pre>
 * 입력문자에 영문과 숫자가 포함되는지 체크
 * @param str : 입력문자
 * @return 0/1/2
 *         0 : Include alphabet and digits
 *         1 : Not include alphabet
 *         2 : Not include digits
 * </pre>
 */
function validation_cfCheckAlphabetAndDigits(str) {

	var alphabetValid = false;
	var digitsValid = false;
	
	for (var i = 0; i < str.length; i++) {
		if (!util_reDigit.test(str.charAt(i))) {
			alphabetValid = true;
		}
		if (!util_reAlphabetic.test(str.charAt(i))) {
			digitsValid = true;
		}
	}
	
	if (!alphabetValid) {
		return 1;
	} else if (!digitsValid) {
		return 2;
	} else {
		return 0;
	}
}

/**
 * 특수문자 입력 체크
 */
function validation_cfOnlyNumCharCheck(obj) {
	if (obj.value == "") {
		return true;
	}

	var re = /[~!@\#$%^&*\()\-=+_\\|']/gi;
	if (re.test(obj.value)) {
		alert("특수문자는 입력하실 수 없습니다.");
		obj.value = obj.value.replace(re, "");
	}
	return true;
}

/**
 * <pre>
 * 입력필드 숫자 입력
 * 
 * (사용예)
 * &lt;input type=&quot;text&quot; name=&quot;IchAmt&quot; value=&quot;&quot; title=&quot;이체금액 입력&quot; onkeydown=&quot;return validation_cfOnlyNumber(event);&quot; /&gt;
 * </pre>
 * 
 * @author FA 정영탁
 */
function validation_cfOnlyNumber(ev) {

	ev = ev || window.event;
	var keyVal = ev.keyCode ? ev.keyCode : ev.which ? ev.which : ev.charCode;
	if ( !( (keyVal >= 112 && keyVal <= 123) // F1~F12
			|| keyVal == 8 // backspace
			|| keyVal == 9 // tab
			|| keyVal == 46 // delete
			|| (keyVal >= 35 && keyVal <= 40) // home,end
			|| (!ev.shiftKey && keyVal >= 48 && keyVal <= 57) // number on keyboard
			|| (!ev.shiftKey && keyVal >= 96 && keyVal <= 105)) ) { // number on keypad
		ev.cancelBubble = true;
		ev.returnValue = false;
		return false;
	}
	return true;
}

/**
 * <pre>
 * 입력필드 영문자 입력
 * </pre>
 * @author FA 정영탁
 */
function validation_cfOnlyAlphabet(ev) {

	ev = ev || window.event;
	var keyVal = ev.keyCode ? ev.keyCode : ev.which ? ev.which : ev.charCode;
	if ( !(ev.shiftKey || ev.ctrlKey || ev.altKey
			|| (keyVal >= 112 && keyVal <= 123) // F1~F12
			|| keyVal == 8 // backspace
			|| keyVal == 9 // tab
			|| keyVal == 46 // delete
			|| (keyVal >= 35 && keyVal <= 40) // home,end
			|| (keyVal >= 65 && keyVal <= 90) // A-Z
			|| (keyVal >= 97 && keyVal <= 122)) ) { // a-z
		ev.cancelBubble = true;
		ev.returnValue = false;
		return false;
	}
	return true;
}

/**
 * <pre>
 * 입력필드 영문자,숫자 입력
 * </pre>
 * @author FA 정영탁
 */
function validation_cfOnlyAlphaNumeric(ev) {

	ev = ev || window.event;
	var keyVal = ev.keyCode ? ev.keyCode : ev.which ? ev.which : ev.charCode;
	var isAlphaNumeric = (ev.ctrlKey || ev.altKey
			|| (keyVal >= 112 && keyVal <= 123) // F1~F12
			|| keyVal == 8 // backspace
			|| keyVal == 9 // tab
			|| keyVal == 46 // delete
			|| (keyVal >= 35 && keyVal <= 40) // home,end
			|| (!ev.shiftKey && keyVal >= 48 && keyVal <= 57) // number on keyboard
			|| (!ev.shiftKey && keyVal >= 96 && keyVal <= 105) // number on keypad
			|| (keyVal >= 65 && keyVal <= 90) // A-Z
			|| (keyVal >= 97 && keyVal <= 122)); // a-z
	if (isAlphaNumeric) {
		return true;
	} else {
		ev.cancelBubble = true;
		ev.returnValue = false;
		return false;
	}
}

/**
 * (내부함수) 한글 종성체크
 * @param str 문자열
 * @return (0/1/2) : 0=unknown, 1=false, 2=true
 * @author FA 정영탁
 */
function validation_cfIsJongSung(str) {
    var INDETERMINATE = 0;
    var NOJONGSONG = 1;
    var JONGSONG = 2;

    var word = new String(str);                   /* 숫자가 들어오는 등에 대비해 무조건 문자열로 바꿈 */
    var numStr1 = "013678lmnLMN";                 /* '조' 전까지는 0이 받침이 있는걸로 나옴 --; */
    var numStr2 = "2459aefhijkoqrsuvwxyzAEFHIJKOQRSUVWXYZ";
    /* bdgpt들은 읽기에 따라 받침이 있기도 하고 없기도 한다고 판단. */
    /* 대문자는 단독으로 읽을 때를 감안하면 받침 있다고 확정되는 것이 더 적음. */

    if (word == null || word.length < 1) {
        return INDETERMINATE;
    }

    var lastChar = word.charAt(word.length - 1);
    var lastCharCode = word.charCodeAt(word.length - 1);

    if (numStr1.indexOf(lastChar) > -1) {
        return JONGSONG;
    }else if (numStr2.indexOf(lastChar) > -1) {
        return NOJONGSONG;
    }

    if (lastCharCode<0xac00 || lastCharCode>0xda0c) {
        return INDETERMINATE;
    }
    else{
        var lastjongseong = (lastCharCode - 0xAC00) % (21*28) % 28  ;

        if (lastjongseong == 0){
            return NOJONGSONG;
        }else{
            return JONGSONG;
        }
    }
}

/**
 * <pre>
 * jQuery.Validator의 설정값을 이용하여 키 입력의 onkeydown 자동 구현
 * (적용 rule : digits, alphabet, numalpha)
 * 
 * (사용예)
 *   $.alopexready(function() {
 *     validation_cfInitFormValidate($('#f'));
 *   });
 * </pre>
 * @param frm : 폼 object
 * @author FA 정영탁
 */
function validation_cfInitFormValidate(frm) {
    if (frm == null || frm == undefined || typeof(frm) != 'object') {
        return false;
    }
    $(frm).find('input,select,textarea').not('input[type="submit"]').each(function() {
        validation_cfInitFormValidateObject($(this));
    });
}

function validation_cfInitFormValidateObject(inputObj) {
    var rule = eval('(' + $(inputObj).attr('data-validate-rule') + ')');
    var inputObjId = inputObj.attr("id");
    if ( rule ) {
        inputObj.on("paste", function(){return false;});
        if (rule.numalpha) {
        	$(inputObj).on('input', function() { chkInput("numChar", this, true); } );
        } else if (rule.alphabet) {
            $(inputObj).on('input', function() { chkInput("eng", this, true); } );
        } else if (rule.digits) {
            $(inputObj).on('input', function() { chkInput("num", this, true); } );
        } else if (rule.hangul) {  // 한글만 입력
            $(inputObj).on('input', function() { chkInput("hangul", this, true); } );
        } else if (rule.name) {     // 한글 + 영문
            $(inputObj).on('input', function() { chkInput("name", this, true); } );
        } else if (rule.nameSpace) {     // 한글 + 영문 + 띄어쓰기
            $(inputObj).on('input', function() { chkInput("nameSpace", this, true); } );
        } else if (rule.cntn) {     // 한글 + 영문 + 숫자
            $(inputObj).on('input', function() { chkInput("cntn", this, true); } );
        } else if (rule.qna) {     // 한글 + 영문 + 숫자
            $(inputObj).on('input', function() { chkInput("qna", this, true); } );
        } else if (rule.compName) {     // 1:1 문의
            $(inputObj).on('input', function() { chkInput("compName", this, true); } );
        } else if (rule.cusnm) {     // 바우처 신청자등록
            $(inputObj).on('input', function() { chkInput("cusnm", this, true); } );
        } else if (rule.depart) {     // 부서정보 (기업명, 부서명)
            $(inputObj).on('input', function() { chkInput("depart", this, true); } );
        } else if (rule.compKor) {     // 한글부서정보 (기업명, 부서명) 
            $(inputObj).on('input', function() { chkInput("compKor", this, true); } );
        } else if (rule.compEnm) {     // 영문부서정보 (기업명, 부서명)
            $(inputObj).on('input', function() { chkInput("compEnm", this, true); } );
        } else if (rule.bzno) {
            $(inputObj).on('input', function(){ 
                var orgstr = $(inputObj).val().replace(/-/g, '');
                if ( orgstr.length > 10 ) {
                    orgstr = orgstr.substring(0, orgstr.length-1)
                }
                var str = orgstr;

                if(str.length > 3 && str.length <= 5){
                    str = str.replace(/-/g, '').replace(/([\d*]{3})([\d*]{1,2})/g, '$1-$2');
                } else if(str.length <= 10){
                    str = str.replace(/-/g, '').replace(/([\d*]{3})([\d*]{2})([\d*]{1,5})/g, '$1-$2-$3');
                }

                var regExp = /^[0-9]*$/; // 숫자만  입력 
                if( !regExp.test(orgstr) ) {
                	printTooltip({target:'#'+inputObjId, message: "사업자등록번호는 숫자만 입력이 가능합니다."});
                    $(inputObj).val(str.substring(0, str.length-1));
                } else {
                	if(str != ""){		// ie에서 input 이벤트가 focusin, focusout일 경우에도 동작하여 방어로직 추가
                		removeTooltip(inputObjId);
                	}
                    $(inputObj).val(str);
                }
            });
        } else if (rule.bizNumber) { //표준재무제표증명 발급번호 ####-###-####-###
            $(inputObj).on('input', function(){ 
                var orgstr = $(inputObj).val().replace(/-/g, '');
                if ( orgstr.length > 14 ) {
                    orgstr = orgstr.substring(0, orgstr.length-1)
                }
                var str = orgstr;
                if(str.length > 4 && str.length <= 7){
                    str = str.replace(/-/g, '').replace(/([\w*]{4})([\w*]{1,3})/g, '$1-$2');
                }else if(str.length > 7 && str.length <= 11){
                    str = str.replace(/-/g, '').replace(/([\w*]{4})([\w*]{3})([\w*]{1,4})/g, '$1-$2-$3');
                }else if(str.length <= 14){
                    str = str.replace(/-/g, '').replace(/([\w*]{4})([\w*]{3})([\w*]{4})([\w*]{1,3})/g, '$1-$2-$3-$4');
                }

                var regExp = /^[a-zA-Z0-9]*$/; // 숫자, 영문만  입력 
                if( !regExp.test(orgstr) ) {
                	printTooltip({target:'#'+inputObjId, message: "표준재무제표증명 발급번호는 영문과 숫자만 입력이 가능합니다."});
                	$(inputObj).val(str.substring(0, str.length-1));
                } else {
                	removeTooltip(inputObjId);
                    $(inputObj).val(str); 
                }
            });
        } else if (rule.money) {
            $(inputObj).on('input', function(){ 
                var orgstr = $(inputObj).val().replace(/,/g, '');
                if ( orgstr.startsWith("0") ) {
                    orgstr = orgstr.substring(1, orgstr.length);
                }
                var str = orgstr;
                str = str.replace(/(\d)(?=(?:\d{3})+(?!\d))/g, '$1,');
                var regExp = /^[0-9]*$/; // 숫자만  입력 
                if( !regExp.test(orgstr) ) {
                	printTooltip({target:'#'+inputObjId, message: "금액은 숫자만 입력이 가능합니다."});
                    $(inputObj).val(str.substring(0, str.length-1));
                } else {
                	if(str != ""){		// ie에서 input 이벤트가 focusin, focusout일 경우에도 동작하여 방어로직 추가
                		removeTooltip(inputObjId);
                	}
                    $(inputObj).val(str); 
                }
            });
        } else if (rule.email) {
            $(inputObj).on('input', function() { chkInput("email", this, true); } );
        }
        if(rule.isEmpty){
        	$(inputObj).on('change', function(){
                var inputObjId = inputObj.attr("id");
                if($("#"+inputObjId).val().trim() == ""){
                    printTooltip({target:'#'+inputObjId, message: rule.isEmpty});
                }else{
                    removeTooltip(inputObjId);
                }
            });
        }else if (rule.bzno_len) {
        	$(inputObj).on('change', function(){
        		validation_eqFOut_ErrMsg(inputObjId, "12","사업자번호 10자리를 입력해 주세요.");
        	});
        }else if (rule.pw4_len) {
        	$(inputObj).on('change', function(){
        		validation_eqFOut_ErrMsg(inputObjId, "4","카드비밀번호 4자리를 입력해 주세요.");
        	});
        }else if (rule.tmon_len) {
        	$(inputObj).on('change', function(){
        		validation_eqFOut_ErrMsg(inputObjId, "2","유효기간 월 2자리를 입력해 주세요.");
        	});
        }else if (rule.tyear_len) {
        	$(inputObj).on('change', function(){
        		validation_eqFOut_ErrMsg(inputObjId, "2","유효기간 연도 2자리를 입력해 주세요.");
        	});
        }else if (rule.cvc_len) {
        	$(inputObj).on('change', function(){
        		validation_eqFOut_ErrMsg(inputObjId, "3","CVC 3자리를 입력해 주세요.");
        	});
        }else if (rule.card_len) {
    		$(inputObj).on('change', function(){
    			if($("#"+inputObjId).next().hasClass("on")){		// 가상키패드 일 경우
    				validation_eqFOut_ErrMsg(inputObjId, "16","카드번호 16자리를 입력해 주세요.");
    			}else{																// 물리키패드 일 경우
    				validation_eqFOut_ErrMsg(inputObjId, "25","카드번호 16자리를 입력해 주세요.");
    			}
        	});
        }else if (rule.phone_len) {
        	$(inputObj).on('change', function(){
        		validation_btFOut_ErrMsg(inputObjId, "10", "11", "휴대폰번호 10~11자리를 입력해 주세요.");
        	});
        }else if (rule.rlno_7) {
        	$(inputObj).on('change', function(){
        		if($("#"+inputObjId).next().hasClass("on")){		// 가상키패드 일 경우
        			validation_eqFOut_ErrMsg(inputObjId, "7", "주민등록번호 7자리를 입력해 주세요.");
        		}else{																// 물리키패드 일 경우
        			validation_eqFOut_ErrMsg(inputObjId, "10", "주민등록번호 7자리를 입력해 주세요.");
        		}
        	});
        }else if (rule.rlno_13) {
        	$(inputObj).on('change', function(){
        		if($("#"+inputObjId).next().hasClass("on")){		// 가상키패드 일 경우
        			validation_eqFOut_ErrMsg(inputObjId, "13", "주민등록번호 13자리를 입력해 주세요.");
        		}else{																// 물리키패드 일 경우
        			validation_eqFOut_ErrMsg(inputObjId, "16", "주민등록번호 13자리를 입력해 주세요.");
        		}
        	});
        }
    }
}

function chkInput(type, id, isView) {
    
    var regExp = "";
    var regMessage = "";
    var isMessageView = "";
    
    if(isView == null || isView == ""){
        isMessageView = false;
    }else{
        isMessageView = isView;
    }

    if(type == "numChar") {
        regExp = /[^a-zA-Z0-9]/gi; // 영문, 숫자만  입력 
        regMessage = "영문과 숫자만 입력 가능합니다.";
    } else if(type == "num") {
        regExp = /[^0-9]/gi; // 숫자만  입력 
        regMessage = "숫자만 입력 가능합니다.";
    } else if(type == "name") {
        regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z]/gi; // 한글, 영문만 입력 
        regMessage = "한글과 영문만 입력 가능합니다.";
    } else if(type == "nameSpace") {
        regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z ]/gi; // 한글, 영문만(띄어쓰기 추가) 입력 
        regMessage = "한글과 영문만 입력 가능합니다.";
    } else if(type == "eng") {
        regExp = /[^a-zA-Z]/gi; // 영문만 입력
        regMessage = "영문만 입력 가능합니다.";
    } else if(type == "hangul") {
        regExp = /[^ㄱ-힣ㄱ-ㅎㅏ]/gi; // 한글만 입력
        regMessage = "한글만 입력 가능합니다.";
    } else if(type == "hangulSpace") {
        regExp = /[^가-힣ㄱ-ㅎㅏ ]/gi; // 한글만(띄어쓰기 추가) 입력
        regMessage = "한글,띄어쓰기만 입력 가능합니다.";
    } else if(type == "engSpace") {
        regExp = /[^a-zA-Z ]/gi; // 영문만(띄어쓰기 추가) 입력
        regMessage = "영문,띄어쓰기만 입력 가능합니다.";
    } else if(type == "email") {
        regExp = /([^a-zA-Z0-9_\.\-\@])/gi; // 숫자,영문,-,_,@,.
        regMessage = "영문,숫자, 일부 특수문자만 입력 가능합니다.";
    } else if(type == "cntn") {
        regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\.\-\@\_\(\r\n|\n|\r)\ ]/gi; // 한글, 영문, 숫자, 특수문자, 엔터 띄어쓰기 입력
        regMessage = "한글,영문,숫자,일부 특수문자만 입력 가능합니다.";
    } else if(type == "qna") {
        regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\.\,\?\!\-\@\_\(\r\n|\n|\r)\ ]/gi; // 한글, 영문, 숫자, 특수문자, 엔터 띄어쓰기 입력
        regMessage = "한글,영문,숫자,일부 특수문자만 입력 가능합니다.";
    } else if(type == "compName") {
        regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\!\@\#\$\%\^\&\*\(\)\[\]\-\_\+\=\,\.\ ]/gi; // 한글, 영문, 숫자  띄어쓰기 !@#$%^&*()입력
        regMessage = "한글,영문,숫자,일부 특수문자만 입력 가능합니다.";
    } else if(type == "cusnm") {
        regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9]/gi; // 한글, 영문, 숫자입력(바우처)
        regMessage = "한글,영문,숫자만 입력 가능합니다.";
    } else if(type == "depart") {
	    regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\@\(\)\ ]/gi; // 한글, 영문, 숫자  띄어쓰기 @()입력 (부서정보 기업명,부서명) 2022-09-29 변경
	    regMessage = "한글,영문,숫자,일부 특수문자( @ ( ) )만 입력 가능합니다.";
	} else if(type == "compEnm") {
	    regExp = /[^a-zA-Z0-9\@\(\)\ ]/gi; // 영문, 숫자, 띄어쓰기 @()입력 (카드추가발급-영문이름, 법인영문명)
	    regMessage = "영문,숫자,일부 특수문자( @ ( ) )만 입력 가능합니다.";
	} else if(type == "compKor") {
	    regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣ0-9\@\(\)\ ]/gi; // 한글, 숫자  띄어쓰기 @()입력 (부서정보 기업명,부서명) 2022-09-29 변경
	    regMessage = "한글,숫자,일부 특수문자( @ ( ) )만 입력 가능합니다.";
	} else if(type == "depart") {
	    regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\@\(\)\ ]/gi; // 한글, 영문, 숫자  띄어쓰기 @()입력 (부서정보 기업명,부서명) 2022-09-29 변경
	    regMessage = "한글,영문,숫자,일부 특수문자( @ ( ) )만 입력 가능합니다.";
	} else if(type == "address") {
		regExp = /[^가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9\-\.\(\)\ ]/gi; // 한글, 영문, 숫자  띄어쓰기 - . () 입력
	    regMessage = "한글,영문,숫자,일부 특수문자( - . ( ) )만 입력 가능합니다.";
	}
    
    var textCut = "";
    var inputObjId = $(id).attr("id");
    if(regExp.test($(id).val()) && regExp != '') {
    	if(isMessageView){
			printTooltip({target:'#'+inputObjId, message: regMessage});
    	}
        textCut = $(id).val().replace(regExp,'');
        $(id).val(textCut).focus();
    }else{
    	if(isMessageView){
    		if($(id).val() != ""){		// ie에서 input 이벤트가 focusin, focusout일 경우에도 동작하여 방어로직 추가
    			removeTooltip(inputObjId);
    		}
    	}
    }
}

/**
 * <pre>
 * jQuery.Validator를 이용한 FORM 체크
 * </pre>
 * @param frm : 폼 object
 * @return true/false
 * @author FA 정영탁
 */
function validation_cfCheckFormValidate(frm) {
	if (frm == null || frm == undefined || typeof(frm) != 'object') {
		return false;
	}
	if (!$(frm).validate()) {
		var emsg = $(frm).validator().getErrorMessage();
		for (var prop in emsg) {
			var elem = $(frm).find('[name="'+prop+'"]');
			var alias = elem.attr('data-alias');
			if (alias != null && alias != undefined && alias != '') {
				var un0 = new Array("(은)는", "는", "은");
				alert(alias + un0[validation_cfIsJongSung(alias)] + ' ' + emsg[prop][0]);
			} else {
				alert(emsg[prop][0]);
			}
			if (elem.attr('type') != 'hidden') {
				elem.focus();
			}
			break;
		}
		return false;
	}
	return true;
}

/** 
 * validation_cfCheckFormValidate_LargeForm(elems)
 * - IE7에서 대용량 Form validate를 위한 대체 메소드.
 * 
 * @param elems : form 내의 data-validate-rule attribute가 있는 elements를 담은 array
 * @returns {Boolean}
 */
function validation_cfCheckFormValidate_LargeForm(elems) {
	if (elems == null || elems == undefined || typeof(elems) != 'object') {
		return false;
	}
	var result = true;
	
	$.each(elems, function (idx, value){
		if (!$(value).validate()) {
			result = false;
			var emsg = $(value).validator().getErrorMessage();
			for (var prop in emsg) {
				var elem = $(value);
				var alias = elem.attr('data-alias');
				if (alias != null && alias != undefined && alias != '') {
					var un0 = new Array("(은)는", "는", "은");
					alert(alias + un0[validation_cfIsJongSung(alias)] + ' ' + emsg[prop]);
				} else {
					alert(emsg[prop]);
				}
				if (elem.attr('type') != 'hidden') {
					elem.focus();
				}
				break;
			}
			return false;
		}
	});
	
	if(result){
		return true;
	}else{
		return false;
	}
}

/**
 * <pre>
 * jQuery.Validator를 이용한 필드 체크
 * </pre>
 * @param field : 필드 ID 또는 Object
 * @return true/false
 * @author FA 정영탁
 */
function validation_cfCheckFieldValidate(field) {
	if (typeof(field) == 'object') {
		field = $(field);
	} else {
		field = $('#'+field);
	}

	if (!field.validate()) {
		var emsg = field.validator().getErrorMessage();
		var alias = field.attr('data-alias');
		if (alias != null && alias != undefined && alias != '') {
			var un0 = new Array("(은)는", "는", "은");
			alert(alias + un0[validation_cfIsJongSung(alias)] + ' ' + emsg[0]);
		} else {
			alert(emsg[0]);
		}
		if (field.attr('type') != 'hidden') {
			field.focus();
		}
		return false;
	}
	return true;
}


/**
 * 회원ID자릿수가 6 - 10인지 체크
 * @param obj     - 체크 필드
 * @param msg     - false일 때 띄울 메시지
 * @param emptyOk - 공백필드 true/false
 * @param iMin    - 입력 최소값
 * @param iMax    - 입력 최대값
 * @return true/false
 */
function validation_cfCheckID(obj, msg, emptyOk, iMin, iMax) {
	obj.value = $.trim(obj.value);
	
    for(var i=0; i<obj.value.length; i++) {
        var ch = obj.value.charCodeAt(i);
        if(ch > 128){ alert(msg); obj.focus(); return false; }
    }    
    
    if(iMin == null){ iMin = 5;  }
    if(iMax == null){ iMax = 10; }
    
    var result = true;
    
    if(obj.value.length>=iMin && obj.value.length<=iMax) {
    	if(/^[a-zA-Z0-9]+$/g.test(obj.value) == false){ result = false; }
    	else{ result = true;  }
    	
    } else {
    	if(!emptyOk){ alert(msg); obj.focus(); }
    	result = emptyOk;
    }
    return result;
}

/**
 * <pre>
 * object 공백체크
 * </pre>
 * @param Obj 	: Date객체
 * @param msg 	: alert 메세지
 * @param emptyOk 	: 
 * @reutn
 * 
 */
function nh_fCheckEmpty(obj, msg, emptyOk) {
	res = true;
	if(nh_fIsEmptyObj(obj)){
		if(!emptyOk) {
			nhAlert(msg, function() {
				obj.focus();
			});
			return false;
		}
		res = emptyOk;
	}
	return res;
}

/**
 * object 공백체크
 * </pre>
 * @param para 	: Date객체
 * 
 */
function nh_fIsEmptyObj(para) {
	  for(var i=0; i<nh_fIsEmptyObj.arguments.length; i++)
	  {
	    if( typeof(nh_fIsEmptyObj.arguments[i]) == "object" && nh_fIsEmptyObj.arguments[i].value.length > 0)
	      return false;
	  }
	  return true;
}

/**
 * <pre>
 * object의 Byte길이와  len값 을 비교하여 리턴 
 * </pre>
 * @param Obj 	: object
 * @param len 	: 체크 시작 길이
 * @param len2 	: 체크 종료 길이
 * @param Obj 	: alert msg
 */
function nh_fCheckLength(obj, len, len2, msg ){
		if( !( len <= nh_fByteLen(obj) && nh_fByteLen(obj) <= len2) ) {
			nhAlert(msg, function() {
				obj.focus();
			});
			return false;
		}
	return true;
}

 /**
  * <pre>
  * Object Value의 Byte길이 리턴
  * </pre>
  * @param Obj 	: object
  */
function nh_fByteLen(obj){
	var len	= 0;
	var fbyte = obj.value;
	if ( fbyte == null ) return 0;
	for(var i=0;i<fbyte.length;i++){
		var c = escape(fbyte.charAt(i));
		if ( c.length == 1 ) len ++;
		else if ( c.indexOf("%u") != -1 ) len += 2;
		else if ( c.indexOf("%") != -1 ) len += c.length/3;
	}
	return len;
}

 /**
  * <pre>
  * Obj1,Obj2 값비교
  * </pre>
  * @param Obj1 	: object
  * @param Obj2 	: object
  * @param Obj 	: alert msg
  */
function nh_fCompareObj (obj1, obj2, msg){
	if(obj1.value != obj2.value) { 
		nhAlert(msg, function() {
	        obj2.focus();
	    });
	    return false;
	}
	return true;
}

/**
 * e-mail 형식 확인
 */
function checkEmail( email ) {
    var regex = /^[0-9a-zA-Z\-\_\.]*@[0-9a-zA-Z]([-_\.]?[0-9a-zA-Z])*\.[a-zA-z]{2,3}$/;
    return !regex.test(email);
}

/**
 * 길이 체크 함수
 * objId : ID값, len: 최소길이, len2:최대길이, msg:알럿메세지
 * return true, false
 */
function nh_eq_lengthChkId(objId, len, msg){
	if( !nh_lengthChkId(objId, len, '', msg)) return false;
	else	return true;
}

function nh_bt_lengthChkId(objId, len, len2, msg){
	if( !nh_lengthChkId(objId, len, len2, msg)) return false;
	else	return true;
}

function nh_lengthChkId(objId, len, len2, msg){
    if(len2){   // 최대길이(len2)가 있을경우 최소길이,최대길이 사이값 일 경우 
        if( !( len <= nh_fByteLenId(objId) && nh_fByteLenId(objId) <= len2) ) {
        	if(msg){
        		nhAlert(msg, function() {
    				$("#"+objId).focus();
    			});	
        	}
			return false;
		}
    }else{  // 최대길이(len2) 없을경우 최소길이값으로 동일체크
        if( !( len == nh_fByteLenId(objId))) {
        	if(msg){
        		nhAlert(msg, function() {
        			$("#"+objId).focus();
    			});	
        	}
			return false;
		}
    }
    return true;
}

/**
 * objId length 리턴 함수
 */
function nh_fByteLenId(objId){
    var len	= 0;
	var fbyte = $("#"+objId).val();
	if ( fbyte == null ) return 0;
	len = fbyte.length;
	return len;
}

/**
 * focusOut 일 경우 길이체크 후 에러 메세지 노출 및 삭제 함수
 * inputObjId : ID값, len:비교길이(최소), len2:비교길이(최대), msg: 노출할 에러메세지 
 */
function validation_eqFOut_ErrMsg(inputObjId, len, msg){
	if( !(nh_eq_lengthChkId(inputObjId, len)) ){
		printTooltip({target:'#'+inputObjId, message: msg});
		return false;
	}else{
		removeTooltip(inputObjId);
		return true;
	}
}

function validation_btFOut_ErrMsg(inputObjId, len, len2, msg){
	if( !(nh_bt_lengthChkId(inputObjId, len, len2)) ){
		printTooltip({target:'#'+inputObjId, message: msg});
		return false;
	}else{
		removeTooltip(inputObjId);
		return true;
	}
}

/**
 * 주민등록번호 유효성체크및 패턴(바우처)
 * @param obj
 */
function validation_cfCheckRlno(obj){
	var str    = format_cfOnlyNumFormat($(obj).val());
	var strLen = str.length;
	if(str != '' && strLen == 13){
		$(obj).val(str.replace(/-/g, '').replace(/([\d*]{6})([\d*]{7})/g, '$1-$2'));
	}
}

/**
 * 전화번호 유효성체크및 패턴(바우처)
 * @param obj
 */
function validation_cfCheckTel(obj){
	var str = format_cfOnlyNumFormat($(obj).val());
	if(str != ''){
		if(str.length==9){
			$(obj).val(str.replace(/-/g, '').replace(/([\d*]{2})([\d*]{3})([\d*]{4})/g, '$1-$2-$3'));
		} else if(str.length==10){
			$(obj).val(str.replace(/-/g, '').replace(/([\d*]{3})([\d*]{3})([\d*]{4})/g, '$1-$2-$3'));
		} else if(str.length==11){
			$(obj).val(str.replace(/-/g, '').replace(/([\d*]{3})([\d*]{4})([\d*]{4})/g, '$1-$2-$3'));
		}
	}
}

/**
 * 날짜 유효성체크및 패턴(바우처)
 * @param obj
 */
function validation_cfCheckDate(obj){
	var str    = format_cfOnlyNumFormat($(obj).val());
	var strLen = str.length;
    if(str != '' && strLen == 8) {
	    $(obj).val(str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{2})([\d*]{2})/g, '$1-$2-$3'));
    }
}

function validation_cfCheckPay(obj){
	var str    = format_cfOnlyNumFormat($(obj).val());
	$(obj).val(format_cfFormatNumber(str));
}

/**
 * 입력포커스-focusin 패턴 유효성체크(바우처)
 * 날짜(date),실명번호(rlno),휴대폰(tel),금액(pay)
 * @param obj
 */
function inPatternValidation(obj){
	var rule = eval('(' + $(obj).attr('data-validate-rule') + ')');
	if(rule){
		if(rule.date || rule.rlno || rule.tel || rule.pay){ //날짜,실명번호,전화번호,금액패턴 제거
			obj.val(format_cfOnlyNumFormat(obj.val()));
		}
	}
}

/**
* 출력포커스-focusout 패턴 유효성체크(바우처)
* 날짜(date),실명번호(rlno),휴대폰(tel),금액(pay)
* @param obj
*/
function outPatternValidation(obj){
     var rule = eval('(' + $(obj).attr('data-validate-rule') + ')');
     if(rule){
         if(rule.date){           //날짜패턴
             validation_cfCheckDate(obj);
         } else if(rule.rlno){    //실명번호패턴
             validation_cfCheckRlno(obj);
         } else if(rule.tel){     //휴대폰패턴
             validation_cfCheckTel(obj);
         } else if(rule.pay){     //금액패턴
        	 validation_cfCheckPay(obj);
         }
     }
}

/**
* 주민등록번호 유효성체크(바우처)
* @param obj
* @return true/false
*/
function nh_cfCheckRlno(obj){
	var rule = /^(?:[0-9]{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[1,2][0-9]|3[0,1]))[-]*[1-4][0-9]{6}$/;
	if(!rule.test(obj)){
        return false;
    } else {
    	return true;
    }
}

/**
* 휴대폰번호 유효성체크(바우처)
* @param obj
* @return true/false
*/
function nh_cfCheckHpNo(obj){
	var rule = /^01([0:1:6:7:8:9])[-]*([0-9]{3,4})[-]*([0-9]{4})$/;
	if(!rule.test(obj)){
        return false;
    } else {
    	return true;
    }
}

/**
* 주민등록번호 유효성체크(바우처)
* @param obj
* @return true/false
*/
function nh_cfCheckJuminNo(obj){
	var objNo = obj.split('');//주민등록번호 한자리씩 배열담기
	var ckarr = [2,3,4,5,6,7,8,9,2,3,4,5];//곱해줄숫자배열
	
	//1.각자리에 2,3,4,5,6,7,8,9,2,3,4,5 를 곱해줌, 단 마지막자리는 빼놓음
	for(var i=0; i<objNo.length-1;i++){
		objNo[i]=objNo[i]*ckarr[i];
	}
	
	var objNolast = objNo[objNo.length-1];//주민등록번호 마지막자리 따로 빼두기
	
	//2.각자리의 숫자를 모두더함
	var sum = 0;
	for(var i=0;i<objNo.length-1;i++){
		sum+=objNo[i];
	}
	
	//3. 11로 나눈 나머지값 구함
	sum=sum%11;
	
	//4.11에서 결과값을 뺌(단,마지막결과가 두자리인 경우 다시 10으로 나는 나머지값을 구함)
	sum = 11-sum;
	if(sum > 9){
		sum = sum%10;
	}
	
	//5.결과가 주민등록번호 마지막자리와 일치하면 유효한 주민번호임.
	if(sum==objNolast){
		nhAlert('['+obj+']은 유효한 주민등록번호 입니다.');
		return false;
	}
	
	//5.결과가 주민등록번호 마지막자리와 일치하지않으면 유효하지않은 주민번호
	if(sum!=objNolast && objNolast != undefined){
		nhAlert('['+obj+']은 유효하지않은 주민등록번호 입니다.');
		return false;
	}
}