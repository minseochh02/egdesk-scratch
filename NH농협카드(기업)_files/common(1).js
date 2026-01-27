/*****************************************************************************************
* 업무명 : 공통
* 세부업무명 : 공통
* 설명 : 공통업무(로그인,우편번호,지점찾기,보안카드/OTP 등)
*       솔루션 관련 (가상키패드 등)
* 작성자 : 공통팀
* 작성일 : 2013.01.30
* -----------------------------------------------------------------------------------------
*  변경이력
* -----------------------------------------------------------------------------------------
*  No 날짜        작성자  내용
*  1  2013.01.30  공통팀  최초작성
*  2  2014.09.24  김민수  보안카드 2자리수로 변경 및 자동커서 on/off 기능 추가
*  3  2014.10.16  김미헌  권유직원 조회 팝업 호출 기능 추가
*  4  2014.10.22  김수찬  로딩바 이미지 alt변경 및 메뉴 1Depth 이벤트 추가
*  5  2014.10.31  정영탁  SuperSign 조회를 위한 Ajax
*  6  2016.05.16  홍경의  인증서 등록/재발급에서 타행발행 인증서 존재시 메시지(자바에서 처리) 변경 및 [타행/타기관 인증서 등록 바로가기] 버튼 표시
*  7  2016.06.09  홍경의  당행/타행 스마트OTP 채번 및 검증로직 수정
******************************************************************************************/

/****************************************************
 * 공통 업무
 ****************************************************/

/**
 * 레이어 팝업 오픈시에 현재 포커스를 저장하기 위한 변수
 */
var common_FOCUS_LAYER_ID = null;

var console; if (!console) { console = {}; if (typeof console.log !== 'function') { console.log = function() {}; } }

var submitDelayFlag = false; 
var movePageDelayFlag = false; 
function useSubmitDelayFlag() {
    submitDelayFlag = false;
}
function checkSubmitDelay() {
    return submitDelayFlag;
    //return false;
}
function useMovePageDelayFlag() {
    movePageDelayFlag = false;
}

/**
 * <pre>
 * 일반계좌, 평생계좌 종류 반환
 * </pre>
 * @param sGjaNbr : 계좌번호
 * @return sReturn : 0(일반계좌), 1(중앙회평생계좌), 2(지역농협평생계좌)
 */
function common_cfGetEternalAccount(sGjaNbr) {
    var sReturn     = "";  // 리턴값
    var sTempGjaNbr = "";  // 계좌번호 유효성체크
    var sLastChar   = "";  // 마지막 문자

    // 예외처리(null값변환, "-"값제거, 빈문자열제거
    if (sGjaNbr == null) sTempGjaNbr = "";
    else sTempGjaNbr = sGjaNbr;

    sTempGjaNbr = util_cfRemoveProcess(sTempGjaNbr," ");
    sTempGjaNbr = util_cfRemoveProcess(sTempGjaNbr,"-");

    if (sTempGjaNbr.length == 10){
        sLastChar = sTempGjaNbr.substring(9,10);
    }else if (sTempGjaNbr.length == 13){
        sLastChar = sTempGjaNbr.substring(12,13);
    }

    if("8" == sLastChar){
        sReturn = "1";
    }else if("9" == sLastChar){
        sReturn = "2";
    }else{
        sReturn = "0";      }

    return sReturn;
}

/**
 * 계좌번호 검증후 계좌번호에 맞는 과목코드를 반환 (허수 3자리로)
 * @param sAccount : 계좌번호
 * @return sNewGwamok : 과목코드
 */
function common_cfGetNewAccountGwamok(sAccount) {
    var bValid = false;
    var sNewGwamok = null;
    var sCheckVirtual = null;
    var sFullAccount = null;
    var iAccountlength = 0;
    var sNewGwamok = "999";

    sAccount = $.trim(sAccount);
    if (sAccount.indexOf("-") > 0) sAccount = util_cfRemoveProcess(sAccount, "-");
    sFullAccount = util_cfFillLeftSpace(util_cfRemoveProcess(sAccount, " "), 15, "0"); // 계좌번호 15자리까지 0으로 Left Padding
    sCheckVirtual = sAccount.substring(0, 3);
    iAccountlength = sAccount.length;

    if (validation_cfIsMyAccount(sAccount))
        return "000";

    if (iAccountlength == 11) {
            sNewGwamok = "0" + sAccount.substring(3, 5);
    } else if (iAccountlength == 12) {
            sNewGwamok = "0" + sAccount.substring(4, 6);
    } else if (iAccountlength == 13) {
            sNewGwamok = sAccount.substring(0, 3);
    } else if (iAccountlength == 14) {
        if (validation_cfIsVirtualAccount(sAccount)) { // 신계좌체계의 가상계좌는 14자리 3-10-1
            sNewGwamok = sAccount.substring(0, 3);
        } else {
            sNewGwamok = "0" + sAccount.substring(6, 8);
        }
    } else if (iAccountlength == 15) {
            sNewGwamok = sAccount.substring(6, 9);
    } else if (iAccountlength == 16) {
            sNewGwamok = sAccount.substring(0, 4);
    }
    return common_cfGetMappingGwamok(sNewGwamok);
}

/**
 * 기존 코드 변경을 최소화 하기 위해 신계좌 번호로 인해 생겨진 과목 코드를 기존 과목 코드로 리턴 과목을 비교해서 분기처리를 할때
 * 사용한다. 신계좌 과목중 315,316,456,457,459,790,791,792는 제외한다.
 *
 * @param sGwamok :
 *            과목코드
 * @return
 */
function common_cfGetMappingGwamok(sGwamok) {
    var sRetGwamok   = "";
    if(sGwamok.length == 2) sGwamok = "0" + sGwamok;
    if("001" == sGwamok || "301" == sGwamok || "501" == sGwamok) sRetGwamok = "001";
    else if("002" == sGwamok || "302" == sGwamok || "502" == sGwamok) sRetGwamok = "002";
    else if("003" == sGwamok || "303" == sGwamok) sRetGwamok = "003";
    else if("004" == sGwamok || "304" == sGwamok) sRetGwamok = "004";
    else if("005" == sGwamok || "305" == sGwamok || "505" == sGwamok) sRetGwamok = "005";
    else if("006" == sGwamok || "306" == sGwamok || "506" == sGwamok) sRetGwamok = "006";
    else if("012" == sGwamok || "312" == sGwamok || "512" == sGwamok) sRetGwamok = "012";
    else if("017" == sGwamok || "317" == sGwamok || "517" == sGwamok) sRetGwamok = "017";
    else if("023" == sGwamok || "323" == sGwamok) sRetGwamok = "023";
    else if("048" == sGwamok || "348" == sGwamok) sRetGwamok = "048";
    else if("051" == sGwamok || "351" == sGwamok || "551" == sGwamok) sRetGwamok = "051";
    else if("052" == sGwamok || "352" == sGwamok || "552" == sGwamok) sRetGwamok = "052";
    else if("053" == sGwamok || "353" == sGwamok) sRetGwamok = "053";
    else if("055" == sGwamok || "355" == sGwamok || "555" == sGwamok) sRetGwamok = "055";
    else if("056" == sGwamok || "356" == sGwamok || "556" == sGwamok) sRetGwamok = "056";
    else if("074" == sGwamok || "374" == sGwamok || "574" == sGwamok) sRetGwamok = "074";
    else if("010" == sGwamok || "310" == sGwamok) sRetGwamok = "010";
    else if("014" == sGwamok || "314" == sGwamok) sRetGwamok = "014";
    else if("021" == sGwamok || "321" == sGwamok) sRetGwamok = "021";
    else if("044" == sGwamok || "344" == sGwamok) sRetGwamok = "044";
    else if("047" == sGwamok || "347" == sGwamok) sRetGwamok = "047";
    else if("045" == sGwamok || "345" == sGwamok) sRetGwamok = "045";
    else if("049" == sGwamok || "349" == sGwamok) sRetGwamok = "049";
    else if("054" == sGwamok || "354" == sGwamok) sRetGwamok = "054";
    else if("059" == sGwamok || "359" == sGwamok) sRetGwamok = "059";
    else if("060" == sGwamok || "360" == sGwamok) sRetGwamok = "060";
    else if("076" == sGwamok || "376" == sGwamok) sRetGwamok = "076";
    else if("084" == sGwamok || "384" == sGwamok) sRetGwamok = "084";
    else if("094" == sGwamok || "394" == sGwamok) sRetGwamok = "094";
    else if("098" == sGwamok || "398" == sGwamok) sRetGwamok = "098";
    else if("025" == sGwamok || "325" == sGwamok) sRetGwamok = "025";
    else if("033" == sGwamok || "333" == sGwamok) sRetGwamok = "033";
    else if("034" == sGwamok || "334" == sGwamok) sRetGwamok = "034";
    else if("045" == sGwamok || "345" == sGwamok) sRetGwamok = "045";
    else if("058" == sGwamok || "358" == sGwamok) sRetGwamok = "058";
    else if("073" == sGwamok || "373" == sGwamok) sRetGwamok = "073";
    else if("068" == sGwamok || "368" == sGwamok) sRetGwamok = "068";
    else if("069" == sGwamok || "369" == sGwamok) sRetGwamok = "069";
    else sRetGwamok = sGwamok;
    return sRetGwamok;
}

/**
 * 계좌종류 반환
 * @param sAccount : 계좌
 * @return
 */
function common_cfGetAccountType(sAccount) {
    var   sType       = "";
    var   sGwamok     = "";

    sAccount = $.trim(sAccount);
    if(sAccount.length == 16) {
        return "3";
    }
    if( validation_cfIsMyAccount(sAccount) ) {
        return "0";
    }
    sGwamok = common_cfGetNewAccountGwamok(sAccount);
    if ( sGwamok == null) {
        return "999"; // 적용이 안되는 계좌
    }
    if( sGwamok == "018" || sGwamok == "019" ) {
        if("0" ==  sGwamok.substring(0,1)) {
            return "6";
        }
    }

    switch(1*(sGwamok)) {
        case 1: case 2: case 12: case 17: case 40: case 50: case 51: case 52: case 55: case 56: // case 74:
        case 301: case 302: case 312: case 317: case 351: case 352: case 355: case 356: // case 374:
        case 501: case 502: case 512: case 517: case 551: case 552: case 555: case 556: // case 574:
            return "0"; // 요구불
        case 5: case 6: case 305: case 505: case 306: case 506:
            return "1"; // 요구불 (가,당)
        case 3: case 4: case 10: case 14: case 21: case 22: case 24: case 25: case 33: case 34: case 44: case 45: case 47: case 49:
        case 53: case 54: case 59: case 60: case 73: case 76: case 80: case 84: case 94: case 98:
        case 303: case 304:  case 310: case 314: case 321: case 325: case 333: case 334: case 344: case 345: case 347: case 349: // case 323:
        case 353: case 354: case 359: case 360: case 373: case 376: case 384: case 394: case 398:
            return "2"; // 저축성
        case 28: case 32: case 30: case 31: case 35: case 36: case 38: case 43: case 46: case 77: case 79: case 81: case 86: case 87: case 88: case 90: case 91: case 92: case 93: case 97:
            return "5"; // 펀드 및 신탁
        case 62: // 대출 && 특수체계계좌
            if (common_cfGetNewJoongJo(sAccount) == "1") {
                return "8"; // 중앙회
            } else {
                return "7"; // 지역
            }
        case 11: case 20: case 61: case 72: case 75: case 78: case 82: case 83: case 70: case 71:
            return "7"; // 대출
        case 18: case 19: case 68: case 69: // case 183:
            return "6"; // 공제
        case 451: case 452: case 453: case 454: case 455: case 456: case 457: case 459: // 외화예금
        case 419: case 431: case 433: // 외화대출
        case 432: case 434: case 435: // 인터넷서비스 불가 과목
            return "9"; // 외환계좌
        case 64: case 65: case 66: case 67: case 790: case 791: case 792: // case 793: case 910: case 911: case 912:
            return "10"; // 가상계좌
        default:
            return "999";
    }
}

/**
 * 계좌번호 중조구분 반환
 * @param sAccount : 계좌번호
 * @return sNewJoongJo : 중앙회:1, 조합:2, 구축협:3
*/
function common_cfGetNewJoongJo(sAccount){

    sAccount = $.trim(sAccount);
    sNewJoongJo = "1";

    if (sAccount.length == 11 || sAccount.length == 12 || sAccount.length == 15) {
        sNewJoongJo = "1";
    } else if(sAccount.length == 13 && (sAccount.substring(12)=="1" || sAccount.substring(12)=="2") ) {
        sNewJoongJo = "1"; // 농협은행
    } else if(sAccount.length == 13 && (sAccount.substring(12)=="3" || sAccount.substring(12)=="4" || sAccount.substring(12)=="5") ) {
        sNewJoongJo = "2"; // 조합
    } else if(sAccount.length == 13 && (sAccount.substring(12)=="6" || sAccount.substring(12)=="7") ) {
        sNewJoongJo = "3"; // 구축협
    } else if(sAccount.length == 13 && (sAccount.substring(12)=="8" || sAccount.substring(12)=="9") ) {
        sNewJoongJo = "4"; // 가상계좌
    } else if(sAccount.length == 14 && (sAccount.substring(0,3)=="793") ) {
          sNewJoongJo = "4"; // 조합
    } else if(sAccount.length == 14) {
        sNewJoongJo = "2"; // 조합
    }
    return sNewJoongJo;
}

/**********************
* window.open(arg1,arg2,arg3)  옵션 배열의 갯수를 정확히 넣어줘야 합니다. 값이 필요 없으면 '' 을 넣습니다.
*  ex :  common_cfOpenWinPop(a.html,"새창임","form 이름",[넓이,높이,x좌표,y좌표,scroll여부,resizable여부,주소창여부,menu var 여부,toolbar 여부,상태바 여부])
*        common_cfOpenWinPop(act,"popupWin","form2") -> form 데이타를 submit 하면서 일반적인 창 크기
*        common_cfOpenWinPop("ICCNA000S.view","popupWin","form2",["500","600"]) -> form 데이타를 submit 하면서 팝업 사이즈가 500,600 을 띄울 경우
*        common_cfOpenWinPop(act,"popupWin"); form 데이타없이 일반적인 크기의 팝업을 띄울경우
*        common_cfOpenWinPop("ICCNA000S.view?a=1","popupWin","",["500","600"]) -> form 데이타없이 팝업을 띄울 경우
*        scroll은 default=yes임 , center가 yes로 되어있어도 x,y좌표가 있으면 좌표에 따른다.
* @param : 주소
* @param : 윈도우 이름
* @param : 창관련 옵션(배열 형식)
* @param : 언어코드
* @return : void
* @see
************************/
function common_cfOpenWinPop(url, popname , formName , option, localeCode)
{
    var sFeatures ="";

    if(localeCode == undefined || localeCode == ''){
        localeCode = "KO";
    }

    if(option != undefined){
        var popWidth = option[0] == "" ? "600" : option[0];
        var popHeight = option[1] == "" ? "450" : option[1];
        var popLeft = option[2] == "" ? 0 : option[2];
        var popTop = option[3] == "" ? 0 : option[3];
        var popScroll = option[4] == "" ? "no" : option[4];
        var popResize = option[5] == "" ? "yes" : option[5];
        var popLocation = option[6] == "" ? "no" : option[6];
        var popMenubar = option[7] == "" ? "no" : option[7];
        var popToolbar = option[8] == "" ? "no" : option[8];
        var popStatus = option[9] == "" ? "no" : option[9];

        var xpos = (screen.width - popWidth) / 2;
        var ypos = (screen.height - popHeight) / 2 ;

        sFeatures = "width="+popWidth;
        sFeatures += ",height="+popHeight;

        sFeatures += ",left="+xpos;
        sFeatures += ",top="+ypos;

        sFeatures += ",scrollbars="+popScroll;
        sFeatures += ",resizable="+popResize;
        sFeatures += ",location="+popLocation;
        sFeatures += ",menubar="+popMenubar;
        sFeatures += ",toolbar="+popToolbar;
        sFeatures += ",status="+popStatus;

    }

    if(formName != undefined && formName != "") {
        var newWin = "";

        newWin = window.open('', popname, sFeatures);

        var submitform = eval("document."+formName);

        /* submitform 길이가 0일 경우 'POST IS NULL' alert창이 뜨는 문제 방지. */
        if(submitform.elements.length == 0) {
            var element = document.createElement('INPUT');
            element.type = "hidden";
            submitform.appendChild(element);
        }

        submitform.action=url;
        submitform.target=popname;
        submitform.submit();

    } else {
        var newWin = window.open('', popname, sFeatures);

        var submitform = document.createElement('form');

        if(url.indexOf("?") != -1){
            var parameters = (url.split("?")[1]).split("&");
            url = url.split("?")[0];

            for(var i = 0 ; i < parameters.length ; i++)
            {
                varName = parameters[i].split('=')[0];
                value = parameters[i].split('=')[1];
                $('<input type="hidden" name="' + varName + '"/>').val(value)
                .appendTo(submitform);
            }
        }

        $(submitform).attr("method", "POST");
        document.body.appendChild(submitform);

        submitform.action = url;
        submitform.target = popname;
        submitform.submit();
        document.body.removeChild(submitform);
    }
}

/**
 * jQuery AJAX
 * @param {String} path : 이동하고자 하는 경로값
 * @param {Object} param : 페이지 전환시 다음 페이지로 넘기고자 하는 파라메터 값(FORM or JSON)
 * @param {Function} successFunc
 * @param {Function} errorFunc
 */
function common_cfAjaxCall(path, param, successFunc, errorFunc, option) {
    if (param && $(param).length > 0 && $(param)[0].tagName == 'FORM') {
        $.each(['SESSION_TOKEN','TOKEN'], function(i, val) {
            $(param).find('[name='+val+']').remove();
        });
    }

    return $('<div></div>').common_movePage(path, param, option).done(function(data, status, xhr){
        if (successFunc && typeof successFunc == 'function') {
            //IE9 bug(ajax로 대량의 table cell markup을 수신 시 cell이 밀리는 현상)
            //<td>사이의 공백이나 개행 문자가 있을 경우 발생함.
            if(navigator.appVersion.indexOf("MSIE 9.")!=-1) {
                data = data.replace(/td>\s+<td/g, 'td><td');
                data = data.replace(/tr>\s+<td/g, 'tr><td');
                data = data.replace(/td>\s+<tr/g, 'td><tr');
            }
            successFunc(data, status, xhr);
        }
        try {
            ipcn_cfContentNavigateComplete();
        } catch(e) {}
    }).fail(function(data, status, xhr){
        if (errorFunc && typeof errorFunc == 'function') {
            errorFunc(data, status, xhr);
        } else {
            common_cfUserDefinedErrorPop(data, status, xhr);
        }
    });
}

