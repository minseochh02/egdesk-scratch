
$(document).ready(function(){
    if( typeof jQuery("button.card-cvc").html() != "undefined" ) {
        jQuery("button.card-cvc").on("click", showCardInfoCVC);
    }
});

/**
 * Custom Alert
 * message : alert message
 * f : alert 확인 후 실행되는 스크립트 함수
 */
function nhAlert(message, f, z_index) {
    jQuery.close();
    if ( f != null ) {
        jQuery.alert(
            message,
            {
                callEvent:f
            }
        );
    } else {
        jQuery.alert(message);
    }

    if ( z_index != null) {
        jQuery("div.alert").css("z-index", z_index);
    }
}

/**
 * Custom Confirm
 * message : Confirm message
 * f_ok : 확인 버튼 클릭 후 실행되는 스크립트 함수
 * f_cancel : 확인 버튼 클릭 후 실행되는 스크립트 함수
 */
function nhConfirm(message, f_ok, f_cancel, str_ok, str_cancel, z_index) {
    jQuery.close(); 

    if ( str_ok == null ) {
        str_ok = "확인";
    }
    if ( str_cancel == null ) {
        str_cancel = "취소";
    }

    if ( f_ok != null && f_cancel != null) {
        jQuery.confirm(
            message,
            {
                  callEvent:f_ok
                , cancelEvent:f_cancel
                , confirmButton:str_ok
                , cancelButton:str_cancel
            }
        );
    } else if ( f_ok != null && f_cancel == null) {
        jQuery.confirm(
            message,
            {
                  callEvent:f_ok
                , confirmButton:str_ok
                , cancelButton:str_cancel
            }
        );
    } else if ( f_ok == null && f_cancel != null) {
        jQuery.confirm(
            message,
            {
                  cancelEvent:f_cancel
                , confirmButton:str_ok
                , cancelButton:str_cancel
            }
        );
    } else {
        jQuery.confirm(message);
    }

    if ( z_index != null) {
        jQuery("div.confirm").css("z-index", z_index);
    }
}

/**
 * 레이어 팝업 호출
 * as-is function : popup.js - function popup_cfLayerOpen
 * @param {String} targetpath : navigate API의 targetpath {String} Required 이동하고자 하는 경로값
 * @param {Object} param : navigate API의 param {Object} 페이지 전환시 다음 페이지로 넘기고자 하는 파라메터 값
 * @param {Object} option : navigate API의 option {Object} 부가적인 정보
 * @return {Object} navigate Object
 */
var popup_FOCUS_LAYER_ID = null;
function popup_crateModalLayerOpen(targetDivId, cls, index, targetpath, param, option) {
    // 현재 포커스 저장
    if (popup_FOCUS_LAYER_ID == null) {
        popup_FOCUS_LAYER_ID = $('*:focus');
    }

    if ( option != null && typeof option == "object" && typeof option.popupClear == "boolean" && !option.popupClear) {
        //pass
    } else {
        jQuery("#" + targetDivId).html("");
    }

    if ( typeof jQuery("#" + targetDivId).html() == "undefined") {
        jQuery("body").append('<div id="' + targetDivId + '" class="' + cls + '" style="z-index:' + index + ';"></div>');
    }

    if ( targetpath.indexOf(".html") > 0 ) {
        targetpath = "/content/html" + targetpath;
        jQuery("#" + targetDivId).load(targetpath, null, function() {
                $('html, body').addClass('popup-open');
                jQuery.jQueryPopup(targetDivId, popup_FOCUS_LAYER_ID);
                popup_afterCommonScript(jQuery("#" + targetDivId));
            }
        );
    } else {
        jQuery("#" + targetDivId).common_movePage(targetpath, param).done(function(){
            if ( jQuery("#" + targetDivId + " .popup").length != 0) {
                $('html, body').addClass('popup-open');
                jQuery.jQueryPopup(targetDivId, popup_FOCUS_LAYER_ID);
                popup_afterCommonScript(jQuery("#" + targetDivId));
            }
        });
    }
}

