//-----------------------------------------------------------------------------------------------------------------------
// * 고객사 전용(공통함수 필요시 추가해서 사용)
// * 작성일 : 2015-07-07
//-----------------------------------------------------------------------------------------------------------------------

/**
 * 인증서 필터링 설정값
 * CERT_Accept_Koscom
 * CERT_Accept_YesSign
 */
/*
var CERT_Accept_Koscom_sample
    = "1.2.410.200004.5.1.1.7|"  //증권전산, 법인, 상호연동
    + "1.2.410.200004.5.1.1.9|"  //증권전산, 개인, 용도제한(개인)*
    + "1.2.410.200004.5.1.1.5|"  //증권전산, 개인, 상호연동
    + "1.2.410.200004.5.2.1.2|"  //정보인증, 개인, 상호연동
    + "1.2.410.200004.5.2.1.1|"  //정보인증, 법인, 상호연동
    + "1.2.410.200004.5.3.1.9|"  //전산원,   개인, 상호연동
    + "1.2.410.200004.5.3.1.2|"  //전산원,   법인, 상호연동
    + "1.2.410.200004.5.4.1.1|"  //전자인증, 개인, 상호연동
    + "1.2.410.200004.5.4.1.2|"  //전자인증, 법인, 상호연동
    + "1.2.410.200005.1.1.1|"    //금결원,  개인, 상호연동
    + "1.2.410.200005.1.1.5|"    //금결원,  법인, 상호연동
    + "1.2.410.200012.1.1.1|"    //무역정보, 개인, 상호연동
    + "1.2.410.200012.1.1.3|"    //무역정보, 법인, 상호연동
;

var CERT_Accept_YesSign_sample
    = "1.2.410.200005.1.1.1|"    //금결원, 개인, 상호연동
    + "1.2.410.200005.1.1.2|"    //금결원, 법인, 용도제한(은행/보험/카드)
    + "1.2.410.200005.1.1.4|"    //금결원, 개인, 용도제한(은행/보험/카드)
    + "1.2.410.200005.1.1.5|"    //금결원, 법인, 상호연동
    + "1.2.410.200005.1.1.6.1|"  //금결원, 법인, 용도제한(기업뱅킹)
    + "1.2.410.200004.5.4.1.1|"  //전자인증, 개인, 상호연동
    + "1.2.410.200004.5.4.1.2|"  //전자인증, 법인, 상호연동
    + "1.2.410.200004.5.1.1.7|"  //증권전산, 법인, 상호연동
    + "1.2.410.200004.5.1.1.5|"  //증권전산, 개인, 상호연동
;
*/

function SITE_disableBrowser(message) {
    var DC_processingImageUrl = DelfinoConfig.processingImageUrl;
    if (jQuery("#dc_overlay") != null && jQuery("#dc_overlay").length > 0) return;
    var document = DelfinoConfig.insideIframe && DC_isIframe() ? top.window.document : window.document;
    var overlayHtml = '<div id="dc_overlay" style="z-index:100000;position:fixed; width:100%; height:100%; top:0px; left:0px; background-color: #000000; opacity: 0.3; filter: alpha(opacity=30);">';
    //overlayHtml = '<div id="dc_overlay" style="z-index:100000;position:fixed; width:100%; height:100%; top:0px; left:0px; background-color: rgba(0,0,0,0.0); opacity: 0.3; filter: alpha(opacity=30);">';
    if (message && DC_processingImageUrl) {
        overlayHtml += '<div style="z-index:100001;position:fixed;top:50%; height:100%;width:100%;">' + '<div style="margin: 0 auto; padding: 5px; width:150px; background-color:#fff; vertical-align:middle; font-weight:bold; text-align: center; color:#555;  border-radius:5px;">' + message + ' <img src="' + DC_processingImageUrl + '" style="vertical-align:middle"/>' + "</div>" + "</div>";
    } else if (DC_processingImageUrl) {
        overlayHtml += '<div style="z-index:100001;position:fixed;top:50%; height:100%;width:100%;">' + '<div style="margin: 0 auto; padding: 5px; width:26px; height:26px;  background-color:#fff; vertical-align:middle; font-weight:bold; text-align: center; color:#555;  border-radius:5px;">' + ' <img src="' + DC_processingImageUrl + '" style="vertical-align:middle"/>' + "</div>" + "</div>";
    }
    overlayHtml += "</div>";
    jQuery("body", document).append(overlayHtml);
}
//DC_disableBrowser = SITE_disableBrowser;
//window.DCrypto.goInstallPage = SITE_goInstallPage; //함수재정의필요

if (DC_browserInfo.MSIE && DC_browserInfo.version >= 11) {
    delfino.conf.handler.checkAjaxto = 5000; //미설치가 자주 나올경우 주석해제,미설치시 해당시간만큼 느려짐

    //JSONP 대신 ajax 로 원복시킴
    //delfino.conf.handler.supportSync = true;
    //delfino.conf.handler.ajaxto = 10000;
    //delfino.conf.handler.checkAjaxto = 10000;
}

Delfino4Html.unloadIframe = function() {
    this.inProgress = false;
    var fakeWindow = window;
    var fakeDocument = document;
    if (DelfinoConfig.insideIframe && DC_isIframe()) {
        fakeWindow = top.window;
        fakeDocument = top.window.document;
    }
    if (typeof window.orientation !== 'undefined' || window.navigator.userAgent.search(/ipad|iphone|android/i) > 0) {
        setTimeout(function() {
            this.removeAllAriaHidden();
        }.bind(this), 10);
    }
    if (this.newWindow) {
        this.newWindow.close();
        this.newWindow = undefined;
        window.DC_enableBrowser();
        return;
    }
    if (this.iframeDiv) {
        if (this.preloaded) {
            this.hideIframe();
        } else {
            if (jQuery(fakeDocument).has(this.iframeDiv).length == 1) {
                fakeDocument.body.removeChild(this.iframeDiv);
                $("body").append('<input id="dummyForIE" type="text" style="position:absolute;width:1px;height:1px;box-sizing:border-box;padding:0px;border:none;left:0;top:0;"/>');
                $("input#dummyForIE").focus();
                setTimeout(function() {
                    fakeWindow.focus && fakeWindow.focus();
                    $("input#dummyForIE").remove();
                }.bind(this), 1e3);
                this.removeMetaTag();
            }
        }
    }
    if (this.scrollBackup) {
        fakeWindow.scroll(this.scrollBackup.X, this.scrollBackup.Y);
    }
    window.DC_enableBrowser();
}