function showErrorLayerPop(errObject) {
    if('MOBILE' == common_cfGetDeviceType() || 'TABLET' == common_cfGetDeviceType()) {
        var errHTML = getMErrorHTML(errObject);
        popupConfirm("알림", errHTML, "", 1, '{"buttonInfo" : [{"title" : "확인", "cbFuncName" : "closeMErrPop", "buttonStyle" : "1"}] }');
    } else {
        var errHTML = getErrorHTML(errObject); // template가져옴
        open_layer_html(errHTML, 'layerDiv_errPop');

        /*
        if(window.opener != undefined || window.opener != null){
            var errHTML = getErrorHTMLWinOpen(errObject); // template가져옴
            open_layer_htmlWinOpen(errHTML, 'layerDiv_errPop_winOpen');
        }else{
            var errHTML = getErrorHTML(errObject); // template가져옴
            open_layer_html(errHTML, 'layerDiv_errPop');
        }
        */
    }
}
function getErrorHTMLWinOpen(errObject) {

	var errorCode = errObject.errorCode;
    var subErrorCode = "";
    var guid = errObject.guid;
    var detailView = "";
    var rmsSvc = errObject.rmsSvc;
    var apSvrNm = errObject.apSvrNm;
    var orgErrorCode = errObject.orgErrorCode;
    var errSvrInfo = errObject.errSvrInfo;

    if(errorCode && errorCode.length == 9){
        subErrorCode = errorCode.substring(4);
    } else if ('NH_IMO_ERR' == errorCode){
        subErrorCode = errObject.subErrorCode;
    } else {
    	subErrorCode = errorCode;
    }

    if(guid != undefined && guid != null && guid != 'null' && guid.length > 0){
        guid = " > " + guid;
    }else{
        guid = "";
    }

    if(rmsSvc != undefined && rmsSvc != null && rmsSvc != 'null' && rmsSvc.length > 0){
        rmsSvc = rmsSvc + " > ";
    }else{
        rmsSvc = "";
    }

    if(apSvrNm != undefined && apSvrNm != null && apSvrNm != 'null' && apSvrNm.length > 0){
        apSvrNm = ", " + apSvrNm;
    }else{
        apSvrNm = "";
    }

    if (errObject.errFlnm != undefined && errObject.errFlnm !=''){
    	detailView = rmsSvc + errObject.errFlnm + " > " + errObject.orgErrorCode + " > " + errObject.errPrgLine + guid;
    }else{
    	detailView = rmsSvc + errObject.errPrgName + " > " + errObject.orgErrorCode + " > " + errObject.errPrgLine + guid;
    }

    var serviceId = errObject.serviceId;
    var subServiceId = "";
    var phonNumber = "(1644-4000)";

    if(serviceId != undefined && serviceId != 'undefined' && serviceId != null && serviceId != 'null' && serviceId.length > 4){
        subServiceId = serviceId.substring(0,4);
    }

    var returnServiceId = errObject.returnServiceId;

    if(returnServiceId != undefined && returnServiceId != null && returnServiceId != 'null' && returnServiceId.length > 0){
        returnServiceId = returnServiceId;
    }else{
        returnServiceId = "null";
    }

    var checkFailYn = "N";
    var message = "";

    if( (errObject.errMsg == undefined || errObject.errMsg == 'undefined' || errObject.errMsg == null || errObject.errMsg == 'null')
        && (subErrorCode == '') && (errObject.errSvrInfo == undefined || errObject.errSvrInfo == 'undefined' || errObject.errSvrInfo == null || errObject.errSvrInfo == 'null') ){

        checkFailYn = "Y";
        message = common_cfGetMessage("I0541");

    } else {
    	if (errObject.errMsg.indexOf('OCSP_') > -1 || errObject.errMsg.indexOf('CERT_') > -1) {
    		checkFailYn = "Y";
    		message = common_cfGetMessage("E0434");
    	} else {
    		message = errObject.errMsg;
    	}
    }

    //간편인증 이용자 타 매체 이동시 오류팝업
    if(errorCode == 'MCPR98019'){
        checkFailYn = "Y";
        message = common_cfGetMessage("E0349");
    }

    var err_HTML = "";
    err_HTML += "    <div class='pop_header' data-dialog-movecursor='true'>";
    err_HTML += "        <h1 class='h1_pop'>"+common_cfGetMessage("I0522")+"</h1>";
    err_HTML += "    </div>";
    err_HTML += "    <div class='pop_content'>";
    err_HTML += "        <!-- 오류 페이지 -->";
    err_HTML += "        <div class='error'>";
    err_HTML += "            <div class='desc'>";
    //err_HTML += "                <p>"+common_cfGetMessage("I0519")+"</p>";
    err_HTML += "                <p>"+message+"</p>";
    if (subErrorCode == '06695' || subErrorCode == '96695' || subErrorCode == '06697' || subErrorCode == '96697' || subErrorCode == '06709') {
        err_HTML += "            <p>"+common_cfGetMessage("I0527")+"</p>";
    }
    if(checkFailYn == "N"){
        err_HTML += "                <div class='gcode'>";
//        err_HTML += "                    <span class='code'><strong>"+common_cfGetMessage("I0520")+" : "+subErrorCode+","+ errObject.errSvrInfo + "" + apSvrNm +"</strong></span>";
        err_HTML += "                    <span class='code'><strong>"+common_cfGetMessage("I0520")+" : "+subErrorCode+", "+errSvrInfo+"</strong></span>";
        err_HTML += "                    <span class='btn7 more'><a href='#' onClick='viewDetailErr();'>"+common_cfGetMessage("I0521")+"</a></span>";
        err_HTML += "                    <span class='mcode' id='view_code' style='display:none;'>" + detailView + "</span>";
        err_HTML += "                </div>";
    }

    err_HTML += "            </div>";
    err_HTML += "            <div class='foot'>";
    err_HTML += "                <p><span class='info3'>"+common_cfGetMessage("I0523")+"<span>" + phonNumber + "</span>"+common_cfGetMessage("I0524")+"</span></p>";
    err_HTML += "            </div>";
    err_HTML += "        </div>";
    err_HTML += "        <!-- //오류 페이지 -->";
    err_HTML += "        <div class='btn_area'>";

    /*
     * 2016 e-금융 보안강화 및 서비스 고도화 구축 > START
     * - 공인인증서 발급 절차 개선
     * - 인증서 등록/재발급에서 타행발행 인증서 존재시 [타행/타기관 인증서 등록 바로가기] 버튼 표시
     */
    if (subErrorCode == '92513') {
        err_HTML += "        <span class='btn1'><a href='javascript:closeErrorLayerWinOpen(\"" + (window["G_WEB"] == "true" ? "PGCA0161I" : "IPCA0161I") + "\", \"" + orgErrorCode + "\", \"" + serviceId + "\", false);'>"+common_cfGetMessage("I0660")+"</a></span>";
    }
    /*
     * 2016 e-금융 보안강화 및 서비스 고도화 구축 > END
     */

    err_HTML += "            <span class='btn2'><a href='javascript:closeErrorLayerWinOpen(\"" +returnServiceId+ "\", \"" + orgErrorCode + "\", \"" + serviceId + "\", true);'>"+common_cfGetMessage("I0525")+"</a></span>";
    if (subErrorCode == '06695' || subErrorCode == '96695' || subErrorCode == '06709') {
        err_HTML += "        <span class='btn2'><a href='javascript:closeErrorLayerWinOpen(\"" + (window["G_WEB"] == "true" ? "PGAM0491R" : "IPAM0491R") + "\", \"" + orgErrorCode + "\", \"" + serviceId + "\", false);'>"+common_cfGetMessage("I0528")+"</a></span>";
        err_HTML += "        <span class='btn2'><a href='javascript:closeErrorLayerWinOpen(\"" + (window["G_WEB"] == "true" ? "PGAM0261I" : "IPAM0261I") + "\", \"" + orgErrorCode + "\", \"" + serviceId + "\", false);'>"+common_cfGetMessage("I0529")+"</a></span>";
    }
    if (subErrorCode == '06697' || subErrorCode == '96697') {
        err_HTML += "        <span class='btn2'><a href='javascript:closeErrorLayerWinOpen(\"" + (window["G_WEB"] == "true" ? "PGAM0491R" : "IPAM0491R") + "\", \"" + orgErrorCode + "\", \"" + serviceId + "\", false);'>"+common_cfGetMessage("I0528")+"</a></span>";
        err_HTML += "        <span class='btn2'><a href='javascript:closeErrorLayerWinOpen(\"" + (window["G_WEB"] == "true" ? "PGAM0261I" : "IPAM0261I") + "\", \"" + orgErrorCode + "\", \"" + serviceId + "\", false);'>"+common_cfGetMessage("I0530")+"</a></span>";
    }
    if (subErrorCode == '96698') {
        err_HTML += "        <span class='btn2'><a href='javascript:closeErrorLayerWinOpen(\"" + "IPAM0401I" + "\", \"" + orgErrorCode + "\", \"" + serviceId + "\", false);'>"+common_cfGetMessage("I0655")+"</a></span>";
    }

    if(errorCode == 'MCPR98019'){
        err_HTML += "        <span class='btn1'><a id='btnPinCertLoginExit' href='#none'>로그아웃</a></span>";
    }

    err_HTML += "        </div>";
    err_HTML += "    </div>";
    err_HTML += "    <div class='pop_footer'>";
    err_HTML += "        <p class='pop_logo'>NH Card</p>";
    err_HTML += "        <button class='pop_close close_pop' data-tap='closeErrPopWinOpen();'>"+common_cfGetMessage("I0525")+"</button>";
    err_HTML += "    </div>";

    return err_HTML;
}

//M사이트 관련 에러레이어
function getMErrorHTML(errObject) {

    var errorCode = errObject.errorCode;
    var subErrorCode = "";
//    var guid = errObject.guid;
//    var detailView = "";
//    var rmsSvc = errObject.rmsSvc;
//    var apSvrNm = errObject.apSvrNm;
    var orgErrorCode = errObject.orgErrorCode;

//    if(errorCode && errorCode.length == 9){
//        subErrorCode = errorCode.substring(5);
    if(errorCode){

    	//TODO 특정 에러 코드일 경우 메세지 변경하여 출력
    	if(errorCode == "WFWF90601"){
    		errObject.errMsg = "일시적인 지연이 발생하여 서비스가 중단되었습니다.<br/>잠시 뒤 다시 이용해 주십시오.";
    	}

    	subErrorCode = errorCode.substring(errorCode.length - 5);
    } else {
    	subErrorCode = errorCode;
    }

    //LIC에러 처리
    if ( ( "LIC_7090" == orgErrorCode ) ||
         ( "LIC_7091" == orgErrorCode ) ||
         ( "LIC_7092" == orgErrorCode ) ||
         ( "LIC_7093" == orgErrorCode ) ||
         ( "LIC_7094" == orgErrorCode ) ||
         ( "LIC_7095" == orgErrorCode ) ||
         ( "LIC_7096" == orgErrorCode ) ||
         ( "LIC_7097" == orgErrorCode ) ||
         ( "LIC_7098" == orgErrorCode ) ) {
//        subErrorCode = orgErrorCode;
        subErrorCode = orgErrorCode.substring(orgErrorCode.length - 5);
    }

    var message = "";

    if( (errObject.errMsg == undefined || errObject.errMsg == 'undefined' || errObject.errMsg == null || errObject.errMsg == 'null')
        && (subErrorCode == '') && (errObject.errSvrInfo == undefined || errObject.errSvrInfo == 'undefined' || errObject.errSvrInfo == null || errObject.errSvrInfo == 'null')){

//        checkFailYn = "Y";
//        message = common_cfGetMessage("I0541");
        message = "일시적인 지연이 발생하여 서비스가 중단되었습니다.<br/>잠시 뒤 다시 이용해 주십시오.";
    }else{
        message = errObject.errMsg;
    }

    var err_HTML = "";
    err_HTML += "    <div class='pop_header' data-dialog-movecursor='true'>";
//    err_HTML += "        <h1 class='h1_pop'>안내메시지</h1>";
    err_HTML += "    </div>";
    err_HTML += "    <div class='con_wrap'>";
    err_HTML += "        <div class='error_wrap'>";
//    err_HTML += "            <p class='point2'>이용에 불편을 드려 죄송합니다.</p>";
    err_HTML += "            <p class='point2'>"+message+"</p>";
//    if(checkFailYn == "N"){
//        err_HTML += "            <p class='mgt5 point2'>안내코드 : "+subErrorCode+","+ errObject.errSvrInfo + "" + apSvrNm +"</p>";
//        err_HTML += "            <p class='mgt5 point2'>안내코드 : "+subErrorCode+"</p>";
//        err_HTML += "            <p class='mgt5 point2' >안내코드 : "+subErrorCode+"</p>";
        err_HTML += "            <p class='mgt5 point2' style='color: red;'>["+subErrorCode+"]</p>";
//        err_HTML += "            <div class='btn_wrap mgt15'>";
//        err_HTML += "                <a href='#' onClick='viewMDetailErr();' class='btn1_1'><span>상세안내코드/GID보기취소</span></a>";
//        err_HTML += "            </div>";
//        err_HTML += "            <div id='view_code' style='display:none;'><br />" + detailView + "</div>";
//    }
    err_HTML += "        </div>";
//    err_HTML += "        <p class='mgt10'>자세한 사항은 <strong>농협 고객행복센터"+phonNumber+"</strong>에 문의하시기 바랍니다.</p>";
    err_HTML += "    </div>";
//    err_HTML += "    <div class='btn_wrap btn_dozen'>";
//    err_HTML += "        <a href='javascript:closeMErrorLayer(\"" +returnServiceId+ "\", \"" + orgErrorCode + "\", \"" + serviceId + "\");' class='btn_blue'><span>닫기</span></a>";
//    err_HTML += "    </div>";

//    err_HTML += "    <div class='pop_footer'>";
//    err_HTML += "        <button class='pop_close close_pop' data-tap='closeMErrPop();'>현재 창 닫기</button>";
//    err_HTML += "    </div>";

    return err_HTML;
}

/*
function open_layer_html(txt, divObj, width, height, xpos, ypos) {

    // 현재 포커스 저장
    if (common_FOCUS_LAYER_ID == null) {
        common_FOCUS_LAYER_ID = $('*:focus');
    }

    var inner_html_txt = txt;
    var obj = document.getElementById(divObj);

    if(obj != null && obj != undefined) {
        obj.innerHTML = inner_html_txt;
    }

    $('#layerDiv_errPop').open();
}
*/

function open_m_layer_html(txt, divObj, width, height, xpos, ypos) {

    // 현재 포커스 저장
    if (common_FOCUS_LAYER_ID == null) {
        common_FOCUS_LAYER_ID = $('*:focus');
    }

    var inner_html_txt = txt;
    var obj = document.getElementById(divObj);

    if(obj != null && obj != undefined) {
        obj.innerHTML = inner_html_txt;
    }

    $('#layerDiv_mErrPop').open();
}

function open_layer_htmlWinOpen(txt, divObj, width, height, xpos, ypos) {

    // 현재 포커스 저장
    if (common_FOCUS_LAYER_ID == null) {
        common_FOCUS_LAYER_ID = $('*:focus');
    }

    var inner_html_txt = txt;
    var obj = document.getElementById(divObj);

    if(obj != null && obj != undefined) {
        obj.innerHTML = inner_html_txt;
    }

    $('#layerDiv_errPop_winOpen').open();
}

function viewDetailErr(){

    if($(".mcode").css("display") != "block"){
        $(".mcode").show();
    }else{
        $(".mcode").hide();
    }
    return false;

}

function viewMDetailErr(){

    if($("#view_code").css("display") != "block"){
        $("#view_code").show();
    }else{
        $("#view_code").hide();
    }
    return false;

}

function closeErrPop() {
	$('.nh-dialog-mask').css("display", "none");
	$("html, body").css({'overflow' : 'auto' , 'height' : '100%'});
	$(window).on("scroll mousewheel");
    $('#layerDiv_errPop').close();
    $('#layerDiv_errPop').empty();

//    $('#div[id^="layerDiv_errPop"]').close();
//    $('#div[id^="layerDiv_errPop" ]').empty();

    // 저장된 포커스로 이동
    if (common_FOCUS_LAYER_ID != null) {
        common_FOCUS_LAYER_ID.focus();
        common_FOCUS_LAYER_ID = null;
    }
}

function closeMErrPop() {
    $('.mask').css("display", "none");
    $('#layerDiv_mErrPop').close();
    $('#layerDiv_mErrPop').empty();

    // 저장된 포커스로 이동
    if (common_FOCUS_LAYER_ID != null) {
        common_FOCUS_LAYER_ID.focus();
        common_FOCUS_LAYER_ID = null;
    }
}

function closeMErrorLayer(returnServiceId, orgErrorCode, cuServiceId){

    var subServiceId = "";

    if(cuServiceId != undefined && cuServiceId != 'undefined' && cuServiceId != null && cuServiceId != 'null' && cuServiceId.length > 4){
        subServiceId = cuServiceId.substring(0,4);
    }

    var serviceId = "";

    //로그인관련 에러라면 로그인 페이지로 이동.
    if ('NA11005' == orgErrorCode || 'NA11007' == orgErrorCode || 'NA11009' == orgErrorCode
            || 'NA11010' == orgErrorCode || "NC12002" == orgErrorCode
            || 'NW11101' == orgErrorCode || "NW11102" == orgErrorCode
            || "NW11105" == orgErrorCode) {

        serviceId = "PMCNA100R"; // 뱅킹로그인
    }

    //프레임웍에 세팅된 return service가 있으면
    if(returnServiceId.indexOf(".view") > 0 || returnServiceId.indexOf(".cmd") > 0 || returnServiceId.indexOf(".frag") > 0){
         var position = returnServiceId.indexOf('.');
         serviceId = returnServiceId.substring(0,position);
    }else{
        if(returnServiceId != "null") serviceId = returnServiceId;
    }

    var existYn = "N";
    //serviceId가 없으면 cn_return.js에 등록된 서비스로 이동.
//    for(var i=0; i<targetSvrid.length; i++){
//        for(var j=0; j<targetSvrid[i].length;j++){
//            if (cuServiceId.indexOf(targetSvrid[i][j], 0) != -1) {
//                serviceId = rtnSrvId[i];
//                //alert("있다. i =["+i+"]");
//                existYn = "Y";
//                break;
//            }
//        }
//        if(existYn == "Y")    break;
//        //alert(rtnSrvId[i]);
//    }

    // LIC에러 발생한 경우
    if ( 'LIC_7090' == orgErrorCode ||
         'LIC_7091' == orgErrorCode ||
         'LIC_7092' == orgErrorCode ||
         'LIC_7093' == orgErrorCode ||
         'LIC_7094' == orgErrorCode ||
         'LIC_7095' == orgErrorCode ||
         'LIC_7096' == orgErrorCode ||
         'LIC_7097' == orgErrorCode ||
         'LIC_7098' == orgErrorCode )  {
        closeMErrPop();
        document.location.href = "/";
    }

    // 파트너뱅킹 초기 접속 에러
    if ( 'WSCN91001' == orgErrorCode ||
         'WSCN91002' == orgErrorCode ||
         'WSCN91003' == orgErrorCode ||
         'WSCN91004' == orgErrorCode ||
         'WSCN91005' == orgErrorCode ||
         'WSCN91006' == orgErrorCode ||
         'WSCN91007' == orgErrorCode ) {
        window.close();
    }

    //serviceId가 없으면 레이어 팝업을 닫고 있으면 navigate한다.
    if(serviceId != ""){
        closeMErrPop();
        navigateIP(serviceId);    // 개인뱅킹,파트너뱅킹 서비스 공유를 위해 navigateIP로 변경
    }else{
        closeMErrPop();
    }
}

function closeErrPopWinOpen() {
    $('#layerDiv_errPop_winOpen').close();
    $('#layerDiv_errPop_winOpen').empty();

    // 저장된 포커스로 이동
    if (common_FOCUS_LAYER_ID != null) {
        common_FOCUS_LAYER_ID.focus();
        common_FOCUS_LAYER_ID = null;
    }
}

