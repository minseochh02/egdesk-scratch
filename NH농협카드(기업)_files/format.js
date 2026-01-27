/*****************************************************************************************
* 업무명 : 공통
* 세부업무명 : 공통
* 설명 : 날짜, 금액, 숫자, 주민등록번호/사업자번호, 계좌 포멧
* 작성자 : 공통팀
* 작성일 : 2013.01.30
* -----------------------------------------------------------------------------------------
*  변경이력
* -----------------------------------------------------------------------------------------
*  No 날짜       작성자  내용
*  1  2013.01.30 공통팀  최초작성
******************************************************************************************/

/**
 * <pre>
 * 날짜 시간 포멧
 * ex) 20130101 -> 2013.01.01
 *     20130101120101 -> 2013.01.01 12:01:01
 * </pre>
 * @param strDate : 포멧대상 문자열
 * @return 포멧된 문자열
 */
function format_cfDateTypeFormat(strDate) {
    var strChangeDate = "";
    if(strDate.length==8){
      strChangeDate = strDate.substring(0,4) + "." + strDate.substring(4,6) + "." + strDate.substring(6,8);
    }else if(strDate.length==14){
    strChangeDate = strDate.substring(0,4) + "." + strDate.substring(4,6) + "." + strDate.substring(6,8) + "&nbsp;" + strDate.substring(8,10) + ":" + strDate.substring(10,12) + ":" + strDate.substring(12,14);
  }
  return strChangeDate ;
}
/**
 * 입력한 날짜를 주어진 구분자를 사용하여 YYYY구분자 MM구분자DD 형식으로 반환
 * 예1) null ==> ""<br>
 * 예2) 20040506 구분자 /  ==> 2004/05/06<br>
 * 예3) 20040506113020 구분자 / ==> 2004/05/06 11:30:20<br>
 * 예3) 그외 ==> 오늘날짜<br>
 *
 * @title 입력한 날짜를 YYYY-MM-DD 형식으로 반환
 **/
function format_cfDateTypeFormat(strDate,strFormat) {
	//var formatDate = "yyyy" + strFormat + "MM" strFormat+ delim + "dd";
	if(strDate == null || strDate == ""){
		return "";
	}else if(strDate.length == 6){
		return strDate.substring(0,4) + strFormat + strDate.substring(4,6);
	}else if(strDate.length == 8){
		return strDate.substring(0,4) + strFormat + strDate.substring(4,6) + strFormat + strDate.substring(6,8); 
	}else if(strDate.length == 14){
		return strDate.substring(0,4) + strFormat + strDate.substring(4,6) + strFormat + strDate.substring(6,8)+ " "+strDate.substring(8,10)+":"+strDate.substring(10,12)+":"+strDate.substring(12);
	}else{
		var toDay = new Date();
		var year = toDay.getFullYear();
		var month = toDay.getMonth() + 1;
		var date = toDay.getDate();
		return year+strFormat+(month >= 10 ? month : '0' + month)+strFormat+(date>=10 ? date: '0'+date);
	}
}
/**
 * 주민등록번호, 사업자번호 포멧
 * @param str : 포멧대상 문자열
 * @return 포멧된 문자열
 */
function format_cfRegnNo(str) {

    temp = "";
    len = str.length;

    if ((len != 13) && (len !=10))
        return str;

     if(len == 10) {
       temp = str.substring(0,3) + "-"+ str.substring(3,5) + "-"+ str.substring(5,10);
     }
    if(len == 13) {
            if ( str.charAt(6) == '0' ) {
                temp = str.substring(1,4) + "-" + str.substring(4,6) + "-" + str.substring(8,13);
            } else {
                temp = str.substring(0,6) + "-" + str.substring(6,13);
            }
  }
    return temp;
}


/**
 * <pre>
 * 숫자포멧 - 추가
 * ex) 123456 -> 123,456
 * </pre>
 * @param obj : 포멧대상 문자열
 * @return 포멧된 문자열
 */
function numberWithCommas(obj) {
	return obj.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * <pre>
 * 숫자포멧
 * ex) 123456 -> 123,456
 * </pre>
 * @param str : 포멧대상 문자열
 * @param bCheck : 잘못된금액 체크여부(기본값: false)
 * @return 포멧된 문자열
 */
