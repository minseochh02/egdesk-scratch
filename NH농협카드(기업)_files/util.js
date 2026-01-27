/*****************************************************************************************
* 업무명 : 공통
* 세부업무명 : 공통
* 설명 : 문자열처리
*        쿠키처리
* 작성자 : 공통팀
* 작성일 : 2013.01.30 
* -----------------------------------------------------------------------------------------
*  변경이력 
* -----------------------------------------------------------------------------------------
*  No 날짜       작성자  내용
*  1  2013.01.30 공통팀  최초작성
******************************************************************************************/

/**
 * 정규식 상수
 */
var util_reDigit = /^\d+$/;
var util_reBnji = /^\d+(\-\d+)?$/;
var util_reEngName = /^[a-zA-Z. ]+$/;
var util_reSignedInteger = /^[+|-]?\d+$/;
var util_reInteger = /^\d+$/;
var util_reAlphabetic = /^[a-zA-Z]+$/;
var util_reAlphanumeric = /^[a-zA-Z0-9]+$/;
var util_reEmail = /^.+\@.+\..+$/;
var util_reUpperAlphanumeric = /^[A-Z0-9]+$/;
var util_reLowerAlphanumeric = /^[a-z0-9]+$/;
var util_reNumeric = /^[0-9]+$/;
var util_reSignedDigit = /^[+|-]?[\d.|\d]+$/;

/**
 * <pre>
 * Field 배열에 있는 값을 콤마로 구분하여 문자열로 리턴
 * </pre>
 * @param obj : Field 배열
 * @return 콤마로 구분된 문자열
 */

function util_cfArrValuesToString(obj){
	var retStr = "";
	if(obj.length){
		for(var i =0; i < obj.length;i++){
			retStr += obj[i].value + "," ;
		}
	}else{
		retStr = obj.value ;
	}
	return retStr;
}

/**
 * <pre>
 * 배열에 있는 값을 문자열로 리턴
 * </pre>
 * @param args : 배열
 * @return 문자열
 */
function util_cfGetArrToStr(args){
	var stype = "";
	var stypelist = "";
	if(args.length == 0){ return stypelist; }
	for(var j = 0 ; j < args.length ; j++ ) {
		stype =	stype +  args[j];
	}
	stypelist = stype ; //stype.substring(1);
	return stypelist;
}

/**
 * <pre>
 * 특정길이만큼 문자열을 잘라서 리턴
 * </pre>
 * @param message : 문자열
 * @param maximum : 길이
 * @return 
 */
function util_cfAssertMsglen(message, maximum){
  var inc     = 0;
  var nbytes  = 0;
  var msg     = "";
  var msglen  = message.length;

  for (var i=0; i<msglen; i++) {
    var ch = message.charAt(i);
    if (escape(ch).length > 4) {
      inc = 2;
    } else if (ch == '\n') {
      if (message.charAt(i-1) != '\r') {
        inc = 1;
      }
    } else if (ch == '<' || ch == '>') {
      inc = 4;
    } else {
      inc = 1;
    }
    if ((nbytes + inc) > maximum) {
      break;
    }
    nbytes += inc;
    msg += ch;
  }
  return msg;
}

/**
 * <pre>
 * TextField Value의 Byte길이 리턴
 * </pre>
 * @param obj : TextField
 * @return 
 */
function util_cfByteLen(obj) {
    var len = 0;
	var fbyte = null;
	if(typeof(obj) == "string"){
		 fbyte = obj;
	}else{
		 fbyte = obj.value;
	}

    if (fbyte == null) return 0;
    for (var i = 0; i < fbyte.length; i++) {
        var c = escape(fbyte.charAt(i));
        if (c.length == 1) len ++;
        else if (c.indexOf("%u") != -1) len += 2;
        else if (c.indexOf("%") != -1) len += c.length / 3;
    }
    return len;
}

/**
 * <pre>
 * Form에서 Text, Password 필드값 제거
 * </pre>
 * @param form : 폼
 * @return 
 */
function util_cfClearVal(form) {
    var count = form.elements.length;
    for (var i = 0; i < count; i++) {
        if (form.elements[i].type == "text" || form.elements[i].type == "password") {
            form.elements[i].value = "";
        }
    }
    return;
}

/**
 * <pre>
 * 쿠키제거
 * </pre>
 * @param name : 쿠키이름
 * @return 
 */
function util_cfDelCookie(name)
{
    var today = new Date();
    today.setTime(today.getTime() - 1);

    var value = util_cfGetCookie(name);
    if( value != "")
        document.cookie = name + "=" + value + "; expires=" + today.toGMTString();
}