function closeErrorLayerWinOpen(returnServiceId, orgErrorCode, cuServiceId, isGlobal){

    if (isGlobal == null || isGlobal == undefined) {
        isGlobal = true;
    }

    var subServiceId = "";

    if(cuServiceId != undefined && cuServiceId != 'undefined' && cuServiceId != null && cuServiceId != 'null' && cuServiceId.length > 4){
        subServiceId = cuServiceId.substring(0,4);
    }

    var serviceId = "";

    //로그인관련 에러라면 로그인 페이지로 이동.
    if ('NA11005' == orgErrorCode || 'NA11007' == orgErrorCode || 'NA11009' == orgErrorCode
            || 'NA11010' == orgErrorCode || "NC12002" == orgErrorCode
            || 'NW11101' == orgErrorCode || "NW11102" == orgErrorCode
            || "NW11105" == orgErrorCode || 'REG_LOGIN' == orgErrorCode) {

        closeErrPopWinOpen();
    }

    //프레임웍에 세팅된 return service가 있으면
    if(returnServiceId.indexOf(".view") > 0 || returnServiceId.indexOf(".cmd") > 0 || returnServiceId.indexOf(".frag") > 0){
         var position = returnServiceId.indexOf('.');
         serviceId = returnServiceId.substring(0,position);
    }else{
        if(returnServiceId != "null") {
            serviceId = returnServiceId;
        }
    }

    var existYn = "N";
    //serviceId가 없으면 cn_return.js에 등록된 서비스로 이동.
//    if(targetSvrid){
//	    for(var i=0; i<targetSvrid.length; i++){
//	        for(var j=0; j<targetSvrid[i].length;j++){
//	            if (cuServiceId.indexOf(targetSvrid[i][j], 0) != -1) {
//	                serviceId = rtnSrvId[i];
//	                //alert("있다. i =["+i+"]");
//	                existYn = "Y";
//	                break;
//	            }
//	        }
//	        if(existYn == "Y")    break;
	        //alert(rtnSrvId[i]);
//	    }
//    }


    //serviceId가 없으면 레이어 팝업을 닫고 있으면 navigate한다.
    if(serviceId != ""){
        closeErrPopWinOpen();
        if (returnServiceId.indexOf(".thtml") > 0) {
            common_navigateToContent(serviceId,null); // 컨텐츠 페이지로 바로가기, by 정영탁
        } else if (isGlobal) {
            navigateIP(serviceId);    // 개인뱅킹,파트너뱅킹 서비스 공유를 위해 navigateIP로 변경, by 정영탁
        } else {
            navigate(serviceId);
        }
    }else{
        closeErrPopWinOpen();
    }
}

function common_cfUserDefinedErrorPop(data, xhr) {

    var _errorObject = data.COMMON_HEAD;
    var _imoErrorObject = '';
    var _errorCode = _errorObject.CODE;
    var _subErrorCode = _errorObject.SUBERRORCODE;
    var _errSvrInfo = _errorObject.ERRORSERVERINFO;
    var _errorMsg = '';
    var _orgErrorCode = _errorObject.CODE;
    var _errPrgName = '';
    var _errPrgLine = '';
    var _guid = '';
    var _rmsSvc = '';
    var _preServiceId = '';
    var _returnServiceId = '';
    var _serviceId = '';
    var _errFlnm = '';
    var _errTitle = '';

    if ('NH_IMO_ERR' == _errorCode) {
        _imoErrorObject = JSON.parse(_errorObject.MESSAGE);
        _errorCode = _imoErrorObject.CHAN_ERR_C;
        _errorMsg = _imoErrorObject.CUS_MSG;
        _orgErrorCode = _imoErrorObject.STD_ERR_C;
        _errPrgName = _imoErrorObject.ERR_SVCNM;
        _errPrgLine = _imoErrorObject.PGM_LINE_NO;
        _guid = _imoErrorObject.GID;
        _rmsSvc = _imoErrorObject.IMO_ID;
        _preServiceId = _imoErrorObject.PREVIOUS_SERVICE_ID;
        _returnServiceId = _imoErrorObject.RETURN_SERVICE_ID;
        _serviceId = _imoErrorObject.SERVICE;
        _errFlnm = _imoErrorObject.ERR_FLNM;
        _errTitle = _imoErrorObject.STD_ERR_MSG_CNTN;
    } else {
        _errorMsg = _errorObject.MESSAGE;
        _errPrgName = _errorObject.ERRPRGNAME;
        _errPrgLine = _errorObject.ERRPRGLINE;
    }
    
    //바우처용 에러안내팝업 호출 servicd id
    if(_serviceId == undefined || _serviceId == "") {
    	_serviceId = _errorObject.SERVICE;
    }
    
    var errObject = {
        errMsg : _errorMsg
        , errorCode : _errorCode
        , subErrorCode : _subErrorCode
        , errSvrInfo : _errSvrInfo
        , orgErrorCode : _orgErrorCode
        , errPrgName : _errPrgName
        , errPrgLine : parseInt(_errPrgLine)
        , guid : _guid
        , rmsSvc : _rmsSvc
        , preServiceId : _preServiceId
        , returnServiceId : _returnServiceId
        , serviceId : _serviceId
        , errFlnm : _errFlnm
        , errTitle : _errTitle
    };

    showErrorLayerPop(errObject);
}

/**
 * 에러상세메시지 팝업
 *
 */
function common_errorCodeMsg(errorCode){
    // 현재 포커스 저장
    if (common_FOCUS_LAYER_ID == null) {
        common_FOCUS_LAYER_ID = $('*:focus');
    }

    if(errorCode.length == 4){
        ec = "EACO0" + errorCode;
    }else if(errorCode.length == 5){
        ec = "EACO" + errorCode;
    }else{
        ec = errorCode;
    };
    $('#layerDiv_errPop').common_movePage('IPCNA299P',{"errorCode" : ec}).done(function(){
        $('#layerDiv_errPop').find('.close_pop, .pop_close').tap( closeErrPop );
        $('#layerDiv_errPop').open({movable : true});
    });
}

/**
 * Content thtml 화면으로 navigate 시 사용
 * @param url
 * @param param
 */
function common_navigateToContent(url, param, option){

    var urlPrefix = "/servlet/content";
    var result_url = '';

    var form = $('<form class="' + 'alopexhiddenform' + '" style="display:none;"></form>').appendTo('head');
    form.attr('method', 'POST');

    if(option != null && option.hasOwnProperty('domainCode')){
        result_url = common_cfGetDomain(option.domainCode) + urlPrefix + url;
    }else{
        result_url = urlPrefix + url;
    }

    form.attr('action', result_url);

    if(option != null && option.hasOwnProperty('target')){
        form.attr('target', option.target);
    }

    for (var prop in param) {
         var item = param[prop];
         if($.isArray(item)) {
             $.each(item, function(i,value) {
                 $('<input type="hidden" name="' + prop + '"/>').val(value).appendTo(form);
             });
         } else {
             $('<input type="hidden" name="' + prop + '"/>').val(item).appendTo(form);
         }
    }

    //복수 탭 로그인 방지
    if(window["ISINDEX"] == "true"){
        $('<input type="hidden" name="sscc"/>').val(window.name).appendTo(form);
    }

    //SESSION_TOKEN 값 추가
    if(window["SESSION_TOKEN"] != undefined && window["SESSION_TOKEN"] != null){
        $('<input type="hidden" name="SESSION_TOKEN"/>').val(window["SESSION_TOKEN"]).appendTo(form);
    }

    //index 페이지일 경우 deviceType parameter 추가
    if(window["INDEX_TYPE"] != undefined){
        var deviceType = common_cfGetDeviceType();

        if(deviceType == "TABLET" && window["INDEX_TYPE"] == "PC"){
            deviceType = "NORMAL";
        }else if(deviceType == "TABLET" && window["INDEX_TYPE"] == "MOBILE"){
            deviceType = "MOBILE";
        }

        $('<input type="hidden" name="deviceType"/>').val(deviceType)
        .appendTo(form);
    }

    form[0].submit();
}

/**
 * Global Content thtml 화면으로 navigate 시 사용
 * @param url
 * @param param
 */
function common_navigateToContent_Global(url, param, option){

    var urlPrefix = "/servlet/content";
    var result_url = '';

    var form = $('<form class="' + 'alopexhiddenform' + '" style="display:none;"></form>').appendTo('head');
    form.attr('method', 'POST');

    if(option != null && option.hasOwnProperty('domainCode')){
        result_url = common_cfGetDomain(option.domainCode) + urlPrefix + url;
    }else{
        result_url = urlPrefix + url;
    }

    form.attr('action', result_url + "?fwglobal=true");

    if(option != null && option.hasOwnProperty('target')){
        form.attr('target', option.target);
    }

    for (var prop in param) {
        var item = param[prop];
        if($.isArray(item)) {
            $.each(item, function(i,value) {
                $('<input type="hidden" name="' + prop + '"/>').val(value).appendTo(form);
            });
        } else {
            $('<input type="hidden" name="' + prop + '"/>').val(item).appendTo(form);
        }
    }

    $('<input type="hidden" name="fwglobal"/>').val("true").appendTo(form);

    //복수 탭 로그인 방지
    if(window["ISINDEX"] == "true"){
        $('<input type="hidden" name="sscc"/>').val(window.name).appendTo(form);
    }

    //SESSION_TOKEN 값 추가
    if(window["SESSION_TOKEN"] != undefined && window["SESSION_TOKEN"] != null){
        $('<input type="hidden" name="SESSION_TOKEN"/>').val(window["SESSION_TOKEN"]).appendTo(form);
    }

    //index 페이지일 경우 deviceType parameter 추가
    if(window["INDEX_TYPE"] != undefined){
        var deviceType = common_cfGetDeviceType();

        if(deviceType == "TABLET" && window["INDEX_TYPE"] == "PC"){
            deviceType = "NORMAL";
        }else if(deviceType == "TABLET" && window["INDEX_TYPE"] == "MOBILE"){
            deviceType = "MOBILE";
        }

        $('<input type="hidden" name="deviceType"/>').val(deviceType)
        .appendTo(form);
    }

    form[0].submit();
}

/**
 * 로딩바 element 동적 생성.
 *
 */
function common_makeLoadingBar(){
    if(window["M_WEB"] != undefined){
        document.write("<div id='INGSHOW' style='position:fixed; top:0px; left:0px; z-index:100001; display:none; border;0px solid #000; outline:0;' class='loadingbar'>");
        document.write("<img src='/images/MW_IP/common/loading_bar.gif' width='240' height='150' alt='고객님께서 요청하신 내용을 처리중입니다. 잠시만 기다리세요'>");
    }else if(window["LOCALE_INFO"] != "ko_KR"){
        document.write("<div id='INGSHOW' style='position:fixed; width:292px; height:66px; top:0px; left:0px; z-index:100001; display:none; border;0px solid #000; outline:0;' class='loadingbar'>");
        document.write("<img src='/images/CN/loading_bar_eng.gif' alt='Please wait while we are processing your request' />");
    }else{
        document.write("<div id='INGSHOW' style='position:fixed; width:292px; height:66px; top:0px; left:0px; z-index:100001; display:none; border;0px solid #000; outline:0;' class='loadingbar'>");
        document.write("<img src='/images/CN/loading_bar.gif' alt='안전하고 편리한 농협인터넷뱅킹. 고객님께서 요청하신 내용을 처리중입니다. 잠시만 기다리세요' />");
    }
    document.write("</div>");
    document.write('<div id="SHOWBLOCK" style="width:100%;height:100%;overflow: hidden; display: none; z-index: 100000; position: fixed; left: 0px; top: 0px; opacity: 0.5; background:white; filter:progid:DXImageTransform.Microsoft.Alpha(Opacity=50)" class="loadingblocker" ></div>');
}

/**
 * 로딩바 show.
 *
 * _progressCount : show된 Dialog 개수 count
 */
var _progressCount = 0;

function common_showInitLodingBar(){

    if(_progressCount == 0){
        var INGSHOW = document.getElementById("INGSHOW");
        var SHOWBLOCK = document.getElementById("SHOWBLOCK");
        try {
            if(typeof(INGSHOW) != 'undefined') {
                //document.documentElement.style.overflow = 'hidden';
                //INGSHOW.style.display = 'block';
                SHOWBLOCK.style.display = 'block';

                common_setPositionLoadingBar();

                $(window).bind('resize', common_setPositionLoadingBar);
            }
        } catch (e){}

    }

    _progressCount++;
}

/**
 * 로딩바 close
 *
 */
function common_closeInitLodingBar(){
    _progressCount--;

    if(_progressCount <= 0){
        try{
            _progressCount = 0;
            /*if(window.afDialogNumber == 0 || window.afDialogNumber == undefined){
                document.documentElement.style.overflow = '';
            }*/
            document.getElementById("INGSHOW").style.display = "none";
            document.getElementById("SHOWBLOCK").style.display = "none";

            $(window).unbind('resize', common_setPositionLoadingBar);

        } catch (e){}
    }
}

function common_setPositionLoadingBar(){

    var windowCenterTop = ($(window).height() / 2);
    var windowCenterLeft = 0;

    if(window.innerWidth != undefined){
        windowCenterLeft = (window.innerWidth /  2);
    }else{
        windowCenterLeft = ($(document).width() /  2);
    }

    $('#INGSHOW').css( {'top' : (windowCenterTop - $('#INGSHOW').height()/2) , 'left' : (windowCenterLeft - $('#INGSHOW').width()/2)} ).css({'display' : 'block'});
}

/**
 * 보안필드(E2E, 가상키보드)초기화.
 *
 */
function common_cfResetSecField(arrayField){
    var cnt = arrayField.length;
    for(var i=0; i<cnt; i++){
        var inputId = arrayField[i];
        //가상키보드 초기화.
        var trasnkeyObj = transkey["Tk_" + inputId];
        if (trasnkeyObj) {
            trasnkeyObj.clear();
        }
        //물리키보드 초기화.(value만 초기화)
        $("#" + inputId).val();

        /*##########################################################*/
        /* non-activeX 대응개발 추가*/
        if(typeof TK_Clear == "function") TK_Clear(document.getElementById(inputId).form.name, document.getElementById(inputId).name);
        /*##########################################################*/
    }
}

/**
 * 자주사용하는입금계좌, 고객의농협계좌, 최근입금계좌등과 같이 layer popup을 이용하여 보안필드에 값을 setting할경우 복호화 대상에서 제외처리.
 */
function common_cfSetDirectField(id) {
    try{
        if($("#"+id).val().length > 0 && $("input[name=E2E_"+id+"]").val() > 0 && $("#"+id).attr("type")=="password"){
            if($("#"+id).val() !== "0000" ) {
                $("#Tk_" + id + "_check").val('direct');
            }
        }else{
            $("#Tk_" + id + "_check").val('direct');
        }
    }catch(e){}
}

/**
 * 자주사용하는입금계좌, 고객의농협계좌, 최근입금계좌등과 같이 layer popup을 이용하여 보안필드에 값을 setting 후 다시 물리키보드로 값을 입력시.
 */
function common_cfSetE2EField(id) {
    if(window.navigator.userAgent.indexOf("Windows") == -1) {  //윈도우가 아닌경우.
        $("#Tk_" + id + "_check").val('transkey');
    }else{
        if(window["M_WEB"] != undefined){
            $("#Tk_" + id + "_check").val('transkey');
        }else{
            var inputObj = document.getElementById("Tk_" + id + "_checkbox");

            if(inputObj != undefined && inputObj != null){
                reClickCheckbox (id);
            }else if(isTranskeyArrayCheck(id)){
                //그룹으로 묶인 가상키패드
                $("#Tk_" + id + "_check").val('transkey');
            }else{
                $("#Tk_" + id + "_check").val('e2e');
            }
        }
    }
}

/**
 * 자주사용하는입금계좌, 고객의농협계좌, 최근입금계좌등과 같이 layer popup을 이용하여 보안필드에 값을 setting 후 다시 물리키보드/가상키보드로 값을 입력시. ( 그룹ID )
 */
function common_cfSetE2EGroupField(groupId) {
    recheckTranskeyGroup (groupId);
}

/**
 * <pre>
 * 안전증명 ( CABSOFT 솔루션연계 )
 * </pre>
 */
function common_cfSmartCert() {

    var _service_ID = "IpCnB001S.act";

    // 글로벌 적용
    if(window["G_WEB"] == "true"){
        _service_ID = "PGCNB010S.view";
    }

    // 리포트 솔루션 팝업 띄움
    common_cfOpenWinPop(_service_ID,
                        "pop_SmartCert",
                        "",
                        [ "1000", "800", "0", "0", "no", "no", "no", "no", "no", "no" ]);
}

/**
 * <pre>
 * 디바이스타입 파악을 위한 변수
 * </pre>
 */
var common_KNOWN_MOBILE_USER_AGENT_PREFIXES = [ "w3c ", "w3c-", "acs-", "alav",
      "alca", "amoi", "audi", "avan", "benq", "bird", "blac", "blaz", "brew",
      "cell", "cldc", "cmd-", "dang", "doco", "eric", "hipt", "htc_", "inno",
      "ipaq", "ipod", "jigs", "kddi", "keji", "leno", "lg-c", "lg-d", "lg-g",
      "lge-", "lg/u", "maui", "maxo", "midp", "mits", "mmef", "mobi", "mot-",
      "moto", "mwbp", "nec-", "newt", "noki", "palm", "pana", "pant", "phil",
      "play", "port", "prox", "qwap", "sage", "sams", "sany", "sch-", "sec-",
      "send", "seri", "sgh-", "shar", "sie-", "siem", "smal", "smar", "sony",
      "sph-", "symb", "t-mo", "teli", "tim-", "tosh", "tsm-", "upg1", "upsi",
      "vk-v", "voda", "wap-", "wapa", "wapi", "wapp", "wapr", "webc", "winw",
      "winw", "xda ", "xda-" ];
var common_KNOWN_MOBILE_USER_AGENT_KEYWORDS = [ "blackberry", "webos", "ipod",
      "lge vx", "midp", "maemo", "mmp", "netfront", "hiptop", "nintendo DS",
      "novarra", "openweb", "opera mobi", "opera mini", "palm", "psp",
      "phone", "smartphone", "symbian", "up.browser", "up.link", "wap",
      "windows ce", "naver(inapp;", "kakaotalk" ];
var common_KNOWN_TABLET_USER_AGENT_KEYWORDS = [ "ipad", "playbook", "hp-tablet" ];

/**
 * <pre>
 * 디바이스타입 파악
 * </pre>
 * @returns NORMAL(PC), MOBILE, TABLET
 */
function common_cfGetDeviceType() {
    var userAgent = navigator.userAgent.toLowerCase();
    if (userAgent != null && userAgent.length > 0) {
        var tUserAgent = userAgent.slice(0, 4);

        for ( var i = 0; i < common_KNOWN_MOBILE_USER_AGENT_PREFIXES.length; i++) {
            if (tUserAgent.indexOf(common_KNOWN_MOBILE_USER_AGENT_PREFIXES[i], 0) != -1) {
                return 'MOBILE';
            }
        }
    }

    for ( var i = 0; i < common_KNOWN_MOBILE_USER_AGENT_KEYWORDS.length; i++) {
        if (userAgent.indexOf(common_KNOWN_MOBILE_USER_AGENT_KEYWORDS[i], 0) != -1) {
            return 'MOBILE';
        }
    }

    for ( var ii = 0; ii < common_KNOWN_TABLET_USER_AGENT_KEYWORDS.length; ii++) {
        if (userAgent.indexOf(common_KNOWN_TABLET_USER_AGENT_KEYWORDS[ii], 0) != -1) {
            return 'TABLET';
        }
    }

    if (userAgent.indexOf("android") != -1 && userAgent.indexOf("mobile") != -1) {
        return 'MOBILE';
    } else if (userAgent.indexOf("android") != -1
            && userAgent.indexOf("mobile") == -1) {
        return 'TABLET';
    }

    // 20141110, by extended
    // MOBILE, TABLET이  아니면서 SuperSign 사용 여부 확인
    if(document.getElementById("BTW_SUPER_SIGN") != null) {
        return 'SMART_AUTH';
    }

    return 'NORMAL';
}