function format_cfFormatNumber(s, bCheck) {
	var str = s.replace("/\D/g", "");
	if (str == "0") {
		return str;
	}
	if (bCheck == null || bCheck == undefined) {
		bCheck = false;
	}
	var len = str.length;
	var tmp = "";
	var tm2 = "";
	var i = 0;
	if (bCheck) {
		if (str.charAt(i) == '0') {
			alert('잘못된 금액 입력입니다.\n확인 후 다시 입력해 주시기 바랍니다.');
			return '';
		}
	} else {
		while (str.charAt(i) == '0') {
			i++;
		}
	}
	str = str.substring(i, len);
	len = str.length;

	if (len < 3) {
		return str;
	} else {
		var sit = len % 3;
		if (sit > 0) {
			tmp = tmp + str.substring(0, sit) + ',';
			len = len - sit;
		}
		while (len > 3) {
			tmp = tmp + str.substring(sit, sit + 3) + ',';
			len = len - 3;
			sit = sit + 3;
		}
		tmp = tmp + str.substring(sit, sit + 3) + tm2;
		str = tmp;
	}

	if(str.substring(0,2) == '-,'){
		str = '-'+str.substring(2);
	}
	return str;
}

/**
 * <pre>
 * 금액에 컴마 삽입 및 금액처리 (원화/외화)
 * </pre>
 *
 * @param acct :
 *            계좌번호
 * @param amt :
 *            금액
 * @return 포멧된 금액
 */
function format_cfGetAllWonFormat(acct, amt){
    var sCent;
    var str;
    var sAcctType = common_cfGetAccountType(acct);
    if(sAcctType == '9') {        // 외화계좌일경우
        var iLen = amt.length;
        if(iLen > 2) {
            sCent = amt.substring(iLen-2, iLen);
            if(amt == "888888888888")    return "?";
            str = format_cfGetWonFormat(amt.substring(0, iLen-2));
            str = str + "." + sCent;
        } else if(iLen == 2) {
            str = "0." + amt;
        } else if(iLen == 1) {
            str = "0.0" + amt;
        }
    } else {                    // 원화계좌일경우
        str = format_cfGetWonFormat(amt);
    }
    return str;
}

/**
 * <pre>
 * 금액에 컴마 삽입 및 금액처리 (원화)
 * </pre>
 * @param amt : 금액
 * @return 포멧된 금액
 */
function format_cfGetWonFormat(amt){
  var str  = amt;
  var len  = str.length;
  var tmp  = "";
  var tm2  = "";
  var i5    = 0;

  if(amt == "888888888888") {
	  return "?";
  }
  while(str.charAt(i5) == '0') {
	  i5++;
  }

  str = str.substring(i5,len);
  len = str.length;

  if(len == 0) {
      return '0';
  } else if(len < 3) {
      return str;
  } else {
      var sit = len % 3;
      if (sit > 0) {
          tmp = tmp + str.substring(0,sit) + ',';
          len = len - sit;
      }
      while (len > 3) {
          tmp = tmp + str.substring(sit,sit+3) + ',';
          len = len - 3;
          sit = sit + 3;
      }
      tmp = tmp + str.substring(sit,sit+3) + tm2;
      str = tmp;
  }
  return str;
}

/**
 * <pre>
 * 원하는 형식의 포멧으로 변환
 * </pre>
 * @param str : 포멧대상 문자열
 * @param delim : 삽입될 문자
 * @param type : 포멧을 원하는 형식 (ex. "3-2-2")
 * @return 포멧된 문자열
 */
function format_cfGetFormat(str, delim, type) {
    if(str == null || delim == null || type == null)        return '';
    var aType = type.split("-");
    var retStr = "";
    var firstLen = 0;
    var lastLen = 0;

    for(var i3=0; i3<aType.length; i3++) {
        if(i3 == 0) {
            firstLen    = 0;
            lastLen        = parseInt(aType[0]);
        } else {
            firstLen    = lastLen;
            lastLen        = firstLen + parseInt(aType[i3]);
        }
        if(i3 == aType.length-1)
            retStr = retStr + str.substring(firstLen, lastLen);
        else
            retStr = retStr + str.substring(firstLen, lastLen) + delim;
    }
    return retStr;
}

/**
 * 금액한글처리 관련 상수
 */
var format_hanNumber = new Array ('영','일','이','삼','사','오','육','칠','팔','구' );
var format_fourFour = new Array ('일', '만', '억', '조' );
var format_fourDigit = new Array ('일','십', '백', '천' );

