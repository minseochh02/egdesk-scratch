/**
 * 우편번호검색 공통팝업 호출
 * global: 1일경우 글로벌
 */
function common_cfZipSearch (formNm, callbackFunction, global) {

    var submitform = eval("document."+formNm);
    var zipService = "IPCNA100P";
    if(global == "1") {
        zipService = "PGCNA200P";
    }
    
    // 현재 포커스 저장
    if (common_FOCUS_LAYER_ID == null) {
        common_FOCUS_LAYER_ID = $('*:focus');
    }

    var submitform = eval("document."+formNm);
    if($(submitform).find('#zip_pop_callback').length == 0){
        
        var element = document.createElement('INPUT');
        element.type = "hidden";
        element.name = "zip_pop_callback";
        element.id = "zip_pop_callback";
        element.value = callbackFunction;
        submitform.appendChild(element);
    
        $('#zipSearchDialog').common_movePage(zipService, submitform ).done(function(){ 
             $('#zipSearchDialog').open({movable : true});
             try {
                 contentLoadComplete();
             } catch (e) {}
        });
    }else{ 
        $('#zip_pop_callback').val(callbackFunction);
        $('#zipSearchDialog').common_movePage(zipService, submitform ).done(function(){ 
             $('#zipSearchDialog').open({movable : true});
             try {
                 contentLoadComplete();
             } catch (e) {}
        });
    }    
}
/**
 * 우편번호검색 서브팝업 호출 : 팝업 내 호출시 사용.
 * global: 1일경우 글로벌
 * 콜백함수만을 호출하여 처리
 */
function common_cfZipSubSearch (callBackFunc, global) {
   
    var zipService = "IPCNA100P";
    if(global == "1") {
        zipService = "PGCNA200P";
    }    
    popup_cfLayerSubOpen(zipService,{'zip_pop_callback' : callBackFunc,'isSubYn' :'Y'});
}


/**
 * 우편번호,SQNO 받고 해당 주소리턴 (구주소용)
 *
 */
function common_getZipAddress(code, sqno){
    var returnVal ='';
    var paramValue = {CODE : code, 
                      SQNO : sqno };
    httpSend("IPCNA255S", paramValue, function(responseJson){returnVal= responseJson["zipAddress"];}, function(responseJson){}, {async:false});
    return returnVal;    
}

/**
 * 우편번호,SQNO 받고 해당 주소리턴 (신주소용)
 *
 */
function common_getNewZipAddress(code, sqno){
    var returnVal ='';
    var paramValue = {CODE : code, 
                      SQNO : sqno };
    httpSend("IPCNA256S", paramValue, function(responseJson){returnVal= responseJson["zipAddress"];}, function(responseJson){}, {async:false});
    return returnVal;    
}


/**
 * <pre>
 * 리포트 인쇄 ( CABSOFT 솔루션연계 )
 * </pre>
 * @param reportTitle : 리포트타이틀         
 * @param reportFile : 서식명 
 * @param reportData : 리포트대상 데이타
 */
/*
function common_cfReportPrint ( reportTitle, reportFile, reportData, reportChartImgName ) {
    
    // Form 받기
    var reportSendFrm = document.getElementById ( "reportSendFrm" ) ;
    var _service_ID = "/IpCnB000S.act";    
    
    // Form Element에  값넣기
    reportSendFrm.reportTitle.value = reportTitle;
    reportSendFrm.reportFile.value = reportFile;
    reportSendFrm.reportData.value = reportData;
    //대량Data추가
    reportSendFrm.massiveYN.value = $('#massiveYN').val();
    reportSendFrm.massiveType.value = $('#massiveType').val();
    
    // 글로벌 적용
    if(window["G_WEB"] == "true"){
          reportSendFrm.reportGlobalYN.value = "true";
          _service_ID = "PGCNB000S.view";
    }else{
          reportSendFrm.reportGlobalYN.value = "false";
    }    

    // 차트이미지이름 입력
    if ( reportChartImgName != null && reportChartImgName != undefined ) {
        reportSendFrm.reportChartImgName.value = reportChartImgName;
    }
    
    // 리포트 솔루션 팝업 띄움
    common_cfOpenWinPop (_service_ID ,
                          "pop_eForm", 
                          "reportSendFrm", 
                          ["1000","800","0","0","no","no","no","no","no","no"] );
}
*/