function popup_modalLayerOpen(targetpath, param, option) {
    popup_crateModalLayerOpen("modalLayerPopup", "", "", targetpath, param, option)
}

function popup_signLayerOpen(targetpath, param, option) {
    popup_crateModalLayerOpen("signLayerPopup", "pop-wrap", 2500, targetpath, param, option);
}

function addEvent_modalLayerClose(){
    jQuery.jQueryPopup("modalLayerPopup");
}

function popup_resize(){
    //$(window).trigger('resize'); // 팝업강제 리사이징
    layerpop.resize();
}

function popup_open(id, option){
    if (popup_FOCUS_LAYER_ID == null) {
        popup_FOCUS_LAYER_ID = $('*:focus');
    }
    
    jQuery.jQueryPopup(id, popup_FOCUS_LAYER_ID);
    if ( option != null && typeof option == "object" && typeof option.showIndex == "number") {
        var totalCount = jQuery("#" + id + " ul.swiper-wrapper > li").length;
        for(var i=0; i<totalCount; i++ ) {
            jQuery("#" + id + " button.swiper-button-prev").trigger("click");
        }
        for(var i=0; i<option.showIndex; i++ ) {
            jQuery("#" + id + " button.swiper-button-next").trigger("click");
        }
    }
    popup_afterCommonScript(jQuery("#" + id));
}

function popup_afterCommonScript(obj) {

    if( jQuery("input.ipt.date").length > 0 ) {
        datepicker.init();
    }

    layerpop.resize();
    layerpop.loop();
    createCommon.init();
}

function popup_close(id){
    jQuery.jQueryPopup(id);
}

function popup_subModalLayerOpen(targetpath, param, option) {
    popup_crateModalLayerOpen("subModalLayerPopup", "pop-wrap", 4000, targetpath, param, option);
}

function makeErrorClass(obj, msg){
    printTooltip({target:'#' + obj, message:msg});
}

function printTooltipInit() {
    jQuery("[name=error]").children().removeClass("error");
    jQuery("p[name=errMsg]").remove();
}

function printTooltip(option) {
    if ( option != null && typeof option == "object" ) {
        var target = "";
        var type = "error";
        var message = "";
        var afterFocus = "";
        var isAfterFocus = true;
        if ( typeof option.target == "string" ) {
            target = option.target;
        }

        if ( typeof option.type == "string" ) {
            type = option.type;
        }

        if ( typeof option.message == "string" ) {
            message = option.message;
        }

        if ( typeof option.afterFocus == "string" ) {
            afterFocus = option.afterFocus;
        } else {
            isAfterFocus = false;
        }
        
        var printForm = $(target).parent();
        if ( printForm.length != 0 ) {
        	jQuery("[name=errMsg]", printForm.parent()).remove();

            if ( type == 'none' ) {
                printForm.append("<p name='errMsg' class='txttip'>" + message + "</p>");
            } else {
                $(target).addClass(type);
                printForm.parent().append("<p name='errMsg' class='txttip " + type + "'>" + message + "</p>");
            }
        }

        if ( isAfterFocus ) {
	        if ( afterFocus != "" ) {
	            $(afterFocus).focus();
	        } else {
	            $(target).focus();
	        }
        }
    }
}

/**
 * 에러메세지 삭제
 * obj : id값
 */
function removeTooltip(obj){
    var target = $("#"+obj).parent();
    $("#"+obj).removeClass("error");
    $(target).parent().find('p[name=errMsg]').html("");
}