/**
 * <pre>
 * 금액입력시 한글로 보여줌
 * </pre>
 * @param obj : 금액입력 TextField, object 타입이 아닌경우 한글로 결과 리턴 
 * @param obj2 : 한글로 보여줄 TextField
 * @param type : null-원단위, 1-만단위, 2-십만단위
 * @param gbn : null-한글 Display 필드가 INPUT 필드, 1-한글 Display 필드가 SPAN 필드
 * @return 금액한글
 */ 
function format_cfPutHanAmt(obj, obj2, type, gbn) {
	
	if(typeof(obj) != "object"){
		num = util_cfRemoveProcess( obj , ' ' );
	}else{
		num = util_cfRemoveProcess ( $.trim(obj.value) , ' ' );	
	}

    str = "";
    strr = num.split(",");
    for (var i=0;i<strr.length;i++){
      str += strr[i];
    }
    num = str;  
  
    // 한글금액 처리
    delimiter = ' ';
    var endValue = ' 원';
    var endZValue= ' 영';
  
    bPos = 0; // 만, 억, 조
    sPos = 0; // 십, 백, 천
    digit = 0;
  
    if (type==null){    // 원단위
        bPos = 0; // 만, 억, 조
        sPos = 0; // 십, 백, 천
        endValue=" 원";
        endZValue= '영 원';
    } else if (type=='1'){  //만단위
        bPos = 1; // 만, 억, 조
        sPos = 0; // 십, 백, 천
        endValue=" 원";
        endZValue= '영 만원';
    } else if (type=='2') { //십만단위
        bPos = 1; // 만, 억, 조
        sPos = 1; // 십, 백, 천
        endValue="만 원";
        endZValue= '영 십만원';
    } else if (type=='3') { //백단위 달러
        bPos = 0; // 만, 억, 조
        sPos = 2; // 십, 백, 천
        endValue=" 달러";
        endZValue= '영 백달러';
    }
  
    szDigit = '';
    is_start = false;
    appendFF = false;
    len = num.length;
    szHan = '';
  
    for (var i=len-1;i>=0;i--) {
        szDigit=num.substring(i,i+1);
        digit=parseInt(szDigit);
        
        if (digit!=0) {
        	
            if (bPos!=0 && sPos==0) {
            	
                if (is_start==true) {
                	szHan += delimiter;
                }
                
                szHan += format_fourFour[bPos]; // 만, 억        
                appendFF=false;               
            }
            
            if (bPos!=0 && appendFF==true) {
            	
              if (is_start==true) {
            	  szHan += delimiter;
              }
              
              szHan += format_fourFour[bPos]; // 만, 억
              appendFF=false;       
            }
            
            if (sPos!=0) {
            	szHan += format_fourDigit[sPos]; // 십, 백, 천	
            }
            
            szHan += format_hanNumber[digit]; // 일, 이, 삼
            is_start=true;
        
        } else if (sPos==0 && bPos!=0){
        	 appendFF=true;
        }
        
        sPos++;
        
        if (sPos%4==0) {
            sPos=0;
            bPos++;
            if (bPos>=4) {
            	return "(범위초과)";
            }
        }
    }
    
    if (is_start==false){
        rslt = '';
        if ( gbn == '1' ) {
            $('#' + obj2 ).text ( rslt + endZValue);
            
        }else{
            if(typeof(obj) != "object"){
                return rslt + endZValue;
            }else{
            	obj2.value = rslt + endZValue;    
            }
        }
        
    } else {
        rslt = '';
        for(var i = szHan.length - 1; i >= 0; i--) {
            rslt += szHan.substring(i, i + 1);
        }
        
        if ( gbn == '1' ) {
            $('#' + obj2 ).text ( rslt + endValue);
        }else{
        	
            if(typeof(obj) != "object"){
            	return rslt + endValue;
            }else{
            	obj2.value = rslt + endValue;    
            }
            
        }
    } 
}

/**
 * <pre>
 * 금액에서 콤마등 특수문자 제거 ( 소숫점, 마이너스기호 제외 )
 * </pre>
 * @param str : 포멧대상 문자열
 * @return 포멧된 문자열
 */