/**
 * <pre>
 * 리포트 인쇄 위한 Form설정 ( CABSOFT 솔루션연계 )
 * </pre>
 */
/*
function common_cfReportFormInit() {
    var html = "";
    html += "<form action='' name='reportSendFrm' id='reportSendFrm' method='post'>";
    html += "   <input type='hidden' name='reportTitle' id='reportTitle' value='' />";
    html += "   <input type='hidden' name='reportFile' id='reportFile' value='' />" ;
    html += "    <input type='hidden' name='reportData' id='reportData' value='' />";
    html += "    <input type='hidden' name='reportChartImgName' id='reportChartImgName' value='' />";
    html += "    <input type='hidden' name='reportXmlType' id='reportXmlType' value='' />";
    html += "    <input type='hidden' name='reportGlobalYN' id='reportGlobalYN' value='' />";
    // 대용량 처리로직 추가
    html += "    <input type='hidden' name='totalCount' id='totalCount' value='' />";
    html += "    <input type='hidden' name='massiveYN' id='massiveYN' value='' />";
    html += "    <input type='hidden' name='massiveType' id='massiveType' value='' />";
    html += "</form>";
    $("body").append(html);
}    
*/

/**
 * <pre>
 * 리포트 인쇄 위한 Form설정 ( CABSOFT 솔루션연계 )
 * common_cfReportPrint(파일 경로, xml, 타이틀)
 * ViewReport("html.jsp","html_service.jsp","FAFF002_001","PDF","계정간자금이체총괄표1", xml);
 * </pre>
 */
function common_cfReportPrint(reportFilePath, xmlData, title) {
    /*
    ViewReport("/thirdparty/cabsoft/cdoc/eform/html.jsp","/thirdparty/cabsoft/cdoc/eform/html_service.jsp"
            ,"ic/cn/cbttr1313","PDF","테스트서식", xmlData);
    */
    ViewReport("/thirdparty/cabsoft/cdoc/eform/html.jsp","/thirdparty/cabsoft/cdoc/eform/html_service.jsp"
            ,reportFilePath ,"PDF", title, xmlData);
}

function ViewReport(turl, Servlet,ReportFile,Process,rptTitle,xmldata,rptpasswd,requestpwd){
    var f = "width=830,height=800,toolbar=no,location=no,directories=no,status=no,menubar=no,scrollbars=no,copyhistory=no,resizable=yes,left=0,top=0";
    
    window.open ("","ReportView",f);
    f = makeForm(turl);
    f.appendChild(addData('Servlet', Servlet));
    f.appendChild(addData('ReportFile', ReportFile));
    f.appendChild(addData('Process', Process));
    f.appendChild(addData('rptTitle', rptTitle));
    f.appendChild(addData('rptpasswd', rptpasswd));
    f.appendChild(addData('reqpasswd', requestpwd));
    f.appendChild(addData('XmlData', xmldata));
    f.target = "ReportView";
    f.submit();
}

function makeForm(url){
    var f = document.createElement("form");
    f.setAttribute("method", "post");
    f.setAttribute("action", url);
    document.body.appendChild(f);
      
    return f;
}

function addData(name, value){
    var i = document.createElement("input");
    i.setAttribute("type","hidden");
    i.setAttribute("name",name);
    i.setAttribute("value",value);
    return i;
}

/**
 * ecrm - e 마케팅 시스템 
 * <pre>
 * ex)
 *     common_ecrm('dp_id', '상품코드', function(response){});
 *     common_ecrm('dp_id', {CATE : '1'}, function(response){});
 * </pre>
 * @param dp : DP ID
 * @param param : 상품코드(String) 또는 파라미터(JSON Object)
 */
function common_ecrm(dp, param, callbackSuccess, callbackFail){
    var paramValue = { dp : dp, saac : dp };
    if (param) {
        if (typeof(param) == 'string' || typeof(param) == 'number') {
            paramValue = $.extend({}, paramValue, { PSN_FNC_WRS_C : param });
        } else {
            paramValue = $.extend({}, paramValue, param);
        }
    }
    var options = {
            useProgress : false
    };
    
    try{
        httpSend("IPCNA320S", paramValue, callbackSuccess, callbackFail, options);
    }catch(e){
        console.log('[common_ecrm][실패] ==> ' + e);
        callbackFail();
    }
}