function showCardInfoCVC() {
    var html = "";
    html += "<div class=\"popup\">";
    html += "    <div class=\"pop-contain\">";
    html += "        <div class=\"pop-cont s\" tabindex=\"-1\" role=\"dialog\">";
    html += "            <div class=\"pop-head\">";
    html += "                <h1 class=\"title\">카드고유확인번호</h1>";
    html += "            </div>";
    html += "            <div class=\"pop-body\">";
    html += "                <div class=\"pop-inner\">";
    html += "                    <div class=\"title-area mb20\">";
    html += "                        <h2 class=\"main-title\">카드고유확인번호란?</h2>";
    html += "                        <p class=\"sub-title\">고객님이 소지한 카드 진위여부를 재확인하는 3자리 숫자로서, 카드실물 뒷면의 서명란에<br>인자된 <strong>7자리 숫자 중 뒤의 3자리 숫자</strong>를 말합니다.</p>";
    html += "                    </div>";
    html += "                    <div class=\"cvc-area\">";
    html += "                        <img src=\"/nhcb_web/content/images/common/img_cvc.png\" alt=\"서명란에 인자된 7자리 숫자 중 뒤의 3자리 숫자\">";
    html += "                    </div>";
    html += "                </div>";
    html += "            </div>";
    html += "            <div class=\"btn-area sticky\">";
    html += "                <button type=\"button\" class=\"btn-confirm border-ddd s5 layer-pop-close\"><span>닫기</span></button>";
    html += "            </div>";
    html += "            <button type=\"button\" class=\"btn-close layer-pop-close\"><span>팝업 닫기</span></button>";
    html += "        </div>";
    html += "    </div>";
    html += "</div>";
    open_layer_html(html, 'layerDiv_errPop');
}

/**
 * Custom SelectBox
 * selectbox를 ul 태크 apped 하는 커스텀 함수
 * */
function customSelectBoxView(){
		$(".sel-group").select_box({
			width : "160",
			height : "40px"
	});
}

function showContent_1to2() {
    jQuery("#content01").hide();
    jQuery("#content02").show();
    $(window).scrollTop(0);
}

function showContent_2to1() {
    jQuery("#content02").hide();
    jQuery("#content01").show();
    $(window).scrollTop(0);
}

function setContentEvent_1to2(tagString) {
    jQuery(tagString).on("click", function() {
        showContent_1to2();
    });
}

function setContentEvent_2to1(tagString) {
    jQuery(tagString).on("click", function() {
        showContent_2to1();
    });
}


/**
 * 우편번호검색 공통팝업 호출
 */
function sevice_cfZipSearch(callbackFunc, callbackFocusId) {
	
    if(callbackFunc == undefined || callbackFunc == ""){
    	callbackFunc = "callbackFunc";
    }
    
    if(callbackFocusId == undefined || callbackFocusId == ""){
    	callbackFocusId = "";
    }
    
    var param = {"callbackFunc" : callbackFunc
    		    ,"callbackFocusId" : callbackFocusId};
    
    console.log("focus "+ common_FOCUS_LAYER_ID);
    if (common_FOCUS_LAYER_ID == null) {
		common_FOCUS_LAYER_ID = $('*:focus');
	}

    popup_modalLayerOpen("iccn0040i", param);
}

/*
 * 파일다운로드
 * 20231129 - 웹취약성점검으로 path 대신 mft,was 프로퍼티 key값 보내주는 방식으로 변경
 * */
function common_localFileDownload(option){
	var frm   = "obj_frm";
	var newForm = $("<form></form>");
	newForm.attr("name"  , frm);
	newForm.attr("id"    , frm);
	newForm.attr("method", "post");
	newForm.attr("action", "ivcn0090r.act");
    newForm.attr("target", "_self");
	
	if ( typeof option.fileName == "string" ) {
		fileName = option.fileName;
    }
	if (typeof option.mftIdKey == "string" ) {
		mftIdKey = option.mftIdKey;
    }
    
    if (typeof option.wasPathKey == "string" ) {
		wasPathKey = option.wasPathKey;
    }
	
	newForm.append($('<input/>',{type:'hidden', name:'_fileName_', id:'_fileName_', value: fileName}));
	newForm.append($('<input/>',{type:'hidden', name:'_mftIdKey_', id:'_mftIdKey_', value: mftIdKey}));
	newForm.append($('<input/>',{type:'hidden', name:'_wasPathKey_', id:'_wasPathKey_', value: wasPathKey}));
	
	newForm.appendTo('div#content');
    newForm.submit();
}