function format_cfMoneyUnformat(str) {

  var temp = "";
  var afterStr = str +'';
  var len = afterStr.length;
  var pos = 0;
    var ch = '';
  while (pos < len) {
    ch = afterStr.charAt(pos);
    if (((ch >= '0') && (ch <= '9')) || (ch == '-') || (ch == '.')) temp = temp + ch;
      pos = pos + 1;
  }
  return temp;
}

/**
 * <pre>
 * 숫자를 제외한 문자 제거
 * </pre>
 * @param str : 포멧대상 문자열
 * @return 포멧된 문자열
 */
function format_cfOnlyNumFormat(str) {

  var temp = "";
  var afterStr = str;
  var len = afterStr.length;
  var pos = 0;
    var ch = '';
  while (pos < len) {
    ch = afterStr.charAt(pos);
    if (((ch >= '0') && (ch <= '9'))) temp = temp + ch;
      pos = pos + 1;
  }
  return temp;
}

/**
 * 92.숫자만입력가능하고 자리수 제한 체크해서 입력
 */
function numberOnly(input,num){
	$(input).val($.trim(format_cfOnlyNumFormat($(input).val())));
	lengthCheckLargeToDelete2(input,"",num,"");

}

/**
 * 숫자만입력가능 입력
 */
function numberOnlyEvent(input,num){
	$(input).val($.trim(format_cfOnlyNumFormat($(input).val())));
}

/**
 * 81. 길이체크 - 초과하면 초과된 글자 삭제
 * @returns
 */
function lengthCheckLargeToDelete2(obj,msg,len,type){
	var pop = obj;
	var halflen = len/2;

    if(pop.value!="" && byteLen(pop) > len ){
    	if (type == "h") {
        	alert(msg+"는(은) 영문 숫자 " +len+"자 한글 "+halflen+"자를 넘을 수 없습니다.");
        } else if (type == "e"){
        	alert(msg+"는(은) "+len+"자를 넘을 수 없습니다.");
        }

        obj.blur();
    	// 타입 없으면 메시지 표출안함
        obj.value = pop.value.substring(0,len);

        return true;
    }
    return;
}

/**
 * <pre>
 * 계좌포멧
 * </pre>
 * @param sAccount : 포멧대상 계좌
 * @param sGubun : 구분자
 * @return 포멧된 계좌
 */
function format_cfNewAccountFormat(sAccount,sGubun) {
  sAccount = $.trim(sAccount);
  var   sNewFormat      = "";
  var   iAccountlength  = 0;

  if (sGubun == null) {
    sGubun = "-";
  }

  iAccountlength = sAccount.length;
  if(validation_cfIsMyAccount(sAccount)){
	  sNewFormat = format_cfGetFormat(sAccount, sGubun, (sAccount.length-2) + "-2");
  } else if(validation_cfIsNewAccount(sAccount) && iAccountlength == 13) {                 // 13자리는 신계좌번호 밖에 없으므로...
      sNewFormat = sAccount.substring(0,3)+""+sGubun+""+sAccount.substring(3,7)+""+sGubun+""+sAccount.substring(7,11)+""+sGubun+""+sAccount.substring(11);
  } else if(validation_cfIsVirtualAccount(sAccount) && iAccountlength == 14) {      // 14자리중 가상계좌인지 체크(기존 가상계좌는 일반적인 방법으로...
      sNewFormat = sAccount.substring(0,3)+""+sGubun+""+sAccount.substring(3,12)+""+sGubun+""+sAccount.substring(12);
  } else {
    switch(iAccountlength) {
      case 9:
        sNewFormat = "00"+sAccount.substring(0,1)+""+sGubun+""+sAccount.substring(1,3)+""+sGubun+""+sAccount.substring(3);
        break;
      case 10:
        sNewFormat = "0"+sAccount.substring(0,2)+""+sGubun+""+sAccount.substring(2,4)+""+sGubun+""+sAccount.substring(4);
        break;
      case 11:
        sNewFormat = sAccount.substring(0,3)+""+sGubun+""+sAccount.substring(3,5)+""+sGubun+""+sAccount.substring(5);
        break;
      case 12:
        sNewFormat = sAccount.substring(0,4)+""+sGubun+""+sAccount.substring(4,6)+""+sGubun+""+sAccount.substring(6);
        break;
      case 13:
        sNewFormat = sAccount.substring(0,3)+""+sGubun+""+sAccount.substring(3,5)+""+sGubun+""+sAccount.substring(5,10)+""+sGubun+""+sAccount.substring(10);
        break;
      case 14:
        sNewFormat = sAccount.substring(0,6)+""+sGubun+""+sAccount.substring(6,8)+""+sGubun+""+sAccount.substring(8);
        break;
      case 15:
        sNewFormat = sAccount.substring(0,6)+""+sGubun+""+sAccount.substring(6,9)+""+sGubun+""+sAccount.substring(9);
        break;
      case 16:
        sNewFormat = sAccount.substring(0,4)+""+sGubun+""+sAccount.substring(4,8)+""+sGubun+""+sAccount.substring(8,12)+""+sGubun+""+sAccount.substring(12);
        break;
      default :
        sNewFormat = sAccount;
        break;
    }
  }
  return sNewFormat;
}