//뱅크 페이지로 이동
function goNHBankPage(viewId){
    if(viewId){
        common_movePage('IpCnB021S.act',{DSN_ADR:viewId},{target:'_blank'});
    }else{
        common_movePage('IpCnB021S.act',{},{target:'_blank'});
    }
}

//SSO 미연동 페이지로 이동(개발 / 운영 양쪽 URL이 다르지 않을 경우 사용 불필요)
//urlName : reload properties name
//pathName : urlName을 제외한 전체 path
function forwardPage(urlName,pathName,isNewTarget){
    var target ={};
    if(isNewTarget){
        target = {
            target:'_blank'
            , noBlocking : true
        };
    }
    common_movePage('forwarURL',{URL_NAME:urlName,DSN_ADR:pathName},target);
    
}


// 2020.02.27 추가 조재용계장님 요청 
function call_addcertiProcess(param){
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
    popup_cfLayerOpen('IpCnB004S',param);
}


/**
 * 오류안내 HTML
 */
function open_layer_html(txt, divObj, width, height, xpos, ypos) {    
    // 현재 포커스 저장
    if (common_FOCUS_LAYER_ID == null) {
        common_FOCUS_LAYER_ID = $('*:focus');
    }
    
    //20231207 - 두번째 레이어 팝업으로 호출 시 기존팝업 focusid가 존재하여 초기화.
    popup_FOCUS_LAYER_ID = null; 

    if ( typeof jQuery("#" + divObj).html() == "undefined") {
        jQuery("body").append('<div id="' + divObj + '" class="popup-wrap full" style="z-index:8000;"></div>');
    }

    var inner_html_txt = txt;
    var obj = document.getElementById(divObj);
    if(obj != null && obj != undefined) {
        obj.innerHTML = inner_html_txt;
    }
    //$('#layerDiv_errPop').open();
    
    //$.jQueryPopup(divObj);
	popup_open(divObj);
    popup_resize();
  //임시 상세안내코드 열기
    error_open();

}

//임시 상세안내코드 열기
function error_open(){
	
	$('.error_open').click(function(){
		var d=$('.error_message').css('display');
		if(d=='block'){
			$('.error_message').css({
				display:'none'
			})
		} else{
			$('.error_message').css({
				display:'block'
			});
		}
		return false;
	});	
}