/**
 * <pre>
 * 디바이스타입 구분
 * </pre>
 * @returns deviceType (android, iphone, etc...)
 */
function common_GetDeviceType() {
    var deviceTypeLocal = "";
    var userAgent = navigator.userAgent.toLowerCase();

    if(userAgent.match(DEVICE_ANDROID)){
        deviceTypeLocal = DEVICE_ANDROID;
    }else if(userAgent.match(DEVICE_IPHONE)){
        deviceTypeLocal = DEVICE_IPHONE;
    }else{
        deviceTypeLocal = DEVICE_ETC;
    }
    return deviceTypeLocal ;
}


/**
 * <pre>
 * 모바일디바이스타입 구분
 * </pre>
 * @returns mobileTypeFromLocal (fromAndroid, fromIphone)
 * 앱에서 셋팅해준 값으로 구분한다.
 */
function common_GetMobileDeviceType() {
    var userAgent = navigator.userAgent.toLowerCase();

    var mobileTypeFromLocal = "";

    if(userAgent.match(FROM_ANDROID)){
        mobileTypeFromLocal = FROM_ANDROID;
    }else if(userAgent.match(FROM_IPHONE)){
        mobileTypeFromLocal = FROM_IPHONE;
    }

    return mobileTypeFromLocal ;
}


/**
 * <pre>
 * 글로벌뱅킹용 코드에 따른 언어별 메시지 가져오기 (에러메시지,정보메시지)
 * </pre>
 * @param 메시지코드
 * @returns 언어별 코드매핑 메시지
 */
function common_cfGetMessage(code) {
    try {
        var msgVal = msgCode[arguments[0]];
        for(var idx = 1; idx < arguments.length; idx++) {
            msgVal = msgVal.replace(/%d/i, arguments[idx]);
        }
        return msgVal;
    } catch(e) {
      return "";
    }
}

/**
 * <pre>
 * 외부 link Page에서 서비스 호출 시 중계페이지에서 외부 link Page에서 보낸 Parameters를 parsing
 * </pre>
 * @returns (JSON) 외부 link Page의 parameters
 */
function common_cfGetBroadCastParam(){

    var param ={};
    var varName = '';
    var value = '';
    //var nowAddress = decodeURIComponent(location.href);
    var nowAddress = location.href;
    var parameters = '';

    if(nowAddress.indexOf('?') != -1){
        parameters = (nowAddress.slice(nowAddress.indexOf('?')+1,nowAddress.length)).split('&');
        for(var i = 0 ; i < parameters.length ; i++)  {
        	var paramsIndex = parameters[i].indexOf('=');
        	varName = parameters[i].substring(0,paramsIndex);
        	value = parameters[i].substring(paramsIndex + 1);
        	param[varName] = value;

        	/*
            varName = parameters[i].split('=')[0];
            value = decodeURIComponent(parameters[i].split('=')[1]);
            param[varName] = value;
            */
        }
    }

    param["deviceType"] = common_cfGetDeviceType();
    param["proxyPage"] = "Y";

    return param;
}

/**
 * <pre>
 * 외부 link Page에서 서비스 호출 시 중계페이지에서 외부 link Page에서 보낸 Parameters를 parsing
 * </pre>
 * @returns (JSON) 외부 link Page의 parameters
 */

function common_cfGetBroadCastParamHTML(){

	var param ={};
	var varName = '';
	var value = '';
	var nowAddress = decodeURIComponent(location.href);
	var parameters = '';
	var deviceType = common_cfGetDeviceType();
	if(nowAddress.indexOf('?') != -1){
		parameters = (nowAddress.slice(nowAddress.indexOf('?')+1,nowAddress.length)).split('&');
		for(var i = 0 ; i < parameters.length ; i++)  {
			varName = parameters[i].split('=')[0];

			varName = varName.toUpperCase();

			value = parameters[i].split('=')[1];

			if(varName == "SERVICE_ID"){

				if(value == "MCCC6010R"){
					param[varName]="McCc4060I";
				}else if(value == "MCCC2119P"){
					param[varName]="McCc2119R";
				}else if(value == "IPCC2119P"){
					param[varName]="IpCc2119R";
				} else if(value == "IPCC2021R"){
					if(deviceType == "MOBILE") {
						param[varName]="McCc1010I";
					} else {
						param[varName] =  value.substring(0,1) + value.substring(1,2).toLowerCase() + value.substring(2,3)
						+  value.substring(3,4).toLowerCase()  + value.substring(4,10);
					}
				} else if(value == "MCCC2021R"){
					param[varName]="McCc1010I";
				} else if(value.toUpperCase() == "IPCI2002R" || value.toUpperCase() == "MCCI3020R" || value.toUpperCase() == "SCCI3020I") {
					if(deviceType == "MOBILE") {
						param[varName] = "ScCi3020I";
					} else {
						param[varName] = "IpCi2002R";
					}
				} else if(value == "IPCI9011R") {
					if(deviceType == "MOBILE") {
						param[varName] = "Mc" + value.substring(2,3)
						+  value.substring(3,4).toLowerCase()  + value.substring(4,10);;
					} else {
						param[varName] = value.substring(0,1) + value.substring(1,2).toLowerCase() + value.substring(2,3)
						+  value.substring(3,4).toLowerCase()  + value.substring(4,10);
					}
				} else {
					if(deviceType =="MOBILE"){
						param[varName] =  "M" + "c" + value.substring(2,3)
						+  value.substring(3,4).toLowerCase()  + value.substring(4,10);
					}else{
						param[varName] =  value.substring(0,1) + value.substring(1,2).toLowerCase() + value.substring(2,3)
						+  value.substring(3,4).toLowerCase()  + value.substring(4,10);
					}
				}

			}else if(varName == "EVENT_NO"){
				param["EVT_CRT_SQNO"] =  value;
				param["evt_crt_sqno"] =  value;
			}else if(varName == "BBRD_NO") {
				param["BBRD_SQNO"] =  value;
				param["bbrd_sqno"] =  value;
			}else if(varName == "WRS_TUP_C"){
				param["WRS_TUP_C"] =  value;
				param["wrs_tup_c"] =  value;
			}else if(varName == "CD_WRS_SQNO"){
				param["CD_WRS_SQNO"] =  value;
				param["cd_wrs_sqno"] =  value;
			}else if(varName == "IO_CD_MEMMEMNBR"){
				param["io_cd_memmemnbr"] =  value;
				param["e_io_cd_memmemnbr"] =  value;
			}else if(varName == "FROMSITE"){
				param["FromSite"] =  value;
			}else if(varName == "IO_CD_JHUCOD"){
				param["io_cd_jhucod"] =  value;
				param["IO_CD_JHUCOD"] =  value;
				param["WRS_TUP_C"] =  value;
				param["wrs_tup_c"] =  value;
				param["e_io_cd_jhucod"] =  value;
			}else if(varName == "ENC_OUT"){
				param["enc_out"] =  value;
			}else{
				param[varName] = value;
			}
		}
	}
	param["deviceType"] = common_cfGetDeviceType();
	param["proxyPage"] = "Y";
	return param;

}

/**
 * 전자서명값 특정 element에 넘기기
 * - 이니텍 crossweb.js SFCertFormProcess 커스터마이징
 */
var cfSFCertFormProcessInfo = [];
function common_cfSFCertFormProcess(elementID, ret, cbdata){
    var SF_RETURN_SIGN_INFO = get_shttp_filter(ret, "_shttp_client_signature_");
    if ( ( elementID != "undefined" && elementID != null && $.trim( elementID ) != '' ) && SF_RETURN_SIGN_INFO != "" ) {
        var tmpObj = {};
        tmpObj.elementID = elementID;
        tmpObj.cbdata = cbdata;
        cfSFCertFormProcessInfo.push(tmpObj);
        URLDecode(SF_RETURN_SIGN_INFO, "common_cfSFCertFormProcess_decCallback");
        return;
    }
}

function common_cfSFCertFormProcess_decCallback(result) {
    $("#" + cfSFCertFormProcessInfo[0].elementID).val(result);
    var cbdata = cfSFCertFormProcessInfo[0].cbdata;
    cfSFCertFormProcessInfo.splice(0, 1);
    if(cbdata) eval(cbdata.callback)(cbdata.url, cbdata.postdata, cbdata.result);
}

/**
* <pre>
* 이미지서버 파일(약관/서식)다운로드
*
* jsp에서 보낼 full 경로는 아래와 같습니다.
* NhOpModePropertyHelper.getProperty("FILE_DOWNLOAD_PATH") + /file/ebank/form/pdf/(20130430)nhmr1.pdf
* </pre>
*/

function common_getFileDownload(uri){
  var splitlist = uri.split(".");
  var filext = null;
  if(splitlist.length > 1)
      filext = splitlist[splitlist.length-1];

  if(filext != null && filext.toUpperCase() == "PDF")
  {
      window.open(encodeURI(uri + "?@_out_of_window"));
  }else{
    if(filext != null){
        document.location.href = encodeURI(uri);
    }
  }
}

/**
 * @param key : Domain 구분값(없을 경우 현재 위치한 Domain 설정)
 * key는 constant.js 참고
 * //개인뱅킹 - 카드간의 도메인 변경으로 인한 세션 아웃 방지 로직 추가(개인 WEB에만 적용됨)
 */
function common_cfGetDomain(key){

    var domain = '';
    var temp = '';
    var currentDomainCode = '';

    //개발계 및 검증계 여부
    if(common_cfIsDev()){
        if(common_cfIsDev() == "staging"){
            temp += 'STG_';
            currentDomainCode += 'STG_';
        }else{
            temp += 'DEV_';
            currentDomainCode += 'DEV_';
        }
    }

    temp += key;
    currentDomainCode += common_cfGetDomainCode();
    domain = DOMAINCODE[temp];

    if(domain == undefined || domain == null){
        domain = '/';
    }

    //개인뱅킹 - 카드간의 도메인 변경으로 인한 세션 아웃 방지(개인 WEB에만 적용됨)
    /*
    if(currentDomainCode == "IP00" || currentDomainCode == "CC00" || currentDomainCode == "IH00"){
        if(temp == "IP00" || temp == "CC00" || temp == "IH00"){
            domain = DOMAINCODE[currentDomainCode];
        }
    }
    */

    return domain;
}

function common_cfIsDev(){
    if (document.location.href.indexOf('https://dev.nonghyup.com') != '-1'
        || document.location.href.indexOf('http://16.24.112.') != '-1'
            || document.location.href.indexOf('https://localhost') != '-1'
            || document.location.href.indexOf('https://127.0.0.1') != '-1') {
        return true;
    }else {
        return false;
    }
}

/**
 * <pre>
 * 보안카드 입력시 숫자체크 및 자동 Focus 이동
 * </pre>
 * @returns
 */
function common_cfSecureCardInputHandler(){

    var check_auto_cursor;    // 자동커서 on/off 쿠키
    check_auto_cursor = util_cfGetCookie("security_card_auto_cursor");

    $("#io_ea_rsp_no1, #io_ea_rsp_no3").bind('focus', function (e){
        $(this).val("");
        var id = $(this).attr("id");
        TK_Clear(document.getElementById(id).form.name, id);
    });

    // shift + tab 이동
    $("#io_ea_rsp_no3").bind('keydown', function (e){
        if(e.shiftKey){
            var code = (e.keyCode ? e.keyCode : e.which);
            if(code == '9'){
                $(this).val("");
                var id = $(this).attr("id");
                TK_Clear(document.getElementById(id).form.name, id);
            }
        }
    });

    $("#io_ea_rsp_no1, #io_ea_rsp_no3").bind('keyup.custom', function (e){
        var value = $(this).val();
        var currentId = $(this)[0].id;

        // 숫자만 입력
        /*if(!/^\s*\d+\s*$/.test(value)){
            $(this).val("");
            return;
        }*/

        // 자동커서 기능 '사용' 일경우에만 자동 커서 이동
        if(check_auto_cursor != "n"){
            if(value.length == 2){
                nextId = "io_ea_rsp_no3";
                if(currentId != "io_ea_rsp_no3"){
                    $("#io_ea_rsp_no3").focus();
                }
            }
        }
    });
}

/**
 * 현재의 위치를 판단하여, 변환된 URL을 반환
 * (IP에서 접속하면 IP로 연결, WS에서 접속하면 WS로 연결)
 * @author 정영탁(SI303162)
 */
function common_cfGetCurrentGlobalPath(path) {
    if (path.length <= 2) {
        return path;
    }
    var _pathname = document.location.pathname;
    _pathname = _pathname.substring(_pathname.lastIndexOf('/') + 1, _pathname.length);
    var _firstPath = _pathname.substring(0,2);
    if (_firstPath == 'IP' || _firstPath == 'WS' || _firstPath == 'IH') {
        return (path.substring(0,2) == 'IP' ? _firstPath + path.substring(2, path.length) : path);
    } else {
        return path;
    }
}

/**
 * <pre>
 * 개인뱅킹+파트너뱅킹 공용 navigate
 * (IP에서 접속하면 IP로 연결, WS에서 접속하면 WS로 연결)
 * @author 정영탁(SI303162)
 * </pre>
 */
function navigateIP(path, param, option, loadto) {
//    return navigate(path/*common_cfGetCurrentGlobalPath(path)*/, param, option, loadto);
    return common_movePage(path/*common_cfGetCurrentGlobalPath(path)*/, param, option, loadto);
}

/**
 * <pre>
 * 개인뱅킹+파트너뱅킹 공용 httpSend
 * (IP에서 접속하면 IP로 연결, WS에서 접속하면 WS로 연결)
 * @author 정영탁(SI303162)
 * </pre>
 */
function httpSendIP(service, content, success, error, option) {
    return httpSend(service/*common_cfGetCurrentGlobalPath(service)*/, content, success, error, option);
}

/**
 * <pre>
 * 개인뱅킹+파트너뱅킹 공용 navigate
 * (IP에서 접속하면 IP로 연결, WS에서 접속하면 WS로 연결)
 * @author 정영탁(SI303162)
 */
(function($) {
    $.fn.navigateIP = function(path, param, option, loadto) {
        var _this = $(this);
        return _this.common_movePage(path/*common_cfGetCurrentGlobalPath(path)*/, param, option, loadto).done(function(){
            // ajax 거래시에 complete js 실행(content영역에서 사용 - 퍼블리싱)
            try {
                contentLoadComplete();
            } catch (e) {}

            common_FavoriteButtonInit();    // Body영역의 타이틀 옆 즐겨찾기 버튼(별표) 클릭시
        });
    };
})(jQuery);

/**
 * 현재 페이지의 메뉴ID를 반환한다.
 * @author FAS 정영탁
 */
function common_cfGetCurrentMenuId(rootMenuId, defaultMenuId){
    if(rootMenuId == "" || rootMenuId == null || rootMenuId == undefined){
        console.log("[common_cfGetCurrentMenuId]_error : no rootMenuId");
        return "";
    }

    var _getCurrentMenuId = function(menuObj) {
        var menuId = null;
        if (location.href.indexOf(menuObj["url"]) > -1) {
            return (menuObj["link"] || menuObj["id"]);
        } else if (menuObj["subMenus"]) {
            for (var i = 0; i < menuObj["subMenus"].length; i++) {
                var _currentMenuId = _getCurrentMenuId(menuObj["subMenus"][i]);
                if (_currentMenuId != null) {
                    menuId = _currentMenuId;
                    break;
                }
            }
        }
        return menuId;
    };

    var rootObj = eval('menu_'+rootMenuId);
    var result = _getCurrentMenuId(rootObj);

    return (result || defaultMenuId);
}

/**
 * indexType : 접속 index page가 PC index or M사이트 index를 설정(ex. MOBILE, PC)
 * domainCode : 해당 index page의 Domain Code (ex. IP00, IC00)
 */
function common_cfSetIndexPageConfig(indexType){

    try{
        var config_table = null;

        if(indexType != undefined && indexType == "MOBILE"){
            config_table = MOBILE_INDEX_CONFIG_TABLE;
        }else{
            config_table = PC_INDEX_CONFIG_TABLE;
        }

//        var config_obj = config_table[domainCode] != undefined ? config_table[domainCode] : null;
        var deviceType = common_cfGetDeviceType();
        var initServiceYN = null;

        if(config_obj != null){
            initServiceYN = config_obj["INITSERVICE"];

            if(initServiceYN){
                httpSend("initService", null, function (){}, function (){}, {"useProgress" : false, "headers" : {"saac" : "saac"}});
            }

            if(config_obj[deviceType] != null){
                setTimeout(function (){
                    document.location.href = config_obj[deviceType];
                },10);
            }else{
                return;
            }
        }else{
            //모든 예외사항이 발생 시 개인뱅킹의 main index로 이동.
            httpSend("initService", null, function (){}, function (){}, {"useProgress" : false, "headers" : {"saac" : "saac"}});
            setTimeout(function (){
                document.location.href = common_cfGetDomain("IP00");
            },10);
        }
    }catch(e){
        //모든 예외사항이 발생 시 개인뱅킹의 main index로 이동.
        httpSend("initService", null, function (){}, function (){}, {"useProgress" : false, "headers" : {"saac" : "saac"}});
        setTimeout(function (){
            document.location.href = common_cfGetDomain("IP00");
        },10);
    }

}

/**
 * <pre>
 * 보안카드,OTP구분값 체크
 * </pre>
 */
function common_cfCheckPwCdDs(){

    httpSend ( "IPCNA115S",
               null,
               function() {},
               function(responseJson, status, xhr) { // CallBack Fail
                    common_cfUserDefinedErrorPop(responseJson, status, xhr);
               } ,
               { async : false }
             );
}

function common_cfGetDomainCode(){

    var domain = "https://" +  document.location.host;
    var domainCode = "";

    for(var i in DOMAINCODE){
        if(DOMAINCODE[i] == domain){
            domainCode = i.substring(i.length-4, i.length);
            break;
        }
    }

    return domainCode;

}

/**
 * <pre>
 * 이니텍 에러 체크
 * </pre>
 */
function common_cfCheckInitechError (status){

    // 값이 없는지 체크
    if ( status == null || status == undefined ) {
        return false;
    }

    // status가 이니텍 에러코드에 해당되는지 판단
    if ( "800" == status ||
         "921" == status ||
         "922" == status ||
         "923" == status ||
         "924" == status ||
         "925" == status ||
         "926" == status ||
         "927" == status ||
         "928" == status ||
         "929" == status ||
         "930" == status ||
         "931" == status ||
         "932" == status ||
         "933" == status ||
         "934" == status ||
         "935" == status ||
         "936" == status ||
         "937" == status ||
         "938" == status ||
         "939" == status ||
         "940" == status ||
         "949" == status ) {
         return true;
    }

    return false;
}

/**
 * 버튼 속성 변경
 * - 페이지 내의 button type을 초기화 한다(기본값: submit을 button으로 변경)
 */
function common_cfInitButtonType(formId) {
    if (typeof(formId) == 'object') {
        formId = $(formId);
    } else {
        formId = $('#'+formId);
    }

    formId.find('button').each(function(){
        $(this).attr('type', 'button');
    });
}

/**
 * 보안카드 자동커서 on/off 기능 체크(쿠키)
 */