/**
 * 계좌번호를 모두 15자리 셋팅해준다.
 * @param sAccount : 계좌번호
 * @return 포멧된 계좌
 */
function format_cfFillZeroAccount(sAccount) {
  sAccount = $.trim(sAccount);
  var   sReturnAccount = "";
  var   sTempValue     = "";
  var   iAccountlength = 0;
  iAccountlength = sAccount.length;

  for(var i=0; i < (15-iAccountlength); i++) {
      sTempValue = "0"+sTempValue;
  }
  sReturnAccount = sTempValue + sAccount;

  return sReturnAccount;
}



var format_arrTelcode		= new Array ('','02','031','032','033','041','042','043','044','051','052','053','054','055','061','062','063','064','070');
var format_arrTelvalue		= new Array ('선택','02','031','032','033','041','042','043','044','051','052','053','054','055','061','062','063','064','070');
var format_arrMobilecode	= new Array ('','010','011','016','017','018','019');
var format_arrMobilevalue	= new Array ('선택','010','011','016','017','018','019');
var format_arrTelallcode	= new Array ('','010','011','016','017','018','019','02','031','032','033','041','042','043','044','051','052','053','054','055','061','062','063','064','070');
var format_arrTelallvalue	= new Array ('선택','010','011','016','017','018','019','02','031','032','033','041','042','043','044','051','052','053','054','055','061','062','063','064','070');

/**
 * <pre>
 * 전화번호 국을 Select Box 형태로 표시한다.
 * </pre>
 * @param {String} mode = 1:지역, 2:핸드폰, 3:지역+핸드폰
 * @param {String} frm  = form name
 * @param {String} name = select box name
 * @param {String} choice = 선택할 값
 * @param {String} event  = 이벤트 메소드
 */
function format_getSelectBoxInfo(mode, frm, name, choice , event) {
	var selectCnt = 0;
	var temp_code = new Array();
	var temp_value = new Array();
	var vTitleName = "";

	if(mode == "1") {		// 지역번호
		temp_code = format_arrTelcode;
		temp_value = format_arrTelvalue;
		vTitleName = "지역번호 선택";
	} else if (mode=="2") {
		temp_code = format_arrMobilecode;
		temp_value = format_arrMobilevalue;
		vTitleName = "핸드폰 앞자리 선택";
	} else if (mode=="3") {
		temp_code = format_arrTelallcode;
		temp_value = format_arrTelallvalue;
		vTitleName = "지역번호 및 핸드폰 앞자리 선택";
	}

	selectCnt = temp_code.length;
	document.write("<select data-type='select' title='"+vTitleName+"' id='" + name + "' name='" + name + "' " + event + ">");
	for(var i4=0; i4<selectCnt; i4++) {
		if(choice != '' &&  choice==temp_value[i4]) {
			document.write("<option value='" + temp_code[i4] + "' selected >" + temp_value[i4]+"</option>");
		} else {
			document.write("<option value='" + temp_code[i4] + "'>" + temp_value[i4]+"</option>");
		}
	}
	document.write("</select>");
}


/**
 * 32. 전문에서 넘겨주는 금액 처리부분
 *
 * @param num					-String : 숫자 (ex : 00000345100.00 - 전문에서 넘어온 금액)
 * @return www                 	-String : 천단위 표시된 금액
 */