function getErrorHTML(errObject) {
    var errorCode = errObject.errorCode;
    var subErrorCode = "";
    var guid = errObject.guid;
    var detailView = "";
    var rmsSvc = errObject.rmsSvc;
    var apSvrNm = errObject.apSvrNm;
    var orgErrorCode = errObject.orgErrorCode;
    var errSvrInfo = errObject.errSvrInfo;
    var errPrgLine = errObject.errPrgLine;
    var errTitle = errObject.errTitle;
    var vouchErrMsg = "일시적 사정으로 서비스가 불가하오니 잠시후 이용해 주십시오.<br/>자세한 사항은 NH농협카드 IT담당자에게 문의하시기 바랍니다.";
    
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
        detailView = rmsSvc + errObject.errFlnm + " > " + errObject.orgErrorCode + " > " + errPrgLine + guid;
    }else{
        detailView = rmsSvc + errObject.errPrgName + " > " + errObject.orgErrorCode + " > " + errPrgLine + guid;

        detailView = rmsSvc;

        if(errObject.errPrgName != undefined && errObject.errPrgName != null && errObject.errPrgName != 'null' && errObject.errPrgName.length > 0){
            detailView += errObject.errPrgName + " > ";
        } 

        detailView += errObject.orgErrorCode;

        if(errObject.errPrgLine  != undefined && errObject.errPrgLine  != null && errObject.errPrgLine  != 'null' && errObject.errPrgLine .length > 0){
            detailView += " > " + errPrgLine + guid;
        }
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
     
    } else if( (errObject.errMsg == undefined || errObject.errMsg == 'undefined' || errObject.errMsg == null || errObject.errMsg == 'null') ) {
        if ( common_cfGetMessage(errorCode) != undefined ) {
            message = common_cfGetMessage(errorCode);
        } else {
            message = common_cfGetMessage("I0462");
        }
    } else {
        if (errObject.errMsg.indexOf('OCSP_') > -1 || errObject.errMsg.indexOf('CERT_') > -1) {
            checkFailYn = "Y";
            message = common_cfGetMessage("E0434");
        } else {
        	message = errObject.errMsg;
        } 
    }
    
    //바우처 오류메시지
    if (errorCode.indexOf("JEXN3000001")>-1 && serviceId.indexOf("iv") > -1) {
    	message = vouchErrMsg;
    }
    
    if ( typeof errTitle == 'undefined' || errTitle.trim() == "" ) {
        errTitle = "이용에 불편을 드려 죄송합니다.";
    }

    //간편인증 이용자 타 매체 이동시 오류팝업
    
    var onClinkEventHtml = "onclick='closeErrorLayer(\"" +returnServiceId+ "\", \"" + orgErrorCode + "\", \"" + serviceId + "\", true);'";
    
    if(errorCode == 'MCPR98019'){
        checkFailYn = "Y";
        message = common_cfGetMessage("E0349");
    } 
    
    var err_HTML = "";
    err_HTML += "<div class=\"popup\">";
    err_HTML += "    <div class=\"pop-contain\">";
    err_HTML += "        <div class=\"pop-cont s\" tabindex=\"-1\" role=\"dialog\">";
    err_HTML += "            <div class=\"pop-head\">";
    err_HTML += "                <h1 class=\"title\">" + common_cfGetMessage("I0522") + "</h1>";
    err_HTML += "            </div>";
    err_HTML += "            <div class=\"pop-body franchise\">";
    err_HTML += "                <div class=\"pop-inner\">";
    err_HTML += "                    <section>";
    err_HTML += "                        <div class=\"info-area\">";
    err_HTML += "                            <p class=\"title\">" + errTitle + "</p>";
    err_HTML += "                            <p class=\"add-text\">" + message + "</p>";
    //err_HTML += "                            <p class=\"guide-text\">" + common_cfGetMessage("I0520") + " : "  + subErrorCode + ", " + errSvrInfo + "</p>";
    err_HTML += "                            <div class=\"message-box\">";
    err_HTML += "                                <p class=\"title\">" + common_cfGetMessage("I0520") + "</p>";
    err_HTML += "                                <div class=\"text-area\">";
    err_HTML += "                                    <span class=\"text\">" + subErrorCode + ", " + errSvrInfo + "</span>"; // 90601, 16.74-01
    err_HTML += "                                    <button type=\"button\" class=\"error_open btn-secondary btn-line s\"><span>상세안내코드</span></button>";
    err_HTML += "                                    <span class=\"sub error_message\">" + detailView + "</span>"; // ICBC 0500R:icbc0450tC ><br>IC CD00019 > 160
    err_HTML += "                                </div>";
    err_HTML += "                            </div>";
    err_HTML += "                        </div>";
    err_HTML += "                        <div class=\"bottom-info\">";
    err_HTML += "                            <ul>";
    //err_HTML += "                                <li>자세한 사항은 <strong>농협 고객행복센터</strong> (<a href=\"tel:1644-4000\">1644-4000</a>)에 문의하시기 바랍니다.</li>";
    
    if(serviceId.indexOf("iv") > -1){//바우처 오류메시지
    	err_HTML += "                                <li>죄송합니다. 자세한 사항은  <b>NH농협카드 담당자</b>에게 문의하시기 바랍니다.</li>";
    } else {
    	err_HTML += "                                <li>자세한 사항은 <strong>NH농협카드 고객행복센터 (1644-4000)</strong>에 문의하시기 바랍니다.</li>";
    }
    
    //err_HTML += "                                <li>" + common_cfGetMessage("I0523") + "<span>" + phonNumber + "</span>"+common_cfGetMessage("I0524") + "</li>";
    err_HTML += "                            </ul>";
    err_HTML += "                        </div>";
    err_HTML += "                    </section>";
    err_HTML += "                </div>";
    err_HTML += "            </div>";
    err_HTML += "            <div class=\"btn-area sticky\">";
    err_HTML += "                <button type=\"button\" class=\"btn-primary m layer-pop-close\" " + onClinkEventHtml + "><span>확인</span></button>";
    err_HTML += "            </div>";
    err_HTML += "            <button type=\"button\" class=\"btn-close layer-pop-close\" " + onClinkEventHtml + "><span>팝업 닫기</span></button>";
    err_HTML += "        </div>";
    err_HTML += "    </div>";
    err_HTML += "</div>";
    return err_HTML;
}