/**
 * <pre>
 * 쿠키값 Return
 * </pre>
 * @param name : 쿠키이름
 * @return 
 */
function util_cfGetCookie(name) {
    var Found     = false;
    var start, end;
    var i         = 0;


    while(i <= document.cookie.length )    {
        start     = i;
        end     = start + name.length;

        if( document.cookie.substring(start, end) == name)
        {
            Found = true;
            break;
        }
        i++;
    }

    if( Found == true)     {
        start = end + 1;
        end = document.cookie.indexOf(";", start);

        if(end < start)     end = document.cookie.length;
        return document.cookie.substring(start, end);
    }

    return "";
}

/**
 * <pre>
 * 문자열에서 특수문자 제거
 * </pre>
 * @param str : 문자열
 * @return 
 */
function util_cfDeleteSpecialChar(str) {
    var len = str.length;

    var let = "";

    for( var i=0 ; i < len ; i++ ) {
        if( !validation_cfCheckSpecialChar( str.charAt(i)) )
            let += str.charAt(i);
    }

    return let;
}

/**
 * <pre>
 * 문자열에서 오른쪽에 있는 " " 제거
 * </pre>
 * @param str : 문자열
 * @return 
 */
function util_cfEndEnc(str) {
    str = str + "";
    var len = str.length;

    for(var i = (len - 1); str.charAt(i) == ' '; i--) {
    	str = str.substring(0, i + 1);
    }

    return str;
}

/**
 * <pre>
 * 문자열에서 왼쪽에 있는 " " 제거
 * </pre>
 * @param str : 문자열
 * @return 
 */
function util_cfFirstEnc(str) {
    var len = str.length;
    var i = 0;

    for(i = 0; str.charAt(i) == ' '; i++) {
       str = str.substring(i, len);
    }
    return str;
}

/**
 * <pre>
 * 특정길이만큼 문자열 오른쪽에 " " 채우기
 * </pre>
 * @param str : 문자열
 * @param Len : 길이
 * @return 
 */
function util_cfFixlength(str, Len) {
    var tmp = str;

	var i; // 지역변수화
    for ( i = str.length ; i < Len ; i++){
        tmp+=" ";
    }
	return tmp;
}

/**
 * <pre>
 * Form안에 있는 첫번째 Display된 element에 포커스가 가도록 처리
 * </pre>
 * @param frm : Form
 * @return 
 */
function util_cfInitfocus(frm) {

    for (var i = 0; i < frm.elements.length; i ++) {
        if (frm.elements[i].type == "hidden") continue;
        else {
            self.focus();
            if (frm.elements[i].disabled) continue;
            frm.elements[i].focus();
            break;
        }
    }
}

/**
 * <pre>
 * 특정길이만큼 문자열 왼쪽에 특정문자로 채움
 * 특정문자 파라미터가 Null일 경우 빈문자로 채움
 * </pre>
 * @param aNum : 문자열
 * @param len : 길이
 * @param gn : 특정문자
 * @return 
 */
function util_cfFillLeftSpace(aNum, len, gn) {
    var str = aNum;
    var attach = "";
    var gubun;
    if (gn == null) gubun = " ";
    else      gubun = gn;

    if (aNum.length < len) {
        for (var i = len - aNum.length; i >= 1; i--) {
            attach += gubun ;
        }    
        str = attach + str;
    }
    return str;
}


/**
 * <pre>
 * 특정길이만큼 문자열 오른에 특정문자로 채움
 * 특정문자 파라미터가 Null일 경우 빈문자로 채움
 * </pre>
 * @param aNum : 문자열
 * @param len : 길이
 * @param gn : 특정문자
 * @return 
 */
function util_cfFillRightSpace(aNum, len, gn) {
    var str = aNum;
    var attach = "";
    var gubun;
    if (gn == null) gubun = " ";
    else      gubun = gn;

    if (aNum.length < len) {
        for (var i = aNum.length; i < len; i++) {
            attach += gubun ;
        }    
        str = str + attach;
    }
    return str;
}

/**
 * <pre>
 * 웹브라우저종류 리턴
 * </pre>
 * @param 
 * @return 웹브라우저종류
 */