function common_cfCheckAutoCursor(){
    var check_auto_cursor = util_cfGetCookie("security_card_auto_cursor");

    common_cfSecureCardInputHandler();    // 숫자만 입력되고 포커스 이동되도록 이벤트 적용

    // 자동커서 설정 radio init
    if(check_auto_cursor == "n") {
        $("#auto_cursor_radio_n").attr("checked", "checked");
    } else {
        $("#auto_cursor_radio_y").attr("checked", "checked");
    }

    // 자동커서 선택 이벤트
    $("input[name=auto_cursor_radio]").bind('change', function(e){
        util_cfSetCookie("security_card_auto_cursor", $(this).val());
        $("#io_ea_rsp_no1, #io_ea_rsp_no3").unbind("keyup.custom");
        common_cfSecureCardInputHandler();
    });

}

/**
 * SuperSign 조회를 위한 Ajax
 * @author 정영탁, 2014.10.31
 */
function common_cfSuperSignAjax( ssignObj, callback_success, callback_error ) {
    $.ajax({
        type : "GET",
        url: "/CodeGuard/supersign.jsp",
        data: ssignObj,
        cache : false,
        success : callback_success,
        error : callback_error
    });
}

/**
 * SuperSign 조회를 위한 Ajax
 * @author 김승용, 2016.09.29
 * 지문인증 일경우에만 사용
 */
function common_cfSuperSignAjaxFinger( ssignObj, callback_success, callback_error ) {
    $.ajax({
        type : "POST",
        url: "/CodeGuard/supersign.jsp",
        data: ssignObj,
        cache : false,
        success : callback_success,
        error : callback_error
    });
}

/**
 * 해외IP차단서비스 가입고객 거래 Block
 */
function common_cfForeignIPBlock( param , callback ) {
    var _service_name="IPCNA700S";
    if(window["G_WEB"] == "true") {
        _service_name="PGCNA700S";
    }
    var sendParam = param || {};
    var wrapperDiv = $('#FOREIGN_IP_BLOCK_WRAPPER_DIV');
    if(wrapperDiv.size() == 0){
        wrapperDiv = $('<div></div>').attr({id:'FOREIGN_IP_BLOCK_WRAPPER_DIV','data-type':"dialog" }).css({display:'none'});
        $('body').append(wrapperDiv);
    }
    $(wrapperDiv).common_movePage(_service_name, sendParam).done(function(data,status,xhr){
        if(typeof callback === 'function') callback(data,status,xhr);
    });
}

/**
 * 스마트금융 페이지로 전환
 */
function common_toSFMainNavigate(sub , joongjo){
    var serviceId          = sub || 'SFMN0001R';
    var naac_ds_dtlc     = joongjo || '1';


    common_toSFGateway(serviceId , {SF_NAAC_DS_DTLC:naac_ds_dtlc});
}

/**
 * 스마트금융 페이지로 전환
 */
function common_toSFGateway(serviceId , param) {
    var paramValue = { TARGET_SERVICE : serviceId };

    httpSend("ISSUETOKEN",
            paramValue,
            function(responseJson) { // 성공시 CallBack
                var logging_url = responseJson["TARGET"] + "?p_id="+ responseJson["TARGET"] + "&mvtomkt=1";
                try {
                    n_click_logging ( logging_url );
                } catch (e) {}

                var urlPrefix = "/content/html/sf/cn/";
                var result_url = '';

                result_url = common_cfGetDomain('SF00') + urlPrefix + "sfgateway.html?refbnk=1";

                if (responseJson["ENCTKIDX"] == null || responseJson["ENCTKIDX"] == "undefined" || responseJson["ENCTKIDX"] == '') {
                    result_url += "&SERVICE_ID=" + responseJson["TARGET"] + "&NAVIGATE_TYPE=" + responseJson["NAVIGATE_TYPE"];
                } else {
                    result_url += "&SERVICE_ID=VERIFYTOKEN&NAVIGATE_TYPE=1&ENCTKIDX=" + responseJson["ENCTKIDX"] + "&TARGET_SERVICE=" + responseJson["TARGET"];
                }

                if(param){
                    for(key in param){
                        result_url += '&' + key + '=' + param[key];
                    }
                }


                document.location.href = result_url;

            },
            function(responseJson, status, xhr) { // CallBack Fail
                common_cfUserDefinedErrorPop(responseJson, status, xhr);
                $('#layerDiv_scrtCdOtpPop').close(); // 레이어팝업 닫기
            },
            { async : false, useProgress : false } // Sync옵션
    );
}


/**
 * E2E 추가적용처리
 *
 * @param idOfObject : 해당 object 의 ID 값
 * @param type : n (숫자형)
 * @param hasTranskeyCheckBoxNecessarily : TranskeyCheckBox 필수추가여부 (true/false)
 */
function common_addE2eElement(idOfObject, type, hasTranskeyCheckBoxNecessarily) {
    if(typeof setE2Eelement !== 'undefined') {
        var e2eElementAdded        = idOfObject +":"+ type +":"+ hasTranskeyCheckBoxNecessarily;
        var arrayOfE2eElementAdded = [e2eElementAdded];
        if(typeof arrayOfE2eElementAdded === "object") {
            common_removeE2eElement(idOfObject, type, hasTranskeyCheckBoxNecessarily);
            setE2Eelement = setE2Eelement.concat(arrayOfE2eElementAdded);
        }
    }
}

/**
 * E2E 제거적용처리
 *
 * @param idOfObject : 해당 object 의 ID 값
 *
 */
function common_removeE2eElement(idOfObject, type, hasTranskeyCheckBoxNecessarily) {
    if(typeof setE2Eelement !== 'undefined') {
        var e2eElementRemoved        = idOfObject +":"+ type +":"+ hasTranskeyCheckBoxNecessarily;
        for(var i = 0 ; i < setE2Eelement.length ; i++) {
            if(setE2Eelement[i] === e2eElementRemoved) {
                setE2Eelement.splice(i, 1);
                break;
            }
        }
    }
}


/**
 * E2E값 제거
 * 페이지에서 동적으로 페이지를 변경하는 경우 (show/hide가 아닌 empty, append의 경우)
 * E2E 적용 필드의 E2E_fieldname 이 존재하는 경우 키보드 보안 오류가 발생하므로
 * empty, append 시에 E2E_fieldname element를 제거한다.
 * @param idOfObject : 해당 object 의 ID 값
 *
 */
function common_removeE2eHiddenElement(hiddenE2eFieldName) {
    if($("[name="+hiddenE2eFieldName+"]").length > 0 )
        $("[name="+hiddenE2eFieldName+"]").remove();
}

/**
 * E2E적용필드에 TranskeyCheckBox 붙일 때 사용
 * @param inputObj
 */
function common_appendTranskeyCheckBoxToE2eElement(inputObj) {

    var _pathname = document.location.pathname;
    _pathname = _pathname.substring(_pathname.lastIndexOf('/') + 1, _pathname.length);
    var _firstPath = _pathname.substring(0,2);


    var checkboxElement='';

    var span = $("<span></span>").addClass("mousebtn");
    var label = $("<label></label>");

    checkboxElement+="<input type=\"checkbox\" data-type=\"checkbox\" title=\"";
    checkboxElement+=(common_cfGetMessage('I0659') == "")? "마우스 입력기 사용" : common_cfGetMessage('I0659');
    checkboxElement+="\" id=\"Tk_";
    checkboxElement+=inputObj.id;
    checkboxElement+="_checkbox\" name=\"Tk_";
    checkboxElement+=inputObj.id;
    checkboxElement+="_checkbox\" ";
    checkboxElement+="onclick=\"transkey.Tk_";
    checkboxElement+=inputObj.id;
    checkboxElement+=".onClickCheckbox(event);\"/>";
    checkboxElement+=" <span class=\"labelC\">";
    checkboxElement+= (common_cfGetMessage('I0658') == "")? "마우스입력기" : common_cfGetMessage('I0658');
    checkboxElement+="</span>";
    checkboxElement+"";
    label.append(checkboxElement);
    span.append(label);

    if(_firstPath == 'IH' || "IH00" == common_cfGetDomainCode()) {
        $(inputObj).parent().parent().after(span);
        $(inputObj).parent().parent().after("&nbsp;");
    } else {
        $(inputObj).parent().after(span);
        $(inputObj).parent().after("&nbsp;");
    }

}


function common_setSecureToDirect(sourceId, targetId) {
    var targetForm, sourceForm;
    if($.type(sourceId) == "undefined" || $.type(targetId) == "undefined") {
        return;
    } else {
        var sourceObj = document.getElementById(sourceId);
        var targetObj = document.getElementById(targetId);
        sourceForm = sourceObj.form;
        targetForm = targetObj.form;

        common_setDefaultSecureField($(targetForm), $(sourceForm), targetId, sourceId);


    }
}

function common_setDefaultSecureField(targetForm, sourceForm, targetId, sourceId){
    var transkey_i, transkeyUuid, secure_view, hid_key_data,transkey_inputs;

    //secure 필드가 없는 경우

    if(targetForm.find("#secure_view").length <= 0) {
        //create element
        console.log("create Element");
        targetForm.append(sourceForm.find("transkeyUuid"));
        targetForm.append(sourceForm.find("secure_view"));
        targetForm.append(sourceForm.find("hid_key_data"));


        targetForm.append(sourceForm.find("transkey_i"));

        targetForm.append(sourceForm.find("transkey_inputs"));
        targetForm.find("#transkey_inputs").val("Tk_"+targetId+":"+targetId+":"+$("#"+sourceId).attr("type").toLowerCase());

        _setDefaultSecureField(targetForm, sourceForm, targetId, sourceId);

    } else {
        //secure 필드가 이미 존재하는 경우
        //append element
        //처음 호출 된 경우
        console.log("already Element - first call");
        if(targetForm.find("#transkey_inputs").val().indexOf("Tk_"+targetId+":"+targetId) < 0) {
            //transkey_i + 1, transkey_inputs + targetfield
            transkey_i = targetForm.find("#transkey_i");
            transkey_i.val(Number(transkey_i.val())+1);

            transkey_inputs = targetForm.find("#transkey_inputs");
            transkey_inputs.val(transkey_inputs.val()+",Tk_"+targetId+":"+targetId+":"+$("#"+sourceId).attr("type").toLowerCase());

            _setDefaultSecureField(targetForm, sourceForm, targetId, sourceId);

        } else {
        //호출이 한번이라도 된적이 있으면
            console.log("already Element - second call");
            targetForm.find("[name=E2E_"+targetId+"]").val(sourceForm.find("[name=E2E_"+sourceId+"]").val());
            targetForm.find("#transkey_Tk_"+targetId).val(sourceForm.find("#transkey_Tk_"+sourceId).val());
            targetForm.find("#Tk_"+targetId+"_check").val(sourceForm.find("#Tk_"+sourceId+"_check").val());

        }
    }

    function _setDefaultSecureField(targetForm, sourceForm, targetId, sourceId){
        var e2e_target, transkey_Tk_target, Tk_target_check;

        e2e_target = $("<input></input>");
        e2e_target.attr({"type":"hidden","name":"E2E_"+targetId}).val(sourceForm.find("[name=E2E_"+sourceId+"]").val());


        transkey_Tk_target = $("<input></input>");
        transkey_Tk_target.attr({"type":"hidden","name":"transkey_Tk_"+targetId, "id":"transkey_Tk_"+targetId}).val(sourceForm.find("#transkey_Tk_"+sourceId).val());

        Tk_target_check = $("<input></input>");
        Tk_target_check.attr({"type":"hidden","name":"Tk_"+targetId+"_check", "id":"Tk_"+targetId+"_check"}).val(sourceForm.find("#Tk_"+sourceId+"_check").val());

        targetForm.append(e2e_target);
        targetForm.append(transkey_Tk_target);
        targetForm.append(Tk_target_check);
    }
}

/**
 * NxKey Check
 */

function isTKLoadingCheck(){
    if(navigator.userAgent.indexOf("Windows") > 0){//윈도우환경 체크
       if(typeof TK_Loading != "function"){
           alert("키보드보안 설치를 다시 확인하시기 바랍니다(Error 10)");
           navigate("IPCNA902R");
       }
    }
}

function nxKeyLoadCheck(result){
       try{
          if(result.reply.keydata == null) {
             alert("키보드보안 설치를 다시 확인하시기 바랍니다(Error 11)");
             navigate("IPCNA902R");
          }
       }catch(e){
               alert("키보드보안 설치를 다시 확인하시기 바랍니다(Error 12)");
               navigate("IPCNA902R");
       }
}



/**
 * 지원 OS, WebBrowser 안내용 팝업출력처리
 */
function common_showLayerPopupForInformationAboutSupportedOsAndWebBrowser(solutionType) {
    /*
    if(solutionType == "INISAFEWebEX") {
        if(window["G_WEB"] == "true") {
            popup_cfLayerLoad("/content/html/i18n/en_US/cn/pgcn0092c.html");
        } else {
            popup_cfLayerLoad("/content/html/ip/cn/ipcn0092c.html");
        }
    }
    */
    document.location.href = common_cfGetDomain('IP00') + "/content/html/ip/cn/osbrowserguide.html";
}


//지문인증 로그인 추가 글로벌
function fingerAuthPopGlobal() {
    if($("#loginType") != undefined) {
        $("#loginType").val("");
    }
    popup_cfLayerOpen('PGCNI140P', {
        'ssign_data' : 'login',
        'ssign_ext_data' : 'login',
        'ssign_req_type' : 'SID',    // 인증서이동의 경우 'data', 그 이외는 'SID'
        'ssign_cert_type' : 'BIO',        //
        'ssign_cert_serial' : window["SMART_CERT_SERIAL"]
    });
}

//지문인증 로그인 추가
function fingerAuthPop() {
    if($("#loginType") != undefined) {
        $("#loginType").val("");
    }
    popup_cfLayerOpen('IPCNI140P', {
        'ssign_data' : 'login',
        'ssign_ext_data' : 'login',
        'ssign_req_type' : 'SID',    // 인증서이동의 경우 'data', 그 이외는 'SID'
        'ssign_cert_type' : 'BIO',        //
        'ssign_cert_serial' : window["SMART_CERT_SERIAL"]
    });
}


//간편인증 로그인 글로벌
function common_cfPinCertPopGlobal() {
    popup_cfLayerOpen('PGCNI160P', {
        'ssign_data' : 'login',
        'ssign_ext_data' : 'login',
        'ssign_req_type' : 'SID',    // 인증서이동의 경우 'data', 그 이외는 'SID'
        'ssign_cert_type' : 'PIN',        //
        'ssign_cert_serial' : window["SMART_CERT_SERIAL"]
    });
}

//간편인증 로그인
function common_cfPinCertPop() {
    popup_cfLayerOpen('IPCNI160P', {
        'ssign_data' : 'login',
        'ssign_ext_data' : 'login',
        'ssign_req_type' : 'SID',    // 인증서이동의 경우 'data', 그 이외는 'SID'
        'ssign_cert_type' : 'PIN',        //
        'ssign_cert_serial' : window["SMART_CERT_SERIAL"]
    });
}

function fingerGuidePop(){
    popup_cfLayerOpen('IPCNI141P');
}
function fingerGuidePopGlobal(){
    popup_cfLayerOpen('PGCNI141P');
}

//지원종료 안내팝업 추가
function serviceExpiredOsPopup(){
    var tp = navigator.platform;
    var ua = navigator.userAgent;
    var result = {};

    if (tp == "Win32" || tp == "Win64"){
                if(ua.search("Windows Phone") >= 0){
                    result.platform = "Windows Phone";
                    result.name="Windows Phone";
                } else {
                    result.platform = "WINDOWS";
                }
     }

    if(result.platform == "WINDOWS"){
                if(ua.indexOf("Windows NT 5.0") != -1 || ua.indexOf("Windows NT 5.01") != -1){result.version="5.0"; result.name="Windows 2000";}
                else if(ua.indexOf("Windows NT 5.1") != -1) {result.version="5.1"; result.name="XP";}
                else if(ua.indexOf("Windows NT 5.2") != -1) {result.version="5.2"; result.name="XP64/Windows 2003";}
                else if(ua.indexOf("Windows NT 6.0") != -1) {result.version="6.0"; result.name="VISTA";}
    }

    if(result.name=="Windows 2000" || result.name=="XP" || (result.name=="XP64/Windows 2003") || result.name=="VISTA"){
        if ( window["M_WEB"] != "true" ) { // M뱅킹이 아닌 경우
            if(window["G_WEB"] != "true") {
                popup_cfContentLayerOpen('/ip/am/ipam0907p.html');
            }
        }
    }
}

function common_preSolutionCheckFunc(type , callback){

    if(common_cfGetDeviceType() != 'NORMAL') {
        callback();
        return;
    }

    if(type == 'cert' || type == 'finger' || type == 'pinCert' || type == 'idPw'){
        var common_solutionChecker = new NHSolutionChecker();
        common_solutionChecker.setCheckSolution('Astx'         , 1);
        common_solutionChecker.setCheckSolution('CrosswebEX', 1);
        common_solutionChecker.installCheck(callback , function(){
            if(typeof ipcna302_installCheck_fail_callback == 'function') ipcna302_installCheck_fail_callback(callback);
        });

    }
}


function NHSolutionChecker (max_count , term){
    this.solution_list      = ['CrosswebEX','Astx','TouchEnNx'];
    this.solution_config = {
        CrosswebEX     : {checkYn : 0,checkType : 0,essential : 1},
        Astx         : {checkYn : 0,checkType : 0,essential : 1},
        TouchEnNx     : {checkYn : 0,checkType : 0,essential : 0}

    };
    this.initializeChecker = function (max_count , term){
        this.install_check_max_count = max_count || 5;
        this.install_check_term = term || 1000;
        this.install_check_now_count = 0;
    };
    this.setCheckSolution = function(solutionName , checkType){
        var settingTarget = this.solution_config;
        settingTarget[solutionName].checkYn   = 1;
        settingTarget[solutionName].checkType = checkType;
    };
    this.installCheck = function(success , fail){

        //처리중 시작
        common_showInitLodingBar();

        var checkSolution = [];
        var size = this.solution_list.length;
        for(var i = 0; i < size; i++){
            var sol = this.solution_list[i];
            if(this.solution_config[sol].checkYn == '1') checkSolution.push(sol);
        }
        this._installCheck(checkSolution, success, fail);

    };
    this._installCheck = function(checkSolution, successCallback, failCallback){

        if(typeof(successCallback) != 'function') successCallback = function(){};
        if(typeof(failCallback) != 'function') failCallback = function(){};
        if(typeof window.nh_solution_check == 'undefined') failCallback();

        var checkEndYn     = true;
        var checkResult = true;

        for(var i =0; i <checkSolution.length; i++){
            if(this.solution_config[checkSolution[i]].checkType != 0){
                var rst = nh_solution_check[checkSolution[i]].status;
                if(rst != 1){
                    checkResult  = false;
                    if(rst == 0) { checkEndYn     = false; }
                }
            }
        }


        this.install_check_now_count++;

        nh_solution_check.console();

        if(!checkEndYn){
            if(this.install_check_now_count >= this.install_check_max_count){
                common_closeInitLodingBar(); //처리중 종료
                this.install_check_now_count = 0;
                if(checkResult){
                    successCallback();
                }else{
                    failCallback();
                }
            }else{
                var THIS = this;
                setTimeout(function(){
                    THIS._installCheck(checkSolution , successCallback , failCallback);
                } , THIS.install_check_term);
            }
        }else{

            //처리중 종료
            common_closeInitLodingBar();

            this.install_check_now_count = 0;
            if(checkResult){
                successCallback();
            }else{
                failCallback();
            }
        }

    };

    this.getCheckSolution = function(){
        var checkFlag = true;
        var solutionlist = this.solution_list;
        var solutionConf = this.solution_config;
        var size = solutionlist.length;
        for(var i = 0; i < size; i++){
            var sol = solutionlist[i];
            if(solutionConf[sol].checkYn == '1' && solutionConf[sol].checkType == '1' && nh_solution_check[sol].status != '1'){
                checkFlag = false;
                break;
            }
        }
        return checkFlag;
    };

    this.getCheckEssentialSolution = function(){
        var checkFlag = true;
        var solutionlist = this.solution_list;
        var solutionConf = this.solution_config;
        var size = solutionlist.length;
        for(var i = 0; i < size; i++){
            var sol = solutionlist[i];
            if(solutionConf[sol].essential == '1' && nh_solution_check[sol].status != '1'){
                checkFlag = false;
                break;
            }
        }
        return checkFlag;
    };

    this.getAllCheckSolution = function(){
        var checkFlag = true;
        var solutionlist = this.solution_list;
        var solutionConf = this.solution_config;
        var size = solutionlist.length;
        for(var i = 0; i < size; i++){
            var sol = solutionlist[i];
            if(nh_solution_check[sol].status != '1'){
                checkFlag = false;
                break;
            }
        }
        return checkFlag;
    };

    this.initializeChecker(max_count , term);

}