function closeErrorLayer(returnServiceId, orgErrorCode, cuServiceId, isGlobal){
    
    if (isGlobal == null || isGlobal == undefined) {
        isGlobal = true;
    }

    var serviceId = "";
    
    // 로그인관련 에러라면 로그인 페이지로 이동.
    if ('REQ_LOGIN' == orgErrorCode) {
        serviceId = "iccn0000i";
    }

    if ('NA11005' == orgErrorCode || 'NA11007' == orgErrorCode 
     || 'NA11009' == orgErrorCode || 'NC12002' == orgErrorCode 
     || 'NW11101' == orgErrorCode || 'NW11102' == orgErrorCode
     || 'NW11105' == orgErrorCode || 'NA11010' == orgErrorCode
     || 'REG_LOGIN' == orgErrorCode) {
        serviceId = "iccn0000i";
    } else {
        if (returnServiceId && returnServiceId != 'null') {
            serviceId = returnServiceId;
        }
    }
    
    // 이중 로그인 발생한 경우
    if ( 'LIC_7090' == orgErrorCode || 
         'LIC_7091' == orgErrorCode ||
         'LIC_7092' == orgErrorCode ||
         'LIC_7093' == orgErrorCode ||
         'LIC_7094' == orgErrorCode ||
         'LIC_7095' == orgErrorCode ||
         'LIC_7096' == orgErrorCode ||
         'LIC_7097' == orgErrorCode ||
         'LIC_7098' == orgErrorCode ||
         'DUP_LOGIN' == orgErrorCode ) { 
        //closeErrPop();
        document.location.href = "/";
    }

    // serviceId가 없으면 레이어 팝업을 닫고 있으면 navigate한다.
    if(serviceId != null && serviceId != ""){
        //closeErrPop();
        if (serviceId.indexOf(".hct") > -1) {
            common_moveHtml(serviceId);
        } else if (serviceId.indexOf(".menu") > -1) {
            common_moveMenu(serviceId);
        } else {
            common_movePage(serviceId);
        }
    }else{
        //closeErrPop();
    }
}