function util_cfGetBrowserIE() {
	  var browser = navigator.userAgent.toLowerCase();  
	  var browserName = "";	

	  if(browser.indexOf('opera') > -1) { 
		browserName = 'opera';
	  }else if(browser.indexOf('firefox') > -1) { 
		browserName = 'firefox';
	  }else if(browser.indexOf('chrome') > -1) { 
		browserName = 'chrome';
	  }else if(browser.indexOf('safari') > -1) { 
		browserName = 'safari';
	  }else{ 
		browserName = 'msie';
	  }
	
		  
	return browserName;
	  
}

/**
 * <pre>
 * 특정크기 자바스크립트 배열변수 생성
 * </pre>
 * @param n : 크기
 * @return 배열변수
 */
function util_cfMakeArraySize(n) {
    this.length = n;
    for(var i = 1; i <= n; i++ ) {
        this[i] = 0;
    }
    return this;
}

/**
 * <pre>
 * 자바스크립트 배열변수 생성
 * </pre>
 * @param 
 * @return 배열변수  
 */
function util_cfMakeArray() {
    var lngth = util_cfMakeArray.arguments.length;

    for ( var i = 0 ; i < lngth ; i++ ) {
        this[i]=util_cfMakeArray.arguments[i];
    }
    return this;
}

/**
 * <pre>
 * 폼필드 오브젝트의 종류와 상관없이 주어진 이름의 객체에 특정값을 할당
 * util_cfSetObjValue 와 차이점은 Selectbox에 값을 할당할 때 현재 selected된 값을 변경함.
 * Text필드에 할당하는 것은 동일
 * </pre>
 * @param obj : 오브젝트
 * @param sValue : 할당값
 * @return 
 */
function util_cfModifyObjValue(obj, sValue) {
	
    if (obj.type == "text") {
    	obj.value = sValue;
        return;
    }
    for (var i = 0; i < obj.options.length; i++)
    {
        if (obj.options[i].selected == true)
        {
        	obj.options[i].value = sValue;

        }
    }
}

/**
 * <pre>
 * 폼필드 오브젝트의 종류와 상관없이 주어진 값을 주어진 이름의 객체에 할당
 * util_cfModifyObjValue와 차이점은 selectbox에 값을 할당할 때 해당값으로 selected되도록 함.
 * Text필드에 할당하는 것은 동일
 * </pre>
 * @param objFormField : 오브젝트
 * @param sValue : 특정값
 * @param isNonReset : 값이 없을 경우 초기화 여부
 * @return  
 */
function util_cfSetObjValue(objFormField, sValue, isNonReset) {

	if (objFormField.type == "select-one") {
		var isSelected = false;
		for ( var i = 0; i < objFormField.options.length; i++) {
			if (objFormField.options[i].value == sValue) {
				objFormField.options[i].selected = true;
				isSelected = true;
			}
		}
		if (!isSelected && isNonReset) {
			objFormField.options[0].selected = true;
		}
	} else if (objFormField.type == "text") {
		objFormField.value = sValue;
	}
}

/**
 * <pre>
 * 특정문자열에서 정규식에 해당하는 문자 제거
 * </pre>
 * 
 * @param str1 :
 *            문자열
 * @param rexp :
 *            제거해야 할 문자 정규식
 * @return
 */
function util_cfRemoveChar(str, rexp) {

    var str2 = "";
    for (var i = 0; i < str.length; i++) {
        if (!rexp.test(str.charAt(i))) {
            str2 += str.charAt(i);
        }
    }
    return str2;
}

/**
 * <pre>
 * 특정 Object Value에서 한글제거
 * </pre>
 * @param obj : 오브젝트
 * @return
 */
function util_cfRemoveKor(obj) {
    var str = String(obj.value);
    var len = str.length;
    var sit = 0;
    var tmp = "";
    var ch = '';
    i = 0;
    while (sit < len) {
        ch = str.charAt(sit);
        if ((ch == ' ') || (ch >= '0' && ch <= '9') || (ch == '-') || (ch == '@') || (ch == '.') || (ch == ',') || ((ch >= 'A') && (ch <= 'Z')) || ((ch >= 'a' && ch <= 'z'))) {
            tmp = tmp + ch;
        }         
        sit++;

    }
    obj.value = tmp;
}

/**
 * <pre>
 * 문자열에서 특정문자 제거
 * </pre>
 * @param str : 문자열
 * @param delim : 제거대상문자
 * @return
 */
function util_cfRemoveProcess(str, delim) {
    var retStr = '';
    if (str == null || str == '' || delim == null || delim == '')  return '';
    for (var i = 0; i < str.length; i++) {
        if (str.charAt(i) != delim) {
            retStr = retStr + str.charAt(i);
        }
    }
    return retStr;
}