var nh_solution_check = {

    setSolutionConfig : function(name , attr , val){
        nh_solution_check[name][attr] = val;
    },
    getSolutionConfig : function(name , attr){
        return nh_solution_check[name][attr];
    },
    CrosswebEX     : {
        status         : 0,
        useExtension: 1,
        extensionSts: 0
    },
    Astx         : {
        status         : 0,
        useExtension: 0,
        extensionSts: 0
    },
    TouchEnNx     : {
        status         : 0,
        useExtension: 1,
        extensionSts: 0
    },
    console : function(){}
};

function common_cfCheckSolution(afterFunc , checkSol){

    var serviceID     = (window["G_WEB"] == "true") ? 'PGCNA302S' : 'IPCNA302S';
    var func         = (typeof afterFunc == 'function') ? afterFunc : function(){};
    var checkParam     = (typeof checkSol == 'object') ? checkSol : {SO_ND : 'ASTX,CROSSWEB,INSTALLLAY'};

    if(common_cfGetDeviceType() != 'NORMAL') {
        func();
        return;
    }

    if(typeof solutionGlobalChecker != 'undefined'){

        var solutionLocalChecker = new NHSolutionChecker();
        solutionLocalChecker.setCheckSolution('Astx'         , checkParam.SO_ND.indexOf('ASTX') != -1 ? 1 : 0);
        solutionLocalChecker.setCheckSolution('CrosswebEX'  , checkParam.SO_ND.indexOf('CROSSWEB') != -1 ? 1 : 0);
        solutionLocalChecker.setCheckSolution('TouchEnNx'     , checkParam.SO_ND.indexOf('TOUCHENNX') != -1 ? 1 : 0);
        solutionLocalChecker.installCheck(func, function(){ipcna302_installCheck_fail_callback(func);});
    }else{
        ipcna302_installCheckSuccessAfterCallback = func;
        common_cfCallSolutionInstallPop(serviceID , {SO_ND : 'ASTX,CROSSWEB,INSTALLLAY'});
    }



}

function common_cfCallSolutionInstallPop(svcID , param){

    $('#solutionInfoLayerPopup').remove();
    var serviceID = svcID || 'IPCNA303S';
    var parameter = param || {};
    var targetDiv = $('<div></div>');
    $('body').append(targetDiv);
    targetDiv.common_movePage(serviceID , parameter);

}

function common_cfgoVeraportPage(option){

    if(    (window["POP_WEB"] != undefined && window["POP_WEB"] == "true") &&
            (window.opener != undefined || window.opener != null) ){

            if(typeof window.opener.common_cfgoVeraportPage == 'function') window.opener.common_cfgoVeraportPage();
            window.close();
            return;
    }else{
        if(window["G_WEB"] == "true") {
            navigate('PGCNA300S' , option , {method:'GET'});
        }else{
            navigate('IPCNA300S' , option , {method:'GET'});
        }
    }

}

function common_cfManageCert() {

    var afterFunc = function(){
        SetProperty("certmanui_language", "KOR");
        ManageCert();
    };

    if(typeof solutionGlobalChecker != 'undefined'){
        var solutionLocalChecker = new NHSolutionChecker();
        solutionLocalChecker.setCheckSolution('Astx'         , 1);
        solutionLocalChecker.setCheckSolution('CrosswebEX'  , 1);
        solutionLocalChecker.setCheckSolution('TouchEnNx'     , 0);
        solutionLocalChecker.installCheck(afterFunc, function(){ipcna302_installCheck_fail_callback(afterFunc);});
    }else{
        ipcna302_installCheckSuccessAfterCallback = function() {
            SetProperty("certmanui_language", "KOR");
            ManageCert();
        };
        common_cfCallSolutionInstallPop('IPCNA302S' , {SO_ND : 'ASTX,CROSSWEB,INSTALLLAY'});
    }

}

/**
 * 화면 이동 prototype.
 */

function movePageDefaultError(data, xhr) {

    var errorCode = xhr.getResponseHeader('ERROR_CODE');
    var errorMsg = xhr.getResponseHeader('ERROR_MESSAGE');
    errorMsg = decodeURIComponent(errorMsg);
    errorMsg = errorMsg.split('+').join(' ');
    // var orgErrorCode = $.trim(xhr.getResponseHeader('ORG_ERROR_CODE'));
    if (errorCode) {
        var errObject = {
            errMsg : errorMsg,
            errorCode : xhr.getResponseHeader('ERROR_CODE'),
            subErrorCode : xhr.getResponseHeader('SUB_ERROR_CODE'),
            orgErrorCode : xhr.getResponseHeader('ORG_ERROR_CODE'),
            errPrgName : xhr.getResponseHeader('ERROR_PROGRAM_NAME'),
            errFlnm : xhr.getResponseHeader('ERR_FLNM'),
            errPrgLine : xhr.getResponseHeader('ERROR_PROGRAM_LINE'),
            errSvrInfo : xhr.getResponseHeader('ERROR_SERVER_INFO'),
            guid : xhr.getResponseHeader('BACKEND_CHANNEL_GUID'),
            rmsSvc : xhr.getResponseHeader('RMS_SVC_C'),
            returnServiceId : xhr.getResponseHeader('RETURN_SERVICE_ID'),
            serviceId : xhr.getResponseHeader('service'),
            status : xhr.status
        };

        showErrorLayerPop(errObject);
    } else {
        $("#content").html('');
        $("#content").html(data);
    }
}

(function($) {
    $.fn.common_movePage = function(url, param, option, returnUrl, returnParam) {
        if ( option != null && typeof option == "object" && typeof option.indicator == "boolean" && !option.indicator )  {
            submitDelayFlag = false;
        } else if ( checkSubmitDelay() ) {
            return;
        } else {
            submitDelayFlag = true;
            setTimeout("useSubmitDelayFlag()", 500);
        }
        try{
            initiateTimer();
        }catch(e){}

        var deferred = $.Deferred();

        var domId = '';
        var inputData = '';
        var _this = $(this);
        var jexDom = '';
        var suffix = '.act';

        // 기업카드 - indicator
        var indicator = getNHIndicator();

        loadUUID(); //2018.04.09

        /**
    	 *
    	 */
        var historyUrl = null;
        var historyParam = null;
        var isReturnUrl = false;

        if (param) {
            if($(param)[0].tagName === undefined) {
                inputData = param;
            } else {
                domId = $(param).attr('id');
                jexDom = jexjs.plugin("dom");
                inputData = jexDom.getAll(domId);
            }
        } else {
            inputData = {};
        }

    	if(returnUrl) {
    		isReturnUrl = true;
    		historyUrl = getActUrl(returnUrl);
    		historyParam = returnParam ? returnParam : null;
    	}
    	else {
    		historyUrl = getActUrl(url);
    		historyParam = inputData ? inputData : null;
    	}
		pushHistory(historyUrl, historyParam, isReturnUrl);

        /*
        if (option && typeof option['error'] == typeof function(){}) {
            deferred.fail(error);
        } else {
            deferred.fail(movePageDefaultError);
        }
        */

        var jexAjax = jexjs.createAjaxUtil(url);
        jexAjax.setting('headers', {serviceType : 'frag'});
        jexAjax.setting('suffix', suffix);
        jexAjax.setting('userData', true);					 //2. 잉카 Ajax호출 시 jexAjex 옵션 세팅  2018.04.10

        if ( !(option != null && typeof option == "object" && typeof option.indicator == "boolean" && !option.indicator) ) {
            jexAjax.setIndicator(indicator);
        } else {
            jexAjax.setIndicator("");
        }

        jexAjax.set(inputData);

        jexAjax.execute({
            success : function(data, xhr){
                useSubmitDelayFlag();
                // console.log(data);
                var errCode = xhr.getResponseHeader('ERROR_CODE');

                if ( option != null && typeof option == "object" && typeof option.errorFunction == "function" 
                  && ( errCode != null || jQuery(data).find("div._errorCode").length == 1 ) ) {
                    option.errorFunction(_this, data);
                } else if (errCode != null && jQuery(data).find("div._menuTitle").length != 0) {
                    //movePageDefaultError(data, xhr);
                    open_layer_html(
                        getErrorLayerPopup(
                            jQuery(data).find("div._menuTitle").html()
                            , jQuery(data).find("div._errorCode").html()    //, xhr.getResponseHeader('ERROR_CODE')
                            , jQuery(data).find("div._errorTitle").html()
                            , jQuery(data).find("div._message").html()      //, xhr.getResponseHeader('ERROR_MESSAGE')
                            , jQuery(data).find("div._guide").html()
                            , url
                        )
                        , "layerDiv_errPop"
                    );
                } else if (errCode != null) {
                    movePageDefaultError(data, xhr);
                } else {
                    //if ( jQuery(data).find("div._errorCode").html() == "500") {
                    if ( jQuery(data).find("div._errorCode").length == 1) {
                        open_layer_html(
                            getErrorLayerPopup(
                                jQuery(data).find("div._menuTitle").html()
                                , jQuery(data).find("div._errorCode").html()
                                , jQuery(data).find("div._errorTitle").html()
                                , jQuery(data).find("div._message").html()
                                , jQuery(data).find("div._guide").html()
                                , url
                            )
                            , "layerDiv_errPop"
                        );
                    } else {
                        _this.html(data);

                        common_fn_movePage_after(data, option);
                    }
                }
                deferred.resolve(data);
                getNHIndicator().hide();
            },
            error   : function(e){
                useSubmitDelayFlag();
                deferred.reject(e);
                getNHIndicator().hide();
            }
        });

        return deferred.promise();
    }
})(jQuery);

function common_fn_movePage_after(data, option) {
    if ( option && option['showContent'] && option['showContent'] == "02") {
        showContent_1to2();
    }

    if ( jQuery(".pop-wrap").hasClass("on") ) {
        popup_resize();
    }

    if( jQuery(data).find(".accordion").length > 0 ) {
        //jQuery('.accordion-header button').off("click");
        accordian.init();
    }
    
    if( jQuery(data).find("div.tooltip-area").length > 0 ) {
        createCommon.tooltip("div.tooltip-area");
    }

}

function indicatorIOS() {
    var ua = navigator.userAgent;
    return (/iPhone/).test(ua) && !(/CriOS/).test(ua) && !(/FxiOS/).test(ua) && !(/OPiOS/).test(ua);
}

function getNHIndicator() {
    return jexjs.plugin('indicator', {
         modal : false
        ,scopeWindow : null
        ,css : {
             bg     : 'loading'
            //,imgBg  : 'nhcard-indicator-bg'
            //,img    : 'nhcard-indicator-img'
            ,active : 'active'
        }
    });
}

function showIndicator() {
    var indicator = getNHIndicator();

    if(!indicatorIOS()){
    	indicator.show();
    }
}

function formToObject(form) {
    var o = {};
    var jf = $(form);
    if (form && jf.length > 0 && jf[0].tagName == 'FORM') {
      $.each(jf.serializeArray(), function(i, v) {
        if (o[v.name] !== undefined) {
          if (!o[v.name].push) {
            o[v.name] = [o[v.name]];
          }
          o[v.name].push(v.value || '');
        } else {
          o[v.name] = v.value || '';
        }
      });
    }
    return o;
};

function backMainPage() {
	if(deviceType == ""){
		backPage(PC_MAIN_URL);
    }else{
        if(deviceType == "MOBILE"){
        	backPage(getActUrl(MOBILE_MAIN_URL));
        }else{
        	backPage(getActUrl(PC_MAIN_URL));
        }
    }
}

function getMainUrl() {
	if(window.deviceType == ""){
		return PC_MAIN_URL;
    }else{
        if(window.deviceType == "MOBILE"){
        	return MOBILE_MAIN_URL;
        }else{
        	return PC_MAIN_URL;
        }
    }
}

function getLoginUrl() {
	if(window.deviceType == ""){
		return PC_LOGIN_URL;
    }else{
        if(window.deviceType == "MOBILE"){
        	return MOBILE_LOGIN_URL;
        }else{
        	return PC_LOGIN_URL;
        }
    }
}

function backPage(url, param, isPutHistory) {
	setTimeout(function(){
        showIndicator();
    }, 1);

    var form = $('<form class="selform" style="display:none;"></form>').appendTo('head');
    form.attr('method', 'POST');
    form.attr('action', url);

    for (var prop in param) {
        var item = param[prop];
        if($.isArray(item)) {
            $.each(item, function(i, value) {
                $('<input type="hidden" name="' + prop + '"/>').val(value).appendTo(form);
            });
        } else {
            $('<input type="hidden" name="' + prop + '"/>').val(item).appendTo(form);
        };
    }

    loadUUID(); //2018.04.09
    form.submit();

    if(isPutHistory) {
    	pushHistory(url, param);
    }
}

function getActUrl(url) {
	var rtn = "";
	if(typeof url != 'undefined'){
		var prefix = url.startsWith("/") ? "" : "/";
	    var suffix = url.indexOf('.act') > -1 ? '' : '.act';
	    rtn =  prefix + url + suffix;
	}
    return rtn;
}

function common_movePage(url, param, option, returnUrl, returnParam) {
    if ( typeof isSevcieConfirm != "undefined" && isSevcieConfirm ) {
        var message = "해당 페이지로 이동 시, <br/>기업카드 홈페이지 로그인이 필요합니다.";
        if ( menuId.indexOf("ic") == 0) {
            message = "해당 페이지로 이동 시, <br/>기업카드 홈페이지 로그인이 필요합니다.<br/>가맹점 홈페이지에서는 로그아웃됩니다.";
        } else if ( menuId.indexOf("impg") == 0 && typeof isPGAdminConfirm != "undefined" && !isPGAdminConfirm ) {
            isSevcieConfirm = false;
            common_movePage(url, param, option, returnUrl, returnParam);
            return;
        } else if ( menuId.indexOf("impg") == 0 && typeof isPGAdminConfirm != "undefined" && isPGAdminConfirm ) {
            message = "해당 페이지로 이동 시,<br/>가맹점 홈페이지 로그인이 필요합니다.<br/>PG관리자에서는 로그아웃됩니다.";
        } else if ( menuId.indexOf("im") == 0) {
            message = "해당 페이지로 이동 시,<br/>가맹점 홈페이지 로그인이 필요합니다.<br/>기업카드 홈페이지에서는 로그아웃됩니다.";
        } else if ( menuId.indexOf("iv") == 0) {
            message = "해당 페이지로 이동 시,<br/>바우처 홈페이지 로그인이 필요합니다.";
        }
        
        httpSend("checkService", {serviceId : url }, function(responseJson) {
            if ( responseJson['result'] ) {
                nhConfirm(
                    message
                    , function () {
                        isSevcieConfirm = false;
                        common_movePage(url, param, option, returnUrl, returnParam);
                    }
                    , null
                    , "확인"
                    , "취소"
                );
                return;
            } else {
                isSevcieConfirm = false;
                common_movePage(url, param, option, returnUrl, returnParam);
                return;
            }
        });
        return;
    } else {
        if ( movePageDelayFlag ) {
            return;
        } else {
            movePageDelayFlag = true;
            setTimeout("useMovePageDelayFlag()", 500);
        }
    
        var isTarget = false;       //새창으로 열시 타겟을 추가
        if(option){
            if(option.target){
                isTarget = true;
            }
        }
        if(!isTarget){
            setTimeout(function(){
                 showIndicator();
            }, 1);
        }
    
        var result_url = getActUrl(url);
        var deferred = $.Deferred();
    
        loadUUID(); //2018.04.09
    
        try {
            var passBlocking = false;
            if(typeof _pageUUID != 'undefined' ) {
                var temp_pageUUID = _pageUUID;
                if ( typeof option != 'undefined' && typeof option.noBlocking != 'undefined' && option.noBlocking ) {
                    passBlocking = true;
                }
    
                if (passBlocking) {
                    _pageUUID = "";
                }
            }

            if (param) {
                if($(param)[0].tagName == 'FORM') {
                    $(param).attr('method', 'POST');
                    $(param).attr('action', result_url);
    
                    if(typeof _pageUUID != 'undefined' && _pageUUID != ""){
                        $(param).append( $('<input/>', {type:'hidden', name:'_request_pageUUID', value:_pageUUID} ));
                    }

                    $(param)[0].submit();
    
                    param = formToObject($(param)[0]);
                } else {
                    $('.selform').remove();
                    var form = $('<form class="selform" style="display:none;"></form>').appendTo('head');
                    form.attr('method', 'POST');
                    form.attr('action', result_url);
    
                    if(isTarget){
                        form.attr('target', option.target);
                    }
    
                    for (var prop in param) {
                        var item = param[prop];
                        if($.isArray(item)) {
                            $.each(item, function(i, value) {
                                $('<input type="hidden" name="' + prop + '"/>').val(value).appendTo(form);
                            });
                        } else {
                            $('<input type="hidden" name="' + prop + '"/>').val(item).appendTo(form);
                        };
                    }
    
                    if(typeof _sInfo !== 'undefined'){
                        $('<input type="hidden" name="_sInfo"/>').val(_sInfo).appendTo(form);
                    }
                    
                    if(typeof _pageUUID != 'undefined' && _pageUUID != ""){
                        $('<input type="hidden" name="_request_pageUUID"/>').val(_pageUUID).appendTo(form);
                    }
    
                    form.submit();
                };
            } else {
                window.location.href = result_url;
            }
            deferred.resolve();
        } catch (e) {
            deferred.reject(e);
        }

        if (passBlocking) {
            _pageUUID = temp_pageUUID;
        }
        
        /**
         *
         */
        var historyUrl = null;
        var historyParam = null;
        var isReturnUrl = false;
        if(returnUrl) {
            isReturnUrl = true;
            historyUrl = getActUrl(returnUrl);
            historyParam = returnParam ? returnParam : null;
        }
        else {
            historyUrl = result_url;
            historyParam = param ? param : null;
        }
    
        if( (historyUrl.indexOf(getLoginUrl()) < 0) && (historyUrl.indexOf(getMainUrl()) < 0) ) {
            pushHistory(historyUrl, historyParam, isReturnUrl);
        }
    
        return deferred.promise();
    }
}

function common_moveHtml(url, param, option) {

    setTimeout(function(){
        showIndicator();
    }, 1);

    var urlPrefix = "";
    var result_url = urlPrefix + url;

    var form = $('<form class="selform" style="display:none;"></form>').appendTo('head');
    form.attr('method', 'POST');
    form.attr('action', result_url);

    for (var prop in param) {
        var item = param[prop];
        if($.isArray(item)) {
            $.each(item, function(i, value) {
                $('<input type="hidden" name="' + prop + '"/>').val(value).appendTo(form);
            });
        } else {
            $('<input type="hidden" name="' + prop + '"/>').val(item).appendTo(form);
        };
    }

    loadUUID(); //2018.04.09
    form.submit();

    pushHistory(result_url, param);

}