function getErrorLayerPopup(menuTitle, errorCode, errorTitle, message, guide, serviceId ) {
	var vouchErrMsg = "일시적 사정으로 서비스가 불가하오니 잠시후 이용해 주십시오.<br/>자세한 사항은 NH농협카드 IT담당자에게 문의하시기 바랍니다.";
    if ( menuTitle == null || menuTitle.trim() == "") {
        menuTitle = "안내메세지";
    }

    if ( errorCode == null || errorCode.trim() == "") {
        errorCode = "";
    }

    if ( errorTitle == null || errorTitle.trim() == "") {
        //errorTitle = "<span>비정상 접근 오류</span><br>서비스 이용에 불편을 드려 죄송합니다.";
        errorTitle = "서비스 이용에 불편을 드려 죄송합니다.";
    }

    if ( message == null || message.trim() == "") {
    	if(serviceId.indexOf("iv") > -1){//바우처 오류메시지
    		message = vouchErrMsg;
    	} else {
    		message = "비정상 접근 및 잘못된 접속으로 인해 서비스 불가합니다.<br>브라우저 창 종료 후 재접속 하셔서 거래해 주시기 바랍니다.";
    	}
        //message = "";
    }
    
    //바우처 오류메시지
    if ( errorCode.indexOf("JEXN3000001")>-1 && serviceId.indexOf("iv") > -1) {
    	message = vouchErrMsg;
    }
    
    if ( guide == null || guide.trim() == "") {
        guide = "";
    }

    var err_HTML = "";
    err_HTML += "<div class=\"popup\">";
    err_HTML += "    <div class=\"pop-contain\">";
    err_HTML += "        <div class=\"pop-cont s\" tabindex=\"-1\" role=\"dialog\">";
    err_HTML += "            <div class=\"pop-head\">";
    err_HTML += "                <h1 class=\"title\">" + menuTitle + "</h1>";
    err_HTML += "            </div>";
    err_HTML += "            <div class=\"pop-body\">";
    err_HTML += "                <div class=\"pop-inner\">";
    err_HTML += "                    <section>";
    err_HTML += "                        <div class=\"info-area\">";
    err_HTML += "                            <p class=\"title\" data-code=\"" + errorCode + "\">" + errorTitle + "</p>";
    err_HTML += "                            <p class=\"add-text\">" + message + "</p>";
    //err_HTML += "                            <p class=\"guide-text\">" + guide + "</p>";
    err_HTML += "                            <div class=\"message-box\">\n";
    err_HTML += "                                <p class=\"title\">안내코드</p>\n";
    err_HTML += "                                <div class=\"text-area\">\n";
    err_HTML += "                                    <span class=\"text\">" + errorCode + "</span>\n";
    err_HTML += "                                    <button type=\"button\" class=\"error_open btn-secondary btn-line s\"><span>상세안내코드</span></button>\n";
    err_HTML += "                                    <span class=\"sub error_message\">" + guide + "</span>\n";
    err_HTML += "                                </div>\n";
    err_HTML += "                            </div>\n";
    err_HTML += "                        </div>";
    err_HTML += "                        <div class=\"bottom-info\">";
    err_HTML += "                            <ul>";
    
    if(serviceId.indexOf("iv") > -1){//바우처 오류메시지
    	err_HTML += "                                <li>죄송합니다. 자세한 사항은  <b>NH농협카드 담당자</b>에게 문의하시기 바랍니다.</li>";
    } else {
    	err_HTML += "                                <li>자세한 사항은 <strong>NH농협카드 고객행복센터 (1644-4000)</strong>에 문의하시기 바랍니다.<span style=\"color: white;\">500</span></li>";
    }
    err_HTML += "                            </ul>";
    err_HTML += "                        </div>";
    err_HTML += "                    </section>";
    err_HTML += "                </div>";
    err_HTML += "            </div>";
    err_HTML += "            <div class=\"btn-area sticky\">";
    err_HTML += "                <button type=\"button\" class=\"btn-primary m layer-pop-close\"><span>확인</span></button>";
    err_HTML += "            </div>";
    err_HTML += "            <button type=\"button\" class=\"btn-close layer-pop-close\"><span>팝업 닫기</span></button>";
    err_HTML += "        </div>";
    err_HTML += "    </div>";
    err_HTML += "</div>";
    return err_HTML;
}

/**
 * 조회 업무 Result
 *  1. 첫 조회 결과 출력 
 *     submitSearchResultByAuth([targegId], [argeForm])
 *     예시 ) submitSearchResultByAuth("result", jQuery("#form02")
 *  2. 추가 조회 Append
 *     submitSearchResultByAuth([targegId], [argeForm], appendTarget, resultTarget, divNextPageTarget)
 *     예시 ) submitSearchResultByAuth("result", jQuery("#form02"), 'resultTable', 'div.payment-wrap', 'button.btn-more')
 */
function submitSearchResultByAuth(targetId, form, appendTarget, resultTarget, divNextPageTarget) {
    submitSearchResultService(targetId, "iccn0200r", form, appendTarget, resultTarget, divNextPageTarget);
}

function submitSearchResultService(targetId, serviceId, form, appendTarget, resultTarget, divNextPageTarget, option) {
    if ( appendTarget == null && resultTarget == null ) {
        jQuery("#" + targetId).common_movePage(serviceId, form).done(function(data, status, xhr){
            $('html').animate({scrollTop : $("#"+targetId).offset().top-$(".header").height()-10}, 300);
        });
    } else {
        jQuery('<div></div>').common_movePage(serviceId, form).done(function(data, status, xhr){
            // 기존에 출력된 정보 삭제
            if ( option != null && typeof option == "boolean" && option ) {
                jQuery("#" + targetId + " " + resultTarget).remove();
            }

            // 목록 출력
            jQuery(data).find(resultTarget).each(function() {
                jQuery("#" + targetId + " #" + appendTarget).append(jQuery(this)[0]);
            });

            // 더보기 버튼 변경
            if ( jQuery(data).find(divNextPageTarget).length == 1) {
                jQuery("#" + targetId + " " + divNextPageTarget).parent().html(jQuery(data).find(divNextPageTarget).parent().html());
            } else if ( jQuery(data).find(divNextPageTarget).length == 0) {
                jQuery("#" + targetId + " " + divNextPageTarget).parent().remove();
            }

            // 완료 후 실행 함수
            if ( option != null && typeof option == "object" && typeof option.afterFunction == "function" ) {
                option.afterFunction();
            }
        });
    }
}