/**
 * <pre>
 * 문자열에서 특정문자 치환
 * </pre>
 * @param str : 문자열
 * @param strValue1 : 치환대상 문자
 * @param strValue2 : 치환 문자
 * @return
 */
function util_cfReplaceAll(strTemp, strValue1, strValue2){
    while(1){
        if( strTemp.indexOf(strValue1) != -1 )
            strTemp = strTemp.replace(strValue1, strValue2);
        else
            break;
    }
    return strTemp;
}

/**
 * <pre>
 * 기본 Javascript의  parseInt는 파라미터로 주어진 문자열에 공백문자, 
 * 혹은 0으로 시작되는 숫자형 문자열에 대해 제대로 Parsing하지 못하므로 
 * 공백, 앞에 오는 0의 제거를 선행 후 Integer parsing을 한다.
 * </pre>
 * @param sDigit : 문자열
 * @return
 */
function util_cfSafeParseInt(sDigit) {
    sDigit = $.trim(sDigit);
    sDigit = util_cfFrontZeroTrim(sDigit);
    return parseInt(sDigit,10);
}

/**
 * <pre>
 * SelectBox에서 특정값에 따른 Text 리턴
 * </pre>
 * @param obj : SelectBox Object
 * @param argValue : 특정값
 * @return Text 
 */
function util_cfSelectbox2value(obj, argValue) {
	if ( f_checktype(obj) == 1 ) {
		var i;  // 지역변수화
		for( i = 0 ; i < obj.length ; i++ ) {
			if ( obj[i].value == argValue ) {
				obj.selectedIndex = i;
				title = obj[i].text;
				break;
			}
		}
	} else {
		obj.value = argValue;
	}

	return title;
}

/**
 * SelectBox에서 선택된 option의 value
 * @param obj : SelectBox Object
 */
function util_cfSelectedValue(obj) {
	var retValue = '';
	if (obj) {
		retValue = obj.options[obj.selectedIndex].value;
	}
	return retValue;
}

/**
 * <pre>
 * 쿠키설정
 * </pre>
 * @param name : 쿠키이름
 * @param value : 특정값
 * @return  
 */
function util_cfSetCookie(name, value) {
    var argc    = util_cfSetCookie.arguments.length;
    var argv    = util_cfSetCookie.arguments;

    var    expires    = (argc > 2) ? argv[2] : null;
    var    path    = (argc > 3) ? argv[3] : null;
    var    domain    = (argv > 4) ? argv[4] : null;
    var    secure    = (argc > 5) ? argv[5] : false;

    document.cookie = name + "=" + escape(value) +
        ((expires==null)?"":("; expires=" + expires.toGMTString())) +
        ((path==null)?"":("; path=" + path)) +
        ((domain==null)?"":("; domain=" + domain)) +
        ((secure==true)?";secure" : "");
}

/**
 * <pre>
 * 문자열 양쪽 공백문자제거
 * </pre>
 * @param sSrc : 문자열
 * @param sValue : 특정값
 * @return  
 */
function util_cfTrim(sSrc) {
    var i = 0;
    for (i = 0; i < sSrc.length; i++) {
        if (sSrc.charAt(i) != ' ') {
            break;
        }
    }
    sSrc = sSrc.substring(i);
    for (i = sSrc.length - 1; i >= 0; i--) {
        if (sSrc.charAt(i) != ' ') {
            break;
        }
    }
    return sSrc.substring(0, i + 1);
}

/**
 * <pre>
 * Form에 속한 첫번째 Element에 Focus
 * </pre>
 * @param form : 대상 Form
 * @return  
 */
function util_cfSetFocusToFirstTextField(form) {
    if (typeof form == 'undefined') return;  // if form is invalid, just return.
    var count = form.elements.length;
    for (var i = 0; i < count; i++) {
        if (form.elements[i].type == "text" || form.elements[i].type == "password" || form.elements[i].type == "select-one") {
            form.elements[i].focus();
            return;
        }
    }
}

/**
 * <pre>
 * 문자열 왼쪽 '0' 제거
 * </pre>
 * @param str : 문자열
 * @return  
 */
function util_cfFrontZeroTrim(str) {
    var len = str.length;
    var count = 0;
    for(var i = 0; str.charAt(i) == '0'; i++){
      count++;
    }
    str = str.substring(count, len);
    return str;
}
/**우편번호 검색
 * @param obj : 검사할 input object
 * @param len : input 값의 최소길이
 * @param msg : 안내메시지
 */