function httpSend(service, param, success, error, option) {
    if ( option != null && typeof option == "object" && typeof option.indicator == "boolean" && !option.indicator )  {
        submitDelayFlag = false;
    } else if ( checkSubmitDelay() ) {
        return;
    } else {
        submitDelayFlag = true;
        setTimeout("useSubmitDelayFlag()", 500);
    }

    try{
        initiateTimer();
    }catch(e){}

    var deferred = $.Deferred();
    var igErrPop = false;
    var domId = '';
    var inputData = '';
    var jexDom = '';

    // 기업카드 - indicator
    var indicator = getNHIndicator();

    loadUUID(); //2018.04.09

    if (param) {
        if($(param)[0].tagName === undefined) {
            inputData = param;
        } else {
            domId = $(param).attr('id');
            jexDom = jexjs.plugin("dom");
            inputData = jexDom.getAll(domId);
        }
    } else {
        inputData = {};
    }

    if (success && typeof success == typeof function(){}) {
        deferred.done(success);
    }

    if (error && typeof error == typeof function(){}) {
        deferred.fail(error);
    } else {
        deferred.fail(httpSendDefaultError);
    }

    var jexAjax = jexjs.createAjaxUtil(service);
    	if(!(option && option.indicator === false)){
    		jexAjax.setIndicator(indicator);
    	}
        jexAjax.setting('headers', {serviceType : 'cmd'});
        jexAjax.set(inputData);

    if(option && option["setFormContentType"] != undefined && option["setFormContentType"] != null){
        jexAjax.setting('contentType', 'application/x-www-form-urlencoded; charset=utf-8');
        jexAjax.setting('processData', true);
    }

    if( option && option.async === false ) {
        indicator.show();
        jexAjax.setting('delay', 5);
        jexAjax.setting('async', false);
    } else {
        jexAjax.setting('async', true);
    }

    if( option && option.keyProtect === true ) { //2018.04.19
    	jexAjax.setting('userData', true);
    }

    if( option && option.igErrPop === true ) { //2018.04.19
    	igErrPop = true;
    }

    //loadUUID(); //2018.04.09

    if(option && option.async === false) {
        jexAjax.execute({
            success : function(data, xhr){
                useSubmitDelayFlag();
                var err = data.COMMON_HEAD.ERROR;
                if (err == true) {
                    if (igErrPop == true) {
                        deferred.reject(data);
                    } else {
                        common_cfUserDefinedErrorPop(data, xhr);
                    }
                } else {
                    deferred.resolve(data);
                }
                getNHIndicator().hide();
            },
            error   : function(e){
                useSubmitDelayFlag();
                deferred.reject(e);
                getNHIndicator().hide();
            }
        });
    } else {
        jexAjax.execute({
            success : function(data, xhr){
                useSubmitDelayFlag();
                var err = data.COMMON_HEAD.ERROR;
                if (err == true) {
                    if (igErrPop == true) {
                        deferred.reject(data);
                    } else {
                        common_cfUserDefinedErrorPop(data, xhr);
                    }
                } else {
                    deferred.resolve(data);
                }
                getNHIndicator().hide();
            },
            error   : function(e){
                useSubmitDelayFlag();
                deferred.reject(e);
                getNHIndicator().hide();
            }
        });
    }

    return deferred.promise();
}

//최근이용메뉴 5개
function checkCookieArr(nhCardMenuIdName) {
	var cookieValue = getCookie('nhCardMenuIdName')? JSON.parse(getCookie('nhCardMenuIdName')) : "";
	
	if(cookieValue != ""){
		var newCookie = [nhCardMenuIdName];
		
		for(i =0;  i < cookieValue.length; i++){
			
			  if(nhCardMenuIdName.menu_id != cookieValue[i].menu_id){
				  newCookie.push(cookieValue[i]);
			 }
		}

		if(newCookie.length > 5){
			newCookie.splice(5);
		}
		
		setCookieF("nhCardMenuIdName", JSON.stringify(newCookie),365);
	}else{
		setCookieF("nhCardMenuIdName", JSON.stringify([nhCardMenuIdName]),365);
	}
}


function common_moveMenu(menuId, param, option, returnUrl, returnParam){
    //기업카드(최근이이용메뉴)
    if(option && option.menu_name){
		var nhCardMenuIdName =Object.assign({},param,option);
	    checkCookieArr(nhCardMenuIdName);
	}
    
    //if ( typeof option != "undefined" && typeof option.isConfirm == "boolean" && option.isConfirm ) {
    if ( typeof isSevcieConfirm != "undefined" && isSevcieConfirm ) {
        var message = "해당 페이지로 이동 시, <br/>기업카드 홈페이지 로그인이 필요합니다.";
        if ( menuId.indexOf("ic") == 0) {
            message = "해당 페이지로 이동 시, <br/>기업카드 홈페이지 로그인이 필요합니다.<br/>가맹점 홈페이지에서는 로그아웃됩니다.";
        } else if ( menuId.indexOf("impg") == 0 && !isPGAdminConfirm ) {
            isSevcieConfirm = false;
            common_moveMenu(menuId, {menu_id:menuId});
            return;
        } else if ( menuId.indexOf("im") == 0) {
            message = "해당 페이지로 이동 시,<br/>가맹점 홈페이지 로그인이 필요합니다.<br/>기업카드 홈페이지에서는 로그아웃됩니다.";
        }
        
        // 법인카드추가발급 메뉴 이탈시 동작
        if(isSevcieConfirm == "isAddCard") {
        	var isConfirm = true;
        	if( typeof option != "undefined" && !option.isConfirm) {
        		isConfirm = option['isConfirm'];
        	}
        	if(isConfirm) popup_modalLayerOpen("iccg0600p", {menu_id:menuId});
        }
        
        httpSend("checkService", {serviceId : menuId + ".menu"}, function(responseJson) {
            if ( responseJson['result'] ) {
                nhConfirm(
                    message
                    , function () {
                        isSevcieConfirm = false;
                        common_moveMenu(menuId, {menu_id:menuId});
                    }
                    , null
                    , "확인"
                    , "취소"
                );
                return;
            } else {
                isSevcieConfirm = false;
                common_moveMenu(menuId, {menu_id:menuId});
                return;
            }
        });
        return;
    } else {
        setTimeout(function(){
            showIndicator();
        }, 1);
    
        if( typeof param == "undefined" ) {
            param = {menu_id : menuId};
        }
        
        var prefix = menuId.startsWith("/") ? "" : "/";
        var suffix = menuId.indexOf('.menu') > -1 ? '' : '.menu';
        var result_menuId = prefix + menuId + suffix;
    
        var form = $('<form class="selform" style="display:none;"></form>').appendTo('head');
        form.attr('method', 'POST');
        form.attr('action', result_menuId);
    
        for (var prop in param) {
            var item = param[prop];
            if($.isArray(item)) {
                $.each(item, function(i, value) {
                    $('<input type="hidden" name="' + prop + '"/>').val(value).appendTo(form);
                });
            } else {
                $('<input type="hidden" name="' + prop + '"/>').val(item).appendTo(form);
            };
        }
    
        if(typeof _sInfo !== 'undefined'){
             $('<input type="hidden" name="_sInfo"/>').val(_sInfo).appendTo(form);
        }
    
        if(returnUrl){
            pushHistory(getActUrl(returnUrl), returnParam,true);
            nhSetLocalStorage("LAST_MENU", menuId.replace("/mobile/", ""));
        }else{
            pushHistory(result_menuId, param);
            nhSetLocalStorage("LAST_MENU", menuId.replace("/mobile/", ""));
        }
    
        loadUUID(); //2018.04.09
        form.submit();
    }
}

function pushHistory(url, param, isReturnUrl) {
	/*
	if('NORMAL' == common_cfGetDeviceType()) {
		return;
	}
	*/

	var historys = nhGetObjectLocalStorage("NHCARD_HISTORYS");
	if(!historys) {
		historys = new Array();
	}

	var lastHistory = null;
	if(historys.length) {
		lastHistory = historys[historys.length-1];
	}

	// 이전 페이지 정보가 returnUrl일 경우 제거(이전 스텝)
	if(isReturnUrl && lastHistory && lastHistory.isReturnUrl) {
		historys.pop();
	}
	else if(lastHistory && lastHistory.url.split("?")[0] === url.split("?")[0]) {
		historys.pop();
	}

	var history = {
		url:url,
		param:param
	};
	if(isReturnUrl) {
		history.isReturnUrl = true;
	}

	historys.push(history);
	nhSetObjectLocalStorage("NHCARD_HISTORYS", historys);
}

function httpSendDefaultError(e) {
	console.log('Ajax 통신 오류');
}

/**
 *  통신 후 에러메시지 공통처리
 *  success메소드 맨 윗줄에 if(httpSendIMOError(결과파라미터)) return; 추가
 */
function httpSendIMOError(e) {
	if (e['COMMON_HEAD']['ERROR']) {
		if (e['COMMON_HEAD']['ERROR'] == "NH_IMO_ERR") { // 전문 에러내용 처리
			var errorMsg = JSON.parse(e['COMMON_HEAD']['MESSAGE']);
			alert(errorMsg['CUS_MSG'] + "\n" + errorMsg['STD_ERR_MSG_CNTN'] + "\n[" + errorMsg['STD_ERR_C'] + "]");
		} else { // JEX 에러내용 처리
			alert("[" + e['COMMON_HEAD']['CODE'] + "]" + e['COMMON_HEAD']['MESSAGE']);
		}
		return true;
	}
	return false;
}

window.onerror=function(msg, url, linenumber){
//	if (common_GetDeviceType() != DEVICE_IPHONE) {
//		alert('Error message: '+msg+'\nURL: '+url+'\nLine Number: '+linenumber);
//	}
	if($('#jexjs-indicator-wrap')){
		$('#jexjs-indicator-wrap').remove();
	}else{
		document.location.reload();
	}
	return false;
};

function loadUUID() {
    var uuid = jexjs.cookie.get("JEX_UI_UUID");
    var lgin = jexjs.sessionStorage.get("JEX_LOGIN");

    if (jexjs.empty(uuid)) {
        uuid = jexjs.cookie.get("JEX_UI_UUID_R");
    }

    if (!jexjs.empty( lgin )){
        uuid = uuid +"*"+lgin;
    }

    if (!jexjs.empty(uuid)) {
        jexjs.cookie.set("JEX_UI_UUID_SND", uuid);
    }
}

/**
 * 모바일 Web에서 App 호출 함수
 *
 * @param appName null 이거나 'nhcard' 일경우 농협카드 앱
 * @param menuId  null 이거나 이동할 페이지 / 0 : 메인 -MY NH , 1 : 메인 -혜택, 2: 메인-금융, 3:메인 -카드
 * @param token   null 이거나 로그인 처리 후 확인용으로 사용 할 값
 * @param tbs     null 이거나 공인인증 사용값
 *
 * TODO 키캣 이전 크롬에서 정상 호출 안한다고 하는데 테스트 할 수 없이 임시 주석
 *
 * 연동시 필요 정보
 * 1. 마켓 주소 (IOS, 안드로이드)
 * 2. App 호출 주소 (IOS, 안드로이드)
 *
 * ex)
 * IOS 마켓 주소 : https://itunes.apple.com/kr/app/id406473666?mt=8
 * IOS APP 호출주소 : nhcard://nh.smart.card
 * 안드로이드 마켓 주소 : market://details?id=nh.smart.card
 * 안드로이드 APP 호출주소 : com.nonghyup.nhcard://mobile_web
 *
 */
var launchMap = {
		"NH농협카드 가맹점 찾기" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhsmartcardar:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhnonghyeobkadeu-gamaengjeom/id406636215?mt=8",
				"AppName":"NH농협카드 가맹점 찾기"
			},
			"Android" : {
				"PackageName" : "nh.smart.card.nc.add.ar",
				"Scheme" : "nhbranchar",
				"AppName":"NH농협카드 가맹점 찾기"
			}
		},
		"NH스피드뱅킹" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhspeedbanking:",
				"AppStoreUrl" : "",
				"AppName":"NH스피드뱅킹"
			},
			"Android" : {
				"PackageName" : "nh.smart.speed",
				"Scheme" : "nhSmartSpeed",
				"AppName":"NH스피드뱅킹"
			}
		},
		"NH농협카드" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhcard:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/seumateunhnonghyeobkadeu/id406473666?mt=8",
				"AppName":"NH농협카드"
			},
			"Android" : {
				"PackageName" : "nh.smart.card",
				"Scheme" : "nhsmartcard",
				"AppName":"NH농협카드"
			}
		},
		"NH모바일카드" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.NHAppCard:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhnonghyeob-mobailkadeu-aebkadeu/id698023004?mt=8",
				"AppName":"NH모바일카드"
			},
			"Android" : {
				"PackageName" : "nh.smart.mobilecard",
				"Scheme" : "",
				"AppName":"NH모바일카드"
			}
		},
		"내사랑독도" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhMyLoveDokdo:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/naesalang-dogdo/id468571978?mt=8",
				"AppName":"내사랑독도"
			},
			"Android" : {
				"PackageName" : "nh.smart.dokdo",
				"Scheme" : "nhdokdo",
				"AppName":"내사랑독도"
			}
		},
//		"NH연말정산컨설팅" : {
//			"iOS" : {
//				"URLScheme" : "com.nonghyup.nhsmarttax:",
//				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nh-yeonmaljeongsan-keonseolting/id412568986?mt=8",
//				"AppName":"연말정산"
//			},
//			"Android" : {
//				"PackageName" : "com.ssomon.NHCol",
//				"Scheme" : "",
//				"AppName":"연말정산"
//			}
//		},
//		"NH로또" : {
//			"iOS" : {
//				"URLScheme" : "com.nonghyup.nhlotto:",
//				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nh-lotto/id398000960?mt=8",
//				"AppName":"로또"
//			},
//			"Android" : {
//				"PackageName" : "nh.smart.nb.svc",
//				"Scheme" : "",
//				"AppName":"로또"
//			}
//		},
		"농협찾기" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhbranch:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nonghyeobchajgi/id397995602?mt=8",
				"AppName":"농협찾기"
			},
			"Android" : {
				"PackageName" : "nh.smart.nb.svc.brc",
				"Scheme" : "",
				"AppName":"농협찾기"
			}
		},
		"NH농협" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhcodescan:",
				"AppStoreUrl" : "http://itunes.apple.com/kr/app/id414009782",
				"AppName":"농협Info"
			},
			"Android" : {
				"PackageName" : "nh.smart.codescan",
				"Scheme" : "",
				"AppName":"농협Info"
			}
		},
		"신토불이" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhocr:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/sintobul-i/id398001727?mt=8",
				"AppName":"신토불이"
			},
			"Android" : {
				"PackageName" : "nh.smart.ocr",
				"Scheme" : "",
				"AppName":"신토불이"
			}
		},
		"쇠고기" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhocr:",
				"AppStoreUrl" : "http://itunes.apple.com/kr/app/id398001727?mt=8",
				"AppName":"쇠고기"
			},
			"Android" : {
				"PackageName" : "nh.smart.ocr",
				"Scheme" : "",
				"AppName":"쇠고기"
			}
		},
//		"캠퍼스노트" : {
//			"iOS" : {
//				"URLScheme" : "com.nonghyup.nhcampus:",
//				"AppStoreUrl" : "http://itunes.apple.com/us/app//id481006196?mt=8",
//				"AppName":"캠퍼스노트"
//			},
//			"Android" : {
//				"PackageName" : "kr.co.kdml.nhcampus",
//				"Scheme" : "",
//				"AppName":"캠퍼스노트"
//			}
//		},
		"팜스테이" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhfarms:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nh-pamseutei/id414009268?mt=8",
				"AppName":"팜스테이"
			},
			"Android" : {
				"PackageName" : "nh.smart.farms",
				"Scheme" : "",
				"AppName":"팜스테이"
			}
		},
		"NH퇴직연금" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhpension:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhtoejig-yeongeum/id485251662?mt=8",
				"AppName":"퇴직연금"
			},
			"Android" : {
				"PackageName" : "nh.smart.pension",
				"Scheme" : "",
				"AppName":"퇴직연금"
			}
		},
//		"NH매거진" : {
//			"iOS" : {
//				"URLScheme" : "com.nonghyup.nhmagazine:",
//				"AppStoreUrl" : "http://itunes.apple.com/us/app//id484423240?mt=8",
//				"AppName":"NH매거진"
//			},
//			"Android" : {
//				"PackageName" : "com.moazine.b2b.nhmagazine",
//				"Scheme" : "",
//				"AppName":"NH매거진"
//			}
//		},
		"NH사고팔고" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhbuyandsell2:",
				"AppStoreUrl" : "http://itunes.apple.com/kr/app/nhsagopalgo/id517675021?mt=8",
				"AppName":"NH사고팔고"
			},
			"Android" : {
				"PackageName" : "nh.smart.buyandsell",
				"Scheme" : "",
				"AppName":"NH사고팔고"
			}
		},
		"내가총무다" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhchongmu2:",
				"AppStoreUrl" : "http://itunes.apple.com/kr/app/naegacongmuda/id517673793?mt=8",
				"AppName":"내가총무다"
			},
			"Android" : {
				"PackageName" : "nh.smart.chongmu",
				"Scheme" : "",
				"AppName":"내가총무다"
			}
		},
		"NH스마트뱅킹" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.newsmartbanking:",
				"AppStoreUrl" : "https://itunes.apple.com/app/id1444712671",
				"AppName":"NH스마트뱅킹"
			},
			"Android" : {
				"PackageName" : "nh.smart.banking",
				"Scheme" : "nhsmartbank",
				"AppName":"NH스마트뱅킹"
			}
		},
		/*"nhbank" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhsmartbanking:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/new-nhseumateubaengking/id398002630?mt=8",
				"AppName":"NH스마트뱅킹"
			},
			"Android" : {
				"PackageName" : "nh.smart",
				"Scheme" : "nhsmartbank",
				"AppName":"NH스마트뱅킹"
			}
		},*/
		"NH기업스마트뱅킹" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhibzbanking:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhnonghyeob-gieobseumateubaengking/id572186085?mt=8",
				"AppName":"NH기업뱅킹"
			},
			"Android" : {
				"PackageName" : "nh.smart.nhibzbanking",
				"Scheme" : "",
				"AppName":"NH기업뱅킹"
			}
		},
		"꿈이룸" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhbucket:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhkkum-ilum/id583229473?mt=8",
				"AppName":"꿈이룸"
			},
			"Android" : {
				"PackageName" : "nh.smart.bucket",
				"Scheme" : "nhBucket",
				"AppName":"꿈이룸"
			}
		},
		"NH선불교통카드 길잡이" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"NH선불교통카드"
			},
			"Android" : {
				"PackageName" : "nh.smart.nfccard",
				"Scheme" : "",
				"AppName":"NH선불교통카드"
			}
		},
		"NH통합계산기" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhcal:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhtonghabgyesangi/id583846766?mt=8",
				"AppName":"NH통합계산기"
			},
			"Android" : {
				"PackageName" : "nh.smart.calculator",
				"Scheme" : "",
				"AppName":"NH통합계산기"
			}
		},