function submitSearchResultDetail(serviceId, form) {
    $("#content02").common_movePage(serviceId, form, {"showContent":"02"}).done(function(data, status, xhr){
        
        // 아코디언 유무 확인
        if(jQuery(data).find(".info-list").length > 0 )  {
            accordian.init();
        }
    });
}

/**
 * 비밀번호 유효성 체크
 */
function submitPasswordCheck(form, afterFunc) {
    // 비밀번호 유효성 체크
    npPfsCtrl.waitSubmit(function(){
        httpSend("iccn0050r", form,
            function ( callbackData ) {
                if ( callbackData["checkResult"] ) {
                    // 정상 
                    if ( afterFunc != null && typeof afterFunc == "function") {
                        afterFunc();
                    } else {
                        return true;
                    }
                } else {
                    // 오류
                    nhAlert(callbackData["checkResultMSG"]);
                    return false;
                }
            },
            function(data, status, xhr){
                common_cfUserDefinedErrorPop(data,status,xhr);
                
            },
            { useProgress:false, keyProtect:true }
        );
    });
    
}

/**
 * 카드비밀번호 유효성 체크
 */
function cardPasswordCheck(form, afterFunc) {
    // 비밀번호 유효성 체크
    npPfsCtrl.waitSubmit(function(){
        httpSend("iccg0320r_2", form,
            function ( callbackData ) {
                if ( callbackData["checkResult"] ) {
                    // 정상 
                    if ( afterFunc != null && typeof afterFunc == "function") {
                        afterFunc();
                    } else {
                        return true;
                    }
                } else {
                    // 오류
                    nhAlert(callbackData["checkResultMSG"]);
                    return false;
                }
            },
            function(data, status, xhr){
                common_cfUserDefinedErrorPop(data,status,xhr);
                
            },
            { useProgress:false, keyProtect:true }
        );
    });
    
} ;

/**
 * 메인페이지로 이동 - 개인카드
 */
function moveP_CardMainPage(){
    forwardPage(common_cfGetDomain('CC00'),"IpCo0001M.act",true);
}

/**
 * 메인페이지로 이동
 */
function moveMainPage(){
    if (IS_BIZ_CARD_MOBILE) {
        common_movePage(MOBILE_MAIN_URL);
    } else {
        common_movePage(PC_MAIN_URL);
    }
}

/**
 * 메인페이지로 이동 - 가맹점
 */
function moveMchtMainPage(){
    if (IS_BIZ_CARD_MOBILE) {
        common_movePage(PC_MCHT_MAIN_URL);
    } else {
        common_movePage(PC_MCHT_MAIN_URL);
    }
}

/**
 * 메인페이지로 이동 - 바우처
 */
function moveVouchMainPage(){
	common_movePage(PC_VOUCH_MAIN_URL);
}

/**
 * 로그인페이지로 이동
 */
function moveLoginPage(input_menuId){
    var menuId = "";
    if ( input_menuId != null && typeof input_menuId != "undefined" ) {
        menuId = { 
            menu_id : input_menuId
        };
    }

    if (IS_BIZ_CARD_MOBILE) {
        common_movePage(MOBILE_LOGIN_URL, menuId);
    } else {
        common_movePage(PC_LOGIN_URL, menuId);
    }
}

/**
 * 로그인페이지로 이동 - 가맹점
 */
function moveMchtLoginPage(){
    if (IS_BIZ_CARD_MOBILE) {
        common_movePage(MOBILE_MCHT_LOGIN_URL);
    } else {
        common_movePage(PC_MCHT_LOGIN_URL);
    }
}