function numberFormat(num) {

	var num = unNumberFormat(num);

	//1보다 작은 값에 대한 - 처리를 위해
	var minusTrue = false;
	if(num.indexOf("-") > -1){
		minusTrue = true;
	}

	//소수점은 콤마제외
	var pointTrue = false;
	if(num.indexOf(".") > -1){
		var tempNum = num.split(".")[1];
		num = num.split(".")[0];

		// 소수점에 값이 있을때만 붙이기
		if(Number(tempNum) > 0) {
			pointTrue = true;
		}
	}

	var pattern = /(-?[0-9]+)([0-9]{3})/;

	var sss = Number(num);
	var www = String(sss);

    while(pattern.test(www)) {
        www = www.replace(pattern,"$1,$2");
    }
    //소수점은 콤마제외
	if(pointTrue){
		if(tempNum.length > 2) {		// 소수점은 2자리까지만 표기
			tempNum = tempNum.substring(0, 2);
		}
		www = www + "." + tempNum;
	}

	if(minusTrue) {
		if(www.indexOf("-") < 0){
			www = "-" + www;
		}
	}

    return www;
}


/**
 * 34. 콤마제거
 *
 * @param num					-String : 천단위 표시된 숫자
 * @return                  	-String : 천단위 제가한 숫자
 */
function unNumberFormat(num) {
    return (num.replace(/\,/g,""));
}


/**
 *  카드론 계좌번호
 *  13자리(관리번호제외) : (111-1111-1111-11)
 *  17자리(관리번호포함) : (111-1111-1111-11-1111)
 *
 * @param
 * @return
 */
function cardLoanAcctNo(data){
    var returnAcctNo = "";

    returnAcctNo = jQuery.trim(data);
    returnAcctNo = returnAcctNo.replace(/-/gi, "");

    // 13자리일 경우
    if (returnAcctNo.length == 13 ){
        returnAcctNo = returnAcctNo.substring(0,3)+"-"+returnAcctNo.substring(3,7)+"-"+returnAcctNo.substring(7,11)+"-"+returnAcctNo.substring(11,13);
        // 17자리일 경우
    }else if (returnAcctNo.length == 17 ){
        returnAcctNo = returnAcctNo.substring(0,3)+"-"+returnAcctNo.substring(3,7)+"-"+returnAcctNo.substring(7,11)+"-"+returnAcctNo.substring(11,13)+"-"+returnAcctNo.substring(13,17);
    }

    return returnAcctNo;
}


/**
 * 11. 날짜 형식
 *
 * @param receivedData			-String : 날짜
 * @param receivedSep			-String : 구분자
 * @return date                 -String : 구분자로 표시된 날짜
 */
function setFormatDate (receivedData, receivedSep) {
	var date = receivedData;
	var sep  = receivedSep;

	/**
	 * 김광진 추가 - 8자리일 경우 년월일, 6자리일 경우 년월 분기
	 */
	if(date.length === 8) {
		date = date.substring(0,4) + sep + date.substring(4,6) + sep + date.substring(6);
	} else if(date.length === 6) {
		date = date.substring(0,4) + sep + date.substring(4,6);
	}

	return date;
}

/**
 * 12. 날짜 형식
 * 
 * @param receivedData			-String : 날짜(19900204131122)
 * @return date                 -String : YYYY년 MM월 dd일 hh:mm:ss
 */
function setFormatLocalDate (date) {
	if(date.length === 14) {
		var yyyy = date.slice(0,4);
		var MM = date.slice(4,6);
		var dd = date.slice(6,8);
		var hh = date.slice(8,10);
		var mm = date.slice(10,12);
		var ss = date.slice(12,14);
		date = yyyy+'년 '+ MM+'월 '+dd+'일 '+hh+':'+mm+':'+ss;
	} else {
		date = "";
	}
	return date;
}

/**
 * 31. 천단위 표시
 *
 * @param data			-String : 금액
 * @return amount       -String : 천단위 표시된 금액
 */
function setFormatAmount(data){
	data = new String(data);
	exp_data = data.split('.');
	tmp = '';
	amount = '';
	cutlen = 3;
	comma = ',';
	len = exp_data[0].length;
	mod = (len % cutlen);
	k = cutlen - mod;

	for (NF_i=0; NF_i<len; NF_i++) {
		amount = amount + data.charAt(NF_i);
		if (NF_i < len - 1) {
			k++;
			if ((k % cutlen) == 0) {
				amount = amount + comma;
				k = 0;
			}
		}
	}

	if (exp_data[1] != undefined) amount += '.' + exp_data[1];
	return amount;
}