//		"나희의도전" : {
//			"iOS" : {
//				"URLScheme" : "com.nonghyup.nahee:",
//				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nahuiuidojeon/id591716212?mt=8",
//				"AppName":"나희의도전"
//			},
//			"Android" : {
//				"PackageName" : "",
//				"Scheme" : "",
//				"AppName":"나희의도전"
//			}
//		},
//		"식단정보" : {
//			"iOS" : {
//				"URLScheme" : "com.nonghyup.nhmenuinfo:",
//				"AppStoreUrl" : "https://itunes.apple.com/kr/app/sigdanjeongbo/id640396655?mt=8",
//				"AppName":"식단정보"
//			},
//			"Android" : {
//				"PackageName" : "nh.smart.nhmenuinfo",
//				"Scheme" : "",
//				"AppName":"식단정보"
//			}
//		},
//		"금융알림장" : {
//			"iOS" : {
//				"URLScheme" : "com.nonghyup.nhums:",
//				"AppStoreUrl" : "https://itunes.apple.com/kr/app/geum-yung-allimjang/id639509483?mt=8",
//				"AppName":"금융알림장"
//			},
//			"Android" : {
//				"PackageName" : "nh.smart.nhums",
//				"Scheme" : "",
//				"AppName":"금융알림장"
//			}
//		},
		"인맥의가치" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhecontacts:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/inmaeg-uigachi/id640406925?mt=8",
				"AppName":"인맥의가치"
			},
			"Android" : {
				"PackageName" : "nh.smart.personalNetwork",
				"Scheme" : "",
				"AppName":"인맥의가치"
			}
		},
		"NH바로바로" : {
			"iOS" : {
				"URLScheme" : "net.infobank.mnbank.nhbarobaro:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhbalobalo/id586859194?mt=8",
				"AppName":"NH바로바로"
			},
			"Android" : {
				"PackageName" : "net.infobank.mnbank.nhbarobaro",
				"Scheme" : "",
				"AppName":"NH바로바로"
			}
		},
		"NH원격상담" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"NH원격상담"
			},
			"Android" : {
				"PackageName" : "com.rsupport.rs.activity.nh",
				"Scheme" : "",
				"AppName":"NH원격상담"
			}
		},
		"모바일안심결제 UBPAY" : {
			"iOS" : {
				"URLScheme" : "com.harex.ubpay:",
				"AppStoreUrl" : "http://itunes.apple.com/kr/app/ubpay/id424564679?mt=8",
				"AppName":"모바일안심결제 UBPAY"
			},
			"Android" : {
				"PackageName" : "com.harex.android.ubpay",
				"Scheme" : "",
				"AppName":"모바일안심결제 UBPAY"
			}
		},
		"NH스마트청구서" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.nhmtax:",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhseumateucheong-guseo/id583251382?mt=8",
				"AppName":"NH스마트청구서"
			},
			"Android" : {
				"PackageName" : "nh.smart.mtax",
				"Scheme" : "",
				"AppName":"NH스마트청구서"
			}
		},
		"뱅크월넷(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"뱅크월넷(SKT)"
			},
			"Android" : {
				"PackageName" : "kr.or.kftc.mobilewallet",
				"Scheme" : "",
				"AppName":"뱅크월넷(SKT)"
			}
		},
		"뱅크월넷(KT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"뱅크월넷(KT)"
			},
			"Android" : {
				"PackageName" : "kr.or.kftc.mobilewallet_kt",
				"Scheme" : "",
				"AppName":"뱅크월넷(KT)"
			}
		},
		"funnyCon" : {
			"iOS" : {
				"URLScheme" : "com.nonghyup.funny:",
				"AppStoreUrl" : "http://itunes.apple.com/app/id702746714?mt=8",
				"AppName":"funnyCon"
			},
			"Android" : {
				"PackageName" : "com.appg.funnycon",
				"Scheme" : "",
				"AppName":"funnyCon"
			}
		},
		"NH농협생명" : {
			"iOS" : {
				"URLScheme" : "nhlife.customer:",
				"AppStoreUrl" : "http://itunes.apple.com/kr/app/nhnonghyeobsaengmyeong-mobail/id731207448?mt=8",
				"AppName":"NH농협생명"
			},
			"Android" : {
				"PackageName" : "com.nhlife.customer.mobile",
				"Scheme" : "",
				"AppName":"NH농협생명"
			}
		},
		"피싱가드" : {
			"iOS" : {
				"URLScheme" : "btworksapp.phishingguard:",
				"AppStoreUrl" : "http://itunes.apple.com/kr/app/pishing-gadeu/id698044360?mt=8",
				"AppName":"피싱가드"
			},
			"Android" : {
				"PackageName" : "net.btworks.phishingguard",
				"Scheme" : "",
				"AppName":"피싱가드"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(SKT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(SKT)"
			},
			"Android" : {
				"PackageName" : "com.skt.skaf.a000as00tm",
				"Scheme" : "",
				"AppName":"모바일티머니(SKT)"
			}
		},
		"모바일티머니(KT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(KT)"
			},
			"Android" : {
				"PackageName" : "com.kt.mtmoney",
				"Scheme" : "",
				"AppName":"모바일티머니(KT)"
			}
		},
		"모바일티머니(LGT)" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"모바일티머니(LGT)"
			},
			"Android" : {
				"PackageName" : "com.lgt.tmoney",
				"Scheme" : "",
				"AppName":"모바일티머니(LGT)"
			}
		},
		"스마트원" : {//<20151104:jhw>스마트OTP 사용자를 위한 스마트원 추가
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"스마트원"
			},
			"Android" : {
				"PackageName" : "com.atsolutions.smartone.otp.nfc",
				"Scheme" : "",
				"AppName":"스마트원"
			}
		},
		"올원뱅크" : {
			"iOS" : {
				"URLScheme" : "NHAllOneBank://",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/ol-wonbaengkeu-all-one-bank/id1138584631?mt=8",
				"AppName":"올원뱅크"
			},
			"Android" : {
				"PackageName" : "nh.smart.allonebank",
				"Scheme" : "",
				"AppName":"올원뱅크"
			}
		},
		"콕뱅크" : {
			"iOS" : {
				"URLScheme" : "NHCOK://",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhkogbaengkeu/id1131147442?mt=8",
				"AppName":"콕뱅크"
			},
			"Android" : {
				"PackageName" : "nh.smart.nhcok",
				"Scheme" : "",
				"AppName":"콕뱅크"
			}
		},
		"올원페이(앱카드)" : {
//			"iOS" : {
//				"URLScheme" : "nhallonepayansimclick://",
//				"AppStoreUrl" : "https://itunes.apple.com/app/id1177889176",
//				"AppName":"올원페이"
//			},
//			"Android" : {
//				"PackageName" : "nh.smart.nhallonepay",
//				"Scheme" : "",
//				"AppName":"올원페이"
//			}
			"iOS" : {
				"URLScheme" : "nhallonepayansimclick://",
				"AppStoreUrl" : "https://itunes.apple.com/app/id1177889176",
				"AppName":"올원페이(앱카드)"
			},
			"Android" : {
				"PackageName" : "nh.smart.nhallonepay",
				"Scheme" : "",
				"AppName":"올원페이(앱카드)"
			}
		},
		"에듀스케치" : {
			"iOS" : {
				"URLScheme" : "NHCheumSketch://",
				"AppStoreUrl" : "https://itunes.apple.com/us/app/nhnonghyeobkadeu-edyuseukechi/id1151778621?mt=8",
				"AppName":"에듀스케치"
			},
			"Android" : {
				"PackageName" : "com.esofting.nh",
				"Scheme" : "",
				"AppName":"에듀스케치"
			}
		},
		"스마트OTP공동앱" : {
			"iOS" : {
				"URLScheme" : "",
				"AppStoreUrl" : "",
				"AppName":"스마트OTP공동앱"
			},
			"Android" : {
				"PackageName" : "com.kftc.smartotp",
				"Scheme" : "",
				"AppName":"스마트OTP공동앱"
			}
		},
		"NH스마트인증" : {
			"iOS" : {
//				"URLScheme" : "com.nonghyup.signone:",
				"URLScheme" : "NHCertSignApp://",
				"AppStoreUrl" : "https://itunes.apple.com/kr/app/nhseumateu-injeung/id943638265?mt=8",
				"AppName":"NH스마트인증"
			},
			"Android" : {
				"PackageName" : "nh.smart.signone",
				"Scheme" : "",
				"AppName":"NH스마트인증"
			}
		}
	}

function openApp(appName, menuId, token, tbs){

	var iosMarketAdd = "https://itunes.apple.com/kr/app/id406473666?mt=8";
	var andMarketAdd = "market://details?id=nh.smart.card";

	var iosAppAdd = "nhcard://nh.smart.card?type=goMain&menuID=0";
	var andAppAdd = "nhcard://nh.smart.card?type=goMain&menuID=0";

	if(appName == undefined || appName == "" || appName == null || appName == "nhcard"){

		var appAdd = "nhcard://nh.smart.card?type=goMain&menuID=0";
		if(menuId && menuId != ""){

			appAdd = "nhcard://nh.smart.card?type=goMenu&menuID=" + menuId;

			if(String(menuId) == "0" || String(menuId) == "1" || String(menuId) == "2" || String(menuId) == "3"){
				appAdd = "nhcard://nh.smart.card?type=goMain&menuID=" + menuId;
			}
		}

		if(token && token != ""){
			appAdd = "nhcard://nh.smart.card?type=certification&token=" + token;

			if(tbs){
				appAdd += "&tbs=" + tbs;
			}
		}

		iosAppAdd = appAdd;
		andAppAdd = appAdd;

	}else{
		if(launchMap[appName]){
			iosMarketAdd = launchMap[appName]["iOS"]["AppStoreUrl"];
			iosAppAdd = launchMap[appName]["iOS"]["URLScheme"];
			andMarketAdd = "market://details?id=" + launchMap[appName]["Android"]["PackageName"];
			andAppAdd = launchMap[appName]["Android"]["Scheme"];
		}else{
			return;
		}
	}


    if(deviceType == "MOBILE"){

		var openAt = (new Date()).getTime();
    	var userAgent = navigator.userAgent.toLowerCase();

    	if(userAgent.search("android") > -1){
//	    		var chrome25 = userAgent.search("chrome") > -1 && navigator.appVersion.match(/Chrome\/\d+\d+/)[0].split("/")[1]>25;
//	    		var kikat = userAgent.indexOf("naver")!=-1 || userAgent.indexOf("daum") != -1;
//	    		if(chrome25 && !kikat){
    		if(andAppAdd == null || andAppAdd == '' ){

			}else{
				document.location.href = andAppAdd;
			}
//	    		}else{
//	    			location.replace("nhcard://nh.smart.card");
//	    		}
    	}else if(userAgent.search("iphone") > -1){
    		//location.replace(iosAppAdd);

    		if(parent){
    			parent.location.replace(iosAppAdd);
				//parent.location.href = iosAppAdd;
			}else{
				location.href = iosAppAdd;
//				document.location.replace(iosAppAdd);
			}
		}
    	setTimeout(function(){
    		if((new Date()).getTime() - openAt < 1000){
    			//안드로이드
    			if(userAgent.search("android") > -1){
    				document.location.href = andMarketAdd;
    			//IOS
    			}else if(userAgent.search("iphone") > -1){
    				if(parent){
    					parent.location.href = iosMarketAdd;
    				}else{
    					document.location.href = iosMarketAdd;
    				}
    				//location.replace(iosMarketAdd);
    			}
    		}
    	}, 500);

	}

}


function openMarket(appName, menuId, token, tbs){

	var iosMarketAdd = "https://itunes.apple.com/kr/app/id406473666?mt=8";
	var andMarketAdd = "market://details?id=nh.smart.card";

	if(launchMap[appName]){
		iosMarketAdd = launchMap[appName]["iOS"]["AppStoreUrl"];
		iosAppAdd = launchMap[appName]["iOS"]["URLScheme"];
		andMarketAdd = "market://details?id=" + launchMap[appName]["Android"]["PackageName"];
		andAppAdd = launchMap[appName]["Android"]["Scheme"];
	}else{
		return;
	}

    if(deviceType == "MOBILE"){
    	var userAgent = navigator.userAgent.toLowerCase();

		if(userAgent.search("android") > -1){
			document.location.href = andMarketAdd;
		//IOS
		}else if(userAgent.search("iphone") > -1){
			if(parent){
				parent.location.href = iosMarketAdd;
			}else{
				document.location.href = iosMarketAdd;
			}
			//location.replace(iosMarketAdd);
		}
    }
}

function getToken(){

	var jexAjax = jexjs.createAjaxUtil("IpCnB013S");

	var token = "";

	jexAjax.setting({
        'async' : false
    });

	jexAjax.execute(function(dat) {

        // 통신 중 Error 발생
        if ( dat['COMMON_HEAD']['ERROR'] )
        {
			var nowDate = new Date();
			token = nowDate.getFullYear();
			token = token * 100 + nowDate.getMonth() + 1;
			token = token * 100 + nowDate.getDate();
			token = token * 100 + nowDate.getHours();
			token = token * 100 + nowDate.getMinutes();
			token = token * 1000 + nowDate.getMilliseconds();

			var chars = "0 1 2 3 4 5 6 7 8 9 q w e r t y u i o p a s d f g h j k l z x c v b n m";
			var charsArry = chars.split(" ");

			for ( var int = 0; int < 13; int++) {
				token = String(token) + charsArry[Math.floor(Math.random() * charsArry.length)];
			}

        }
        else
        {
        	token = dat['Token'];
        }
    });

	return token;
}

/* 2018.05.19 leemingoo
 * 인증 관련 함수 호출 팝업
파라미터 값
title : 호출되는 팝업창의 제목
cert_type : 인증 방식 선택(여러개일경우 ,로 추가)
			cert_pri : 공인인증서 - 현재 입력폼 미 추가.
			                      차후 공인인증서 형식 확인 후 추가 가능할 시 추가 예정
				cert_allone : 올원페이 인증 - 현재 입력폼 미추가
			 			 차후 올원페이 형식 확인 후 추가 가능할 시 추가 예정
			cert_phone : 핸드폰 인증
						(핸드폰 인증의 경우 실제로 문자가 전송되기 때문에 테스트 계정의 정보 사용불가.
						 테스트 주민등록번호/성명에 본인의 정보로 입력하여 테스트 가능)
					        핸드폰 인증의 경우 프로세스 별 별도의 코드값이 필요하나 현재 테스트 용으로
					        동일한 코드값으로 가지고 오게 작업하였음.
					        차후 코드값이 생성됬을시 해당 코드값을 입력 할수 있는 파라미터 추가예정.
			cert_card : 카드 인증

callback : 처리후 콜백할 함수 명
     	  (첫번째 파라미터에 json형식으로 차후 추가 데이타가 필요할 시 제공 예정.)

프로세스가 정상적으로 처리 된 후 SessionObject의 CERTI_TOKEN에 임의의 키값을 제공.
해당 값 유무로 다음 프로세스에서 인증 유무를 확인 후 해당 세션값을 제거 필수!!!!!!!!!!
제거 예) sob.remove("CERTI_TOKEN");
*/
function call_certiProcess(param){
	//차후 레이어로 처리할 수 없는 인증이 추가될 시에 페이지로 변경 가능하도록 함수를 따로 추가하였음.
	var certAdd = JSON.parse(param.cert_add);
	var certArray = [];
	//기존 jsonObject param의 비 정렬로 인해 jsonArray로 변경
	for(pNames in certAdd){
		var data = certAdd[pNames];
		data.name = pNames;
		certArray.push(data);
	}
	param.cert_add = JSON.stringify(certArray);
	popup_cfLayerOpen('IpCnB002S',param);
}


function nhSetLocalStorage(key, value) {
	if(window.localStorage) {
		window.localStorage.setItem(key, value);
	}
}

function nhGetLocalStorage(key) {
	if(window.localStorage) {
		return window.localStorage.getItem(key);
	}
	else {
		return null;
	}
}

function nhGetObjectLocalStorage(key) {
	var value = nhGetLocalStorage(key);
	return value ? JSON.parse(value) : null;
}

function nhSetObjectLocalStorage(key, obj) {
	try{
		nhSetLocalStorage(key, JSON.stringify(obj));
	}catch(e){

	}
}


/** 2018.06.06 lmg 기간추가
 * setCookie
 * @param key
 * @param value
 * @param expDay (today 또는 일자)
 */
function nhSetCookie(key, value, expDay){
	var strCookie = key + "=" +value;
	if(expDay){

		var date = new Date();
		if(expDay == 'today'){
			expDay = "1";
			date.setDate(date.getDate()+parseInt(expDay));
			date.setHours(0, 0, 0, 0);
		}else{
			date.setDate(date.getDate()+parseInt(expDay));
		}
//		strCookie+=";expires="+date.toUTCString();
		strCookie+=";expires="+date.toGMTString();
//		strCookie+=";expires="+date.toString();
	}
	document.cookie = strCookie;
}

/**
 * getCookie
 * @param key
 * @returns {String}
 */
function nhGetCookie(key){

    var cookieArry = document.cookie.split(";");
    var returnVal = "";

    for ( var cI in cookieArry) {
    	var cookieDataArry = String(cookieArry[cI]).split("=");
    	if(String(cookieDataArry[0]).trim() == key && String(cookieDataArry[0]).trim() != ""){
    		returnVal = String(cookieDataArry[1]).trim();
    	}
	}

    return returnVal;
}

function common_setTitle(title){
	$('._main_header h1').text(title);
}

function getFormParamObject(frm){
	var array = frm.serializeArray();
	var arrayIndex = {};
	$.map(array,function(n,i){
		arrayIndex[n['name']] = n['value'];
	});

	return arrayIndex;
}

/**
 * <pre>
 * Object Value의 Byte길이 리턴
 * </pre>
 * @param Obj 	: object
 */
function getByteLenByObject(obj){
	return getByteLenByValue(obj.value);
}

function getByteLenByValue(value){
	var len	= 0;
	var fbyte = value;
	if ( fbyte == null ) return 0;
	for(var i=0;i<fbyte.length;i++){
		var c = escape(fbyte.charAt(i));
		if ( c.length == 1 )	len ++;
		else if ( c.indexOf("%u") == 0 )	len += 2;
        else if ( c.indexOf("%0A") == 0 )	len += 2;
		else if ( c.indexOf("%") == 0 )	len += c.length/3
	}
	return len;
}


/**
 * maxbyte 체크 후 return 처리 
 * @param obj
 * @param maxByte
 * @returns {Boolean}
 */
function fnChkByte(obj, maxByte) {
    var str = obj.val();
    var str_len = str.length;
    
    var rbyte = 0;
    var rlen = 0;
    var str2 = "";
    
    for(var i = 0; i < str_len; i++) {
        var c =   escape(str.charAt(i));
        if ( c.length == 1 )	rbyte ++;
		else if ( c.indexOf("%u") == 0 )	rbyte += 2;
        else if ( c.indexOf("%0A") == 0 )	rbyte += 2;
		else if ( c.indexOf("%") == 0 )	rbyte += c.length/3;
        
        if(rbyte <= maxByte) {
            rlen = i + 1;
        }
    }
    var returnChkByte =true;
    if(rbyte > maxByte) {
        str2 = str.substr(0, rlen);
        obj.val(str2);
        fnChkByte(obj, maxByte);
        returnChkByte =true;
    } else {
    	obj.parent().find(".byteInfo").html(rbyte+" / "+maxByte);
        returnChkByte =false;
    }
    return returnChkByte;
}

/**
 * messagecode, arg 체크 후 return 처리
 * @ nhMessageFormat(msgCode['E0442'],3)
 * @param obj
 * @param arguments
 * @returns message {arg} message
 */
function nhMessageFormat(obj,arguments){
    var message = obj.replace("{0}",arguments);
	return message;
}