/**
 * 로그인페이지로 이동 - 바우처
 */
function moveVouchLoginPage(){
	common_movePage(PC_VOUCH_LOGIN_URL);
}

/**
 * 약관보기 공통팝업 호출
 * sqno : jexAdmin 업무관리 > 프로퍼티관리 > WRS_STLT에 등록 후 사용
 */
function service_termsPopupOpen(sqno, obj){
	//20231208 - 두번째 레이어 팝업으로 호출 시 기존팝업 focusid가 존재하여 초기화.
    popup_FOCUS_LAYER_ID = null; 
	var objId = $(obj).parent().find('input').prop("id");
	popup_subModalLayerOpen('terms_popup', { WRS_STLT_SQNO : sqno, objId : objId} );
}

/**
 * 약관보기 공통팝업 호출
 * sqno : jexAdmin 업무관리 > 프로퍼티관리 > WRS_STLT에 등록 후 사용
 */
function service_manualPopupOpen(sqno, obj, prop, downloadYn, callback){
	var objId = $(obj).prop("id");
	var param = {
				WRS_STLT_SQNO 	: sqno
				, objId 		: objId
				, propertyYn	: prop
				, callback 		: callback
				, downloadYn 	: downloadYn
			}
	popup_subModalLayerOpen('manual_popup', param );
}

/**
 * 정보관리 > 부서정보 관리 화면 이동
 */
function service_userInfo(){
    common_moveMenu('icca0', {menu_id : 'icca0'});
}

/**
 * 인쇄 및 엑셀저장 오류 도움말 팝업 호출
 */
function service_excelHelper(){
    popup_modalLayerOpen('/ic/qi/icqi0010.html');
}

/**
 * 뒤로가기 HistoryBack
 * param : removeArr (제거할 서비스ID)
 * ex) removeArr = "/iccn0040r.act,/iccn0040i.act";
 */
function service_prevPage(removeArr) {
	var historyArr = nhGetObjectLocalStorage("NHCARD_HISTORYS");
	
	// 팝업 및 제거할 서비스ID 히스토리 삭제
	if(!(removeArr == ""|| removeArr ==null || removeArr ==undefined || removeArr == 'undefined')) {
		removeArr = removeArr.split(",");
		historyArr = historyArr.filter(item => !removeArr.includes(item.url));
		console.log("removeArr :: >> " +removeArr);
	}
	
	var histotyLen = historyArr.length-2;
	var returnUrl = "";
	var returnParam = historyArr.pop().param;
	
	if(histotyLen > -1) {
		returnUrl = historyArr[histotyLen].url;
	} 
	
	// 뒤로가기시 스탭 -1 로직 추가
	var stepIdx = Number(returnParam.step_idx)-1;
	returnParam.step_idx = stepIdx;
	
	// 이전페이지 이동시 같은서비스 이후 히스토리 삭제
	var idx = nhGetObjectLocalStorage("NHCARD_HISTORYS").findIndex(item => item.url == returnUrl);
	historyArr = historyArr.slice(0, idx+1);
	nhSetObjectLocalStorage("NHCARD_HISTORYS", historyArr);
	
	console.log("returnUrl :: >> [ "+returnUrl+"]");
	console.log("returnParam :: >> [ "+returnParam+"]");
	
	if(returnUrl  != "") {
		common_movePage(returnUrl, returnParam);
	} else {
		moveMainPage();	
	}
}

/**
 * History 삭제
 * param : serviceId (제거할 서비스ID)
 * ex) removeHistory("/iccn0040r.act");
 */
function removeHistory(serviceId) {
	if(serviceId == ""|| serviceId ==null || serviceId ==undefined || serviceId == 'undefined') {
		return false;
	}
	
	var historyArr = nhGetObjectLocalStorage("NHCARD_HISTORYS");
	historyArr = historyArr.filter(item => item.url != serviceId);
	
	nhSetObjectLocalStorage("NHCARD_HISTORYS", historyArr);
}

/**
 * History 초기화
 * ex) resetHistory();
 */
function resetHistory(){
	nhSetObjectLocalStorage("NHCARD_HISTORYS", "");
}