function checkEmpty(obj, msg, emptyOk){
    res = true;
    if(isEmptyObj(obj)){
        if(!emptyOk){
            alert(msg);
            if (obj.type && obj.type == 'hidden') {
			} else {
				obj.focus();
			}
        }
        res = emptyOk;
    }
    return res;    
}

function isEmptyObj(para) {
    for(var i=0; i<isEmptyObj.arguments.length; i++){
	    if( typeof(isEmptyObj.arguments[i]) == "object" && isEmptyObj.arguments[i].value.length > 0)
	    return false;
	}

	return true;
}

/**우편번호 검색
 * @param obj : 검사할 input object
 * @param len : input 값의 최소길이
 * @param msg : 안내메시지
 */
function CheckLengthMin(obj, len, msg){
	var objLen = byteLen(obj);
	if( objLen < len ) {
		alert(msg);
		obj.focus();
		obj.value = "";
		return false;
	}
	return true;
}

function byteLen(obj){

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

// 모바일 웹 TOP fix
function topInit() {
	s_w = screen.width;							//윈도우 width
	s_h = screen.height;						//윈도우 height
	w_st = $(window).scrollTop();				//윈도우 scrollTop
	h_h = $("#header").height();				//header height
	c_h = $("#container").height();				//container height
	f_h = $("#footer").height();				//footer height
	ctf_h = $(".content_top_fixed").height();	//content_top_fixed height
	bb_h = $(".bottom-button button").height();	//bottom fixed 버튼 height

	commonUi.content_top_fixed();
}

// 모바일웹에서 사용하는 confirm popup
function alertPop(msg) {
	var buttonInfo	= '{"buttonInfo" : [{"title" : "확인", "cbFuncName" : "empty", "buttonStyle" : "1"}]}';
	popupConfirm( "알림" , msg, "", "1", buttonInfo );
}

function empty() {}

/*
 * ASIS - ipcc_memberGbnSelectbox 변형
 * 내용 : 독자카드 중앙/조합판단
 * memberGbn: 11,12,16,17 에 따른 true, false 가 담긴 array
 * 멤버 selectbox 데이터 만들기
 * */
function makeMemberGbnSelectbox( memberGbn ) {
	var COMMON_PARTNER_GBN_11	= { 'code':'11' , 'name':'비씨(농협은행) 회원'};
	var COMMON_PARTNER_GBN_12	= { 'code':'12' , 'name':'비씨(농·축협) 회원'};
	var COMMON_PARTNER_GBN_16	= { 'code':'16' , 'name':'채움(농협은행) 회원'};
	var COMMON_PARTNER_GBN_17	= { 'code':'17' , 'name':'채움(농·축협) 회원'};

	try {
        var options = '';
        var value = '';
        var count = 0;
        var gbnCode = ''; 

        for ( var i = 0; i < memberGbn.length; i++ ){
            if ( memberGbn[i] ) count++;
        }

        if ( memberGbn[0] == true ) {
            value		= COMMON_PARTNER_GBN_16.name;
            gbnCode 	= COMMON_PARTNER_GBN_16.code;
            if ( options != "" ) {
            	options	+= " , ";
            }
            options		+= '{"title" : "' + value + '", "value" : "' + gbnCode + '"}';
        }

        if ( memberGbn[1] == true ) {
        	value		= COMMON_PARTNER_GBN_17.name;
            gbnCode		= COMMON_PARTNER_GBN_17.code;
            if ( options != "" ) {
            	options	+= " , ";
            }
            options		+= '{"title" : "' + value + '", "value" : "' + gbnCode + '"}';
        }

        if ( memberGbn[2] == true ) {
        	value		= COMMON_PARTNER_GBN_11.name;
            gbnCode		= COMMON_PARTNER_GBN_11.code;
            if ( options != "" ) {
            	options	+= " , ";
            }
            options		+= '{"title" : "' + value + '", "value" : "' + gbnCode + '"}';
        }

        if ( memberGbn[3] == true ) {
        	value		= COMMON_PARTNER_GBN_12.name;
            gbnCode		= COMMON_PARTNER_GBN_12.code;
            if ( options != "" ) {
            	options	+= " , ";
            }
            options		+= '{"title" : "' + value + '", "value" : "' + gbnCode + '"}';
        }

		var listInfo	= '{"listInfo" : [ ' + options + '],';
		listInfo		+= '"willSelectIdx" : 0 }';

		return listInfo;
	} catch(e) {
		// alert( 'exception');
	}
}
