/*
 ***************************************************************************
 * nProtect Online Security, 1.13.0
 *
 * For more information on this product, please see
 * http://www.inca.co.kr / http://www.nprotect.com
 *
 * Copyright (c) INCA Internet Co.,Ltd  All Rights Reserved.
 *
 * 본 코드에 대한 모든 권한은 (주)잉카인터넷에게 있으며 동의없이 사용/배포/가공할 수 없습니다.
 *
 ***************************************************************************
 */
var w = window;
w.nua = (typeof(nua) == "undefined" || nua == null || nua == "") ? navigator.userAgent : nua;
w.ad = {
    hE: 1,
    cG: 2,
    bb: 3,
    fJ: 1,
    jt: 2,
    Ix: "__E2E_RESULT__",
    wG: "__E2E_UNIQUE__",
    jd: "__E2E_KEYPAD__",
    k5: "1.13.0",
    Qd: "20191105014216760"
};
w.uV = {
    dV: {
        Fz: "/crp/csolution/inca_nos/pluginfree/jsp/nppfs.install.jsp",
        Gf: "/crp/csolution/inca_nos/pluginfree/jsp/nppfs.key.jsp",
        zf: "/crp/csolution/inca_nos/pluginfree/jsp/nppfs.remove.jsp",
        eP: "/crp/csolution/inca_nos/pluginfree/jsp/nppfs.ready.jsp",
        zo: "/crp/csolution/inca_nos/pluginfree/jsp/nppfs.keypad.jsp",
        KeyPadJsonUrl: "/pluginfree/keypadjson/",
        CryptoUrl: "/crp/csolution/inca_nos/pluginfree/jsp/nppfs.crypto.jsp",
        cM: "https://supdate.nprotect.net/nprotect/nos_service/nos.service",
        dZ: "https",
        l5: 14440,
        Cc: 10,
        iI: "",
        dk: ad.fJ,
        kK: 300,
        Ux: 100,
        Qa: 15
    },
    ki: {
        FW: true,
        SK: true,
        FD: false,
        KV: true
    },
    di: {
        aF: {
            CODE: "10"
        },
        jV: {
            CODE: "20"
        },
        bx: {
            CODE: "30",
            TYPE: {
                Fedora: "10",
                Ubuntu: "20",
                CentOS: "30",
                OpenSUSE: "40",
                OTHER: "99"
            }
        }
    }
};
w.N = {
    m01: "보안프로그램이 업데이트되었습니다. 최신모듈로 업데이트가 필요합니다. 설치페이지로 이동하시겠습니까?",
    m02: "[nProtect Online Security] 모듈을 찾을 수 없습니다. 접속경로를 확인하시거나 관리자에게 문의하십시오.",
    m03: 'Microsoft IE7 이하 브라이저에서는 입력 form 양식에 div[class="%p%"] 항목이 필요합니다.',
    m04: "서버에서 키값을 받을 수 없습니다. 키발급 경로를 확인하거나 지속적으로 문제 발생시 서버관리자에게 문의하십시오.",
    m05: "개인방화벽을 실행할 수 있는 환경이 아닙니다.",
    m06: "키보드보안을 실행할 수 있는 환경이 아닙니다.",
    m07: "단말정보수집을 실행할 수 있는 환경이 아닙니다.",
    m08: "마우스입력기를 실행할 수 있는 환경이 아닙니다.",
    m09: "보안프로그램에서 개발자도구나 디버그도구를 탐지하였습니다.\n보안을 위하여 현재 페이지를 다시 호출합니다.",
    m10: "보안프로그램과의 연결이 원활하지 않습니다. 지속적으로 발생시 관리자에게 문의하십시오.",
    m11: "접속 가능한 포트(%p%)를 찾았습니다.",
    m12: "기본 포트(%p%)가 열려 있는지 검사합니다.",
    m13: "쿠키에 저장된 호스트(%h%)와 포트(%p%)가 있습니다. 이 호스트와 포트를 검사합니다.",
    m14: "사용 가능한 호스트(%h%)와 포트(%p%)를 찾았습니다. 이 호스트와 포트를 사용합니다.",
    m15: "업데이트 모듈이 실행중인 상태입니다.",
    m16: "정상적인 설치가 되었는지 확인합니다. 설치 후 초기화 완료시까지 수 초(대략 5~10초)가 소요됩니다. 설치가 완료되면 자동으로 첫 페이지로 이동합니다.",
    m17: "설치가 완료되었습니다.",
    m18: "Flash SDK를 정상적으로 시작되었습니다.",
    m19: "인증서 초기화에 너무 많은 재호출이 발생하여 초기화 작업을 중지합니다. 페이지를 다시 접속하시거나 지속적인문제 발생시 관리자에게 문의하십시오",
    m20: "장시간동안 사용자의 페이지 사용이 없어 현재 페이지의 접속을 종료합니다.",
    m21: "[%p%] 이름으로 여러 개의 form이 존재합니다. 해당 이름의  첫번째 form에 단말정보가 수집됩니다.",
    m22: "키보드보안프로그램에서 보호되지 않는 키가 입력되었습니다. 보안을 위해 페이지를 다시 호출합니다.",
    m23: "보안프로그램과의 연결이 중지되었습니다.\n보안을 위하여 현재 페이지를 다시 호출합니다.",
    m24: "초기 활성화된 객체(%p%)를 다시 활성화시킵니다.",
    m25: "초기 활성화된 객체(%p%)를 찾았습니다. 키보드보안 초기화 후에 다시 활성화시킵니다.",
    m26: "키보드보안이 초기화되지 않았습니다. 잠시 후 다시 시도해주십시오.",
    m27: "단말정보수집을 위한 [form] 필드가 존재하지 않습니다. 초기화값을 다시 확인하여 주십시오.",
    m28: "단말정보수집 모듈 초기화에 성공하였습니다.",
    m29: "단말정보수집 모듈을 초기화할 수 없습니다.",
    m30: "서버에서 키값을 얻어올 수 없습니다. 서버의 상태 또는 접속경로를 확인하여 주십시오.",
    m31: 'Microsoft IE7 이하 브라이저에서는 입력 form(%p1%) 양식에 div[class="%p2%"] 항목이 필요합니다.',
    m32: "입력 Form(%p%)이 존재하지 않거나 2개 이상입니다.",
    m33: "모듈이 설치되어 있지 않습니다.",
    m34: "모듈이 업데이트되었습니다.",
    m35: "설치페이지로 이동하시겠습니까?",
    m36: "설치페이로 이동하여 다시 설치하시겠습니까?",
    m37: "jQuery 객체를 찾을 수 없습니다. Microsoft IE Browser 9.0 이하 버전에서는 jQuery를 사용해야 합니다.",
    m38: "개발자도구의 단축키는 사용할 수 없습니다.",
    m39: "오른쪽 마우스는 사용할 수 없습니다.",
    m40: "현재의 브라우저는 Ajax를 지원하지 않습니다.",
    m41: "보안프로그램과의 연결시도 중 응답시간을 초과하였습니다.",
    m42: "응답값이 정상적인 규격이 아닙니다.",
    m43: "추가하려는 항목의 상위객체를 찾을 수 없습니다.",
    m44: "생성하려는 입력양식과 값의 개수가 일치하지 않습니다.",
    m45: "문자형키패드는 텍스트입력양식에서 사용할 수 없습니다. 텍스트입력양식에서는 숫자/한글형키패드만 지원합니다.",
    m46: "한글키패드는 암호입력양식에서 사용할 수 없습니다. 암호입력양식에서는 숫자/문자형키패드만 지원합니다.",
    m47: "동적 확장은 10개까지 가능합니다. 동적 필드 로직을 10개 이하로 구성하십시오.",
    m48: "가상운영체제 또는 원격으로 접속하셨습니다. 키보드보안을 지원하지 않는 환경입니다.",
    m49: "가상운영체제 또는 원격접속이 아닙니다. 키보드보안이 실행가능한 환경입니다.",
    m50: "[nProtect Online Security, %p1%] 모듈에 접근할 수 없어 종료합니다.",
    m51: "로컬 서버(%p1%:%p2%)에서 업데이트 확인을 요청하였습니다.",
    m52: "NOS의 세션을 유지합니다.",
    m53: "데이터를 받아서 처리할 Callback함수를 지정해야 합니다.",
    m54: "NOS와 통신할 수 없습니다. npPfsStartup()으로 먼저 페이지를 초기화하십시오.",
    m55: "개인방화벽의 세션을 유지합니다.",
    m56: "개인방화벽을 시작합니다.",
    m57: "개인방화벽이 정상적으로 시작되었습니다.",
    m58: "개인방화벽을 정상적으로 종료하였습니다.",
    m59: "E2E 초기화를 위한 설정변수가 지정되지 않았습니다. npPfsE2E 변수값을 설정하십시오.",
    m60: "랜덤값생성페이지(%p1%)에서 값을 정상적으로 얻어올 수 없습니다.",
    m61: "키보드보안에 입력양식(%p1%)을 등록합니다.",
    m62: "키보드보안에 입력양식(%p1%)이 정상적으로 등록되었습니다.",
    m63: "입력양식(%p1%)에 포커스가 들어왔습니다.",
    m64: "입력양식(%p1%)의 포커스가 사라졌습니다.",
    m65: "입력양식(%p1%)의 키보드보안 값(%p2%)이 입력되었습니다.",
    m66: "키 값이 입력되었습니다.",
    m67: "입력양식(%p1%)의 값이 삭제되었습니다. 현재값(%p2%).",
    m68: "단말정보수집을 정상적으로 종료하였습니다.",
    m69: "단말정보수집을 시작합니다.",
    m70: "단말정보수집이 정상적으로 시작되었습니다.",
    m71: "단말정보수집이 완료되었습니다.",
    m72: "마우스입력기를 시작합니다.",
    m73: "마우스입력기를 정상적으로 종료하였습니다.",
    m74: "마우스입력기 공개키정보(%p1%)",
    m75: "마우스입력기에 입력양식(%p1%)을 등록합니다.",
    m76: "마우스입력기가 정상적으로 시작되었습니다.",
    m77: "입력양식(%p1%)에 [(%p2%)] 속성으로 활성화양식명을 지정하여 주십시오.",
    m78: "입력양식(%p1%)의 마우스입력기가 정상적으로 초기화되었습니다.",
    m79: "마우스입력기(%p1%)가 활성화되었습니다.",
    m80: "마우스입력기(%p1%)가 비활성화되었습니다.",
    m81: "웹페이지에 등록된 Flash 객체가 없습니다.",
    m82: "Flash SDK를 시작합니다.",
    m83: "Flash SDK를 정상적으로 종료하였습니다.",
    m84: "키보드보안에 Flash 입력양식(%p1%)을 등록합니다.",
    m85: "최대길이값이 플래시에서 넘어오지 않았습니다. 최대길이 체크를 무시합니다.",
    m86: "키보드보안에 Flash 입력양식(%p1%)이 정상적으로 등록되었습니다.",
    m87: "폼 이름이 없어 동적필드 생성을 중단합니다.",
    m88: "키보드보안 프로그램이 지원되지 않는 환경에서는\n안전한 거래를 위해 가상키패드(마우스입력기)를\n반드시 사용하셔야 합니다.",
    m89: "공백버튼의 개수가 너무 큽니다. 줄 단위 당 버튼의 개수를 1/3 이하로 설정하십시오. 보통 줄 당 1~2개가 적당합니다.",
    m90: "입력양식(%p1%)의 마우스입력기를 보이게 하려고 합니다.",
    m91: "입력양식(%p1%)의 마우스입력기를 보이게 하였습니다.",
    m92: "입력양식(%p1%)의 마우스입력기를 안보이게 하였습니다.",
    m93: "입력양식(%p1%)의 마우스입력기가 닫혔습니다.",
    m94: "입력양식(%p1%)의 마우스입력기를 입력확인 처리하였습니다.",
    m95: "보안프로그램을 설치하셔야 이용이 가능한 서비스입니다. [확인]을 선택하시면 설치페이지로 연결됩니다.",
    m96: "보안프로그램을 업데이트하셔야 이용이 가능한 서비스입니다. [확인]을 선택하시면 재설치페이지로 연결됩니다.",
    m97: "보안프로그램이 설치되어 있지 않습니다.",
    m98: "입력양식(%p1%)의 마우스입력기를 삭제하였습니다.",
    m99: "키보드보안을 정상적으로 종료하였습니다.",
    m100: "보안프로그램에서 프록시 사용을 탐지하였습니다.\n보안을 위하여 현재 페이지를 다시 호출합니다.",
    m101: "보안프로그램에서 프록시 사용을 탐지하였습니다.\n프록시 기능을 종료하시겠습니까?"
};
var npOutCount = 0;
w.Mc = {
    dB: new Date(),
    timelineStart: new Date(),
    timeline: [],
    info: function(a) {
        this.print(a, "blue")
    },
    log: function(a) {
        this.print(a, "black")
    },
    error: function(a) {
        this.print(a, "red")
    },
    split: function() {
        var a = [];
        for (var b = 0; b < 80; b++) {
            a.push("-")
        }
        this.print(a.join(""), "#ddd")
    },
    reset: function() {
        this.dB = new Date();
        this.timelineStart = new Date();
        this.timeline = []
    },
    check: function(a) {
        this.timeline.push({
            name: a,
            start: this.timelineStart,
            end: new Date()
        });
        this.timelineStart = new Date()
    },
    dateText: function(a) {
        if (L.au(a)) {
            a = new Date()
        }
        return L.ep(a, "HH:mm:ss ms")
    },
    print: function(b, a) {
        if (L.bn(b)) {
            return
        }
        if (L.bn(a)) {
            a = "black"
        }
        if (uV.dV.dk == ad.jt) {
            if (window.console) {
                window.console.log(this.dateText() + " : " + b)
            } else {
                L.xw(document, "byid", "nppfs-console-log");
                if (npOutCount < 1000) {
                    nq("#nppfs-console-log").append('<div style="color:' + a + ';">' + this.dateText() + " : " + npOutCount + ". " + b + "</div>");
                    npOutCount++
                } else {
                    zp.hideLoading()
                }
            }
        }
    },
    interval: function(b) {
        if (uV.dV.dk == ad.jt) {
            var c = this.dB;
            var a = new Date();
            Mc.log("Task(" + b + ") Duration: " + ((a.getTime() - c.getTime()) / 1000) + "s, Start:" + L.ep(c, "HH:mm:ss ms") + ", End:" + L.ep(a, "HH:mm:ss ms"))
        }
    },
    printTimeline: function() {
        var d = [];
        d.push("");
        d.push("Transaction Start : " + L.ep(this.dB, "HH:mm:ss ms"));
        var e = this.timeline;
        for (var c = 0; c < e.length; c++) {
            var b = e[c].name;
            var i = e[c].end.getTime() - this.dB.getTime();
            var g = e[c].end.getTime() - e[c].start.getTime();
            var f = L.ep(e[c].start, "HH:mm:ss ms");
            var a = L.ep(e[c].end, "HH:mm:ss ms");
            d.push("Task(" + b + "), (" + L.comma(i) + " ms / " + L.comma(g) + " ms), " + a)
        }
        Mc.log(d.join("\n"));
        this.reset()
    }
};
w.D = new function() {
    var e = navigator.appName;
    var b = navigator.platform.toLowerCase();

    function f(g) {
        return nua.indexOf(g)
    }

    function a(g) {
        return nua.indexOf(g) >= 0
    }

    function c(g) {
        return nua.toLowerCase().indexOf(g) >= 0
    }
    this.ie = (e == "Microsoft Internet Explorer" || (e == "Netscape" && (a("MSIE") || a("Trident")))) && !a("QQBrowser");
    this.ie64 = this.ie && a("Win64; x64");
    this.edge = f("Mozilla") === 0 && a("Edge");
    this.ff = a("Firefox") && f("Mozilla") === 0 && e == "Netscape" && !a("Navigator");
    this.ns = a("Gecko") && a("Navigator");
    this.b360 = a("360Browser") && a("Chrome") && a("Safari");
    this.qq = a("QQBrowser") && a("Trident");
    this.sf = a("Safari") && !a("Chrome");
    this.op = a("Opera") || a("OPR/");
    this.cr = a("Chrome") && a("Safari") && !a("OPR/") && !a("360Browser") && !a("Edge");
    this.win = (b.indexOf("win") != -1) && !a("Windows Phone");
    this.win9x = a("Windows 98") || a("Win98") || a("Windows ME") || a("Windows NT 4.0") || a("Windows NT 5.0") || a("Windows 2000");
    this.winxp = a("Windows NT 5.1");
    this.mac = a("Mac");
    this.lnx64 = a("Linux") && a("x86_64");
    this.lnx32 = a("Linux") && (a("i386") || a("i686"));
    this.lnx = a("Linux");
    this.and = a("Android");
    this.ios = a("iPhone") || a("iPod") || a("iPad");
    this.iph = a("iPhone");
    this.ipo = a("iPod");
    this.ipa = a("iPad");
    this.fdr = c("fedora");
    this.ubt = c("ubuntu");
    this.winphone = c("windows phone");
    this.winmob = (b == "windows mobile");
    this.cR = null;
    this.bd = null;
    this.isSupportWebSocket = window.WebSocket != null && (this.cr || this.edge || this.op);
    this.virtualMachine = false;
    this.isMobileDevice = function() {
        if (this.winmob || this.winphone || this.ipa || this.ipo || this.iph || this.and) {
            return true
        }
        return false
    };
    this.gC = function() {
        var g = null;
        var l = nua;
        if (D.win) {
            var k = [{
                v: "5.0",
                p: /(Windows NT 5.1|Windows XP)/
            }, {
                v: "5.2",
                p: /Windows NT 5.2/
            }, {
                v: "6.0",
                p: /Windows NT 6.0/
            }, {
                v: "7.0",
                p: /(Windows 7|Windows NT 6.1)/
            }, {
                v: "8.1",
                p: /(Windows 8.1|Windows NT 6.3)/
            }, {
                v: "8.0",
                p: /(Windows 8|Windows NT 6.2)/
            }, {
                v: "10.0",
                p: /(Windows 10|Windows NT 10.0)/
            }, {
                v: "3.0",
                p: /Windows CE/
            }, {
                v: "3.1",
                p: /Win16/
            }, {
                v: "3.2",
                p: /(Windows 95|Win95|Windows_95)/
            }, {
                v: "3.5",
                p: /(Win 9x 4.90|Windows ME)/
            }, {
                v: "3.6",
                p: /(Windows 98|Win98)/
            }, {
                v: "3.7",
                p: /Windows ME/
            }, {
                v: "4.0",
                p: /(Windows NT 4.0|WinNT4.0|WinNT|Windows NT)/
            }, {
                v: "4.0",
                p: /(Windows NT 5.0|Windows 2000)/
            }];
            for (var j = 0; j < k.length; j++) {
                var n = k[j];
                try {
                    if (n.p.test(l)) {
                        g = n.v;
                        break
                    }
                } catch (m) {}
            }
        } else {
            if (D.mac) {
                if (match = /Mac OS X ([0-9.]*)[._]([0-9.]*)/.exec(l)) {
                    g = match[1] + "." + match[2]
                }
            } else {
                if (D.lnx) {}
            }
        }
        return g
    };
    this.iT = function() {
        var g;
        var k;
        var j = nua;
        if (D.ff) {
            g = j.substring(j.toLowerCase().lastIndexOf("firefox"));
            if (g.indexOf(" ") > -1) {
                g = g.substring(0, g.indexOf(" "))
            }
            k = g.split("/");
            return k[1]
        } else {
            if (D.op) {
                if (j.indexOf("OPR/") > -1) {
                    g = j.split("OPR/")[1]
                } else {
                    if (j.indexOf("Opera") > -1) {
                        g = j.split("Opera/")[1]
                    }
                }
                if (g.indexOf(" ") > -1) {
                    k = g.split(" ");
                    return k[0]
                } else {
                    return g
                }
            } else {
                if (D.cr || D.b360) {
                    g = j.substring(j.toLowerCase().lastIndexOf("chrome"));
                    if (g.indexOf(" ") != -1) {
                        g = g.substring(0, g.indexOf(" "));
                        k = g.split("/");
                        return k[1]
                    }
                } else {
                    if (D.sf) {
                        var i = new RegExp(/Version[\/\s](\d+\.\d+)/.test(nua));
                        var l = RegExp["$1"];
                        return l
                    } else {
                        if (D.ie || D.qq) {
                            if (j.indexOf("MSIE") > -1) {
                                fw = j.substring(j.indexOf("MSIE") + 4, j.length);
                                fw = fw.replace(/(^\s*)|(\s*$)/gi, "");
                                k = fw.split(";");
                                k = k[0].split(" ");
                                return k[0]
                            } else {
                                return j.substring(j.indexOf("rv:") + 3, j.indexOf("rv:") + 7)
                            }
                        } else {
                            if (D.edge) {
                                g = j.substring(j.toLowerCase().lastIndexOf("edge"));
                                if (g.indexOf(" ") != -1) {
                                    g = g.substring(0, g.indexOf(" "));
                                    k = g.split("/");
                                    return k[1]
                                } else {
                                    k = g.split("/");
                                    return k[1]
                                }
                            }
                        }
                    }
                }
            }
        }
    };
    this.makeBrowserVersionCode = function() {
        function l(s, r, q) {
            var o = s;
            if (o.length < r) {
                for (var p = 0; p < (r - s.length); p++) {
                    o = q + o
                }
            } else {
                if (s.length > r) {
                    o = s.substring(0, r)
                }
            }
            return o
        }
        var g = "99-000-000";
        try {
            var m = "";
            var j = "";
            var i = D.bd;
            if (i.indexOf(".") != -1) {
                var k = i.split(".");
                m = l(k[0], 3, "0");
                j = l(k[1], 3, "0")
            } else {
                m = l(i, 3, "0");
                j = l("000", 3, "0")
            }
            var g = m + "-" + j;
            if (D.ie) {
                g = "10-" + g
            } else {
                if (D.ff) {
                    g = "20-" + g
                } else {
                    if (D.cr) {
                        g = "30-" + g
                    } else {
                        if (D.sf) {
                            g = "40-" + g
                        } else {
                            if (D.op) {
                                g = "50-" + g
                            } else {
                                if (D.edge) {
                                    g = "60-" + m + "-000"
                                } else {
                                    if (D.b360) {
                                        g = "91-" + g
                                    } else {
                                        if (D.qq) {
                                            g = "92-" + g
                                        } else {
                                            g = "99-000-000"
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (n) {
            g = "99-000-000"
        }
        return g
    };
    this.isSupported = function(g) {
        return this.iG(g) && this.jj(g)
    };
    this.iG = function(g) {
        if (L.bn(this.cR)) {
            this.cR = D.gC()
        }
        var i = this.cR;
        if (D.win && g.aF.aX) {
            if (D.win9x) {
                return false
            }
            return L.ak(i, g.aF.di.qs, g.aF.di.Oc)
        } else {
            if (D.mac && g.jV.aX) {
                return L.ak(i, g.jV.di.qs, g.jV.di.Oc)
            } else {
                if (D.lnx && g.bx.aX) {
                    return true
                }
            }
        }
        return false
    };

    function d(m, l, k) {
        var i = true;
        var j, g;
        if (l == uV.di.bx.TYPE.Fedora) {
            j = m.bx.di.Fedora.qs;
            g = m.bx.di.Fedora.Oc
        } else {
            if (l == uV.di.bx.TYPE.Ubuntu) {
                j = m.bx.di.Ubuntu.qs;
                g = m.bx.di.Ubuntu.Oc
            } else {
                if (l == uV.di.bx.TYPE.CentOS) {
                    j = m.bx.di.CentOS.qs;
                    g = m.bx.di.CentOS.Oc
                } else {
                    if (l == uV.di.bx.TYPE.OpenSUSE) {
                        j = m.bx.di.OpenSUSE.qs;
                        g = m.bx.di.OpenSUSE.Oc
                    } else {
                        i = false
                    }
                }
            }
        }
        if (!L.bn(j)) {
            i = i && L.db(k, j)
        }
        if (!L.bn(g)) {
            i = i && L.db(g, k)
        }
        return i
    }
    this.jj = function(i) {
        if (!this.iG(i)) {
            return false
        }
        var g = null;
        if (D.win) {
            g = i.aF.al
        } else {
            if (D.mac) {
                g = i.jV.al
            } else {
                if (D.lnx) {
                    g = i.bx.al
                }
            }
        }
        if (!L.au(g)) {
            if (L.bn(this.bd)) {
                this.bd = D.iT()
            }
            var j = D.bd;
            if (D.ie && g.IE.aX) {
                return L.ak(j, g.IE.qs, g.IE.Oc)
            } else {
                if (D.ff && g.FF.aX) {
                    return L.ak(j, g.FF.qs, g.FF.Oc)
                } else {
                    if (D.cr && g.CR.aX) {
                        return L.ak(j, g.CR.qs, g.CR.Oc)
                    } else {
                        if (D.sf && g.SF.aX) {
                            return L.ak(j, g.SF.qs, g.SF.Oc)
                        } else {
                            if (D.edge && g.EG.aX) {
                                return L.ak(j, g.EG.qs, g.EG.Oc)
                            } else {
                                if (D.op && g.OP.aX) {
                                    return L.ak(j, g.OP.qs, g.OP.Oc)
                                } else {
                                    if (D.b360 && g.B360.aX) {
                                        return L.ak(j, g.B360.qs, g.B360.Oc)
                                    } else {
                                        if (D.qq && g.QQ.aX) {
                                            return L.ak(j, g.QQ.qs, g.QQ.Oc)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return false
    };
    this.isMetroUi = function() {
        if (!this.ie) {
            return false
        }
        if (!this.bd) {
            return false
        }
        if (!L.db(this.bd, "10.0")) {
            return false
        }
        var g = null;
        try {
            g = !!new ActiveXObject("htmlfile")
        } catch (i) {
            g = false
        }
        if (g) {
            return false
        }
        if (window.screen.availWidth !== window.outerWidth) {
            return false
        }
        return (window.screen.availWidth == window.outerWidth)
    };
    this.CB = function() {
        return this.ie && (L.db("7.0", this.bd) || document.documentMode <= 7)
    };
    this.cO = function() {
        return (this.ie || this.qq) ? D.isNewIe() : true
    };
    this.isNewIe = function() {
        return (this.ie || this.qq) ? (L.db(this.bd, "10.0") && document.documentMode >= 10) : false
    }
};
w.D.cR = D.gC();
w.D.bd = D.iT();
w.npPfsDefine = D;
w.hI = new function() {
    this.plugins = [];
    this.define = function(c) {
        if (L.bn(c.id)) {
            alert("제품 식별 고유코드가 필요합니다.");
            return
        }
        if (L.bn(c.controller)) {
            alert("제품 제어 스크립트 객체가 필요합니다.");
            return
        }
        this.plugins.push(c)
    };
    this.iK = function() {
        var c = false;
        nq(this.plugins).each(function() {
            if (!this.controller.isRunnable() || !this.controller.isSupported()) {
                return true
            }
            var d = true;
            if (typeof(this.isExecutable) == "function") {
                d = this.isExecutable(zp.aG)
            }
            if (d == true && !L.au(this.handshake) && this.handshake == true) {
                c = true;
                return false
            }
        });
        return c
    };
    this.io = function() {
        var c = false;
        nq(this.plugins).each(function() {
            if (!this.controller.isRunnable() || !this.controller.isSupported()) {
                return true
            }
            var d = true;
            if (typeof(this.isExecutable) == "function") {
                d = this.isExecutable(zp.aG)
            }
            if (d == true && !L.au(this.endtoend) && this.endtoend == true) {
                c = true;
                return false
            }
        });
        return c
    };
    this.c7 = function() {
        var c = false;
        nq(this.plugins).each(function() {
            if (!this.controller.isSupported()) {
                return true
            }
            var d = true;
            if (typeof(this.isExecutable) == "function") {
                d = this.isExecutable(zp.aG)
            }
            if (d == true && !L.au(this.runvirtualos) && this.runvirtualos == false) {
                c = true;
                return false
            }
        });
        return c
    };
    this.iS = function() {
        return this.plugins
    };
    var a = [];
    var b = false;
    this.init = function(d) {
        if (b == true) {
            return
        }
        nq(document).bind("nppfs-module-startup", function(f) {
            var e = f.target;
            a.splice(L.indexOf(a, e), 1);
            if (a.length == 0) {
                nq(document).trigger({
                    type: "nppfs-nos-startup",
                    time: new Date()
                });
                b = false
            }
        });
        var c = 0;
        nq(this.plugins).each(function() {
            if (!this.controller.isRunnable()) {
                return true
            }
            c++;
            this.controller.init(d)
        });
        if (c == 0) {
            b = false
        }
    };
    this.startup = function(d) {
        var c = 0;
        if (b == true) {
            return
        }
        b = true;
        nq(this.plugins).each(function() {
            if (!this.controller.isRunnable()) {
                return true
            }
            a.push(this.id);
            c++
        });
        nq(this.plugins).each(function() {
            if (!this.controller.isRunnable()) {
                return true
            }
            this.controller.startup(d)
        });
        if (c == 0) {
            nq(document).trigger({
                type: "nppfs-nos-startup",
                time: new Date()
            });
            b = false
        }
    };
    this.bA = function() {
        var c = true;
        nq(this.plugins).each(function() {
            if (!this.controller.isRunnable()) {
                return true
            }
            a.push(this.id);
            runcnt++;
            c = c && this.controller.bA();
            return c
        });
        return c
    };
    this.isSupported = function() {
        var c = true;
        nq(this.plugins).each(function() {
            c = c && this.controller.isSupported();
            return c
        });
        return c
    };
    this.bm = function(c) {
        nq(this.plugins).each(function() {
            this.controller.bm(c)
        })
    }
};
w.npPfsPlugins = hI;
w.Ye = {
    d3: "f54e7b411b17fdde86e134d3fde127e7c70fb55106c1bda41bc1b36d58ff658e",
    p8: "02a09fc9af07ca384a81770e524126b3431d8fe3e3fda36828b7b342f5672cd5",
    x2: "a4fea4d1745962e775b7e390f6a227f66f06ae1392a317adbb20bc4c0ae2ca1d",
    x5: "662c32d87f5464b4abd48a96a9955ff160e2124777b07379616b0f0bfa874a25c24c90f84727ec9304b7d0d6395bb558",
    j3: "1",
    x6: "0",
    a4: "59615036FA2C1A9EFC35D43EC6C77269",
    h5: "B303AA8350126650FCE9111D899E21F0",
    d4: "FA48FAE45FDF6C6F29DD4766E50F5931",
    p0: "201A9DFAC7ED61A876CA0B1D7AF18161",
    ag: "14F1CF1F85E360D567D4A9C43B99C33B",
    aj: "A0131152837EFEA26E0598577DE5E429",
    kk: "94B53D15A6C345F18DB55F5C879B661E",
    RESULT_PROXY: "64AD3D4FEF74428b9A206D4A17D72C3E",
    RESULT_USER_PROXY: "2EA074D6A53044138EC6DB91CFE2691D",
    e2: "47494638396101000100820031FFFFFF",
    h6: "8938a84e32ba8ae09b0a7b56dd6b0d1e5d3660c985a529dda2585d82e5028280",
    j0: "7c81fb8d9b9ed00dd95abba788571c939670fd37a89a61597e64b86bcb28ed26",
    d8: "7b9bb47968c20e9820f4adeb115828809ecdbbf836e36c31b1030a20f562ff93",
    am: "9190fc5045374ccc195bc2c5842a466919d165221222684a4bf35f43a557fc51",
    dG: "16ce04cba65be8768f15cfb203027a99e3e0af6f8560d79233e3998411aef149",
    CMD_GET_OS_VERSION: "469f5cd3b6e5faf5eb8e3e26b3c8706ecd576c3fa5e65a022036310e2795b636",
    CMD_DISABLE_USER_PORXY: "6f35131db6d411aec9e9b025dd783f6ff14ca94cd26560f81d30c619c3ca7530",
    CMD_IGNORE_PORXY: "a2b1b361eacb280d749963b94947e41a643ac403c14f7e9ceabba2bfacddbb32",
    CMD_DISABLE_PORXY: "08a00e50b06cfde6f03aa75a491e4b6e0d9c2119cc7601b0b60883977008d988"
};
w.nq = (typeof(nosQuery) != "undefined") ? nosQuery : jQuery;
w.L = new function() {
    var npWebSocket = {};
    var npCurrentSendStack = {};
    this.sendWebSocketCommand = function(command, ax, o) {
        if (L.au(o.timeout)) {
            o.timeout = 3000;
        }
        var keyName = o.host + ":" + o.port;
        var url = zp.makeWebSocketUrl(o.port, o.host);

        Mc.log("REQ : [" + keyName + "]" + command);

        if (!npCurrentSendStack[keyName]) {
            npCurrentSendStack[keyName] = [];
        }

        npCurrentSendStack[keyName].push({
            "command": command,
            "ax": ax
        });

        function peekSendStackMsg(aa) {
            if (npCurrentSendStack[keyName].length > 0) {
                npCurrentSendStack[keyName][0].ax(aa);
                npCurrentSendStack[keyName] = npCurrentSendStack[keyName].slice(1);
            }
        }

        try {
            if (npWebSocket && npWebSocket[keyName] === undefined) {
                Mc.log("NEW: " + keyName)
                npWebSocket[keyName] = new WebSocket(url);

                npWebSocket[keyName].onopen = function(event) {
                    npWebSocket[keyName].send(npCurrentSendStack[keyName][0].command);
                }

                npWebSocket[keyName].onerror = function(event) {
                    for (var i = 0; i < npCurrentSendStack[keyName].length; i++) {
                        npCurrentSendStack[keyName][i].ax({
                            readyState: 4,
                            status: 999,
                            responseText: "WebSocket Error."
                        });
                    }

                    Mc.log("REMOVE: [" + keyName + "]" + npWebSocket[keyName]);
                    npCurrentSendStack[keyName] = undefined;

                    npWebSocket[keyName].close();
                    npWebSocket[keyName] = undefined;
                };

                npWebSocket[keyName].onmessage = function(event) {
                    Mc.log("event.origin: " + npCurrentSendStack[keyName][0].command);

                    peekSendStackMsg({
                        readyState: 4,
                        status: 200,
                        responseText: event.data
                    });

                    if (npCurrentSendStack[keyName].length > 0) {
                        npWebSocket[keyName].send(npCurrentSendStack[keyName][0].command);
                    }
                };
            }

            if (npWebSocket && npWebSocket[keyName] && npWebSocket[keyName].readyState === 1) {
                if (npCurrentSendStack[keyName].length === 1) {
                    npWebSocket[keyName].send(npCurrentSendStack[keyName][0].command);
                }
            }

        } catch (e) {
            peekSendStackMsg({
                readyState: 4,
                status: 999,
                responseText: ""
            });
            Mc.error("ERR : " + e);
        }
    };

    function c(j, k) {
        if (j === undefined) {
            j = 1
        } else {
            if (k === undefined) {
                k = "0"
            }
        }
        var l = "";
        while (l.length < j) {
            l += k
        }
        this.bY = function(m) {
            var n = m.toString();
            return l.substring(0, l.length - n.length) + n
        }
    }
    this.au = function(j) {
        if (typeof(j) == "undefined" || j == null) {
            return true
        }
        return false
    };
    this.bn = function(j) {
        if (typeof(j) == "undefined" || j == null || j == "") {
            return true
        }
        return false
    };
    this.n2b = function(k, j) {
        if (this.au(j)) {
            j = ""
        }
        if (this.au(k)) {
            return j
        }
        return k
    };
    this.selectorByName = function(k, j) {
        if (!L.bn(k) && k.indexOf(":") >= 0) {
            if (typeof(j) != "undefined") {
                return nq(document.getElementsByName(k)[0], j)
            } else {
                return nq(document.getElementsByName(k)[0])
            }
        } else {
            if (typeof(j) != "undefined") {
                return nq("[name='" + k + "']", j)
            } else {
                return nq("[name='" + k + "']")
            }
        }
    };
    this.selectorById = function(k, j) {
        if (!L.bn(k) && k.indexOf(":") >= 0) {
            if (typeof(j) != "undefined") {
                return nq(document.getElementById(k), j)
            } else {
                return nq(document.getElementById(k))
            }
        } else {
            if (typeof(j) != "undefined") {
                return nq("#" + k, j)
            } else {
                return nq("#" + k)
            }
        }
    };
    this.eraseSpecialChars = function(l) {
        var j = /[\{\}\[\]\/?.,;:|\)*~`!^\-+<>@#$%&\\\=\(\'\"]/gi;
        if (j.test(l)) {
            var k = l.replace(j, "");
            l = k
        }
        return l
    };
    this.gv = function() {
        var j = new c(15);
        var k = Math.floor(Math.random() * 99) + 1;
        if (k < 10) {
            k = k + 10
        }
        return j.bY((new Date().getTime()).toString() + k)
    };
    this.cC = function(l) {
        if (this.au(l)) {
            l = ""
        }
        var k = l.length;
        var j = new c(4);
        return j.bY((k).toString(16))
    };
    this.sz = function(j) {
        return encodeURIComponent(j)
    }, this.bj = function(l) {
        var k = [];
        for (var j in l) {
            if (typeof nexacro == "object" && nexacro._bInitPlatform) {
                if (j == "getSetter" || j == "getNumSetter") {
                    continue
                }
            }
            k.push(j)
        }
        return k
    };
    this.jC = function(j) {
        this.bj(j).length
    };
    this.hH = function(k) {
        var j = "";
        if (!k) {
            return
        }
        for (var l = 0; l < k.length; l++) {
            j += ((k[l] < 16) ? "0" : "") + k[l].toString(16)
        }
        return j
    };
    this.ha = function(l, n) {
        if (L.bn(l)) {
            return ""
        }
        var k = "";
        if (l.indexOf("0x") == 0 || l.indexOf("0X") == 0) {
            l = l.substr(2)
        }
        if (l.length % 2) {
            l += "0"
        }
        var m = [];
        for (var j = 0; j < l.length; j += 2) {
            m.push(parseInt(l.slice(j, j + 2), 16))
        }
        if (n == "UTF8") {
            return g(m)
        } else {
            for (j = 0; j < m.length; j++) {
                k += String.fromCharCode(m[j])
            }
        }
        return k
    };

    function g(p) {
        var m, l;
        var j = "";
        var n = p.length;
        var k = 0;
        while (k < n) {
            var o = p[k++];
            switch (o >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    j += String.fromCharCode(o);
                    break;
                case 12:
                case 13:
                    m = p[k++];
                    j += String.fromCharCode(((o & 31) << 6) | (m & 63));
                    break;
                case 14:
                    m = p[k++];
                    l = p[k++];
                    j += String.fromCharCode(((o & 15) << 12) | ((m & 63) << 6) | ((l & 63) << 0));
                    break
            }
        }
        return j
    }
    this.comma = function(j) {
        j = String(j);
        return j.replace(/(\d)(?=(?:\d{3})+(?!\d))/g, "$1,")
    };
    this.uncomma = function(j) {
        j = String(j);
        return j.replace(/[^\d]+/g, "")
    };
    this.arrayIn = function(l, k) {
        for (var j = 0; j < l.length; j++) {
            if (l[j] === k) {
                return true
            }
        }
        return false
    };
    this.indexOf = function(l, k) {
        for (var j = 0; j < l.length; j++) {
            if (l[j] === k) {
                return j
            }
        }
        return -1
    };
    this.arrayNotIn = function(l, k) {
        for (var j = 0; j < l.length; j++) {
            if (l[j] === k) {
                return false
            }
        }
        return true
    };
    this.mL = function(l) {
        var k;
        var j = new Array();
        for (k = 0; k < l; k++) {
            j[k] = Math.round(Math.random() * 255)
        }
        return j
    };
    this.wm = function(l, m) {
        var j = AES.eU / 8;
        var k;
        if (typeof l == "string" || l.indexOf) {
            l = l.split("");
            for (k = 0; k < l.length; k++) {
                l[k] = l[k].charCodeAt(0) & 255
            }
        }
        for (k = j - (l.length % j); k > 0 && k < j; k--) {
            l[l.length] = 0
        }
        return l
    };
    this.getBytes = function(n) {
        var m;
        var j = [];
        if (typeof n == "string" || n.indexOf) {
            var k = [];
            var o = n;
            for (var m = 0; m < o.length; m++) {
                var l = o.charCodeAt(m);
                if (l < 128) {
                    k.push(l)
                } else {
                    if (l < 2048) {
                        k.push(192 | (l >> 6), 128 | (l & 63))
                    } else {
                        if (l < 55296 || l >= 57344) {
                            k.push(224 | (l >> 12), 128 | ((l >> 6) & 63), 128 | (l & 63))
                        } else {
                            m++;
                            l = 65536 + (((l & 1023) << 10) | (o.charCodeAt(m) & 1023));
                            k.push(240 | (l >> 18), 128 | ((l >> 12) & 63), 128 | ((l >> 6) & 63), 128 | (l & 63))
                        }
                    }
                }
            }
            return k
        }
        return j
    };
    this.encrypt = function(j, s, p, o) {
        AES.eU = L.au(o) ? 128 : o;
        AES.gl = L.au(s) ? 256 : s.length * 8;
        var m = AES.eU / 8;
        var n, r;
        var q;
        if (!j || !s) {
            return
        }
        if (s.length * 8 != AES.gl) {
            return
        }
        if (p == "CBC") {
            q = this.mL(m)
        } else {
            p = "ECB";
            q = new Array()
        }
        j = this.wm(j);
        var k = new AES.F(s);
        for (var l = 0; l < j.length / m; l++) {
            r = j.slice(l * m, (l + 1) * m);
            if (p == "CBC") {
                for (var n = 0; n < m; n++) {
                    r[n] ^= q[l * m + n]
                }
            }
            q = q.concat(AES.J(r, k))
        }
        return L.hH(q)
    };
    this.gu = function(u, r, p, o, k) {
        AES.eU = L.au(o) ? 128 : o;
        AES.gl = L.au(r) ? 256 : r.length * 8;
        var m = AES.eU / 8;
        var v = new Array();
        var q;
        var l;
        if (!u || !r) {
            return
        }
        if (typeof(u) == "string") {
            u = u.split("");
            for (n = 0; n < u.length; n++) {
                u[n] = u[n].charCodeAt(0) & 255
            }
        }
        if (r.length * 8 != AES.gl) {
            return
        }
        if (!p) {
            p = "ECB"
        }
        var j = new AES.gU(r);
        for (l = (u.length / m) - 1; l > 0; l--) {
            q = AES.er(u.slice(l * m, (l + 1) * m), j);
            if (p == "CBC") {
                for (var n = 0; n < m; n++) {
                    v[(l - 1) * m + n] = q[n] ^ u[(l - 1) * m + n]
                }
            } else {
                v = q.concat(v)
            }
        }
        if (p == "ECB") {
            v = AES.er(u.slice(0, m), j).concat(v)
        }
        var s = v[v.length - 1];
        while (typeof(s) == "undefined" || s == null || s == 0) {
            v.pop();
            s = v[v.length - 1]
        }
        return L.ha(L.hH(v), k)
    };
    this.send = function(l, k, n) {
        var j = "";
        if (this.au(n)) {
            n = {}
        }
        if (this.au(n.async)) {
            n.async = false
        }
        if (this.au(n.timeout) || n.timeout <= 0) {
            n.timeout = 3000
        }
        if (this.au(n.ax)) {
            n.ax = function(p) {
                var o = "";
                if (p.readyState == 4) {
                    if (p.status == 200) {
                        o = p.responseText
                    } else {}
                } else {}
                return o
            }
        }
        Mc.log("REQ : " + k);
        try {
            nq.ajax({
                url: l,
                cache: false,
                async: n.async,
                type: "post",
                global: false,
                data: k,
                error: function(q, p, o) {
                    return n.ax(q)
                },
                success: function(p, o, q) {
                    j = p;
                    return n.ax(q)
                }
            })
        } catch (m) {
            n.ax({
                readyState: 4,
                status: 999,
                responseText: ""
            });
            Mc.error("ERR : " + m)
        }
        return j
    };
    this.jI = {};
    var f = false;
    var e = 0;
    this.fs = function(l, k, j) {
        if (L.au(k)) {
            k = {}
        }
        if (L.au(k.async)) {
            k.async = true
        }
        if (L.au(k.host)) {
            k.host = zp.c6
        }
        if (L.au(k.port)) {
            k.port = zp.cB
        }
        if (L.au(k.direct)) {
            k.direct = false
        }
        if (L.au(k.ax)) {
            k.ax = function(m) {}
        }
        var j = !L.au(j) ? j : function(o) {
            var m = "";
            if (o.readyState == 4) {
                if (o.status == 200 || o.status == 999) {
                    try {
                        m = o.responseText;
                        Mc.log("RES : " + o.responseText);
                        k.ax(o.responseText)
                    } catch (n) {}
                } else {}
            } else {}
            return m
        };
        if (D.isSupportWebSocket && zp.handshakeMode == 2) {
            return this.sendWebSocketCommand(l, j, k);
        } else
        if (D.cO() || f) {
            return this.gb(l, j, k)
        } else {
            if (k.direct == true) {
                return this.sendDirectCommand(l, j, k)
            } else {
                if (k.byiframe == true && (D.ie || D.qq)) {
                    return this.sendIFrameCommand(l, j, k)
                } else {
                    if (e > 20) {
                        return this.gj(l, j, k)
                    } else {
                        return this.gb(l, function(n) {
                            var m = "";
                            if (n.readyState == 4) {
                                if (n.status == 200) {
                                    f = true;
                                    j.call(null, n)
                                } else {
                                    e++;
                                    return L.gj(l, j, k)
                                }
                            } else {}
                            return m
                        }, k)
                    }
                }
            }
        }
    };
    this.gb = function(r, n, q) {
        if (L.au(q.timeout)) {
            q.timeout = 3000
        }
        var k = false;

        function l(o) {
            if (k == false) {
                n(o);
                k = true
            }
        }
        var j = zp.cZ(q.port, q.host);
        var m = null;
        if (q.timeout > 0) {
            m = setTimeout(function() {
                l({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                })
            }, q.timeout)
        }
        try {
            Mc.log("REQ : " + r);
            nq.ajax({
                url: j,
                cache: false,
                async: q.async,
                type: "post",
                global: false,
                data: r,
                error: function(u, s, o) {
                    l({
                        readyState: 4,
                        status: 999,
                        responseText: s + ":" + o
                    })
                },
                success: function(s, o, u) {
                    l(u)
                },
                complete: function(s, o) {
                    if (m != null) {
                        clearTimeout(m)
                    }
                }
            })
        } catch (p) {
            l({
                readyState: 4,
                status: 999,
                responseText: ""
            });
            Mc.error("ERR : " + p)
        }
    };
    this.lock = false;
    this.commandQueue = [];
    this.executeQueue = function() {
        var j = L.commandQueue.shift();
        if (typeof(j) == "function") {
            j()
        }
    };
    this.gj = function(p, l, n) {
        if (L.au(n.timeout)) {
            n.timeout = 3000
        } else {
            if (n.timeout <= 0) {
                n.timeout = 60 * 1000
            }
        }
        if (L.lock == true) {
            if (L.commandQueue.length > 0) {
                L.executeQueue()
            }
            L.commandQueue.push(function() {
                L.gj(p, l, n)
            })
        } else {
            L.lock = true;
            var j = zp.cZ(n.port, n.host);
            var k = setTimeout(function() {
                l({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                });
                try {
                    L.lock = false;
                    L.executeQueue()
                } catch (o) {}
            }, n.timeout);
            Mc.log("REQ : " + p);
            try {
                nq.ajax({
                    url: j,
                    cache: false,
                    crossDomain: true,
                    async: false,
                    type: "GET",
                    global: false,
                    dataType: "jsonp",
                    jsonp: "jsonp_callback",
                    contentType: "application/javascript",
                    timeout: n.timeout,
                    data: {
                        Code: p
                    },
                    error: function(r, q, o) {
                        if (q == "abort" || q == "timeout" || q == "parsererror" || q == "error") {
                            l({
                                readyState: 4,
                                status: 999,
                                responseText: q + ":" + o
                            })
                        }
                    },
                    success: function(q, o, r) {
                        if (q != null && q.RESULT != null) {
                            l({
                                readyState: 4,
                                status: 200,
                                responseText: q.RESULT
                            })
                        }
                    },
                    complete: function(r, o) {
                        clearTimeout(k);
                        try {
                            L.lock = false;
                            L.executeQueue()
                        } catch (q) {}
                    }
                })
            } catch (m) {
                l({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                });
                Mc.error("ERR : " + m);
                L.lock = false;
                L.executeQueue()
            }
        }
    };
    this.sendDirectCommand = function(p, l, n) {
        var j = zp.cZ(n.port, n.host);
        if (L.au(n.timeout)) {
            n.timeout = 3000
        } else {
            if (n.timeout <= 0) {
                n.timeout = 60 * 1000
            }
        }
        var k = setTimeout(function() {
            l({
                readyState: 4,
                status: 999,
                responseText: ""
            })
        }, n.timeout);
        Mc.log("REQ : " + p);
        try {
            nq.ajax({
                url: j,
                cache: false,
                crossDomain: true,
                async: false,
                type: "GET",
                global: false,
                dataType: "jsonp",
                jsonp: "jsonp_callback",
                contentType: "application/javascript",
                timeout: n.timeout,
                data: {
                    Code: p
                },
                error: function(r, q, o) {
                    if (q == "abort" || q == "timeout" || q == "parsererror" || q == "error") {
                        l({
                            readyState: 4,
                            status: 999,
                            responseText: q + ":" + o
                        })
                    }
                },
                success: function(q, o, r) {
                    if (q != null && q.RESULT != null) {
                        l({
                            readyState: 4,
                            status: 200,
                            responseText: q.RESULT
                        })
                    }
                },
                complete: function(q, o) {
                    clearTimeout(k)
                }
            })
        } catch (m) {
            clearTimeout(k);
            l({
                readyState: 4,
                status: 999,
                responseText: ""
            });
            Mc.error("ERR : " + m)
        }
    };
    var a = false;
    this.sendIFrameCommand = function(q, l, p) {
        var k = zp.cZ(p.port, p.host);
        k += "?ifrm=" + q;
        var j = zp.cZ(p.port, p.host);
        var n = document.getElementById("keep-alive-iframe");
        var m = nq("#keep-alive-iframe");
        if (m.length == 0) {
            n = document.createElement("iframe");
            n.id = "keep-alive-iframe";
            n.style.display = "none";
            nq("body").append(n);
            m = nq("#keep-alive-iframe");
            if (a == false) {
                a = true;
                if (!D.CB()) {
                    nq(window).on("message", function(o) {
                        try {
                            var r = o.origin || o.originalEvent.origin;
                            var u = o.data || o.originalEvent.data;
                            if (r === j) {
                                var s = nq.parseJSON(u);
                                if (s.caller == "nppfs-nos-response") {
                                    l({
                                        readyState: 4,
                                        status: 200,
                                        responseText: s.response
                                    })
                                }
                            }
                        } catch (v) {}
                    })
                }
            }
            m.on("load", function(o) {
                if (!D.CB()) {
                    n.contentWindow.postMessage("", j)
                }
                try {
                    l({
                        readyState: 4,
                        status: 200,
                        responseText: Ye.a4
                    })
                } catch (r) {}
            });
            m.on("error", function(o) {
                l({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                })
            })
        }
        Mc.log("REQ : " + q);
        m.attr("src", k)
    };
    dW = {};
    this.iV = function(j, l) {
        var k = j;
        if (!L.bn(l)) {
            if (typeof(l) == "string") {
                k = j + "_" + l
            } else {
                if (typeof(l) == "object") {}
            }
        }
        if (dW[k]) {
            dW[k] = null
        }
    };
    this.bZ = function(j, n) {
        var m = null;
        var l = j;
        var o = null;
        if (!L.bn(n)) {
            if (typeof(n) == "string") {
                m = nq("form[name='" + n + "']").get(0)
            }
            if (typeof(n) == "object") {
                m = nq(n)
            }
            if (!L.au(m)) {
                m = this.findParentForm(m);
                n = nq(m).attr("name");
                l = j + "_" + nq(m).attr("name")
            }
        }
        if (typeof(j) === "string") {
            if (L.selectorById(j).get(0)) {
                o = L.selectorById(j).get(0)
            } else {
                var k = (m != null && m.length > 0) ? L.selectorByName(j, m) : L.selectorByName(j);
                o = (k != null && k.length > 0) ? k.get(0) : L.selectorById(j).get(0)
            }
        }
        if (typeof(j) === "object") {
            o = j
        }
        return o
    };
    this.n5 = function(j) {
        return document.createElement(j)
    };
    this.c1 = function(j, l, x) {
        if (this.au(j)) {
            return
        }
        var k = l;
        var n = x;
        if (!L.au(n)) {
            if (k.length != n.length) {
                alert(N.m44)
            }
        }
        var s = L.bZ(j);
        var v = L.xw(s, "byclass", "nppfs-elements");
        if (!D.CB()) {
            nq(v).hide()
        }
        var q = [];
        var o = false;
        for (var p = 0; p < k.length; p++) {
            var m = this.bZ(k[p], j);
            if (L.au(m)) {
                if (o == false) {
                    o = true
                }
                var u = k[p];
                var r = "";
                if (!L.au(n)) {
                    r = n[p]
                }
                if (uV.dV.dk == ad.fJ) {
                    q.push('<input type="hidden" name="' + u + '" value="' + r + '">')
                } else {
                    q.push(u + '<input type="text" name="' + u + '" value="' + r + '"><br />')
                }
            } else {
                if (!L.au(n)) {
                    nq(m).val(n[p])
                }
            }
        }
        if (o == true) {
            nq(v).append(q.join("\n"));
            if (uV.dV.dk == ad.jt && (!D.cr || D.bd < 49)) {
                nq(v).show()
            }
        }
    };
    this.copyDivision = function(j, l) {
        var k = L.xw(j, "byclass", "nppfs-elements");
        var m = L.xw(l, "byclass", "nppfs-elements");
        if (!L.au(k) && !L.au(m)) {
            nq("input", nq(k)).each(function(o, n) {
                var p = n.name;
                var q = n.value;
                if (!L.au(l.elements[p])) {
                    l.elements[p].value = q
                } else {
                    if (uV.dV.dk == ad.fJ) {
                        nq(m).append('<input type="hidden" name="' + p + '" value="' + q + '" />')
                    } else {
                        nq(m).append(p + ' : <input type="text" name="' + p + '" value="' + q + '" />')
                    }
                }
            })
        }
    };
    this.tY = false;
    this.wT = function(l, k, j) {
        var m = L.n5("div");
        if (k == "byclass") {
            m.setAttribute("class", j)
        } else {
            l = document.body;
            m.setAttribute("id", j)
        }
        m.setAttribute("style", "display:none;");
        nq(l).prepend(m);
        return m
    };
    this.findParentForm = function(m) {
        var k = m;
        var j = nq(m).parents("form");
        if (j.length > 0) {
            var l = j.last();
            k = l.get(0)
        }
        return k
    };
    this.xw = function(l, k, j) {
        if (L.bn(j)) {
            return null
        }
        l = l || document;
        if (l.tagName && l.tagName.toLowerCase() === "form") {
            l = this.findParentForm(l)
        }
        var m = (k == "byid") ? nq("#" + j).get(0) : nq("div." + j, nq(l)).get(0);
        return m || this.wT(l, k, j)
    };
    this.so = function(j) {
        j.preventDefault ? j.preventDefault() : j.returnValue = false
    };
    this.eD = function(l) {
        var j = -1;
        try {
            var m = new Date();
            j = m - l;
            if (j > 100000) {
                j = 99999
            }
        } catch (k) {}
        return j + ""
    };
    this.gn = function(m) {
        var n = m.split(/ |,|\.|\_|\//g);
        var l = new Array();
        var k = 0;
        for (var j = 0; j < n.length; j++) {
            if (!L.bn(n[j])) {
                l[k] = n[j];
                k++
            }
        }
        if (l.length > 0) {
            return l
        }
        return null
    };
    this.db = function(n, j, p) {
        if (this.bn(n)) {
            return false
        }
        if (this.bn(j)) {
            return false
        }
        var m = this.gn("" + n);
        var l = m.length;
        var o = this.gn("" + j);
        var k = 0;
        for (k = 0; k < l; k++) {
            if (L.au(o[k])) {
                o[k] = 0
            }
            m[k] = parseInt(m[k], 10);
            o[k] = parseInt(o[k], 10);
            if (m[k] > o[k]) {
                return true
            } else {
                if (m[k] < o[k]) {
                    return false
                }
            }
        }
        if (k == l) {
            return true
        }
        if (m.toString() == o.toString()) {
            return true
        }
        return false
    };
    this.ak = function(m, l, k) {
        var j = true;
        if (!L.bn(l)) {
            j = j && L.db(m, l)
        }
        if (!L.bn(k)) {
            j = j && L.db(k, m)
        }
        return j
    };
    this.hf = function(k, n, j, p, m) {
        try {
            var l = k + "=" + escape(n) + ";";
            if (j) {
                if (j instanceof Date) {
                    if (isNaN(j.getTime())) {
                        j = new Date()
                    }
                } else {
                    j = new Date(new Date().getTime() + parseInt(j, 10) * 1000 * 60 * 60 * 24)
                }
                l += "expires=" + j.toGMTString() + ";"
            }
            if (!!p) {
                l += "path=" + p + ";"
            }
            if (!!m) {
                l += "domain=" + m + ";"
            }
            document.cookie = l
        } catch (o) {}
    };
    this.jv = function(k) {
        k = k + "=";
        var m = document.cookie;
        var n = m.indexOf(k);
        var l = "";
        if (n != -1) {
            n += k.length;
            var j = m.indexOf(";", n);
            if (j == -1) {
                j = m.length
            }
            l = m.substring(n, j)
        }
        return unescape(l)
    };
    this.show = function(k) {
        if (this.bn(k)) {
            return
        }
        if (typeof(k) !== "object") {
            k = L.bZ(k)
        }
        try {
            nq(k).show()
        } catch (j) {}
    };
    this.hide = function(k) {
        if (this.bn(k)) {
            return
        }
        if (typeof(k) !== "object") {
            k = L.bZ(k)
        }
        try {
            nq(k).hide()
        } catch (j) {}
    };
    this.val = function(j, k) {
        if (!L.au(j) && typeof(j) == "object") {
            if (typeof(k) == "undefined") {
                return nq(j).val() || ""
            } else {
                nq(j).val(k)
            }
        }
    };
    this.readOnly = function(j, k) {
        if (!L.au(j) && typeof(j) == "object") {
            if (typeof(k) == "undefined") {
                return nq(j).prop("readonly")
            } else {
                nq(j).prop("readonly", k)
            }
        }
    };
    this.ja = function(j, m, l, k) {
        nq(m).bind(j, function(n) {
            l(k)
        })
    };
    this.removeEvent = function(j, m, l, k) {
        nq(m).unbind(j, function(n) {
            l(k)
        })
    };
    this.addLoadEvent = function(l, k) {
        var j = function() {
            if (!L.au(k)) {
                l(k)
            } else {
                l()
            }
        };
        if (L.au(nq)) {
            setTimeout(j, 500)
        } else {
            nq(document).ready(function() {
                j()
            })
        }
    };
    this.u8d = function(j) {
        var k = "";
        var l = 0;
        var m = c1 = c2 = 0;
        while (l < j.length) {
            m = j.charCodeAt(l);
            if (m < 128) {
                k += String.fromCharCode(m);
                l++
            } else {
                if ((m > 191) && (m < 224)) {
                    c2 = j.charCodeAt(l + 1);
                    k += String.fromCharCode(((m & 31) << 6) | (c2 & 63));
                    l += 2
                } else {
                    c2 = j.charCodeAt(l + 1);
                    b = j.charCodeAt(l + 2);
                    k += String.fromCharCode(((m & 15) << 12) | ((c2 & 63) << 6) | (b & 63));
                    l += 3
                }
            }
        }
        return k
    };
    this.h2b = function(q) {
        var m = "0123456789abcdef";
        var j = new Array();
        var p = 0;
        for (var o = 0; o < q.length; o += 2) {
            var n = m.indexOf(q.charAt(o));
            var l = m.indexOf(q.charAt(o + 1));
            var k = (n << 4) | l;
            j[p++] = String.fromCharCode(k)
        }
        return j.join("")
    };
    this.dispatch = function(k, j) {
        k = (typeof(k) == "function") ? k : window[k];
        return k.apply(this, j || [])
    };
    this.getBounds = function(k, j) {
        var k = (typeof(k) == "object") ? k : L.bZ(k, j);
        if (!L.au(k)) {
            var l = nq(k);
            return {
                left: l.offset().left,
                top: l.offset().top,
                width: l.outerWidth(),
                height: l.outerHeight()
            }
        }
    };
    this.ep = function(k, l) {
        function n(r, q) {
            if (typeof(r) == "string") {
                var p = "";
                var o = 0;
                while (o++ < q - r.length) {
                    p += "0"
                }
                return p + r
            } else {
                if (typeof(r) == "number") {
                    return n(r.toString(), q)
                }
            }
            return r
        }
        if (!k.valueOf()) {
            return " "
        }
        var j = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var m = k;
        return l.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|ms|a\/p)/gi, function(o) {
            switch (o) {
                case "yyyy":
                    return m.getFullYear();
                case "yy":
                    return n((m.getFullYear() % 1000), 2);
                case "MM":
                    return n((m.getMonth() + 1), 2);
                case "dd":
                    return n(m.getDate(), 2);
                case "E":
                    return j[m.getDay()];
                case "HH":
                    return n(m.getHours(), 2);
                case "hh":
                    return n(((h = m.getHours() % 12) ? h : 12), 2);
                case "mm":
                    return n(m.getMinutes(), 2);
                case "ss":
                    return n(m.getSeconds(), 2);
                case "ms":
                    return n(m.getMilliseconds(), 3);
                case "a/p":
                    return m.getHours() < 12 ? "AM" : "PM";
                default:
                    return o
            }
        })
    };
    this.trim = function(k) {
        if (k == null) {
            return k
        }
        try {
            return k.replace(/(^\s*)|(\s*$)/gi, "")
        } catch (j) {
            try {
                return k.replace(/^\s+|\s+$/g, "")
            } catch (j) {}
        }
        return k
    };
    this.x7 = false;
    var b = 0;
    this.r9 = function(j, n, m) {
        function k(o) {
            try {
                Mc.log(new Error("Stack Trace").stack)
            } catch (p) {}
            if (!L.au(o)) {
                o.print()
            }
            Mc.log("ERROR COUNT : " + b + "");
            if (b >= uV.dV.Qa) {
                if (this.x7 == false) {
                    alert(N.m10);
                    Mc.log(N.m10);
                    this.x7 = true
                }
                if (!L.au(o)) {
                    o.aO(ad.bb)
                }
                bk.JF = true;
                zp.hideLoading();
                try {
                    location.reload()
                } catch (p) {}
                return true
            }
            b++;
            return false
        }
        if (L.bn(j) || j == Ye.h5) {
            var l = (m) ? k(m) : k();
            if (l) {
                return true
            }
            if (n) {
                setTimeout(function() {
                    n()
                }, uV.dV.kK)
            }
            return true
        } else {
            if (j == Ye.p0) {
                zp.mW();
                return true
            }
        }
        b = 0;
        return false
    };
    var i = 0;
    this.parseKeepAliveResult = function(j, m) {
        function k() {
            try {
                Mc.log(new Error("Stack Trace").stack)
            } catch (n) {}
            Mc.log("ERROR COUNT : " + i + "");
            if (i >= uV.dV.Qa) {
                if (this.x7 == false) {
                    Mc.log(N.m23);
                    this.x7 = true
                }
                bk.JF = true;
                zp.hideLoading();
                return true
            }
            i++;
            return false
        }
        if (L.bn(j) || j == Ye.h5) {
            var l = k();
            if (l) {
                return true
            }
            if (m) {
                setTimeout(function() {
                    m()
                }, uV.dV.kK)
            }
            return true
        } else {
            if (j == Ye.p0) {
                zp.mW();
                return true
            }
        }
        i = 0;
        return false
    };
    this.randomTable = [];
    this.randomIndex = 0;
    this.random = function() {
        var k = L.randomTable.length;
        var j = L.randomIndex;
        var l = L.randomTable[j];
        if (k == j + 1) {
            L.randomIndex = 0
        } else {
            L.randomIndex++
        }
        return l
    };
    this.sha256 = d;

    function d(p) {
        function O(P, k) {
            return (P >>> k) | (P << (32 - k))
        }
        var H = Math.pow;
        var u = H(2, 32);
        var n = "length";
        var F, B;
        var x = "";
        var A = [];
        var m = p[n] * 8;
        var l = d.h = d.h || [];
        var E = d.k = d.k || [];
        var r = E[n];
        var o = {};
        for (var q = 2; r < 64; q++) {
            if (!o[q]) {
                for (F = 0; F < 313; F += q) {
                    o[F] = q
                }
                l[r] = (H(q, 0.5) * u) | 0;
                E[r++] = (H(q, 1 / 3) * u) | 0
            }
        }
        p += "\x80";
        while (p[n] % 64 - 56) {
            p += "\x00"
        }
        for (F = 0; F < p[n]; F++) {
            B = p.charCodeAt(F);
            if (B >> 8) {
                return
            }
            A[F >> 2] |= B << ((3 - F) % 4) * 8
        }
        A[A[n]] = ((m / u) | 0);
        A[A[n]] = (m);
        for (B = 0; B < A[n];) {
            var y = A.slice(B, B += 16);
            var j = l;
            l = l.slice(0, 8);
            for (F = 0; F < 64; F++) {
                var C = F + B;
                var s = y[F - 15],
                    v = y[F - 2];
                var J = l[0],
                    G = l[4];
                var M = l[7] + (O(G, 6) ^ O(G, 11) ^ O(G, 25)) + ((G & l[5]) ^ ((~G) & l[6])) + E[F] + (y[F] = (F < 16) ? y[F] : (y[F - 16] + (O(s, 7) ^ O(s, 18) ^ (s >>> 3)) + y[F - 7] + (O(v, 17) ^ O(v, 19) ^ (v >>> 10))) | 0);
                var K = (O(J, 2) ^ O(J, 13) ^ O(J, 22)) + ((J & l[1]) ^ (J & l[2]) ^ (l[1] & l[2]));
                l = [(M + K) | 0].concat(l);
                l[4] = (l[4] + M) | 0
            }
            for (F = 0; F < 8; F++) {
                l[F] = (l[F] + j[F]) | 0
            }
        }
        for (F = 0; F < 8; F++) {
            for (B = 3; B + 1; B--) {
                var I = (l[F] >> (B * 8)) & 255;
                x += ((I < 16) ? 0 : "") + I.toString(16)
            }
        }
        return x
    }
};
w.zp = new function() {
    this.makeWebSocketUrl = function(port, host) {
        var protocol = uV.dV.dZ === "https" ? "wss" : "ws";
        var bs = [];
        bs.push(protocol);
        bs.push("://");
        bs.push(host);
        bs.push(((uV.dV.dZ == "http" && port == 80) || (uV.dV.dZ == "https" && port == 443)) ? "" : ":" + port);
        bs.push(uV.dV.iI);
        return bs.join("");
    };
    this.uuid = null;
    this.cB = -1;
    this.cz = false;
    this.dn = null;
    this.JF = false;
    var n = false;
    var x = false;
    var r = false;
    this.aG = {
        FW: true,
        SK: true,
        FD: true,
        KV: true
    };
    this.handshakeMode = 2;

    function b(y) {
        var A = {
            Firewall: true,
            SecureKey: true,
            Fds: true,
            Keypad: true,
            AutoStartup: true,
            Submit: true,
            Device: true,
            Debug: false,
            Form: null,
            AutoScanAttrName: "npkencrypt",
            AutoScanAttrValue: "on",
            MoveToInstall: function(B, C) {
                location.replace(B)
            },
            Loading: {
                Default: true,
                Before: function() {
                    zp.Wb()
                },
                After: function() {
                    zp.v3()
                }
            }
        };
        nq.extend(A, y);
        zp.aG = {
            FW: A.Firewall && uV.ki.FW,
            SK: A.SecureKey && uV.ki.SK,
            FD: A.Fds && uV.ki.FD,
            KV: A.Keypad && uV.ki.KV,
            SS: A.Submit,
            DV: A.Device,
            PA: A.PinAuth,
            AS: A.AutoStartup,
            FM: A.Form,
            LD: {
                DF: A.Loading.Default,
                BF: A.Loading.Before,
                AF: A.Loading.After
            },
            AN: A.AutoScanAttrName,
            AV: (L.au(A.AutoScanAttrValue) ? "" : A.AutoScanAttrValue.toLowerCase()),
            MI: A.MoveToInstall
        };
        if (A.Debug == true) {
            uV.dV.dk = ad.jt
        } else {
            uV.dV.dk = ad.fJ
        }
    }
    this.v4 = null;
    this.eventBinded = false;
    this.isStarting = false;
    this.functionQueue = [];
    this.functionExecute = function() {
        var y = zp.functionQueue.shift();
        if (typeof(y) == "function") {
            y()
        }
    };
    this.init = function(G) {
        npPfsCtrl.isStarting = true;
        npPfsCtrl.JF = false;
        b(G);
        if (uV.dV.dk == ad.jt) {
            var C = nq.event.trigger;
            nq.event.trigger = function(J, K, I, H) {
                if (!L.au(J) && !L.bn(J.type) && J.type.indexOf("nppfs") == 0) {
                    Mc.log(J.message)
                }
                C(J, K, I, H)
            }
        }
        Mc.reset();
        if (npPfsCtrl.functionQueue.length == 0) {
            nq(document).trigger({
                type: "nppfs-before-init",
                message: "Start the initialization of the NOS.",
                time: new Date()
            })
        }
        Mc.check("NOS 초기화 작업 시작");
        zp.showLoading();
        if (L.bn(zp.uuid)) {
            zp.uuid = L.gv();
            Mc.log("UID : " + zp.uuid)
        }
        var B = null;
        try {
            B = document.activeElement;
            if (B.tagName.toLowerCase() === "input" && !L.au(B.form) && !L.au(nq(B).attr("name"))) {
                this.v4 = B;
                Mc.log(N.m25.replace("%p%", nq(B).attr("name")));
                B.blur()
            }
        } catch (E) {}
        Mc.check("NOS 포커스된 입력양식 찾기 완료");
        if (zp.eventBinded == false) {
            nq(document).unbind("keydown mousedown unload beforeunload");
            nq(document).bind("keydown", function(M) {
                var P = (M || window.event);
                if (L.au(P)) {
                    return
                }
                var J = P.keyCode;
                var I = P.altKey;
                var Q = P.ctrlKey;
                var K = P.shiftKey;
                var H = P.metaKey;
                var O = false;
                if (D.win || D.lnx) {
                    O = (J == 123) || (Q && K && J == 73);
                    if (D.ff) {
                        O = O || (Q && K && (J == 75 || J == 81 || J == 83));
                        O = O || (K && (J == 113 || J == 116 || J == 118))
                    }
                } else {
                    if (D.mac) {
                        O = (I && H && (J == 73));
                        if (D.ff) {
                            O = O || (I && H && (J == 75 || J == 81 || J == 83));
                            O = O || (K && (J == 113 || J == 116 || J == 118))
                        }
                    }
                }
                if (O == true) {
                    Mc.log(N.m38);
                    L.so(P);
                    return false
                }
                bh.jw(P);
                if (P.keyCode == 9) {
                    npVCtrl.stopKeypad(P)
                }
            });
            nq(document).bind("mousedown", function(H) {
                var I = (H || window.event);
                if ((I.button == 2) || (I.button == 3)) {
                    Mc.log(N.m39);
                    L.so(I);
                    return false
                }
            });
            Mc.check("NOS 단축키 차단");
            try {
                function F(I) {
                    I = (I || window.event);
                    try {
                        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.beforeFinalize) == "function") {
                            var H = npPfsExtension.beforeFinalize(I);
                            if (!L.au(H)) {
                                return H
                            }
                        }
                        hI.bm();
                        if (hI.iK() == true) {
                            g()
                        }
                    } catch (J) {}
                }
                if (typeof(window.onbeforeunload) != "undefined") {
                    nq(window).bind("beforeunload", F)
                } else {
                    nq(window).bind("unload", F)
                }
            } catch (E) {
                Mc.log(E)
            }
            Mc.check("NOS 종료 이벤트 추가");
            zp.eventBinded = true
        }
        nq(document).unbind("nppfs-nos-jlk nppfs-nos-jhs nppfs-nos-jvc nppfs-nos-init nppfs-nos-startup");
        nq(document).bind("nppfs-nos-jlk nppfs-nos-jhs nppfs-nos-jvc nppfs-nos-init nppfs-nos-startup", p);
        if (hI.io() == true && L.bn(zp.dn)) {
            var y = uV.dV.Gf;
            Mc.log(y);
            var A = L.send(y, "id=" + zp.uuid, {
                async: false,
                ax: function(I) {
                    if (I.readyState == 4) {
                        if (I.status == 200) {
                            var H = I.responseText;
                            if (L.bn(H)) {
                                Mc.log(N.m04)
                            }
                            zp.dn = L.trim(H)
                        } else {
                            Mc.log(N.m04)
                        }
                        nq(document).trigger({
                            type: "nppfs-nos-jlk",
                            time: new Date()
                        })
                    }
                }
            });
            Mc.check("NOS E2E 초기화 완료")
        } else {
            nq(document).trigger({
                type: "nppfs-nos-jlk",
                time: new Date()
            })
        }
        if ((hI.iK() || hI.c7()) && (L.bn(this.cB) || this.cB <= 0)) {
            zp.eC(function() {
                if (r == true || zp.cz == false) {
                    if (zp.JF == true) {
                        return
                    }
                    zp.JF = true;
                    Mc.log(r ? N.m01 : N.m02);
                    if (typeof(zp.aG.MI) == "function") {
                        zp.aG.MI(uV.dV.Fz, r, false)
                    }
                    zp.hideLoading();
                    return
                }
            })
        } else {
            nq(document).trigger({
                type: "nppfs-nos-jhs",
                time: new Date()
            })
        }
    };

    function p(y) {
        nq(document).unbind(y);
        switch (y.type) {
            case "nppfs-nos-jlk":
                Mc.check("NOS 키교환 완료");
                hI.init({
                    form: zp.aG.FM
                });
                break;
            case "nppfs-nos-jhs":
                Mc.check("NOS 핸드쉐이크 완료");
                if (hI.iK() == true) {
                    a()
                }
                zp.isVirtualMachine(function(A) {
                    nq(document).trigger({
                        type: "nppfs-nos-jvc",
                        time: new Date()
                    });
                    Mc.check("NOS 가상머신확인 완료")
                });
                break;
            case "nppfs-nos-jvc":
                if (zp.aG.AS == true) {
                    zp.startup()
                } else {
                    zp.hideLoading()
                }
                nq(document).trigger({
                    type: "nppfs-nos-init",
                    time: new Date()
                });
                break;
            case "nppfs-nos-init":
                if (npPfsCtrl.functionQueue.length == 0) {
                    nq(document).trigger({
                        type: "nppfs-after-init",
                        message: "Initialization of NOS has been successfully carried out.",
                        time: new Date()
                    })
                }
                Mc.check("NOS 초기화 작업 종료");
                break;
            case "nppfs-nos-startup":
                if (npPfsCtrl.functionQueue.length == 0) {
                    zp.hideLoading();
                    nq(document).trigger({
                        type: "nppfs-after-startup",
                        message: "NOS was driving successfully.",
                        time: new Date()
                    })
                }
                if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.startupCallback) == "function") {
                    npPfsExtension.startupCallback()
                }
                Mc.check("NOS 모듈구동 작업 종료");
                Mc.printTimeline();
                npPfsCtrl.isStarting = false;
                break
        }
    }
    this.isStartup = false;
    this.startup = function(y) {
        Mc.check("NOS 모듈구동 작업 시작");
        if (npPfsCtrl.functionQueue.length == 0) {
            nq(document).trigger({
                type: "nppfs-before-startup",
                message: "Start driving the NOS.",
                time: new Date()
            })
        }
        this.jl();
        Mc.check("NOS 폼이름 점검 종료");
        zp.isStartup = true;
        hI.startup()
    };
    var u = false;
    this.resetVirtualMachine = function() {
        u = false
    };
    this.isVirtualMachine = function(y) {
        y = y || function() {};
        if (u == true) {
            y(D.virtualMachine);
            return
        }
        if (D.isMobileDevice() || D.isMetroUi()) {
            D.virtualMachine = false;
            Mc.log("Can not be checked a virtual machine at Metro UI or Mobile.");
            y(false);
            return
        }
        if (!hI.iK()) {
            u = true;
            D.virtualMachine = false;
            if (!L.au(y) && typeof(y) == "function") {
                y(D.virtualMachine)
            }
            return
        }
        if (zp.cz == false) {
            y(false);
            return
        }
        var A = zp.cQ(Ye.d3, Ye.j3, Ye.j0, null);
        L.fs(A, {
            ax: function(B) {
                if (L.bn(B)) {
                    setTimeout(function() {
                        zp.isVirtualMachine(y)
                    }, uV.dV.kK);
                    return
                } else {
                    if (B == Ye.a4) {
                        zp.aG.SK = false;
                        Mc.log(N.m48);
                        D.virtualMachine = true
                    } else {
                        if (B == Ye.h5) {
                            Mc.log(N.m49);
                            D.virtualMachine = false
                        } else {
                            if (B == Ye.p0) {
                                zp.mW()
                            } else {
                                D.virtualMachine = false
                            }
                        }
                    }
                }
                u = true;
                if (!L.au(y) && typeof(y) == "function") {
                    y(D.virtualMachine)
                }
            }
        })
    };
    this.waitSubmit = function(y) {
        y()
    };
    this.mW = function() {
        if (D.sf == true) {
            alert("보안프로그램에서 개발자도구나 디버그도구를 탐지하였습니다.\n보안을 위하여 개발자도구를 종료합니다.");
            return
        } else {
            alert(N.m09);
            location.reload()
        }
    };
    this.copy = function(y, A) {
        L.copyDivision(y, A)
    };
    this.Wb = function() {
        var y = L.xw(document, "byid", "nppfs-loading-modal");
        if (L.au(y)) {
            return
        }
        try {
            nq(y).css({
                display: "block",
                position: "fixed",
                "z-index": "10000",
                top: "0",
                left: "0",
                height: "100%",
                width: "100%",
                background: "rgba( 255, 255, 255, .7) url(data:image/gif;base64,R0lGODlhIAAgAPMAAP///wAAAMbGxoSEhLa2tpqamjY2NlZWVtjY2OTk5Ly8vB4eHgQEBAAAAAAAAAAAACH/C05FVFNDQVBFMi4wAwEAAAAh/hpDcmVhdGVkIHdpdGggYWpheGxvYWQuaW5mbwAh+QQJCgAAACwAAAAAIAAgAAAE5xDISWlhperN52JLhSSdRgwVo1ICQZRUsiwHpTJT4iowNS8vyW2icCF6k8HMMBkCEDskxTBDAZwuAkkqIfxIQyhBQBFvAQSDITM5VDW6XNE4KagNh6Bgwe60smQUB3d4Rz1ZBApnFASDd0hihh12BkE9kjAJVlycXIg7CQIFA6SlnJ87paqbSKiKoqusnbMdmDC2tXQlkUhziYtyWTxIfy6BE8WJt5YJvpJivxNaGmLHT0VnOgSYf0dZXS7APdpB309RnHOG5gDqXGLDaC457D1zZ/V/nmOM82XiHRLYKhKP1oZmADdEAAAh+QQJCgAAACwAAAAAIAAgAAAE6hDISWlZpOrNp1lGNRSdRpDUolIGw5RUYhhHukqFu8DsrEyqnWThGvAmhVlteBvojpTDDBUEIFwMFBRAmBkSgOrBFZogCASwBDEY/CZSg7GSE0gSCjQBMVG023xWBhklAnoEdhQEfyNqMIcKjhRsjEdnezB+A4k8gTwJhFuiW4dokXiloUepBAp5qaKpp6+Ho7aWW54wl7obvEe0kRuoplCGepwSx2jJvqHEmGt6whJpGpfJCHmOoNHKaHx61WiSR92E4lbFoq+B6QDtuetcaBPnW6+O7wDHpIiK9SaVK5GgV543tzjgGcghAgAh+QQJCgAAACwAAAAAIAAgAAAE7hDISSkxpOrN5zFHNWRdhSiVoVLHspRUMoyUakyEe8PTPCATW9A14E0UvuAKMNAZKYUZCiBMuBakSQKG8G2FzUWox2AUtAQFcBKlVQoLgQReZhQlCIJesQXI5B0CBnUMOxMCenoCfTCEWBsJColTMANldx15BGs8B5wlCZ9Po6OJkwmRpnqkqnuSrayqfKmqpLajoiW5HJq7FL1Gr2mMMcKUMIiJgIemy7xZtJsTmsM4xHiKv5KMCXqfyUCJEonXPN2rAOIAmsfB3uPoAK++G+w48edZPK+M6hLJpQg484enXIdQFSS1u6UhksENEQAAIfkECQoAAAAsAAAAACAAIAAABOcQyEmpGKLqzWcZRVUQnZYg1aBSh2GUVEIQ2aQOE+G+cD4ntpWkZQj1JIiZIogDFFyHI0UxQwFugMSOFIPJftfVAEoZLBbcLEFhlQiqGp1Vd140AUklUN3eCA51C1EWMzMCezCBBmkxVIVHBWd3HHl9JQOIJSdSnJ0TDKChCwUJjoWMPaGqDKannasMo6WnM562R5YluZRwur0wpgqZE7NKUm+FNRPIhjBJxKZteWuIBMN4zRMIVIhffcgojwCF117i4nlLnY5ztRLsnOk+aV+oJY7V7m76PdkS4trKcdg0Zc0tTcKkRAAAIfkECQoAAAAsAAAAACAAIAAABO4QyEkpKqjqzScpRaVkXZWQEximw1BSCUEIlDohrft6cpKCk5xid5MNJTaAIkekKGQkWyKHkvhKsR7ARmitkAYDYRIbUQRQjWBwJRzChi9CRlBcY1UN4g0/VNB0AlcvcAYHRyZPdEQFYV8ccwR5HWxEJ02YmRMLnJ1xCYp0Y5idpQuhopmmC2KgojKasUQDk5BNAwwMOh2RtRq5uQuPZKGIJQIGwAwGf6I0JXMpC8C7kXWDBINFMxS4DKMAWVWAGYsAdNqW5uaRxkSKJOZKaU3tPOBZ4DuK2LATgJhkPJMgTwKCdFjyPHEnKxFCDhEAACH5BAkKAAAALAAAAAAgACAAAATzEMhJaVKp6s2nIkolIJ2WkBShpkVRWqqQrhLSEu9MZJKK9y1ZrqYK9WiClmvoUaF8gIQSNeF1Er4MNFn4SRSDARWroAIETg1iVwuHjYB1kYc1mwruwXKC9gmsJXliGxc+XiUCby9ydh1sOSdMkpMTBpaXBzsfhoc5l58Gm5yToAaZhaOUqjkDgCWNHAULCwOLaTmzswadEqggQwgHuQsHIoZCHQMMQgQGubVEcxOPFAcMDAYUA85eWARmfSRQCdcMe0zeP1AAygwLlJtPNAAL19DARdPzBOWSm1brJBi45soRAWQAAkrQIykShQ9wVhHCwCQCACH5BAkKAAAALAAAAAAgACAAAATrEMhJaVKp6s2nIkqFZF2VIBWhUsJaTokqUCoBq+E71SRQeyqUToLA7VxF0JDyIQh/MVVPMt1ECZlfcjZJ9mIKoaTl1MRIl5o4CUKXOwmyrCInCKqcWtvadL2SYhyASyNDJ0uIiRMDjI0Fd30/iI2UA5GSS5UDj2l6NoqgOgN4gksEBgYFf0FDqKgHnyZ9OX8HrgYHdHpcHQULXAS2qKpENRg7eAMLC7kTBaixUYFkKAzWAAnLC7FLVxLWDBLKCwaKTULgEwbLA4hJtOkSBNqITT3xEgfLpBtzE/jiuL04RGEBgwWhShRgQExHBAAh+QQJCgAAACwAAAAAIAAgAAAE7xDISWlSqerNpyJKhWRdlSAVoVLCWk6JKlAqAavhO9UkUHsqlE6CwO1cRdCQ8iEIfzFVTzLdRAmZX3I2SfZiCqGk5dTESJeaOAlClzsJsqwiJwiqnFrb2nS9kmIcgEsjQydLiIlHehhpejaIjzh9eomSjZR+ipslWIRLAgMDOR2DOqKogTB9pCUJBagDBXR6XB0EBkIIsaRsGGMMAxoDBgYHTKJiUYEGDAzHC9EACcUGkIgFzgwZ0QsSBcXHiQvOwgDdEwfFs0sDzt4S6BK4xYjkDOzn0unFeBzOBijIm1Dgmg5YFQwsCMjp1oJ8LyIAACH5BAkKAAAALAAAAAAgACAAAATwEMhJaVKp6s2nIkqFZF2VIBWhUsJaTokqUCoBq+E71SRQeyqUToLA7VxF0JDyIQh/MVVPMt1ECZlfcjZJ9mIKoaTl1MRIl5o4CUKXOwmyrCInCKqcWtvadL2SYhyASyNDJ0uIiUd6GGl6NoiPOH16iZKNlH6KmyWFOggHhEEvAwwMA0N9GBsEC6amhnVcEwavDAazGwIDaH1ipaYLBUTCGgQDA8NdHz0FpqgTBwsLqAbWAAnIA4FWKdMLGdYGEgraigbT0OITBcg5QwPT4xLrROZL6AuQAPUS7bxLpoWidY0JtxLHKhwwMJBTHgPKdEQAACH5BAkKAAAALAAAAAAgACAAAATrEMhJaVKp6s2nIkqFZF2VIBWhUsJaTokqUCoBq+E71SRQeyqUToLA7VxF0JDyIQh/MVVPMt1ECZlfcjZJ9mIKoaTl1MRIl5o4CUKXOwmyrCInCKqcWtvadL2SYhyASyNDJ0uIiUd6GAULDJCRiXo1CpGXDJOUjY+Yip9DhToJA4RBLwMLCwVDfRgbBAaqqoZ1XBMHswsHtxtFaH1iqaoGNgAIxRpbFAgfPQSqpbgGBqUD1wBXeCYp1AYZ19JJOYgH1KwA4UBvQwXUBxPqVD9L3sbp2BNk2xvvFPJd+MFCN6HAAIKgNggY0KtEBAAh+QQJCgAAACwAAAAAIAAgAAAE6BDISWlSqerNpyJKhWRdlSAVoVLCWk6JKlAqAavhO9UkUHsqlE6CwO1cRdCQ8iEIfzFVTzLdRAmZX3I2SfYIDMaAFdTESJeaEDAIMxYFqrOUaNW4E4ObYcCXaiBVEgULe0NJaxxtYksjh2NLkZISgDgJhHthkpU4mW6blRiYmZOlh4JWkDqILwUGBnE6TYEbCgevr0N1gH4At7gHiRpFaLNrrq8HNgAJA70AWxQIH1+vsYMDAzZQPC9VCNkDWUhGkuE5PxJNwiUK4UfLzOlD4WvzAHaoG9nxPi5d+jYUqfAhhykOFwJWiAAAIfkECQoAAAAsAAAAACAAIAAABPAQyElpUqnqzaciSoVkXVUMFaFSwlpOCcMYlErAavhOMnNLNo8KsZsMZItJEIDIFSkLGQoQTNhIsFehRww2CQLKF0tYGKYSg+ygsZIuNqJksKgbfgIGepNo2cIUB3V1B3IvNiBYNQaDSTtfhhx0CwVPI0UJe0+bm4g5VgcGoqOcnjmjqDSdnhgEoamcsZuXO1aWQy8KAwOAuTYYGwi7w5h+Kr0SJ8MFihpNbx+4Erq7BYBuzsdiH1jCAzoSfl0rVirNbRXlBBlLX+BP0XJLAPGzTkAuAOqb0WT5AH7OcdCm5B8TgRwSRKIHQtaLCwg1RAAAOwAAAAAAAAAAAA==) 50% 50% no-repeat",
                opacity: "0.7",
                backgroundColor: "#ffffff",
                filter: "alpha(opacity=70)"
            })
        } catch (A) {}
        k = 0
    };
    this.v3 = function() {
        var y = L.xw(document, "byid", "nppfs-loading-modal");
        if (L.au(y)) {
            return
        }
        nq(y).css({
            display: "none",
            width: "0px",
            height: "0px"
        });
        q = 0
    };
    var k = 0;
    this.showLoading = function() {
        if (L.au(zp.aG) || L.au(zp.aG.LD) || L.au(zp.aG.LD.DF) || zp.aG.LD.DF == true) {
            this.Wb()
        } else {
            if (!L.au(zp.aG.LD.BF) && typeof(zp.aG.LD.BF) == "function") {
                if (k > 0) {
                    this.Wb()
                } else {
                    k++;
                    zp.aG.LD.BF()
                }
            } else {
                this.Wb()
            }
        }
    };
    var q = 0;
    this.hideLoading = function() {
        if (L.au(zp.aG) || L.au(zp.aG.LD) || L.au(zp.aG.LD.DF) || zp.aG.LD.DF == true) {
            this.v3()
        } else {
            if (!L.au(zp.aG.LD.AF) && typeof(zp.aG.LD.AF) == "function") {
                if (q > 0) {
                    this.v3()
                } else {
                    q++;
                    zp.aG.LD.AF()
                }
            } else {
                this.v3()
            }
        }
    };
    this.cZ = function(y, B) {
        var A = [];
        A.push(uV.dV.dZ);
        A.push("://");
        A.push(B);
        A.push(((uV.dV.dZ == "http" && y == 80) || (uV.dV.dZ == "https" && y == 443)) ? "" : ":" + y);
        A.push(uV.dV.iI);
        return A.join("")
    };
    this.qh = function(y, E, G) {
        if (L.au(G) || typeof(G) != "array") {
            var C = L.mL(16);
            G = new Array(4);
            G[0] = "";
            G[1] = Ye.x5;
            G[2] = L.hH(C) + L.encrypt(document.domain, L.ha(L.hH(C)), "ECB", 128);
            G[3] = "1000"
        }
        var B = G.length;
        var F = [];
        F.push(y);
        if (L.bn(E)) {
            F.push("1")
        } else {
            F.push(E)
        }
        F.push(B);
        for (var A = 0; A < B; A++) {
            F.push(L.cC(G[A]));
            F.push(G[A])
        }
        return F
    };
    this.cQ = function(y, A, B, E) {
        var C = zp.qh(y, A);
        if (!L.bn(B)) {
            C.push(B)
        }
        if (!L.bn(E)) {
            C.push(L.cC(E));
            C.push(E)
        }
        return C.join("")
    };
    var s = false;
    var j = false;
    var c = false;
    var o = [];
    var e = false;
    var f = [];
    var i = function() {
        for (var y = 0; y < f.length; y++) {
            if (typeof(f[y]) == "function") {
                L.dispatch(f[y])
            }
        }
        f = []
    };
    this.eC = function(C) {
        o = [];
        if (e == true) {
            if (typeof(C) == "function") {
                f.push(C)
            }
            return
        }
        e = true;
        if (typeof(C) == "function") {
            f.push(C)
        }
        zp.cz = false;
        if (j == false) {
            var A = L.jv("npPfsHost");
            var y = L.jv("npPfsPort");
            if (!L.bn(A) && !L.bn(y) && y > 0 && s == false) {
                Mc.log(N.m13.replace("%h%", A).replace("%p%", y));
                E(A, y, i);
                s = true
            } else {
                E("127.0.0.1", uV.dV.l5, i);
                s = true;
                j = true
            }
        } else {
            for (var B = 0; B < uV.dV.Cc; B++) {
                E("127.0.0.1", uV.dV.l5 + B, i)
            }
            c = true
        }

        function E(H, G, I) {
            if (zp.JF == true) {
                return
            }
            var F = "task_" + H.split(".").join("_") + "_" + G;
            if (L.indexOf(o, F) < 0) {
                o.push(F)
            }

            function J(R) {
                var P = "1";
                var M = L.mL(16);
                var O = L.hH(M) + L.encrypt(nua, L.ha(L.hH(M)), "ECB", 128);
                var K = P + L.cC(O) + O;
                var Q = zp.cQ(Ye.d3, Ye.j3, Ye.h6, K);
                // chrome 엔진 버전이 94일 경우 websocket 사용
                if (D.isSupportWebSocket) {
                    var version = D.iT();
                    var aM;
                    if (D.op) {
                        //opera의 기존 iT 사용 시 opera 버전을 추출하여 별도 크롬 버전 추출
                        var opVersion = nua.substring(nua.toLowerCase().lastIndexOf("chrome"));
                        if (opVersion.indexOf(" ") != -1) {
                            opVersion = opVersion.substring(0, opVersion.indexOf(" "));
                            aM = opVersion.split("/");
                            version = aM[1];
                        }
                    }
                    if (L.db(version, 94)) {
                        zp.handshakeMode = 2;
                    }
                }
                L.fs(Q, R, function(T) {
                    if (T.readyState == 4) {
                        var S = "";
                        if (T.status == 200) {
                            S = T.responseText
                        }
                        R.ax(S, R.host, R.port)
                    }
                })
            }(function(P) {
                try {
                    nq.extend(P, {
                        host: H,
                        port: G,
                        timeout: 3 * 1000
                    });
                    J(P);
                    return;
                    var isreturned = false;
                } catch (e) {
                    if (isreturned == false) P.ax("", H, G);
                    isreturned = true;
                    Mc.log(e);
                }
            })({
                ax: function(M, P, O) {
                    var K = "task_" + P.split(".").join("_") + "_" + O;
                    o.splice(L.indexOf(o, K), 1);
                    var Q = false;
                    switch (M) {
                        case Ye.a4:
                            var Q = true;
                            break;
                        case Ye.p0:
                            Q = true;
                            zp.mW();
                            break;
                        case Ye.ag:
                            Q = true;
                            r = true;
                            break;
                        case Ye.aj:
                            Q = true;
                            Mc.log(N.m51.replace("%p1%", P).replace("%p2%", O));
                            x = true;
                            break;
                        case Ye.d4:
                            Q = false;
                            n = true;
                            Mc.log(N.m15);
                            break;
                        default:
                            Q = false
                    }
                    if (zp.cz == false && Q == true) {
                        n = false;
                        zp.cz = true;
                        zp.c6 = P;
                        zp.cB = O;
                        Mc.log(N.m14.replace("%h%", P).replace("%p%", O));
                        L.hf("npPfsHost", zp.c6, 7, "/");
                        L.hf("npPfsPort", zp.cB, 7, "/");
                        j = true;
                        c = true;
                        if (x == true) {
                            zp.ak()
                        } else {
                            nq(document).trigger({
                                type: "nppfs-nos-jhs",
                                time: new Date()
                            })
                        }
                        I()
                    }
                    if (o.length == 0) {
                        e = false;
                        handshakeCallback = null;
                        if (n == true) {
                            c = false;
                            setTimeout(function() {
                                zp.eC()
                            }, uV.dV.kK)
                        } else {
                            if (c == false) {
                                zp.eC()
                            } else {
                                if (zp.cz == false) {
                                    L.hf("npPfsHost", "", -1, "/");
                                    L.hf("npPfsPort", "", -1, "/");
                                    I();
                                    nq(document).trigger({
                                        type: "nppfs-nos-jhs",
                                        time: new Date()
                                    })
                                }
                            }
                        }
                    }
                }
            })
        }
    };
    this.ak = function() {
        var y = "";
        var A = uV.dV.cM;
        Mc.log("업데이트버전 경로 : " + A + "");
        var B = setTimeout(function() {
            Mc.log("업데이트버전 다운로드 실패(Timeout 10초).");
            nq(document).trigger({
                type: "nppfs-nos-jhs",
                time: new Date()
            })
        }, 10 * 1000);
        zp.cz = true;
        r = false;
        x = false;
        nq.ajax({
            url: A,
            cache: false,
            crossDomain: true,
            async: false,
            type: "GET",
            global: false,
            dataType: "jsonp",
            jsonp: "jsonp_callback",
            jsonpCallback: "VersionInfo",
            contentType: "application/json",
            error: function(F, E, C) {
                clearTimeout(B);
                nq(document).trigger({
                    type: "nppfs-nos-jhs",
                    time: new Date()
                })
            },
            success: function(F, E, I) {
                clearTimeout(B);
                if (L.bn(F)) {
                    nq(document).trigger({
                        type: "nppfs-nos-jhs",
                        time: new Date()
                    });
                    return
                }
                var C = F;
                Mc.log("업데이트버전 정보 : " + C);
                var G = "1";
                var H = zp.cQ(Ye.d3, Ye.j3, Ye.am, (G + L.cC(C) + C));
                L.fs(H, {
                    ax: function(J) {
                        switch (J) {
                            case Ye.h5:
                                r = false;
                                break;
                            case Ye.a4:
                                r = true;
                            default:
                                break
                        }
                        x = false;
                        nq(document).trigger({
                            type: "nppfs-nos-jhs",
                            time: new Date()
                        });
                        Mc.check("NOS 핸드쉐이크 - 버전비교 종료")
                    }
                })
            },
            complete: function(E, C) {
                clearTimeout(B);
                Mc.check("NOS 핸드쉐이크 - 버전얻기 종료")
            }
        })
    };
    this.isInstall = function(y) {
        if (L.au(y)) {
            y = {}
        }
        if (L.au(y.success)) {
            y.success = function() {}
        }
        if (L.au(y.fail)) {
            y.fail = function() {}
        }
        if (L.bn(this.cB) || this.cB <= 0 || r == true) {
            zp.eC(function() {
                if (zp.cz == false || r == true) {
                    y.fail()
                } else {
                    y.success()
                }
            })
        } else {
            y.success()
        }
    };
    var m = false;
    this.checkInstall = function(y) {
        if (L.au(y)) {
            y = {}
        }
        if (L.au(y.before)) {
            y.before = function() {}
        }
        if (L.au(y.after)) {
            y.after = function() {}
        }
        if (m == false) {
            y.before();
            m = true
        }
        zp.eC(function() {
            if (zp.cz == false || r == true || x == true) {
                if (r == true || L.bn(this.cB) || this.cB <= 0) {
                    r = false
                }
                setTimeout(function() {
                    j = false;
                    c = false;
                    Mc.log("zp.checkInstall(callbacks);");
                    zp.checkInstall(y)
                }, 2 * 1000);
                return
            } else {
                y.after()
            }
        })
    };
    var d = null;

    function v() {
        if (zp.cz == false || zp.JF == true) {
            return
        }

        function A(J) {
            try {
                if (L.parseKeepAliveResult(J, function() {
                        if (d != null) {
                            clearInterval(d);
                            d == null
                        }
                        setTimeout(function() {
                            v()
                        }, 3000)
                    })) {
                    return
                }
                if (d == null) {
                    d = setInterval(v, 3000)
                }
            } catch (K) {}
        }
        nq(document).trigger({
            type: "nppfs-keep-alive",
            message: N.m52,
            time: new Date()
        });

        function y(K, J) {
            K = K + "";
            return K.length >= J ? K : new Array(J - K.length + 1).join("0") + K
        }
        var G = 0;
        if (zp.aG.FW && npNCtrl.isRunning()) {
            G += 1
        }
        if (zp.aG.SK && bh.isRunning()) {
            G += 2
        }
        if (zp.aG.FD && Xv.isRunning()) {
            G += 4
        }
        if (zp.aG.KV && npVCtrl.isRunning()) {
            G += 8
        }
        G = y(G, 4);
        var B = L.mL(16);
        var C = [];
        C.push(L.hH(B) + L.encrypt(G, L.ha(L.hH(B)), "ECB", 128));
        var H = C.length.toString(16);
        for (var F = 0; F < C.length; F++) {
            var I = C[F];
            H += L.cC(I) + I
        }
        var E = zp.cQ(Ye.d3, Ye.j3, Ye.d8, H);
        if (D.win) {
            L.fs(E, {
                ax: A
            })
        } else {
            L.fs(E, {
                ax: A
            })
        }
    }

    function a() {
        if (zp.JF == true) {
            return
        }
        if (d != null) {
            clearInterval(d)
        }
        d = setInterval(v, 3000)
    }

    function g() {
        if (d != null) {}
    }
    this.isSupport = function() {
        var y = hI.iS();
        var A = false;
        nq(y).each(function() {
            if (!L.au(this.controller) && !L.au(this.controller.isSupported) && typeof(this.controller.isSupported) == "function") {
                if (this.id === "nppfs.npk.module") {
                    A = this.controller.isSupported() || npVCtrl.isSupported()
                } else {
                    A = this.controller.isSupported()
                }
                return !A
            }
        });
        return A
    };
    this.GetReplaceField = function(y, A) {
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(A)) {
            return npVCtrl.iu(y, A)
        }
        if (bh.isRunning() == true) {
            return bh.iu(y, A)
        }
    };
    this.GetResultField = function(y, A) {
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(A)) {
            return npVCtrl.im(y, A)
        }
        if (bh.isRunning() == true) {
            return bh.im(y, A)
        }
    };
    this.GetEncryptResult = function(y, A) {
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(A)) {
            return npVCtrl.GetEncryptResult(y, A).trim()
        }
        if (bh.isRunning() == true) {
            return bh.GetEncryptResult(y, A).trim()
        }
    };
    this.ReuseModules = function() {
        if (bh.isRunning() == true) {
            return bh.ReuseModules()
        } else {
            return
        }
    };
    this.RegistDynamicField = function(A, C) {
        try {
            var y = document.activeElement;
            if (!L.au(y) && y.tagName && y.tagName.toLowerCase() == "input" && (y.type == "password" || y.type == "text" || y.type == "tel")) {
                zp.v4 = y
            }
        } catch (B) {}
        if (bh.isRunning() == true) {
            bh.eX(A, C)
        }
        if (npVCtrl.isRunning() == true) {
            npVCtrl.eX(A, C)
        }
    };
    this.ResetField = function(A, y) {
        if (npVCtrl.isRunning() == true) {
            npVCtrl.resetKeypad(y);
            npVCtrl.hideKeypad(y)
        }
        if (bh.isRunning() == true) {
            bh.iM(A, y)
        }
    };
    this.RescanField = function() {
        try {
            var y = document.activeElement;
            if (!L.au(y) && y.tagName && y.tagName.toLowerCase() == "input" && (y.type == "password" || y.type == "text" || y.type == "tel")) {
                zp.v4 = y
            }
        } catch (A) {}
        this.jl();
        if (npVCtrl.isRunning() == true) {
            npVCtrl.cU()
        }
        if (bh.isRunning() == true) {
            bh.cU()
        }
    };
    this.cI = null;
    this.SetGlobalKeyValidation = function(y) {
        this.cI = null;
        if (L.au(y)) {
            return
        }
        if (typeof(y) !== "function") {
            return
        }
        this.cI = y
    };
    this.jl = function() {
        nq(nq("form")).each(function(A, B) {
            var y = nq(this);
            L.xw(this, "byclass", "nppfs-elements");
            var C = "d" + L.hH(L.mL(8));
            if (L.bn(y.attr("name"))) {
                y.attr({
                    name: C
                })
            }
            if (L.bn(y.attr("data-nppfs-form-id"))) {
                y.attr({
                    "data-nppfs-form-id": C
                })
            }
        });
        nq("input").each(function() {
            var y = nq(this).attr("type");
            if (L.bn(y)) {
                nq(this).attr("type", "text");
                y = "text"
            }
            if (!L.bn(y) && y != "text" && y != "password" && y != "tel") {
                return true
            }
        })
    };
    this.encryptValue = function(A, y) {
        if (typeof(y) != "function") {
            alert(N.m53);
            return
        }
        if (L.bn(A)) {
            y("");
            return
        }
        if (zp.cz == false || zp.JF == true) {
            alert("NOS와 통신할 수 없습니다. npPfsStartup()으로 먼저 페이지를 초기화하십시오.");
            y("");
            return
        }
        var E = L.hH(L.getBytes(A));
        var B = "1";
        var F = B + L.cC(E) + E;
        var C = zp.cQ(Ye.d3, Ye.j3, Ye.dG, F);
        L.fs(C, {
            ax: function(G) {
                if (!L.bn(G)) {
                    y(G);
                    return
                }
                y("")
            }
        })
    };
    this.dynamicField = {};
    this.putDynamicField = function(A, C, F) {
        var B = (typeof(A) == "object" && A != null) ? nq(A).attr("name") + "_" : A + "_";
        var y = B + nq("input[name='" + C + "']").attr("name");
        var E = this.dynamicField[y];
        if (L.au(E)) {
            this.dynamicField[y] = [F]
        } else {
            this.dynamicField[y].push(F)
        }
    };
    this.getDynamicField = function(A, C) {
        var B = (typeof(A) == "object" && A != null) ? nq(A).attr("name") + "_" : A + "_";
        var y = B + nq("input[name='" + C + "']").attr("name");
        var E = this.dynamicField[y];
        if (L.au(E)) {
            return []
        }
        return this.dynamicField[y]
    };

    function l(A) {
        var B = [ad.wG, ad.Ix, ad.jd, "i_borun", "i_e2e_id", "i_e2e_key", "i_tot_hash", "i_log_total", "i_elapsed_tm", "i_log_yn", "i_version", "i_tot_log", "f_uuid", "f_key", "f_uuid"];
        for (var y = 0; y < B.length; y++) {
            if (B[y] == A) {
                return y
            }
        }
        return -1
    }
    this.serializeArray = function(A, B) {
        var y = (typeof(A) == "object" && A != null) ? A : L.bZ(A);
        B = typeof(B) == "undefined" ? true : B;
        if (B == false) {
            return nq(y).serializeArray()
        }
        var C = [];
        nq.each(nq(y).serializeArray(), function() {
            if (this.name.indexOf("__E2E__") > 0 || this.name.indexOf("__KI_") == 0 || this.name.indexOf("__KIEXT_") == 0 || this.name.indexOf("__KH_") == 0 || this.name.indexOf("__KU_") == 0 || l(this.name) >= 0) {
                C.push(this)
            }
        });
        return C
    };
    this.toJson = function(A) {
        var B = {};
        var y = (typeof(A) == "object" && A != null) ? A : L.bZ(A);
        nq.each(nq(y).serializeArray(), function() {
            if (B[this.name] !== undefined) {
                if (!B[this.name].push) {
                    B[this.name] = [B[this.name]]
                }
                B[this.name].push(this.value || "")
            } else {
                B[this.name] = this.value || ""
            }
        });
        return B
    };
    this.setColor = function(y) {
        bh.setColor(y);
        npVCtrl.setColor(y)
    };
    this.doFocusOut = function(A, y) {
        bh.doFocusOut(A, y)
    };
    this.enableUI = function(y, A) {
        bh.enableUI(y, A);
        npVCtrl.enableUI(y, A)
    };
    this.disableUI = function(y, A) {
        bh.disableUI(y, A);
        npVCtrl.disableUI(y, A)
    };
    this.IsVirtualMachine = this.isVirtualMachine;
    this.IsMetroUi = this.isMetroUi;
    this.IsInstall = this.isInstall;
    this.IsSupport = this.isSupport;
    this.CheckInstall = this.checkInstall;
    this.isMobileDevice = this.IsMobileDevice = D.isMobileDevice;
    this.launch = function(y) {
        npPfsCtrl.init(y)
    }
};
w.npPfsCtrl = zp;
w.npNCtrl = new function() {
    this.id = "nppfs.npn.module";
    var k = {
        gP: Ye.p8,
        support: {
            aF: {
                aX: true,
                di: {
                    qs: "5.0",
                    Oc: "10.0"
                },
                al: {
                    IE: {
                        aX: true,
                        qs: "7.0",
                        Oc: "11.0"
                    },
                    FF: {
                        aX: true,
                        qs: "21.0"
                    },
                    CR: {
                        aX: true,
                        qs: "30.0"
                    },
                    OP: {
                        aX: true,
                        qs: "9.0"
                    },
                    SF: {
                        aX: true,
                        qs: "5.0"
                    },
                    EG: {
                        aX: true,
                        qs: "12.0"
                    },
                    fv: {
                        aX: false
                    },
                    B360: {
                        aX: true,
                        qs: "7.5"
                    },
                    QQ: {
                        aX: true,
                        qs: "38.0"
                    }
                }
            },
            jV: {
                aX: true,
                di: {
                    qs: "10.8",
                    Oc: "10.13"
                },
                al: {
                    IE: {
                        aX: false
                    },
                    FF: {
                        aX: true,
                        qs: "21.0"
                    },
                    CR: {
                        aX: true,
                        qs: "30.0"
                    },
                    SF: {
                        aX: true,
                        qs: "6.0"
                    },
                    OP: {
                        aX: true,
                        qs: "18.0"
                    }
                }
            },
            bx: {
                aX: true,
                di: {
                    Fedora: {
                        aX: false
                    },
                    Ubuntu: {
                        aX: false
                    },
                    CentOS: {
                        aX: false
                    },
                    OpenSUSE: {
                        aX: false
                    }
                },
                al: {
                    IE: {
                        aX: false
                    },
                    FF: {
                        aX: true,
                        qs: "21.0"
                    },
                    CR: {
                        aX: true,
                        qs: "30.0"
                    },
                    OP: {
                        aX: true,
                        qs: "11.10"
                    },
                    SF: {
                        aX: false
                    }
                }
            }
        }
    };
    var f = false;
    this.isRunning = function() {
        return f
    };
    this.isRunnable = function() {
        return zp.aG.FW && this.isSupported()
    };
    this.isSupported = function() {
        if (D.isMobileDevice() || D.isMetroUi()) {
            return false
        }
        return D.isSupported(k.support)
    };
    var b = "c48665de1b624a02f4e211b5c95926d25133d1e26066f45e7df694ce2622e4e9";
    var o = "0475f4bf427a9f03a47d477a9813af81a697ff61788fb9a3bea494faafcede3b";
    var d = "92062adc336fb731f5415d7c3419cd222010e63b8bfc93ec86dc1b18bf391cb0";
    var q = "d8a41855a3b1282cedeb5d5d82f3b40025c34b14d262c0e3eba1d296fc886e66";
    var l = "0140360d8c50b7e55e0234c84425a4895a6f42559e2a09750e96a732b5782154afef5250cd4f5972442fc3e07d7966c074b2515e4a6a3b53c3f1f8978f0ea613ae23bf0ddf53c511562f5474d7e5faeeccbaeaf34267fb070fbabd7ddea9386f76a1af646e9e6bc99e4f60fd22c2c23c82540e8f273d7fa6f96b12009bdee27d02c78549aad4338600b0a6b1fed2783ed847101fc9ab08867cefc82f27c3d586fc9d";
    var a = "729a5e3b8bb6da7fdc8cf05b75e9217d51ff0707d79280a4653f2e158e1138fa";
    var p = "a9f90291dcb7bfe52313f551eca0c4bdb49c7405e54463e296091918e0fc6b0e";
    var g = "aad3cd7967600a62507e6774db0a2f9bda1c798f8482d6a33f3c77c0064b11001359eef648c370858adb51776fd69ab946818ffccdc7bedef354b2b25caa367be4987efc08d8f351812459d114adddd48ada24b0c08955d36b63e643695bc5ef23af48a2b0cec264a6d802b825608ad5";
    var c = "4b821f49a266daf4eb6451d8118058d57af7a13c939f07c34b0b2756f7026c03";
    var n = "7f8f2dcd0b357fb93bfc918abf61015ae96acae4e00177ace97783ad5957f647";
    var m = "6986f7b8382cd26d24f178287d6f0f356a84d7b3a967085dbd065dadbc4877674cb279779d08ddef26c2813db9b0e7a0fa94d52118352208e971f505ab3e70e69f096632794bae80a3a874c800f2b5dec9cab19809fcbb4e16ac5335b6053338aad0badf9796025fd0d1e13fb53151dc";
    var i = null;

    function j(u, A, y) {
        try {
            var x = zp.qh(k.gP, Ye.j3);
            if (!L.bn(u)) {
                x.push(u)
            }
            if (!L.bn(A)) {
                x.push(L.cC(A));
                x.push(A)
            }
            L.fs(x.join(""), y)
        } catch (v) {}
    }

    function e() {
        if (i != null) {
            i = null
        }
    }

    function r(u) {
        if (zp.JF == true) {
            return
        }

        function v(x) {
            if (L.parseKeepAliveResult(x, function() {
                    e();
                    setTimeout(function() {
                        r()
                    }, uV.dV.kK)
                })) {
                return
            }
            if (i == null) {
                i = setInterval(r, 3000)
            }
        }
        if (D.win) {} else {
            if (D.mac) {
                nq(document).trigger({
                    type: "nppfs-npn-keep-alive",
                    message: N.m55,
                    time: new Date()
                });
                j(null, g, {
                    ax: v
                })
            } else {
                if (D.lnx) {
                    nq(document).trigger({
                        type: "nppfs-npn-keep-alive",
                        message: N.m55,
                        time: new Date()
                    });
                    j(null, m, {
                        ax: v
                    })
                }
            }
        }
    }
    this.init = function() {};
    this.startup = function() {
        if (zp.cz == false || zp.JF == true || s == true) {
            nq(document).trigger({
                type: "nppfs-module-startup",
                target: npNCtrl.id,
                time: new Date()
            });
            return
        }
        nq(document).trigger({
            type: "nppfs-npn-before-startup",
            message: N.m56,
            time: new Date()
        });
        e();

        function u(v) {
            if (L.r9(v, function() {
                    npNCtrl.startup()
                })) {
                return
            }
            s = true;
            nq(document).trigger({
                type: "nppfs-module-startup",
                target: npNCtrl.id,
                time: new Date()
            });
            nq(document).trigger({
                type: "nppfs-npn-after-startup",
                message: N.m57,
                time: new Date()
            })
        }
        if (D.win) {
            j(b + l, null, {
                ax: u
            })
        } else {
            if (D.mac) {
                j(null, a, {
                    ax: u
                })
            } else {
                if (D.lnx) {
                    j(null, c, {
                        ax: u
                    })
                }
            }
        }
        i = setInterval(r, 3000);
        f = true
    };
    var s = false;
    this.bA = function() {
        if (!this.isSupported() || !this.isRunnable()) {
            return true
        }
        return s
    };
    this.bm = function() {
        e();
        nq(document).trigger({
            type: "nppfs-npn-finalized",
            message: N.m58,
            time: new Date()
        })
    }
};
w.hI.define({
    id: npNCtrl.id,
    name: "nProtect Online Security V1.0, Network Protection",
    handshake: true,
    endtoend: false,
    runvirtualos: true,
    controller: npNCtrl,
    isExecutable: function(a) {
        return (typeof(a.FW) != "undefined") ? a.FW : true
    }
});
w.bh = new function() {
    this.id = "nppfs.npk.module";
    var b = {
        gP: Ye.x2,
        support: {
            aF: {
                aX: true,
                di: {
                    qs: "5.0",
                    Oc: "10.0"
                },
                al: {
                    IE: {
                        aX: true,
                        qs: "7.0",
                        Oc: "11.0"
                    },
                    FF: {
                        aX: true,
                        qs: "21.0"
                    },
                    CR: {
                        aX: true,
                        qs: "30.0"
                    },
                    OP: {
                        aX: true,
                        qs: "18.0"
                    },
                    SF: {
                        aX: true,
                        qs: "5.0"
                    },
                    EG: {
                        aX: true,
                        qs: "12.0"
                    },
                    fv: {
                        aX: false
                    },
                    B360: {
                        aX: true,
                        qs: "7.5"
                    },
                    QQ: {
                        aX: true,
                        qs: "38.0"
                    }
                }
            },
            jV: {
                aX: false
            },
            bx: {
                aX: false
            }
        },
        eK: {
            hZ: "#FF0000",
            gx: "#A9D0F5",
            Kq: "#FF0000",
            Xe: "#AFD7AF"
        }
    };
    var m = false;
    this.isRunning = function() {
        return m
    };
    this.isRunnable = function() {
        var V = zp.aG.SK && this.isSupported();
        return V
    };
    this.isSupported = function() {
        if (D.isMobileDevice() || D.isMetroUi()) {
            return false
        }
        if (D.virtualMachine == true) {
            return false
        }
        return D.isSupported(b.support)
    };
    var S = "69996979de848d6421dc7ed2d95a6193fad2a44a808b080d3665524e3d296a59";
    var g = "24b207d419d48cf8a43620f678dfd58299c531ef8ad018bae3aecc5544ed138d";
    var r = "518b8085e07f3932256ca1db8f4ade2df527a82dfb054b7ecd4c8e60e79c4f6d";
    var M = "5ceb28d5ab29129dec49cf90931209728a00775680706a14d8154d58e8f8d632";
    var a = "608098059db1ee7656dc94d2ae9ca2d5c9bfde00ac438718b547fe52eac072d7";
    var d = "489895507da7d238a49ce0072dc9b58b78c3e679a1992daa8f5c1e034c3da4e9";
    var P = "13f7b4e5e90ef26c88cab19c581c631539b25f15a93f039a615976901149fdfe";
    var j = "6145bd54045c6c6cc13b44e0155b61e90cbdfdc014e18dca3818b5d73cd28e5f";
    var O = "391bcce2979a8cfd2098f94bc3254c668f73cd46e3d21807a81bf8730db3014f";
    var K = "8592bb37736bedfb6ee4594f9e5108b64d725b62e3ca15a8a5ec3f0ccc2fc8bf";
    var I = "33a451c0e1af7855dd237a653e3eb96c1d7738692a16cbb737628090ec64f4e4";
    var T = "918fc623a7d813ee36be9a79db49ea007e290ece44c6fea6f49531828b14bc2e";
    var u = "10aa10e8fbbb53836e9ba46a6d88c1f9480fa3f16aa22bb16b8e8a7660d23e68";
    var U = "93e6a4c7504ccac12f31ae45a31227510ca8ec78fb077af842bc8c2ef847c019";
    this.ID = "";
    this.av = null;
    this.uuid = null;
    this.dn = null;
    this.hb = null;
    this.Qb = "";
    this.useInitechHex = "off";
    this.resetElements = [];

    function B(V, Z, Y) {
        try {
            var X = zp.qh(b.gP, Ye.j3);
            X.push(V);
            X.push(Z);
            return L.fs(X.join(""), Y)
        } catch (W) {}
    }
    this.send = function(V, X, W) {
        B(V, X, W)
    };
    var p = function(W, X) {
        var V = nq(W).attr(X);
        return (L.au(V)) ? "" : V.toLowerCase()
    };
    this.init = function() {
        this.uuid = zp.uuid;
        this.dn = zp.dn
    };
    var R = false;
    this.bA = function() {
        if (!this.isSupported() || !this.isRunnable()) {
            return true
        }
        return R
    };
    var C = false;
    this.startup = function() {
        if (zp.cz == false || zp.JF == true) {
            return
        }
        G()
    };
    this.bm = function() {
        if (zp.cz == false) {
            return
        }
        bh.doFocusOut();
        var V = P + "=" + bh.ID;
        B(S, V, {
            async: false,
            direct: true
        });
        nq(document).trigger({
            type: "nppfs-npk-finalized",
            message: N.m99,
            time: new Date()
        })
    };
    this.GetEncryptResult = function(X, aa) {
        if (L.au(aa)) {
            return
        }
        if (L.au(document.getElementsByName(aa))) {
            return
        }
        if (bh.isRunning() == true) {
            var V = L.bZ(ad.wG, X);
            var ab = L.bZ(ad.Ix, X);
            var W = A(aa);
            if (L.au(V) || L.au(ab) || L.au(W) || L.au(V.value) || L.au(ab.value) || L.au(W.value)) {
                return
            }
            var Z = [];
            Z.push("m=c");
            Z.push("u=" + L.sz(V.value));
            Z.push("r=" + L.sz(ab.value));
            Z.push("v=" + L.sz(W.value));
            var Y = L.send(uV.dV.CryptoUrl, Z.join("&"));
            return Y
        }
    };

    function G() {
        Mc.check("NPK 초기화 시작");
        if (!bh.isSupported()) {
            nq(document).trigger({
                type: "nppfs-npk-jksc",
                time: new Date()
            });
            R = true;
            return
        }
        nq(document).trigger({
            type: "nppfs-npk-before-startup",
            message: "키보드보안을 시작합니다.",
            time: new Date()
        });
        nq(document).bind("nppfs-npk-jks nppfs-npk-jkc nppfs-npk-jki nppfs-npk-jkrf nppfs-npk-jksc", function(V) {
            nq(document).unbind(V);
            switch (V.type) {
                case "nppfs-npk-jks":
                    i();
                    break;
                case "nppfs-npk-jkc":
                    s();
                    break;
                case "nppfs-npk-jki":
                    Mc.check("NPK 초기화 완료");
                    q();
                    break;
                case "nppfs-npk-jkrf":
                    k();
                    Mc.check("NPK 필드등록 완료");
                    nq(document).trigger({
                        type: "nppfs-npk-jksc",
                        time: new Date()
                    });
                    break;
                case "nppfs-npk-jksc":
                    R = true;
                    C = true;
                    nq(document).trigger({
                        type: "nppfs-npk-after-startup",
                        message: "키보드보안이 정상적으로 시작되었습니다.",
                        time: new Date()
                    });
                    Mc.check("NPK 시작 완료");
                    nq(document).trigger({
                        type: "nppfs-module-startup",
                        target: bh.id,
                        time: new Date()
                    });
                    break
            }
        });
        if (R == true) {
            bh.cU();
            return
        }
        m = true;
        B(S, d, {
            ax: function(V) {
                if (L.r9(V, function() {
                        G()
                    })) {
                    return
                }
                var W = V.split("&&");
                if (W[0] == "ID") {
                    if (L.bn(W[1])) {
                        bh.startup();
                        return
                    }
                    bh.ID = W[1]
                }
                nq(document).trigger({
                    type: "nppfs-npk-jks",
                    time: new Date()
                })
            }
        })
    }

    function k() {
        try {
            if (document.hasFocus()) {
                var V = zp.v4;
                if (!L.au(V) && V.tagName && V.tagName.toLowerCase() == "input" && (V.type == "password" || V.type == "text" || V.type == "tel")) {
                    V.blur();
                    V.focus();
                    zp.v4 = null;
                    if (!L.bn(V.name)) {
                        Mc.log(N.m24.replace("%p%", V.name))
                    }
                }
            }
        } catch (W) {}
    }

    function i() {
        if (zp.JF == true) {
            return
        }

        function X(Y) {
            setTimeout(function() {
                nq(document).trigger({
                    type: Y,
                    time: new Date()
                })
            }, uV.dV.kK)
        }
        var W = 0;
        nq(document).bind("nppfs-npk-jkci", function(Y) {
            if (W >= uV.dV.Qa) {
                alert(N.m19);
                W = 0;
                nq(document).trigger({
                    type: "nppfs-npk-jkc",
                    time: new Date()
                });
                return
            }
            var Z = T + "=" + bh.ID;
            B(S, Z, {
                ax: function(aa) {
                    if (L.r9(aa, function() {
                            W++;
                            X("nppfs-npk-jkci")
                        })) {
                        return
                    }
                    var ac = aa.split("&&");
                    if (L.au(ac) || ac.length != 2) {
                        W++;
                        X("nppfs-npk-jkci");
                        return
                    }
                    if (ac[0] == "CLIENTADDRESS") {
                        var ab = ac[1].split("&^&");
                        if (L.au(ab) || ab.length != 2 || L.bn(ab[1])) {
                            W++;
                            X("nppfs-npk-jkci");
                            return
                        }
                        bh.hb = ab[1]
                    }
                    nq(document).trigger({
                        type: "nppfs-npk-jkc",
                        time: new Date()
                    });
                    W = 0
                }
            })
        });
        var V = [];
        V.push("Cert=");
        V.push("PKI=5");
        V.push("CertEnc=" + bh.dn);
        V.push("ID=" + bh.ID);
        B(g, V.join("&"), {
            ax: function(Y) {
                if (L.r9(Y, function() {
                        i()
                    })) {
                    return
                }
                nq(document).trigger({
                    type: "nppfs-npk-jkci",
                    time: new Date()
                })
            }
        })
    }

    function s() {
        if (zp.JF == true) {
            return
        }
        var V = u + "=" + bh.ID;
        B(S, V, {
            ax: function(W) {
                if (L.r9(W, function() {
                        s()
                    })) {
                    return
                }
                var Y = W.split("&&");
                if (L.au(Y) || Y.length != 2) {
                    s();
                    return
                }
                if (Y[0] == "ENCREPLACETABLE") {
                    var X = Y[1].split("&^&");
                    if (L.au(X) || X.length != 2 || L.bn(X[1])) {
                        s();
                        return
                    }
                    if (L.bn(bh.Qb)) {
                        bh.Qb = X[1]
                    }
                }
                nq(document).trigger({
                    type: "nppfs-npk-jki",
                    time: new Date()
                })
            }
        })
    }
    this.cU = function() {
        var W = null;

        function V() {
            if (R == true) {
                clearTimeout(W);
                q();
                nq(document).bind("nppfs-npk-jkrf", function(X) {
                    nq(document).unbind(X);
                    k()
                })
            } else {
                W = setTimeout(V, uV.dV.kK)
            }
        }
        V()
    };

    function q() {
        var V = 0;
        nq("input").each(function() {
            var X = nq(this).attr("type");
            if (L.bn(X)) {
                nq(this).attr("type", "text");
                X = "text"
            }
            if (!L.bn(X) && X != "text" && X != "password" && X != "tel") {
                return true
            }
            var W = nq(this).attr("name");
            if (L.bn(W)) {
                nq(this).attr("name", nq(this).attr("id"))
            }
        });
        nq("input[type=text], input[type=password], input[type=tel]").each(function() {
            var W = this;
            var Y = this.form;
            var X = nq(W).attr("name");
            if (L.bn(X) || X == ad.Ix || X == ad.wG || X == ad.jd) {
                return true
            }
            if (X.indexOf("__E2E__") > 0 || X.indexOf("__KI_") == 0 || X.indexOf("__KH_") == 0) {
                return true
            }
            if (nq(W).hasClass("nppfs-npk")) {
                return true
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                if (X.indexOf("__FORMATTER__") > 0) {
                    return true
                }
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.secureKeyUiModifier) == "function") {
                npPfsExtension.secureKeyUiModifier(W)
            }
            var Z = p(W, "npexecutetype");
            if (Z != "" && Z.indexOf("k") == -1) {
                return true
            }
            L.c1(Y, [ad.Ix, ad.wG], [bh.hb, bh.uuid]);
            var aa = p(W, zp.aG.AN);
            if (aa === "off" || L.arrayNotIn([zp.aG.AV, "re", "sub", "des", "db", "key"], aa)) {
                return true
            }
            W.blur();
            nq(document).trigger({
                type: "nppfs-npk-before-regist-field",
                message: N.m61.replace("%p1%", W.name),
                target: W,
                form: (!L.au(Y)) ? nq(Y).attr("name") : null,
                name: W.name,
                time: new Date()
            });
            bh.f7(Y, W);
            V++
        });
        if (V == 0) {
            nq(document).trigger({
                type: "nppfs-npk-jkrf",
                time: new Date()
            });
            return
        }
    }

    function J(V) {
        var X = p(V, zp.aG.AN);
        var W = "OFF";
        if (L.bn(X)) {
            W = "OFF"
        } else {
            if (X === "key") {
                W = "OFF"
            } else {
                if (X === "re") {
                    W = "RE"
                } else {
                    if (X === "sub") {
                        W = "SUB"
                    } else {
                        if (X === "des") {
                            W = "DES"
                        } else {
                            if (X == zp.aG.AV) {
                                W = "ON"
                            } else {
                                if (X === "db") {
                                    W = "DB"
                                } else {
                                    W = "OFF"
                                }
                            }
                        }
                    }
                }
            }
        }
        return W
    }

    function y(V) {
        var Z = "ON";
        try {
            var aa = p(V, "style");
            var ac = aa.split(";");
            for (var Y = 0; Y < ac.length; Y++) {
                var W = L.trim(ac[Y]);
                if (W.indexOf("ime-mode:") == 0 || W.indexOf("-ms-ime-mode:") == 0) {
                    var X = ac[Y].split(":");
                    if (L.trim(X[1]) == "disabled") {
                        Z = "OFF";
                        break
                    }
                }
            }
        } catch (ab) {}
        return Z
    }

    function e(V) {
        var X = nq(V).attr("name");
        var W = "";
        var Y = p(V, zp.aG.AN);
        if (L.arrayIn([zp.aG.AV, "db", "re", "sub", "des"], Y)) {
            W = X + "__E2E__"
        }
        return W
    }

    function c(W) {
        var X = "";
        var V = nq(W);
        var Y = p(W, zp.aG.AN);
        if (L.arrayIn(["re", "sub", "des"], Y)) {
            V.css({
                color: b.eK.Kq,
                "background-color": b.eK.Xe
            })
        } else {
            if (L.arrayIn([zp.aG.AV, "db"], Y) && true) {
                V.css({
                    color: b.eK.hZ,
                    "background-color": b.eK.gx
                })
            }
        }
    }
    var f = [];
    this.f7 = function(aa, X) {
        if (typeof(X) == "string") {
            X = L.bZ(X, aa)
        }
        if (typeof(X) == "undefined") {
            return bs
        }
        var W = nq(X);
        var Y = nq(aa);
        if (W.hasClass("nppfs-npk")) {
            return true
        }
        if (nq(X).hasClass("nppfs-npv")) {
            npVCtrl.resetKeypad(W.attr("name"), Z);
            npVCtrl.setKeypadUse(W.attr("name"), false);
            npVCtrl.destroyKeypad(W.attr("name"), Z)
        }
        var ac = p(X, zp.aG.AN);
        var Z = L.au(aa) ? "blank" : Y.attr("name");
        var V = "task_" + W.attr("name") + "_" + Z;
        if (L.indexOf(f, V) < 0) {
            f.push(V)
        }
        W.addClass("nppfs-npk");
        if (D.ie) {
            W.bind("contextmenu dragstart click focusin focusout keypress selectstart keydown", function(ae) {
                return l(ae)
            })
        } else {
            W.bind("contextmenu dragstart click focus blur keypress selectstart keydown", function(ae) {
                return l(ae)
            })
        }
        if (L.arrayIn([zp.aG.AV, "db"], ac)) {
            W.attr({
                autocorrect: "off",
                spellcheck: "false",
                autocomplete: "off",
                autocapitalize: "off"
            })
        }
        var ab = [];
        ab.push("name=" + X.name);
        ab.push("Length=" + X.maxLength);
        ab.push("type=" + X.type);
        ab.push("E2E=" + J(X));
        ab.push("ID=" + bh.ID);
        ab.push("IME=" + y(X));
        ab.push("Dummy=ON");
        B(r, ab.join("&"), {
            ax: function(ae) {
                if (L.r9(ae, function() {
                        bh.f7(aa, X)
                    })) {
                    return
                }
                var af = p(X, zp.aG.AN);
                if (!L.bn(ae)) {
                    c(X);
                    nq(document).trigger({
                        type: "nppfs-npk-after-regist-field",
                        message: N.m62.replace("%p1%", W.attr("name")),
                        target: X,
                        form: (!L.au(aa)) ? Y.attr("name") : null,
                        name: X.name,
                        time: new Date()
                    })
                }
                f.splice(L.indexOf(f, V), 1);
                if (f.length == 0) {
                    nq(document).trigger({
                        type: "nppfs-npk-jkrf",
                        time: new Date()
                    })
                }
            }
        });
        if (!L.bn(e(X))) {
            L.c1(aa, [e(X)]);
            if (W.attr("nppfs-formatter-type") != undefined) {
                L.c1(aa, [X.name + "__FORMATTER__"])
            }
            npPfsCtrl.putDynamicField(aa, X.name, [e(X)])
        }
    };
    this.iM = function(W, V) {
        if (typeof(V) == "string") {
            V = L.bZ(V, W)
        }
        if (typeof(V) == "undefined") {
            return
        }
        V.value = "";
        var X = A(V);
        if (!L.au(X)) {
            X.value = ""
        }
        this.resetElements.push(V.name)
    };
    this.enableUI = function(V, W) {
        if (typeof(V) == "string") {
            as = L.bZ(V, W)
        }
        if (typeof(as) == "undefined") {
            return
        }
        nq(as).attr("keypad-disabled-ui", "false")
    };
    this.disableUI = function(V, W) {
        if (typeof(V) == "string") {
            as = L.bZ(V, W)
        }
        if (typeof(as) == "undefined") {
            return
        }
        nq(as).attr("keypad-disabled-ui", "true")
    };
    this.setColor = function(V) {
        b.eK.hZ = V.TextColor;
        b.eK.gx = V.FieldBgColor;
        b.eK.Kq = V.ReTextColor;
        b.eK.Xe = V.ReFieldBgColor
    };

    function l(X) {
        var W = true;
        var Y = X.target ? X.target : X.srcElement;
        try {
            if (L.au(X) || zp.JF == true || bh.ID == "") {
                L.so(X);
                return false
            }
            switch (X.type) {
                case "contextmenu":
                case "dragstart":
                    L.so(X);
                    break;
                case "selectstart":
                    if (D.op) {
                        L.so(X);
                        W = false
                    }
                    break;
                case "focusin":
                case "focus":
                    W = x(X);
                    break;
                case "focusout":
                case "blur":
                    W = n(X);
                    break;
                case "click":
                    W = H(X);
                    break;
                case "keydown":
                    W = o(X);
                    break;
                case "keypress":
                    if (typeof(bh) == "undefined" || bh == null) {
                        return false
                    }
                    if (D.ff) {
                        var V = V = X.which;
                        if (V == 8 || X.keyCode == 9) {
                            return true
                        }
                        if (112 <= X.keyCode && X.keyCode <= 123) {
                            return true
                        }
                        L.so(X);
                        if ((X.ctrlKey == true && V == 97) || (X.ctrlKey == true && V == 99) || (X.ctrlKey == true && V == 118) || (X.ctrlKey == true && V == 120)) {
                            W = false
                        }
                    }
                    break
            }
        } catch (Z) {}
        return W
    }

    function H(W) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        try {
            var X = W.target ? W.target : W.srcElement;
            if (X.type == "text" || X.type == "password" || X.type == "tel") {
                var Z = X.value.length;
                if (X.createTextRange) {
                    var V = X.createTextRange();
                    V.move("character", Z);
                    V.select()
                } else {
                    if (X.setSelectionRange) {
                        X.setSelectionRange(Z, Z)
                    } else {}
                }
            }
        } catch (Y) {}
    }

    function x(W) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        try {
            function V() {
                var ab = W.target ? W.target : W.srcElement;
                if (typeof(npVCtrl) != "undefined" && npVCtrl.isRunning() == true) {
                    npVCtrl.hideAll(ab)
                }
                if (nq(ab).prop("readonly") == true || nq(ab).prop("disabled") == true) {
                    L.so(W);
                    return
                }
                if (nq(ab).attr("keypad-disabled-ui") == "true") {
                    return
                }
                if (!nq(ab).is(":visible")) {
                    ab = null;
                    L.so(W);
                    return false
                }
                if (!L.au(ab)) {
                    ab.selectionStart = 0;
                    ab.selectionEnd = 0;
                    if (!D.ie && !D.qq) {
                        ab.focus()
                    }
                    bh.av = ab;
                    ab.value = "";
                    var aa = A(ab);
                    if (!L.au(aa)) {
                        aa.value = ""
                    }
                    var Z = nq(ab);
                    if (Z.attr("nppfs-formatter-type") != undefined) {
                        var Y = nq("input[name='" + Z.attr("name") + "__FORMATTER__']");
                        Y.val("")
                    }
                    var ac = j + "=" + bh.ID + "=" + ab.name;
                    B(S, ac, {
                        ax: function(ae) {
                            if (!D.CB()) {
                                if (L.r9(ae, function() {
                                        x(W)
                                    })) {
                                    return
                                }
                            }
                        }
                    });
                    nq(document).trigger({
                        type: "nppfs-npk-focusin",
                        message: N.m63.replace("%p1%", nq(ab).attr("name")),
                        target: ab,
                        form: (!L.au(ab.form)) ? nq(ab.form).attr("name") : null,
                        name: ab.name,
                        time: new Date()
                    })
                }
            }
            if (!L.au(bh.av)) {
                bh.doFocusOut(bh.av, V)
            } else {
                V()
            }
        } catch (X) {}
    }
    this.doFocusOut = function(X, V) {
        if (L.au(bh.av)) {
            return
        }
        if (L.au(X)) {
            X = bh.av
        }
        var W = O + "=" + bh.ID + "=" + X.name;
        B(S, W, {
            direct: true,
            ax: function(Y) {
                nq(document).trigger({
                    type: "nppfs-npk-focusout",
                    message: N.m64.replace("%p1%", nq(X).attr("name")),
                    target: X,
                    form: (!L.au(X.form)) ? nq(X.form).attr("name") : null,
                    name: nq(X).attr("name"),
                    time: new Date()
                });
                nq(X).trigger({
                    type: "change"
                });
                if (typeof(V) == "function") {
                    V(X)
                }
            }
        });
        bh.av = null
    };

    function n(V) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        var W = V.target ? V.target : V.srcElement;
        bh.doFocusOut(W)
    }

    function Q(W, V) {
        nq(W).trigger({
            type: "keypress",
            which: V,
            keyCode: V
        });
        nq(W).trigger({
            type: "keyup",
            which: V,
            keyCode: V
        })
    }

    function o(V) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        try {
            var W = V.target ? V.target : V.srcElement;
            if (L.au(W) || (W.type != "text" && W.type != "password" && W.type != "tel") || L.au(bh.av)) {
                L.so(V);
                return false
            }
            var W = bh.av;
            var Z = p(W, zp.aG.AN);
            Mc.log("키보드보안 키다운 이벤트발생 : " + W.name + " : " + W.value + " : " + V.keyCode);
            try {
                if (V.keyCode == 8) {
                    L.so(V)
                }
            } catch (Y) {}
            if (D.mac && D.sf) {
                if (V.keyCode == 38) {
                    V.keyCode = 49
                } else {
                    if (V.keyCode == 40) {
                        V.keyCode = 32
                    }
                }
            }
            if ((V.ctrlKey == true || V.metaKey == true) && (V.keyCode == 67 || V.keyCode == 86 || V.keyCode == 88)) {
                L.so(V);
                return false
            }
            if (V.keyCode == 93) {
                L.so(V);
                return false
            }
            if (L.arrayIn([33, 34, 36, 37, 38, 39, 40, 45, 46], V.keyCode)) {
                L.so(V);
                return false
            }
            if (!L.au(V.charCode) && V.charCode != 0) {
                return false
            }
            if (V.keyCode == 32 || V.keyCode == 49 || (V.keyCode == 16 && D.win)) {
                if (D.lnx || D.mac) {
                    var X = K + "=" + bh.ID + "=" + W.name
                } else {
                    var X = K + "=" + bh.ID + "=" + W.name + "=" + bh.useInitechHex
                }
                B(S, X, {
                    ax: function(aa) {
                        if (L.r9(aa, function() {
                                o(V)
                            })) {
                            return
                        }
                        var ab = aa.split("&&");
                        v(ab[1], ab[2], V.keyCode)
                    }
                });
                L.so(V);
                return false
            } else {
                if (V.keyCode == 8) {
                    var X = I + "=" + bh.ID + "=" + W.name;
                    B(S, X, {
                        ax: function(aa) {
                            if (L.r9(aa, function() {
                                    o(V)
                                })) {
                                return
                            }
                            var ab = aa.split("&&");
                            F()
                        }
                    })
                } else {
                    if (V.keyCode == 9) {} else {
                        if (V.keyCode == 13) {} else {
                            if ((Z === "" || Z === "key") && D.mac && D.ff) {
                                if (D.lnx || D.mac) {
                                    var X = K + "=" + bh.ID + "=" + W.name
                                } else {
                                    var X = K + "=" + bh.ID + "=" + W.name + "=" + bh.useInitechHex
                                }
                                B(S, X, {
                                    ax: function(aa) {
                                        if (aa === Ye.kk || aa === Ye.a4) {} else {
                                            if (L.r9(aa, function() {
                                                    o(V)
                                                })) {
                                                return
                                            }
                                            var ab = aa.split("&&");
                                            v(ab[1], ab[2], V.keyCode)
                                        }
                                    }
                                })
                            } else {
                                if (V.keyCode == 229) {} else {
                                    if (V.keyCode == 255) {
                                        L.so(V);
                                        return false
                                    } else {
                                        L.so(V);
                                        return false
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Y) {}
    }
    var E = false;
    this.he = null;
    this.jw = function(V) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        if (!L.au(V) && V.keyCode == 9) {
            var W = new Date().getTime();
            if (L.au(bh.he)) {} else {
                if (W - bh.he <= 150) {
                    L.so(V)
                } else {}
            }
            bh.he = W
        }
    };

    function v(ah, Y, ac) {
        if (L.au(bh.av)) {
            return
        }
        var ae = bh.av;
        var al = nq(ae);
        var X = ae.value;
        if (al.prop("readonly") == true || al.prop("disabled") == true) {
            return
        }
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
            X = npPfsExtension.formatter(al, false)
        }
        if (al.attr("data-keypad-action") == "amount") {
            X = L.uncomma(al.val())
        }
        var W = nq(ae).prop("maxlength");
        if (!L.bn(W) && !L.bn(X) && W > 0 && X.length >= W) {
            Q(ae, ac);
            return
        }
        try {
            var aj = L.ha(ah);
            if (L.bn(aj)) {
                return
            }
            var ak = L.gu(aj, L.ha(bh.ID), "ECB", 128);
            if (L.bn(ak)) {
                return
            }
            if (ak.length > 0) {
                ak = ak.substring(0, 1)
            }
            if (L.bn(ak)) {
                return
            }
            var am = ak.charCodeAt(0);
            var ab = L.au(zp.cI);
            ab = ab || typeof(zp.cI) !== "function";
            ab = ab || zp.cI(am, ae);
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.keyValidation) == "function") {
                ab = ab && npPfsExtension.keyValidation(ae, am)
            }
            if (ab == false) {
                var ag = I + "=" + bh.ID + "=" + ae.name;
                B(S, ag, {
                    ax: function(an) {
                        if (L.r9(an, function() {
                                v(ah, Y, ac)
                            })) {
                            return
                        }
                        var ao = an.split("&&")
                    }
                });
                Mc.log("The key value(" + am + ") is invalid, clear the keystroke.");
                return
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                al.val(npPfsExtension.formatter(al, false))
            }
            if (al.attr("data-keypad-action") == "amount") {
                al.val(L.uncomma(al.val()))
            }
            var V = p(ae, zp.aG.AN);
            if ((L.arrayIn([zp.aG.AV, "db"], V) && true) || L.arrayIn(["re", "sub", "des"], V)) {
                var aa = A(ae);
                if (L.au(aa)) {
                    return
                }
                if (L.arrayIn(["re", "sub"], V)) {
                    var aj = L.ha(Y);
                    if (L.bn(aj)) {
                        return
                    }
                    var Z = L.gu(aj, L.ha(bh.ID), "ECB", 128);
                    if (L.bn(Z)) {
                        return
                    }
                    if (Z.length > 0) {
                        Z = Z.substring(0, 1)
                    }
                    ae.value += ak;
                    aa.value += Z
                } else {
                    if (L.arrayIn([zp.aG.AV, "des", "db"], V)) {
                        if (bh.useInitechHex == "on") {
                            var aj = L.ha(Y);
                            if (L.bn(aj)) {
                                return
                            }
                            ae.value += ak;
                            aa.value += aj
                        } else {
                            ae.value += ak;
                            aa.value += Y
                        }
                        if (al.attr("nppfs-formatter-type") != undefined) {
                            var ai = nq("input[name='" + al.attr("name") + "__FORMATTER__']");
                            ai.val(ai.val() + "a")
                        }
                    }
                }
            } else {
                ae.value += ak
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                al.val(npPfsExtension.formatter(al, true))
            }
            if (al.attr("data-keypad-action") == "amount") {
                al.val(L.comma(al.val()))
            }
            Mc.log(N.m65.replace("%p1%", ae.name).replace("%p2%", ak.charCodeAt(0)));
            nq(document).trigger({
                type: "nppfs-npk-put-complete",
                message: N.m66,
                target: ae,
                form: (!L.au(ae.form)) ? nq(ae.formm).attr("name") : null,
                name: ae.name,
                time: new Date()
            });
            var am = ak.charCodeAt(0);
            Q(ae, am)
        } catch (af) {}
    }

    function A(X) {
        var V = (typeof(X) == "object") ? e(X) : e(nq("input[name='" + X + "']"));
        var W = !L.au(X.form) ? X.form : null;
        return L.bZ(V, W)
    }

    function F() {
        try {
            var Y = bh.av;
            var X = A(Y);
            var W = nq(Y);
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                W.val(npPfsExtension.formatter(W, false))
            }
            if (W.attr("data-keypad-action") == "amount") {
                W.val(L.uncomma(W.val()))
            }
            var aa = p(Y, zp.aG.AN);
            if (L.bn(aa)) {
                return
            }
            if (!L.au(X)) {
                Y.value = Y.value.substring(0, Y.value.length - 1);
                if (L.arrayIn(["re", "sub"], aa)) {
                    X.value = X.value.substring(0, X.value.length - 1)
                } else {
                    if (L.arrayIn([zp.aG.AV, "des", "db"], aa)) {
                        X.value = X.value.substring(0, X.value.length - 64)
                    }
                }
            } else {
                if (aa == "key") {
                    Y.value = Y.value.substring(0, Y.value.length - 1)
                }
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                var V = nq("input[name='" + W.attr("name") + "__FORMATTER__']");
                V.val(V.val().substring(0, V.val().length - 1));
                W.val(npPfsExtension.formatter(W, true))
            }
            if (W.attr("data-keypad-action") == "amount") {
                W.val(L.comma(W.val()))
            }
            Mc.log(N.m67.replace("%p1%", Y.name).replace("%p2%", Y.value))
        } catch (Z) {}
    }
    this.resetColor = function(V) {
        if (L.au(V)) {
            return
        }
        var W = p(V, zp.aG.AN);
        if (L.arrayIn(["re", "sub", "des"], W)) {
            V.style.color = b.eK.Kq;
            V.style.backgroundColor = b.eK.Xe
        } else {
            if (L.arrayIn([zp.aG.AV, "db"], W) && true) {
                V.style.color = b.eK.hZ;
                V.style.backgroundColor = b.eK.gx
            }
        }
    };
    this.iu = function(W, Y) {
        if (L.au(Y)) {
            return ""
        }
        var V = (typeof(Y) == "object") ? Y : L.bZ(Y, W);
        var X = A(V);
        if (L.au(X) || L.au(X.value)) {
            return ""
        }
        if (bh.isRunnable() && (npVCtrl.isRunning() == false || !npVCtrl.isKeypadUse(Y))) {
            return X.value
        }
        return ""
    };
    this.im = function(W, Y) {
        if (bh.isRunnable() && (npVCtrl.isRunning() == false || !npVCtrl.isKeypadUse(Y))) {
            if (L.au(bh.Qb)) {
                return
            }
            var V = Y;
            if (typeof(V) == "string") {
                V = L.bZ(Y, W)
            }
            if (typeof(V) == "undefined") {
                return ""
            }
            try {
                var Z = nq(V).attr(zp.aG.AN);
                Z = (L.au(Z)) ? "" : Z.toLowerCase();
                if (L.arrayIn(["sub", "des"], Z)) {
                    return bh.ID + "=" + V.name
                }
                return bh.Qb
            } catch (X) {}
            return bh.Qb
        }
    };
    this.ReuseModules = function() {
        if (!bh.isRunnable() && C != true) {
            return
        }
        if (L.bn(bh.hb) && L.bn(bh.uuid)) {
            return
        }
        nq("input[type=text], input[type=password], input[type=tel]").each(function() {
            var V = this;
            var X = this.form;
            var W = nq(V).attr("name");
            if (L.bn(W) || W == ad.Ix || W == ad.wG || W == ad.jd) {
                nq(V).remove()
            }
            if (W.indexOf("__E2E__") > 0 || W.indexOf("__KI_") == 0 || W.indexOf("__KH_") == 0) {
                nq(V).remove()
            }
            if (nq(V).hasClass("nppfs-npk")) {
                nq(V).removeClass("nppfs-npk")
            }
            if (nq(V).val().length > 0) {
                nq(V).val("")
            }
        });
        nq(".nppfs-elements").html("");
        R = false;
        bh.init();
        bh.startup()
    };
    this.eX = function(V, Y) {
        var X = null;

        function W() {
            if (bh.bA() == true) {
                if (!L.bn(V)) {
                    if (typeof(V) == "string") {
                        V = nq("form[name='" + V + "']").get(0)
                    }
                }
                if (typeof(Y) == "string") {
                    Y = L.bZ(Y, V)
                }
                if (Y == null || typeof(Y) == "undefined") {
                    return
                }
                if (!bh.isRunnable()) {
                    return
                }
                var Z = p(Y, zp.aG.AN);
                if (Z === "off" || L.arrayNotIn([zp.aG.AV, "re", "sub", "des", "db", "key"], Z)) {
                    return
                }
                bh.f7(V, Y);
                nq(document).bind("nppfs-npk-jkrf", function(aa) {
                    k()
                })
            } else {
                X = setTimeout(W, uV.dV.kK)
            }
        }
        W()
    }
};
w.hI.define({
    id: bh.id,
    name: "nProtect Online Security V1.0, Key Protection",
    handshake: true,
    endtoend: true,
    runvirtualos: false,
    controller: bh,
    isExecutable: function(a) {
        return (typeof(a.SK) != "undefined") ? a.SK : true
    }
});
var Randomizer = new function() {
    this.make = function(g, e, c) {
        var g = L.bn(g) ? "outer" : ((g != "inner") ? "outer" : "inner");
        if (c == 0) {
            return new Array(0)
        }
        var d = new Array(c);
        var b = (g == "inner") ? Math.floor(Math.random() * (e - 1)) + 1 : Math.floor(Math.random() * (e + 1));
        d[0] = b;
        if (c > 1) {
            var f = 1;
            while (f < c) {
                var a = (g == "inner") ? Math.floor(Math.random() * (e - 1)) + 1 : Math.floor(Math.random() * (e + 1));
                if (this.eZ(e, d, f, a)) {
                    d[f] = a;
                    f++
                }
            }
        }
        return d.sort()
    };
    this.indexOf = function(d, b) {
        var a = -1;
        for (var c = 0; c < d.length; c++) {
            if (d[c] == b) {
                return c
            }
        }
        return a
    };
    this.countOf = function(d, b) {
        var a = 0;
        for (var c = 0; c < d.length; c++) {
            if (d[c] <= b) {
                a++
            }
        }
        return a
    };
    this.eZ = function(f, j, g, d) {
        var c = true;
        for (var e = 0; e < g; e++) {
            var b = j[e];
            if (b == 0 && (d == 0 || d == 1)) {
                return false
            }
            if (b == f && (d == f || d == f - 1)) {
                return false
            }
            if (b == d || (b + 1) == d || (b - 1) == d) {
                return false
            }
        }
        return c
    };
    this.random = function(a) {
        return Math.floor(Math.random() * a)
    };
    this.kp = function(c) {
        var a = new Array(c);
        for (var b = 0; b < a.length; b++) {
            a[b] = b
        }
        return a
    };
    this.maxiedIndex = function(d) {
        function a(n, m, k) {
            var j = true;
            for (var l = 0; l < m; l++) {
                var g = n[l];
                if (g == k) {
                    return false
                }
            }
            return j
        }
        var b = [];
        if (d > 1) {
            b = new Array(d);
            for (var c = 0; c < b.length; c++) {
                b[c] = -1
            }
            var f = 0;
            while (f < d) {
                var e = Math.floor(Math.random() * d);
                while (!a(b, f + 1, e)) {
                    e = (e + 1) % d
                }
                b[f] = e;
                f++
            }
        }
        return b
    }
};
var npKeyPadMaker = function(c, b) {
    this._element = c;
    this._keypadinfo = b.data.info;
    this._keypaditems = b.data.items;
    this._uuid = "nppfs-keypad-" + L.eraseSpecialChars(nq(c).attr("name"));
    this._isOldIe = false;
    this._isVeryOldIe = false;
    this._parent = (c.form != null) ? c.form : document.body;
    this._useynfield = "";
    this._hashfield = "";
    this._hashelement = "";
    this._useMultiCursor = false;
    this.init = function() {
        var E = nq(this._element);
        var q = nq(this._parent);
        if (E.hasClass("nppfs-npv")) {
            return true
        }
        E.attr("nppfs-keypad-uuid", this._uuid);
        var u = navigator.userAgent.match(/MSIE ([0-9]{1,}[\.0-9]{0,})/),
            s = !!u;
        this._isOldIe = (s && parseInt(u[1], 10) <= 8) || document.documentMode <= 8;
        this._isVeryOldIe = (s && parseInt(u[1], 10) <= 7) || document.documentMode <= 7;
        this.makeKeyPadDivHtml(q);
        var p = this._keypadinfo;
        this._useynfield = p.inputs.useyn;
        this._hashfield = p.inputs.hash;
        this._togglefield = p.inputs.toggle;
        var x = nq(".nppfs-elements", q);
        if (!L.au(p.dynamic) && p.dynamic.length > 0) {
            for (var r = 0; r < p.dynamic.length; r++) {
                var C = p.dynamic[r].k;
                var o = p.dynamic[r].v;
                if (nq("input[name='" + C + "']", q).length > 0) {
                    continue
                }
                if (uV.dV.dk == ad.jt) {
                    x.append(C + ' : <input type="text" name="' + C + '" value="' + o + '" /><br />');
                    if (E.attr("nppfs-formatter-type") != undefined) {
                        var B = E.attr("name") + "__FORMATTER__";
                        if (nq("input[name='" + B + "']", q).length == 0) {
                            x.append(B + ' : <input type="text" name="' + B + '" value="' + o + '" /><br />')
                        }
                    }
                } else {
                    x.append('<input type="hidden" name="' + C + '" value="' + o + '" />');
                    if (E.attr("nppfs-formatter-type") != undefined) {
                        var B = E.attr("name") + "__FORMATTER__";
                        if (nq("input[name='" + B + "']", q).length == 0) {
                            x.append('<input type="hidden" name="' + B + '" value="' + o + '" />')
                        }
                    }
                }
            }
        }
        this._hashelement = nq("input[name='" + this._hashfield + "']", q);
        var v = nq("#" + this._uuid);
        Mc.log("이전마우스입력기 기 생성여부 : " + v.length + ", UUID : " + this._uuid);
        if (v.length > 0) {
            v.remove()
        }
        var m = [];
        m.push('<div id="' + this._uuid + '" class="nppfs-keypad" data-width="' + p.iw + '" data-height="' + p.ih + '">');
        this._uuid = this._uuid.replace(".", "\\.");
        m.push('<style type="text/css">');
        m.push("	#" + this._uuid + " .kpd-wrap { position:relative; width:" + p.iw + "px; height:" + p.ih + "px; white-space:normal;}");
        m.push("	#" + this._uuid + " .kpd-preview .preview{ background-repeat:no-repeat; background-position:0px 0px; }");
        m.push("	#" + this._uuid + " .kpd-button { position:absolute; width:" + p.coords.bw + "px; height:" + p.coords.bh + "px; overflow:hidden; /* border:1px solid #f88; */ }");
        if (p.touch.use == true) {
            m.push("	#" + this._uuid + " .kpd-touch .kpd-button { background-color : " + p.touch.color + "; opacity : " + (p.touch.opacity / 100) + "; filter: alpha(opacity=" + p.touch.opacity + "); }")
        }
        m.push("	#" + this._uuid + " .kpd-group { width:" + p.iw + "px; height:" + p.ih + "px; overflow:hidden;}");
        if (typeof p.text != "undefined" && p.text.use == true && E.attr("data-keypad-text") == "on") {
            m.push("	#" + this._uuid + " .kpd-text {" + p.text.style + "position:absolute;width:" + p.text.dw + "px; height:" + p.text.dh + "px; left:" + p.text.dx + "px; top:" + p.text.dy + "px; font-size:" + p.text.spanFontSize + "px;}");
            m.push("	#" + this._uuid + " .textfield {" + p.text.spanStyle + "}")
        }
        m.push("</style>");
        m.push('<div class="kpd-wrap ' + p.type + '">');
        var n = "";
        if (D.isMobileDevice()) {
            n = 'tabindex="0" '
        }
        m.push('		<img  style="position:absolute;left:0;top:0;border:0px;width:100%;height:100%" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAADAFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALI7fhAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAAApJREFUCJljYAAAAAIAAfRxZKYAAAAASUVORK5CYII=" alt="키패드" id="' + p.keypadUuid + '_bg_img"' + n + " /> ");
        if (p.touch.use == true) {
            m.push('<div class="kpd-touch">');
            m.push('	<div class="kpd-button touch1"></div>');
            m.push('	<div class="kpd-button touch2"></div>');
            m.push("</div>")
        }
        if (p.preview.use == true) {
            m.push('<div class="kpd-preview">');
            m.push('	<div class="preview ' + p.type + '"></div>');
            m.push("</div>")
        }
        if (typeof p.text != "undefined" && p.text.use == true && E.attr("data-keypad-text") == "on") {
            m.push('<div class="kpd-text" data-left="' + p.text.dx + '" data-top="' + p.text.dy + '" data-width="' + p.text.dw + '" data-height="' + p.text.dh + '" data-font-size="' + p.text.spanFontSize + '">');
            m.push('	<span class="textfield"></span>');
            m.push("</div>")
        }
        var y = this._uuid;
        nq(this._keypaditems).each(function(G) {
            var F = this;
            if (G == 0) {
                m.push('<div class="kpd-group ' + F.id + '" style="position:relative;">')
            } else {
                m.push('<div class="kpd-group ' + F.id + '" style="position:relative;display:none;";>')
            }
            var H = 0;
            if (F.id == "upper") {
                H = p.ih
            } else {
                if (F.id == "special") {
                    H = p.ih * 2
                } else {
                    H = 0
                }
            }
            m.push('		<img class="kpd-image-button" style="position:absolute;left:0;top:0;border:0px;margin-top:-' + H + 'px;" aria-hidden="true" /> ');
            nq(this.buttons).each(function(O) {
                var K = this.coord.x1 + "," + this.coord.y1 + "," + this.coord.x2 + "," + this.coord.y2;
                var J = this.preCoord.x1 + "," + this.preCoord.y1 + "," + this.preCoord.x2 + "," + this.preCoord.y2;
                var I = this.label;
                if (typeof(I) == "undefined" || I == "") {
                    I = "키패드"
                }
                var M = "position: absolute;";
                M += "left: " + this.coord.x1 + "px;";
                M += "top: " + (this.coord.y1 - H) + "px;";
                M += "width: " + (this.coord.x2 - this.coord.x1) + "px;";
                M += "height: " + (this.coord.y2 - this.coord.y1) + "px;";
                M += "margin-top: " + H;
                M += "border: 1px solid #ff0000;";
                m.push('		<img class="kpd-data" aria-label="' + I + '" alt="' + I + '" style="' + M + '" data-coords="' + K + '" pre-coords="' + J + '" coords="' + K + '" precoords="' + J + '" data-action="' + this.action + '" tabindex="-1" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAADAFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALI7fhAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAAApJREFUCJljYAAAAAIAAfRxZKYAAAAASUVORK5CYII=" role="button" onfocus="this.blur();"/> ')
            });
            m.push("</div>")
        });
        m.push("</div>");
        m.push("</div>");
        nq("div." + b.div, nq(this._parent)).append(m.join("\n"));
        var A = nq("#" + this._uuid);
        nq("div.kpd-group img.kpd-image-button", A).attr("src", p.src);
        nq(".kpd-preview .preview", A).css({
            "background-image": "url('" + p.src + "')"
        });
        A.hide();
        this.bindEvents(b);
        if (typeof(p.range) != "undefined" && p.range != "") {
            nq(".kpd-group", A).hide();
            if (p.range.indexOf("lower") >= 0) {
                nq(".kpd-group.lower", A).show()
            } else {
                if (p.range.indexOf("upper") >= 0) {
                    nq(".kpd-group.upper", A).show()
                } else {
                    if (p.range.indexOf("special") >= 0) {
                        nq(".kpd-group.special", A).show()
                    } else {
                        nq(".kpd-group.lower", A).show()
                    }
                }
            }
        }
        E.addClass("nppfs-npv")
    };
    this.makeKeyPadDivHtml = function(o) {
        var m = nq("form");
        if (nq(".nppfs-keypad-div", o).length == 0) {
            var n = '<div class="nppfs-keypad-div"></div>';
            if (m.length == 0) {
                nq("body").prepend(n)
            } else {
                m.each(function() {
                    var q = nq(this);
                    nq(this).append(n)
                })
            }
        }
        if (nq(".nppfs-elements", o).length == 0) {
            var n = '<div class="nppfs-elements"></div>';
            if (m.length == 0) {
                nq("body").prepend(n)
            } else {
                m.each(function() {
                    var q = nq(this);
                    nq(this).append(n)
                })
            }
        }
        if (nq(".nppfs-keypad-style", nq("body")).length == 0) {
            var p = [];
            p.push('<style type="text/css" class="nppfs-keypad-style">');
            p.push("	div.nppfs-keypad-div { position:absolute; display:none; width:0px; height:0px; white-space:normal; overflow:visible;}");
            p.push("	div.nppfs-keypad-wrap { position:absolute; white-space:normal;}");
            p.push("	div.nppfs-keypad { position:relative; margin:0px; z-index:9999; white-space:normal;}");
            p.push("	div.nppfs-keypad .kpd-group { position:relative; z-index:10; width:0px; height:0px; white-space:normal;}");
            p.push("	div.nppfs-keypad .kpd-touch { position:relative; z-index:30; display:none; white-space:normal;}");
            p.push("	div.nppfs-keypad .kpd-preview { position:relative; z-index:40; margin-left:50%; white-space:normal;}");
            p.push("	div.nppfs-keypad .kpd-data { cursor:pointer; }");
            if (!this._useMultiCursor) {
                p.push("	div.nppfs-keypad .kpd-button { cursor:pointer; }");
                p.push("	div.nppfs-keypad .kpd-blank { cursor:default; }")
            }
            p.push("</style>");
            nq("body").prepend(p.join("\n"))
        }
    };
    this.touch = function(o, p) {
        if (L.au(o)) {
            return
        }
        var E = nq(o);
        var q = E.attr("data-action");
        if (q.indexOf("data:") < 0) {
            return
        }
        var F = E.css("left");
        var B = E.css("top");
        var n = E.css("width");
        var u = E.css("height");
        var v = [];
        nq(".kpd-data", E.parent()).each(function() {
            if (nq(this).attr("data-action").indexOf("data:") != -1) {
                v.push(this)
            }
        });
        var A = (v.length <= 2) ? 0 : Math.round(Math.random() * (v.length) * 10) % (v.length);
        var r = v[A];
        var C = nq(r).css("left");
        var y = nq(r).css("top");
        if (F == C && B == y) {
            A = (A + 1) % v.length;
            r = v[A];
            C = nq(r).css("left");
            y = nq(r).css("top")
        }
        var m = nq(r).css("width");
        var s = nq(r).css("height");
        var x = nq(".kpd-touch", E.parent().parent());
        nq(".kpd-button.touch1", x).css({
            left: F,
            top: B,
            width: n,
            height: u
        });
        nq(".kpd-button.touch2", x).css({
            left: C,
            top: y,
            width: m,
            height: s
        });
        if (p != "single") {
            nq(".kpd-button.touch2", x).css({
                left: C,
                top: y,
                width: m,
                height: s
            })
        } else {
            nq(".kpd-button.touch2", x).css({
                display: "none"
            })
        }
        if (this._isOldIe) {
            x.css({
                opacity: 1
            }).show();
            setTimeout(function() {
                x.hide()
            }, this._keypadinfo.touch.timeout)
        } else {
            x.stop().animate({
                opacity: 1
            }, 1);
            x.show().animate({
                opacity: 0
            }, this._keypadinfo.touch.timeout, function() {
                nq(this).hide()
            })
        }
    };
    this.preview = function(r) {
        var E = nq(r);
        var s = E.attr("data-action");
        if (s.indexOf("data:") < 0) {
            return
        }
        var C = nq(r).attr("preCoords");
        var o = C.split(",");
        var B = Math.ceil(o[0]);
        var A = Math.ceil(o[1]);
        var x = Math.ceil(o[2]);
        var v = Math.ceil(o[3]);
        var u = x - B;
        var q = v - A;
        var p = 4;
        var y = 2;
        var m = nq(".kpd-preview .preview", E.parent().parent());
        m.css({
            width: u,
            height: q
        });
        m.css({
            position: "absolute",
            left: -1 * m.width() / 2,
            top: p + "px",
            width: m.width() - y * 2,
            height: m.height() - y * 2,
            "background-position": -(B + 4 - y) + "px " + -(A + 4 - y) + "px"
        });
        var n = nq(".kpd-preview", E.parent().parent());
        if (this._isOldIe) {
            n.css({
                opacity: 1
            }).show();
            setTimeout(function() {
                n.hide()
            }, 500)
        } else {
            n.stop().animate({
                opacity: 1
            }, 1);
            n.show().animate({
                opacity: 0
            }, 500, function() {
                nq(this).hide()
            })
        }
    };
    this.getBounds = function(m) {
        var n = nq(m);
        return {
            left: n.offset().left,
            top: n.offset().top,
            width: n.outerWidth(),
            height: n.outerHeight()
        }
    };
    this.show = function(v, m, H, Q) {
        var T = this;
        var J = nq(T._element);
        var K = nq(T._parent);
        var F = nq("#" + T._uuid, K);
        var U = nq("div.kpd-text", F);
        if (F == null || F.length <= 0) {
            return
        }
        var I = nq(window);
        var n = {
            mode: "layer",
            tw: 0,
            th: 0,
            resize: true,
            resizeRadio: 90,
            position: {
                x: "default",
                y: "default",
                deltax: 0,
                deltay: 5
            }
        };
        nq.extend(n, v.data.info);
        npVCtrl.hideAll(T._uuid);
        if (!T.isUseYn()) {
            T.hide();
            return
        }
        var Z = F.is(":visible");
        if (Z == false) {
            nq(document).trigger({
                type: "nppfs-npv-before-show",
                form: (L.au(T._element.form)) ? "" : nq(T._element.form).attr("name"),
                message: N.m90.replace("%p1%", J.attr("name")),
                target: T._element,
                name: J.attr("name"),
                time: new Date()
            })
        }
        var Y = F.parents(".nppfs-keypad-div");
        Y.show();
        if (n.mode == "layer") {
            var W = false;
            var x = F.attr("data-width");
            var E = F.attr("data-height");
            var G = x;
            var S = E;
            if (n.resize === true && !T._isOldIe) {
                var aa = n.resizeRadio / 100;
                var X = I.width();
                if (X < Math.round(x / aa)) {
                    G = Math.round(X * aa);
                    aa = G / x;
                    S = Math.round(E * aa);
                    W = true
                } else {
                    if (D.isMobileDevice() && I.width() <= I.height() && X >= (x / " + rate + ")) {
                        G = Math.round(X * aa);
                        aa = G / x;
                        S = Math.round(E * aa);
                        W = true
                    } else {
                        G = x;
                        S = E;
                        aa = 1;
                        W = false
                    }
                }
                F.css({
                    width: G + "px",
                    height: S + "px",
                    overflow: "hidden"
                });
                nq("div.kpd-wrap", F).css({
                    width: G + "px",
                    height: S + "px",
                    overflow: "hidden"
                });
                nq("div.kpd-wrap .keypad", F).css({
                    "background-size": G * 2 + "px " + S + "px"
                });
                nq("div.kpd-wrap .keyboard", F).css({
                    "background-size": G * 2 + "px " + S * 3 + "px"
                });
                nq("div.kpd-preview.preview.keypad", F).css({
                    "background-size": G * 2 + "px " + S + "px"
                });
                nq("div.kpd-preview.preview.keyboard", F).css({
                    "background-size": G * 2 + "px " + S + "px"
                });
                nq("div.kpd-group.number img.kpd-image-button", F).css({
                    width: G * 2 + "px",
                    height: S + "px"
                });
                nq("div.kpd-group.lower img.kpd-image-button", F).css({
                    width: G * 2 + "px",
                    height: S * 3 + "px"
                });
                nq("div.kpd-group.upper img.kpd-image-button", F).css({
                    width: G * 2 + "px",
                    height: S * 3 + "px",
                    "margin-top": "-" + S + "px"
                });
                nq("div.kpd-group.special img.kpd-image-button", F).css({
                    width: G * 2 + "px",
                    height: S * 3 + "px",
                    "margin-top": "-" + S * 2 + "px"
                });
                nq("div.kpd-group.upper img.kpd-data", F).css({
                    "margin-top": "-" + S + "px"
                });
                nq("div.kpd-group.special img.kpd-data", F).css({
                    "margin-top": "-" + S * 2 + "px"
                });
                if (typeof T._keypadinfo.text != "undefined" && T._keypadinfo.text.use == true && J.attr("data-keypad-text") == "on") {
                    nq("div.kpd-text", F).css({
                        width: Math.floor(U.attr("data-width") * aa) + 1 + "px",
                        height: Math.floor(U.attr("data-height") * aa) + 1 + "px",
                        top: Math.floor(U.attr("data-top") * aa) + "px",
                        left: Math.floor(U.attr("data-left") * aa) + "px",
                        "font-size": Math.floor(U.attr("data-font-size") * aa) + "px",
                        "z-index": "20"
                    })
                }
                nq("img.kpd-data", nq("div.kpd-group", F)).each(function() {
                    var ae = nq(this).attr("data-coords");
                    var ab = nq(this).attr("pre-coords");
                    var ac = ae.split(",");
                    nq(this).css({
                        left: parseInt(ac[0] * aa) + "px",
                        top: parseInt(ac[1] * aa) + "px",
                        width: parseInt((ac[2] - ac[0]) * aa) + "px",
                        height: parseInt((ac[3] - ac[1]) * aa) + "px"
                    });
                    ac = ab.split(",");
                    newCoords = "";
                    newCoords += parseInt(ac[0] * aa) + ",";
                    newCoords += parseInt(ac[1] * aa) + ",";
                    newCoords += parseInt(ac[2] * aa) + ",";
                    newCoords += parseInt(ac[3] * aa);
                    nq(this).attr("preCoords", newCoords)
                })
            }
            var q = J;
            var u = T.getBounds(q);
            var p = F.parents(".nppfs-keypad-div");
            var s = T.getBounds(p);
            var o = F;
            var r = T.getBounds(o);
            var V = parseInt(G, 10);
            var R = parseInt(S, 10);
            var M = I.width();
            var y = I.height();
            if ("left" === n.position.x) {
                if (W) {
                    o.css("left", ((M - V) / 2 - s.left) + "px")
                } else {
                    o.css("left", (n.position.deltax - s.left) + "px")
                }
            } else {
                if ("right" === n.position.x) {
                    if (W) {
                        o.css("left", ((M - V) / 2 - s.left) + "px")
                    } else {
                        o.css("left", (M - V - (n.position.deltax) - s.left) + "px")
                    }
                } else {
                    if ("center" === n.position.x) {
                        if (W) {
                            o.css("left", ((M - V) / 2 - s.left) + "px")
                        } else {
                            o.css("left", ((M - V) / 2 + (n.position.deltax) - s.left) + "px")
                        }
                    } else {
                        if (W) {
                            o.css("left", ((M - V) / 2 - s.left) + "px")
                        } else {
                            var P = u.left - s.left + (n.position.deltax);
                            if (P + V + 10 > M) {
                                P = M - V - 10
                            }
                            if (P < -1 * s.left) {
                                P = -1 * s.left
                            }
                            o.css("left", P + "px")
                        }
                    }
                }
            }
            if ("top" === n.position.y) {
                var O = (I.scrollTop() + (n.position.deltay) - s.top);
                o.css("top", O + "px")
            } else {
                if ("bottom" === n.position.y) {
                    var O = (I.scrollTop() + y - R - (n.position.deltay) - s.top);
                    o.css("top", O + "px")
                } else {
                    if ("middle" === n.position.y) {
                        o.css("top", (I.scrollTop() + (y - R) / 2 + (n.position.deltay) - s.top) + "px")
                    } else {
                        if ("auto" === n.position.y) {
                            var O = 0;
                            var C = (u.top + u.height + R + (n.position.deltay));
                            var B = (u.top - R - (n.position.deltay));
                            var A = I.scrollTop();
                            if (C > A + y) {
                                if (B < A) {
                                    O = ((u.top + u.height) - s.top + (n.position.deltay))
                                } else {
                                    O = ((u.top - R) - s.top - (n.position.deltay))
                                }
                            } else {
                                O = ((u.top + u.height) - s.top + (n.position.deltay))
                            }
                            o.css("top", O + "px")
                        } else {
                            var O = ((u.top + u.height) - s.top + (n.position.deltay));
                            o.css("top", O + "px")
                        }
                    }
                }
            }
        }
        if (J.attr("data-keypad-action") != "pin") {
            J.css({
                "background-color": T._keypadinfo.color.nbc,
                color: T._keypadinfo.color.nfc
            })
        }
        if (Z == false) {
            g(T._uuid, T._keypadinfo);
            F.show();
            nq(document).trigger({
                type: "nppfs-npv-after-show",
                form: (L.au(T._element.form)) ? "" : nq(T._element.form).attr("name"),
                message: N.m91.replace("%p1%", J.attr("name")),
                target: T._element,
                name: J.attr("name")
            })
        }
        if (D.isMobileDevice()) {
            nq("#" + T._keypadinfo.keypadUuid + "_bg_img").focus()
        }
    };

    function g(n, o) {
        var m = nq("#" + i._uuid);
        if (o.type == "keyboard") {
            nq(".kpd-group", m).hide();
            if (!L.bn(o.range)) {
                if (o.range.indexOf("lower") >= 0) {
                    nq(".kpd-group.lower", m).show()
                } else {
                    if (o.range.indexOf("upper") >= 0) {
                        nq(".kpd-group.upper", m).show()
                    } else {
                        if (o.range.indexOf("special") >= 0) {
                            nq(".kpd-group.special", m).show()
                        } else {
                            nq(".kpd-group.lower", m).show()
                        }
                    }
                }
            } else {
                nq(".kpd-group.lower", m).show()
            }
        } else {
            nq(".kpd-group", m).show()
        }
    }
    this.hide = function() {
        var q = this;
        var m = nq(q._element);
        var p = nq(q._parent);
        var n = nq("#" + q._uuid, p);
        var o = n.is(":visible");
        if (o && m.attr("data-keypad-refresh") == "on") {
            n.hide();
            q.refreshDiv("")
        } else {
            n.hide()
        }
        if (m.attr("data-keypad-action") != "pin") {
            m.css({
                "background-color": q._keypadinfo.color.fbc,
                color: q._keypadinfo.color.ffc
            })
        }
        if (!q.isUseYn() && bh.isRunning()) {
            bh.resetColor(q._element)
        }
        if (typeof(m.attr("nppfs-readonly")) == "undefined") {
            m.removeAttr("readonly")
        }
        nq(document).trigger({
            type: "nppfs-npv-after-hide",
            form: (L.au(q._element.form)) ? "" : nq(q._element.form).attr("name"),
            message: N.m92.replace("%p1%", m.attr("name")),
            target: q._element,
            name: m.attr("name"),
            time: new Date()
        });
        if (o) {
            m.trigger({
                type: "change"
            })
        }
    };
    var i = this;
    this.close = function() {
        if (!npVCtrl.isAbsoluteUse()) {
            i.setUseYn(false)
        }
        this.hide();
        var m = {
            type: "nppfs-npv-closed",
            message: N.m93.replace("%p1%", nq(i._element).attr("name")),
            target: i._element,
            name: nq(i._element).attr("name"),
            form: (L.au(i._element.form)) ? "" : nq(i._element.form).attr("name"),
            time: new Date()
        };
        nq(document).trigger(m)
    };
    this.refreshDiv = function(o) {
        var n = i._keypadinfo;
        var m = npVCtrl.prepareKeypad(c.form, c, "s");
        m += "&n=" + n.keypadUuid;
        L.send(uV.dV.zo, m, {
            async: false,
            ax: function(r) {
                if (r.readyState == 4) {
                    if (r.status == 200) {
                        var q = r.responseText;
                        var p = nq.parseJSON(q);
                        nq(c).keypad({
                            data: p
                        });
                        a(p, o)
                    } else {
                        Mc.log(N.m30)
                    }
                }
            }
        })
    };

    function a(p, s) {
        var q = nq(i._parent);
        var o = nq("#" + i._uuid, q);
        var n = i._uuid;
        var r = [];
        nq(".kpd-preview .preview", o).css({
            "background-image": "url('" + p.info.src + "')"
        });
        nq("div.kpd-group img.kpd-image-button", o).attr("src", p.info.src);
        nq(".kpd-group .kpd-data", o).remove();
        nq(p.items).each(function(v) {
            var u = this;
            s = s == "" ? u.id : s;
            var x = 0;
            if (u.id == "upper") {
                x = p.info.ih
            } else {
                if (u.id == "special") {
                    x = p.info.ih * 2
                } else {
                    x = 0
                }
            }
            nq(this.buttons).each(function(E) {
                var B = this.coord.x1 + "," + this.coord.y1 + "," + this.coord.x2 + "," + this.coord.y2;
                var A = this.preCoord.x1 + "," + this.preCoord.y1 + "," + this.preCoord.x2 + "," + this.preCoord.y2;
                var y = this.label;
                if (typeof(y) == "undefined" || y == "") {
                    y = "키패드"
                }
                var C = "position: absolute;";
                C += "left: " + this.coord.x1 + "px;";
                C += "top: " + (this.coord.y1 - x) + "px;";
                C += "width: " + (this.coord.x2 - this.coord.x1) + "px;";
                C += "height: " + (this.coord.y2 - this.coord.y1) + "px;";
                r.push('		<img class="kpd-data" aria-label="' + y + '" alt="' + y + '" style="' + C + '" data-coords="' + B + '" pre-coords="' + A + '" precoords="' + A + '" data-action="' + this.action + '" tabindex="-1" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAADAFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALI7fhAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAAApJREFUCJljYAAAAAIAAfRxZKYAAAAASUVORK5CYII=" role="button" onfocus="this.blur();" /> ')
            });
            nq(".kpd-group." + u.id + "", o).append(r.join("\n"))
        });
        var m = nq(".kpd-group .kpd-data", o);
        if (m != null) {
            if (D.isMobileDevice() && !D.ff) {
                if (D.ios) {
                    m.on("touchstart", i.ai)
                } else {
                    m.on("click", i.ai)
                }
            } else {
                m.on("click", i.ai)
            }
        }
        if (o.is(":visible") == true) {
            if (D.and) {
                i.close();
                npVCtrl.isRefresh = true;
                setTimeout(function() {
                    i._element.focus()
                }, 100)
            } else {
                nq("#" + i._keypadinfo.keypadUuid + "_bg_img").focus()
            }
        }
    }
    this.ai = function(Q) {
        Q.stopPropagation();
        Q.preventDefault();
        Q.stopImmediatePropagation();
        var V = i._keypadinfo;
        var F = i._keypaditems;
        var E = nq(i._element);
        var B = nq(i._hashelement);
        var G = nq(i._parent);
        var x = nq("#" + i._uuid, G);
        var X = Q.target;
        var P = nq(X).attr("data-action");
        var O = null;
        if (V.touch.use == true && !i._useMultiCursor) {
            i.touch(X, L.n2b(V.touch.touchEventMode, "default"))
        }
        if (V.preview.use == true && !i._useMultiCursor) {
            i.preview(X)
        }
        if (P == null || P == "") {
            return
        }
        if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on") {
            O = nq("div.kpd-text span.textfield", x)
        }
        var T = E.prop("maxlength");
        if (L.au(T)) {
            T = 0
        }
        if (P.indexOf("action") == 0) {
            if (P.indexOf("show") == 7) {
                var p = P.substring(12);
                nq(".kpd-group", x).hide();
                nq(".kpd-group." + p, x).show();
                if (D.and) {
                    i.close();
                    npVCtrl.isRefresh = true;
                    setTimeout(function() {
                        x.show();
                        nq(".kpd-group." + p, x).show();
                        nq("#" + i._keypadinfo.keypadUuid + "_bg_img").focus();
                        npVCtrl.isRefresh = false
                    }, 100)
                } else {
                    nq("#" + i._keypadinfo.keypadUuid + "_bg_img").focus()
                }
            } else {
                if (P.indexOf("hide") == 7) {
                    i.hide()
                } else {
                    if (P.indexOf("close") == 7) {
                        i.close()
                    } else {
                        if (P.indexOf("delete") == 7) {
                            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function" && E.attr("nppfs-formatter-type") != undefined) {
                                E.val(npPfsExtension.formatter(E, false))
                            }
                            if (E.attr("data-keypad-action") == "amount") {
                                E.val(L.uncomma(E.val()))
                            }
                            var I = E.val();
                            var y = B.val();
                            if (npVCtrl.rsa == true) {
                                E.val(I.substring(0, I.length - 1));
                                B.val(y.substring(0, y.length - 96));
                                if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on") {
                                    O.text(O.text().substring(0, O.text().length - 1))
                                }
                            } else {
                                E.val(I.substring(0, I.length - 1));
                                B.val(y.substring(0, y.length - 40))
                            }
                            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function" && E.attr("nppfs-formatter-type") != undefined) {
                                E.val(npPfsExtension.formatter(E, true));
                                var Z = nq("input[name='" + E.attr("name") + "__FORMATTER__']");
                                Z.val(Z.val().substring(0, Z.val().length - 1));
                                if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on") {
                                    O.text(E.val())
                                }
                            }
                            if (E.attr("data-keypad-action") == "amount") {
                                E.val(L.comma(E.val()));
                                if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on") {
                                    O.text(E.val())
                                }
                            }
                            E.trigger({
                                type: "keypress",
                                which: 8,
                                keyCode: 8
                            });
                            E.trigger({
                                type: "keyup",
                                which: 8,
                                keyCode: 8
                            })
                        } else {
                            if (P.indexOf("clear") == 7) {
                                E.val("");
                                B.val("");
                                if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on") {
                                    O.text("")
                                }
                                if (E.attr("nppfs-formatter-type") != undefined) {
                                    var Z = nq("input[name='" + E.attr("name") + "__FORMATTER__']");
                                    Z.val("")
                                }
                                E.trigger({
                                    type: "keypress",
                                    which: 8,
                                    keyCode: 8
                                });
                                E.trigger({
                                    type: "keyup",
                                    which: 8,
                                    keyCode: 8
                                })
                            } else {
                                if (P.indexOf("enter") == 7) {
                                    if (V.enter.indexOf("function") == 0) {
                                        var m = V.enter.substring(9);
                                        try {
                                            if (window.execScript) {
                                                window.execScript(m)
                                            } else {
                                                window["eval"].call(window, m)
                                            }
                                        } catch (U) {
                                            Mc.log(U)
                                        }
                                    } else {
                                        if (V.enter == "hideall") {
                                            npVCtrl.hideAll()
                                        } else {
                                            if (V.enter == "hide") {
                                                i.hide()
                                            } else {
                                                if (i._parent.tagName.toLowerCase() == "form") {
                                                    i._parent.submit()
                                                }
                                            }
                                        }
                                    }
                                    nq(document).trigger({
                                        type: "nppfs-npv-after-enter",
                                        message: N.m94.replace("%p1%", nq(i._element).attr("name")),
                                        target: i._element,
                                        name: nq(i._element).attr("name"),
                                        form: (L.au(i._element.form)) ? "" : nq(i._element.form).attr("name"),
                                        time: new Date()
                                    })
                                } else {
                                    if (P.indexOf("refresh") == 7) {
                                        var p = P.substring(15);
                                        i.refreshDiv(p);
                                        nq(window).trigger("resize")
                                    } else {
                                        if (P.indexOf("link") == 7) {
                                            var v = P.split("|");
                                            var K = "";
                                            var M = [];
                                            var Y = v[1];
                                            if (v.length > 3) {
                                                for (var S = 2; S < v.length; S++) {
                                                    M.push(v[S])
                                                }
                                                K = M.join("|")
                                            } else {
                                                K = v[2]
                                            }
                                            window.open(K, Y)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else {
            if (P.indexOf("data") == 0) {
                var W = P.indexOf(":", 5) == -1 ? 45 : P.indexOf(":", 5);
                var J = P.substring(5, W);
                var u = (W >= 0 && P.length > W + 1) ? P.substring(W + 1) : "*";
                if (J == "korean") {
                    u = String.fromCharCode(u);
                    var C = i._element;
                    var R = i._hashelement;
                    if (u.charCodeAt(0) < 128) {
                        L.val(C, L.val(R) + u);
                        L.val(R, L.val(R) + u)
                    } else {
                        var H = L.val(R) + u;
                        var r = npVCtrl.Hangul.splitWord(H, 2);
                        var A = npVCtrl.Hangul.composeHangul(r[1]);
                        L.val(C, r[0] + A);
                        L.val(R, r[0] + A)
                    }
                    L.val(C, L.val(R));
                    if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on") {
                        O.text(nq(C).val())
                    }
                } else {
                    var n = npVCtrl.encrypt(J);
                    if (u.indexOf("p") == 0) {
                        u = String.fromCharCode(parseInt(u.substring(1)))
                    }
                    if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                        E.val(npPfsExtension.formatter(E, false))
                    }
                    if (E.attr("data-keypad-action") == "amount") {
                        E.val(L.uncomma(E.val()))
                    }
                    if (T <= 0 || E.val().length < T) {
                        E.val(E.val() + u);
                        B.val(B.val() + n);
                        if (E.attr("nppfs-formatter-type") != undefined) {
                            var Z = nq("input[name='" + E.attr("name") + "__FORMATTER__']");
                            Z.val(Z.val() + "1")
                        }
                        var s = u.charCodeAt(0);
                        E.trigger({
                            type: "keypress",
                            which: s,
                            keyCode: s
                        });
                        E.trigger({
                            type: "keyup",
                            which: s,
                            keyCode: s
                        });
                        var o = E.attr("data-keypad-next");
                        var q = (npVCtrl.rsa == true) ? B.val().length / 96 : B.val().length / 40;
                        if (T > 0 && q >= T && !L.bn(o)) {
                            if (o == "__hide__") {
                                i.hide()
                            } else {
                                if (o == "__doenter__") {
                                    if (V.enter.indexOf("function") == 0) {
                                        var m = V.enter.substring(9);
                                        try {
                                            if (window.execScript) {
                                                window.execScript(m)
                                            } else {
                                                window["eval"].call(window, m)
                                            }
                                        } catch (U) {
                                            Mc.log(U)
                                        }
                                    } else {
                                        if (V.enter == "hideall") {
                                            npVCtrl.hideAll()
                                        } else {
                                            if (V.enter == "hide") {
                                                i.hide()
                                            } else {
                                                if (i._parent.tagName.toLowerCase() == "form") {
                                                    i._parent.submit()
                                                }
                                            }
                                        }
                                    }
                                } else {
                                    nq("input[name='" + o + "']")[0].focus()
                                }
                            }
                        }
                        if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on") {
                            if (E.attr("type") == "password") {
                                O.text(O.text() + "*")
                            } else {
                                O.text(O.text() + u)
                            }
                        }
                    }
                    if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                        E.val(npPfsExtension.formatter(E, true));
                        if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on" && typeof E.attr("nppfs-formatter-type") != "undefined") {
                            O.text(E.val())
                        }
                    }
                    if (E.attr("data-keypad-action") == "amount") {
                        E.val(L.comma(E.val()));
                        if (typeof V.text != "undefined" && V.text.use == true && E.attr("data-keypad-text") == "on") {
                            O.text(E.val())
                        }
                    }
                }
                if (V.type == "keyboard") {
                    if (typeof(V.capslock) != "undefined" && V.capslock == false) {
                        if (typeof(V.shift) != "undefined" && V.shift == true && nq(".kpd-group.upper", x).css("display") != "none") {
                            if (typeof(V.range) != "undefined" && V.range != "") {
                                nq(".kpd-group", x).hide();
                                if (V.range.indexOf("lower") >= 0) {
                                    nq(".kpd-group.lower", x).show()
                                } else {
                                    if (V.range.indexOf("upper") >= 0) {
                                        nq(".kpd-group.upper", x).show()
                                    } else {
                                        if (V.range.indexOf("special") >= 0) {
                                            nq(".kpd-group.special", x).show()
                                        } else {
                                            nq(".kpd-group.lower", x).show()
                                        }
                                    }
                                }
                            } else {
                                nq(".kpd-group", x).hide();
                                nq(".kpd-group.lower", x).show()
                            }
                        }
                    }
                }
            } else {}
        }
        Q.stopPropagation();
        Q.preventDefault();
        Q.stopImmediatePropagation()
    };
    var e = false;
    var l = "simulated";
    var k = {};

    function j(n) {
        if (e) {
            if (!n.hasOwnProperty(l)) {
                var m = new nq.Event(n);
                m.preventDefault();
                m.stopPropagation()
            }
        } else {}
    }

    function d(m, n) {
        var o = document.createEvent("MouseEvent");
        o.initMouseEvent(m, true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        o[l] = true;
        n.target.dispatchEvent(o)
    }

    function f(n) {
        if (!n.hasOwnProperty(l)) {
            var m = nq(n.target);
            if (m.hasClass("kpd-data")) {
                e = true;
                d("mousedown", n)
            }
        }
    }
    this.bindEvents = function(p) {
        var u = this;
        var m = nq(u._element);
        var r = nq(u._parent);
        var o = nq("#" + u._uuid, r);
        var q = m.attr("data-keypad-useyn-type");
        var n = m.attr("data-keypad-useyn-input");
        if (D.isMobileDevice() && !D.ff) {
            if (D.ios) {
                nq(".kpd-group .kpd-data", o).on("touchstart", this.ai)
            } else {
                nq(".kpd-group .kpd-data", o).on("click", this.ai)
            }
        } else {
            nq(".kpd-group .kpd-data", o).on("click", this.ai)
        }
        m.on("focus", function(y) {
            npVCtrl.hideAll(u._uuid);
            if (nq("#" + u._uuid).css("display") == "block" && !D.isMobileDevice()) {
                y.preventDefault();
                y.stopPropagation();
                return
            }
            var v = L.n2b(m.attr("data-keypad-mapping"));
            var x = L.n2b(m.attr("data-keypad-ui"));
            if (v == "true" && x != "true") {
                y.preventDefault();
                y.stopPropagation();
                return
            }
            if ((m.attr("readonly") == true || m.attr("readonly") == "readonly") && (typeof(bh) != "undefined" && bh.isRunning())) {
                m.attr("nppfs-readonly", true)
            }
            if (m.prop("disabled") == true) {
                y.preventDefault();
                y.stopPropagation();
                return
            }
            if (m.attr("keypad-disabled-ui") == "true") {
                return
            }
            if (u.isUseYn()) {
                m.attr("readonly", true);
                if (q != "checkbox" && q != "radio") {
                    u.show(p, q, u._useynfield)
                } else {
                    u.show(p, q, n)
                }
                m.blur()
            } else {
                if (m.attr("nppfs-readonly") != "true") {
                    m.attr("readonly", false)
                } else {
                    m.attr("readonly", true)
                }
            }
            if (u._keypadinfo.focusmode == "clear") {
                if (m.attr("nppfs-readonly") != "true" && !npVCtrl.isRefresh) {
                    u.reset()
                }
            }
            npVCtrl.isRefresh = false;
            y.stopPropagation();
            y.preventDefault()
        });
        m.on("focusout blur", function(v) {});
        m.on("keydown", function(x) {
            x = (x) ? x : ((typeof(x) != "undefined") ? x : null);
            var v = (x.charCode) ? x.charCode : ((x.keyCode) ? x.keyCode : x.which);
            if (u.isUseYn() == true) {
                L.so(x)
            }
        });
        if (q == "checkbox" || q == "radio") {
            if (npVCtrl.isAbsoluteUse()) {
                nq("input[name='" + n + "'][value='Y']").prop("checked", true)
            }
            nq("input[name='" + n + "']").on("click", function(x) {
                if (m.attr("keypad-disabled-ui") == "true") {
                    x.preventDefault();
                    return
                }
                if (!nq("input[name='" + n + "']").hasClass("nppfs-npv")) {
                    nq("input[name='" + n + "']").addClass("nppfs-npv")
                }
                if (m.prop("disabled") == true) {
                    x.preventDefault();
                    x.stopPropagation();
                    return
                }
                var v = L.n2b(nq("input[name='" + n + "']").attr("data-keypad-focus-field"), "");
                if (npVCtrl.isAbsoluteUse() && ((q == "checkbox" && !this.checked) || q == "radio" && this.value != "Y")) {
                    alert(N.m88);
                    nq("input[name='" + n + "'][value='Y']").prop("checked", true);
                    x.preventDefault()
                } else {
                    if (v != "") {
                        if (v == m.attr("name")) {
                            u.show(p, q, n)
                        }
                    } else {
                        u.show(p, q, n)
                    }
                }
                x.stopPropagation();
                m.attr("readonly", u.isUseYn());
                u.setUseYn(u.isUseYn());
                u.reset()
            })
        } else {
            if (q == "toggle") {
                var s = npVCtrl.isAbsoluteUse() ? "Y" : "N";
                if (npVCtrl.isAbsoluteUse()) {
                    m.attr({
                        readonly: true,
                        "data-input-useyn-type": "toggle",
                        "data-keypad-useyn-input": u._useynfield
                    });
                    u.reset();
                    nq(".nppfs-elements", r).append('<input type="hidden" name="' + u._useynfield + '" value="Y" class="nppfs-dynamic-field" />');
                    nq("#" + n).attr("src", u._keypadinfo.inputs.toggleon)
                } else {
                    m.attr({
                        readonly: false,
                        "data-input-useyn-type": "toggle",
                        "data-keypad-useyn-input": u._useynfield
                    });
                    nq(".nppfs-elements", r).append('<input type="hidden" name="' + u._useynfield + '" value="N" class="nppfs-dynamic-field" />');
                    nq("#" + n).attr("src", u._keypadinfo.inputs.toggleoff)
                }
                nq("#" + n).css("cursor", "pointer").on("click", function(x) {
                    if (m.attr("keypad-disabled-ui") == "true") {
                        x.preventDefault();
                        return
                    }
                    if (!nq("#" + n).hasClass("nppfs-npv")) {
                        nq("#" + n).addClass("nppfs-npv")
                    }
                    if (m.prop("disabled") == true) {
                        x.preventDefault();
                        x.stopPropagation();
                        return
                    }
                    $input = nq("input[name='" + u._useynfield + "']");
                    if (npVCtrl.isAbsoluteUse() && $input.val() == "Y") {
                        alert(N.m88)
                    } else {
                        if ($input.val() == "Y") {
                            m.attr("readonly", false);
                            $input.val("N");
                            nq(this).attr("src", u._keypadinfo.inputs.toggleoff)
                        } else {
                            m.attr("readonly", true);
                            $input.val("Y");
                            nq(this).attr("src", u._keypadinfo.inputs.toggleon)
                        }
                        u.show(p, q, u._useynfield);
                        var v = L.n2b(nq("#" + n).attr("data-keypad-focus-field"), "");
                        if (v != "") {
                            nq("input[name='" + v + "']").focus()
                        }
                    }
                    m.attr("readonly", u.isUseYn());
                    u.setUseYn(u.isUseYn());
                    u.reset();
                    x.stopPropagation()
                })
            } else {
                var s = npVCtrl.isAbsoluteUse() ? "Y" : "N";
                m.attr({
                    readonly: npVCtrl.isAbsoluteUse(),
                    "data-input-useyn-type": "toggle",
                    "data-keypad-useyn-input": u._useynfield
                });
                nq(".nppfs-elements", r).append('<input type="hidden" name="' + u._useynfield + '" value="' + s + '" class="nppfs-dynamic-field" />')
            }
        }
        if (!this._isVeryOldIe) {
            var o = nq("#" + u._uuid);
            nq(window).on("resize scroll", function(v) {
                if (o.css("display") != "none") {
                    if (q == "checkbox" || q == "radio") {
                        u.show(p, q, n)
                    } else {
                        u.show(p, q, u._useynfield)
                    }
                }
            })
        }
    };
    this.isUseYn = function() {
        if (npVCtrl.isAbsoluteUse()) {
            return true
        }
        var p = this;
        var m = nq(this._element);
        var o = m.attr("data-keypad-useyn-type");
        var n = m.attr("data-keypad-useyn-input");
        if (o == "checkbox") {
            return nq("input[name='" + n + "'][value='Y']").prop("checked")
        } else {
            if (o == "radio") {
                if (nq("input[name='" + n + "'][value='Y']").prop("checked")) {
                    return true
                } else {
                    return false
                }
            } else {
                $input = nq("input[name='" + p._useynfield + "']");
                if ($input.val() == "Y") {
                    return true
                } else {
                    return false
                }
            }
        }
        return false
    };
    this.setUseYn = function(q) {
        if (npVCtrl.isAbsoluteUse() && q == false) {
            alert(N.m88);
            return
        }
        var r = this;
        var n = nq(this._element);
        var p = n.attr("data-keypad-useyn-type");
        var o = n.attr("data-keypad-useyn-input");
        if (p == "checkbox") {
            nq("input[name='" + o + "'][value='Y']").prop("checked", q)
        } else {
            if (p == "radio") {
                nq("input[name='" + o + "'][value='Y']").prop("checked", q);
                nq("input[name='" + o + "'][value='N']").prop("checked", !q)
            } else {
                if (p == "toggle") {
                    o = r._togglefield;
                    $input = nq("input[name='" + r._useynfield + "']");
                    if (q) {
                        $input.val("Y");
                        nq("#" + o).attr("src", r._keypadinfo.inputs.toggleon)
                    } else {
                        $input.val("N");
                        nq("#" + o).attr("src", r._keypadinfo.inputs.toggleoff)
                    }
                } else {
                    nq("input[name='" + r._useynfield + "']").val("Y")
                }
            }
        }
        n.attr("readonly", r.isUseYn());
        r.reset();
        var m = {
            type: q ? "nppfs-npv-enabled" : "nppfs-npv-disabled",
            message: q ? N.m79.replace("%p1%", n.attr("name")) : N.m80.replace("%p1%", n.attr("name")),
            target: this._element,
            name: n.attr("name"),
            form: nq(this._parent).attr("name"),
            time: new Date()
        };
        nq(document).trigger(m)
    };
    this.hash = function() {
        var n = this;
        var m = nq(n._hashelement);
        return m.val()
    };
    this.reset = function() {
        var p = this;
        var n = nq(p._element);
        var o = nq(p._hashelement);
        n.val("");
        o.val("");
        if (typeof p._keypadinfo.text != "undefined" && p._keypadinfo.text.use == true && n.attr("data-keypad-text") == "on") {
            nq("div.kpd-text span.textfield", nq("#" + this._uuid)).text("")
        }
        if (n.attr("nppfs-formatter-type") != undefined) {
            var m = nq("input[name='" + n.attr("name") + "__FORMATTER__']");
            m.val("")
        }
    };
    this.destroy = function() {
        var p = this;
        var x = nq(p._element);
        var n = nq(p._parent);
        var m = p._keypadinfo;
        nq("#" + this._uuid).remove();
        if (!L.au(m.dynamic) && m.dynamic.length > 0) {
            for (var o = 0; o < m.dynamic.length; o++) {
                var u = m.dynamic[o].k;
                nq("input[name='" + u + "']", n).remove()
            }
        }
        var v = x.attr("data-keypad-useyn-type");
        var q = x.attr("data-keypad-useyn-input");
        var s = nq(q);
        if (v == "toggle") {
            nq("#" + q + ".nppfs-dynamic-field").remove()
        } else {
            nq("input[name='" + q + "'].nppfs-dynamic-field").remove()
        }
        x.removeClass("nppfs-npv");
        var r = {
            type: "nppfs-npv-destroyed",
            message: N.m98.replace("%p1%", x.attr("name")),
            target: this._element,
            name: x.attr("name"),
            form: nq(this._parent).attr("name"),
            time: new Date()
        };
        nq(document).trigger(r)
    };
    this.init()
};
nq.fn.keypad = function(a) {
    var b = {
        div: "nppfs-keypad-div",
        data: null
    };
    nq.extend(b, a);
    return this.each(function() {
        if (b.data == null) {
            return true
        }
        var c = new npKeyPadMaker(this, b);
        npVCtrl.keypadObject.push(c)
    })
};
w.npVCtrl = new function() {
    this.id = "nppfs.npv.module";
    var k = {
        eK: {
            hl: null,
            gW: null,
            jJ: null,
            kM: null
        }
    };
    this.uuid = null;
    this.Nw = null;
    this.Qh = null;
    this.rsa = false;
    this.focused = false;
    this.focusedElementName = null;
    this.isRefresh = false;
    this.isRunning = function() {
        return a
    };
    this.isRunnable = function() {
        return zp.aG.KV
    };
    this.isSupported = function() {
        return true
    };
    var u = false;
    this.bA = function() {
        if (!this.isSupported() || !this.isRunnable()) {
            return true
        }
        return u
    };
    var a = false;
    this.init = function() {
        this.uuid = zp.uuid;
        var B = document.body;
        var y = nq(".ui-slider").length > 0;
        if (!y) {
            var A = {
                start: "mousedown",
                move: "mousemove",
                end: "mouseup"
            };
            if (D.isMobileDevice()) {
                A = {
                    start: "touchstart",
                    move: "touchmove",
                    end: "touchend"
                }
            }
            nq(B).on(A.start, function(F) {
                var C = nq(F.target);
                if (C.parents(".nppfs-keypad-div").length > 0 || C.hasClass("nppfs-npv")) {
                    return
                }

                function E(H) {
                    var G = nq(H.target);
                    if (G.parents(".nppfs-keypad-div").length > 0 || G.hasClass("nppfs-npv")) {
                        nq(B).off(A.move + " " + A.end);
                        return
                    }
                    if (H.type === A.end) {
                        npVCtrl.hideAll()
                    } else {}
                    nq(B).off(A.end, E)
                }
                nq(B).on(A.end, E)
            })
        }
        nq(document).bind("nppfs-npv-jvs nppfs-npv-jvp nppfs-npv-jvi", s)
    };
    var i = false;
    var v = "simulated";
    var d = {};

    function e(A) {
        if (i) {
            if (!A.hasOwnProperty(v)) {
                var y = new nq.Event(A);
                y.preventDefault();
                y.stopPropagation()
            }
        } else {}
    }

    function c(y, A) {
        var B = document.createEvent("MouseEvent");
        B.initMouseEvent(y, true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
        B[v] = true;
        A.target.dispatchEvent(B)
    }

    function r(A) {
        if (!A.hasOwnProperty(v)) {
            var y = nq(A.target);
            if (y.hasClass("kpd-data")) {
                i = true;
                c("mousedown", A)
            }
        }
    }

    function s(y) {
        nq(document).unbind(y);
        switch (y.type) {
            case "nppfs-npv-jvs":
                o();
                break;
            case "nppfs-npv-jvp":
                j();
                break;
            case "nppfs-npv-jvi":
                b();
                u = true;
                nq(document).trigger({
                    type: "nppfs-npv-after-startup",
                    message: N.m76,
                    time: new Date()
                });
                nq(document).trigger({
                    type: "nppfs-module-startup",
                    target: npVCtrl.id,
                    time: new Date()
                });
                break
        }
    }
    this.startup = function() {
        if (u == true) {
            this.cU();
            return
        }
        nq(document).trigger({
            type: "nppfs-npv-before-startup",
            message: "마우스입력기를 시작합니다.",
            time: new Date()
        });

        function A() {
            a = true;
            nq(document).trigger({
                type: "nppfs-npv-jvs",
                time: new Date()
            })
        }
        if (bh.isRunnable()) {
            function y() {
                if (bh.bA() == true) {
                    A()
                } else {
                    setTimeout(y, uV.dV.kK)
                }
            }
            y()
        } else {
            A()
        }
    };

    function o() {
        function y(K, A, J) {
            try {
                var H = null;
                K = L.trim(K);
                if (!L.bn(K) && K.length > 64) {
                    var I = K.substring(0, 64);
                    var E = K.substring(64);
                    H = L.gu(L.ha(E), L.ha(I), "ECB", AES.eU)
                }
                if (L.bn(H)) {
                    alert(N.m30)
                } else {
                    var C = L.trim(getPublicKey(("" + H)));
                    var F = new RSAKey();
                    F.setPublic(C.modulus, C.encryptionExponent);
                    var B = F.encrypt(A);
                    npVCtrl.Nw = B;
                    npVCtrl.rsa = true;
                    Mc.log("Enc Key : [" + npVCtrl.Nw + "]");
                    nq(document).trigger({
                        type: "nppfs-npv-jvp",
                        time: new Date()
                    })
                }
            } catch (G) {
                npVCtrl.rsa = false
            }
        }
        L.send(uV.dV.zo, "m=p&u=" + npVCtrl.uuid, {
            async: false,
            ax: function(A) {
                if (A.readyState == 4) {
                    if (A.status == 200) {
                        npVCtrl.Qh = L.hH(L.mL(32));
                        y(A.responseText, npVCtrl.Qh, false)
                    } else {
                        Mc.log(N.m30);
                        npVCtrl.rsa = false
                    }
                }
            }
        })
    }

    function b() {
        try {
            if (document.hasFocus()) {
                var y = zp.v4;
                if (!L.au(y)) {
                    y.blur();
                    y.focus();
                    zp.v4 = null;
                    if (!L.bn(y.name)) {
                        Mc.log(N.m24.replace("%p%", y.name))
                    }
                }
            }
        } catch (A) {}
    }
    this.bm = function() {
        nq(document).trigger({
            type: "nppfs-npv-finalized",
            message: N.m73,
            time: new Date()
        });
        var A = "m=f";
        var y = L.send(uV.dV.zo, A);
        return y
    };
    this.encrypt = function(y, A) {
        return L.encrypt(y, L.ha(npVCtrl.Qh), "ECB", AES.eU)
    };
    this.cU = function() {
        var A = null;

        function y() {
            if (npVCtrl.bA() == true) {
                nq(nq("form")).each(function(C, E) {
                    if (nq(this).hasClass("nppfs-ssm-form")) {
                        return true
                    }
                    L.c1(E, [ad.jd, ad.wG], [npVCtrl.Nw, npVCtrl.uuid])
                });

                function B() {
                    if (bh.bA() == true) {
                        j()
                    } else {
                        setTimeout(B, uV.dV.kK)
                    }
                }
                B()
            } else {
                A = setTimeout(y, uV.dV.kK)
            }
        }
        y()
    };

    function m(A, B) {
        var y = npVCtrl.keypadObject;
        nq(y).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == nq(A).attr("name")) {
                this._actionItem = B.action
            }
        })
    }

    function f(B, A) {
        var C = "";
        var y = npVCtrl.keypadObject;
        nq(y).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == B) {
                var E = this._actionItem;
                nq(E).each(function() {
                    if (this.hasOwnProperty(A)) {
                        C = this[A]
                    }
                })
            }
        });
        if (L.bn(C)) {
            C = ""
        }
        return C
    }
    var n = [];

    function j() {
        nq("input, select, textarea").each(function() {
            var E = nq(this).attr("name");
            if (L.bn(E)) {
                nq(this).attr("name", nq(this).attr("id"))
            }
            if (this.tagName.toLowerCase() === "input") {
                var F = nq(this).attr("type");
                if (L.bn(F)) {
                    nq(this).attr("type", "text")
                }
                if (!L.bn(F) && F != "text" && F != "password" && F != "tel") {
                    return true
                }
            }
        });
        var y = nq("form");
        if (y.length > 0) {
            nq(y).each(function() {
                if (nq(this).hasClass("nppfs-ssm-form")) {
                    return true
                }
                L.c1(this, [ad.jd, ad.wG], [npVCtrl.Nw, npVCtrl.uuid])
            })
        } else {
            L.c1(document.body, [ad.jd, ad.wG], [npVCtrl.Nw, npVCtrl.uuid])
        }
        var B = [];
        nq("input, select, textarea").each(function() {
            var E = this;
            var F = nq(E).attr("name");
            if (this.tagName.toLowerCase() === "textarea" && nq(this).hasClass("nppfs-keypad-script")) {
                return true
            }
            if (L.bn(F) || F == ad.Ix || F == ad.wG || F == ad.jd) {
                return true
            }
            if (F.indexOf("__E2E__") > 0 || F.indexOf("__KI_") == 0 || F.indexOf("__KH_") == 0) {
                return true
            }
            if (nq(E).hasClass("nppfs-npv")) {
                return true
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                if (F.indexOf("__FORMATTER__") > 0) {
                    return true
                }
            }
            if ((E.type != "text" && E.type != "password" && E.type != "tel")) {
                try {
                    if (E.type == "checkbox" || E.type == "radio") {
                        return true
                    }
                    nq(E).focus(function() {
                        npVCtrl.hideAll();
                        nq("div.nppfs-keypad").hide()
                    })
                } catch (H) {}
                return true
            }
            E.blur();
            var J = p(E, zp.aG.AN);
            if (L.arrayIn([zp.aG.AV, "db", "re", "sub", "des", "key", "mo"], J)) {
                nq(E).attr({
                    autocomplete: "off"
                });
                nq(document).trigger({
                    type: "nppfs-npv-before-regist-field",
                    message: N.m75.replace("%p1%", F),
                    target: E,
                    form: nq(E.form).attr("name"),
                    name: F,
                    time: new Date()
                });
                var G = p(E, "npexecutetype");
                if (G != "" && G.indexOf("v") == -1) {
                    return true
                }
                var I = npVCtrl.prepareKeypad(E.form, E);
                if (!L.bn(I)) {
                    B.push({
                        form: E.form,
                        as: E,
                        param: I
                    })
                }
            } else {
                try {
                    nq(E).focus(function() {
                        npVCtrl.hideAll()
                    })
                } catch (H) {}
            }
        });
        if (B.length == 0) {
            nq(document).trigger({
                type: "nppfs-npv-jvi",
                time: new Date()
            })
        } else {
            for (var A = 0; A < B.length; A++) {
                var C = B[A];
                npVCtrl.Iq(C.form, C.as, C.param)
            }
        }
    }
    this.keypadObject = [];
    var x = false;
    var l = false;
    this.prepareKeypad = function(C, T, R) {
        var K = {
            K1: "p",
            i8: "b",
            n3: "k",
            q2: "f",
            s2: "r",
            i9: "c",
            gQ: "t",
            b4: "l",
            s8: "b",
            x4: "d",
            ju: "l",
            x8: "p",
            c4: "c",
            eV: "m",
            u7: "a",
            w3: "n",
            p4: "s",
            b5: "r"
        };
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.keypadUiModifier) == "function") {
            npPfsExtension.keypadUiModifier(T)
        }
        var X = "data-keypad-";
        var Y = p(T, X + "useyn");
        var U = [];
        q(U, "m", (!!R) ? R : "e");
        q(U, "u", npVCtrl.uuid);
        q(U, "ev", "v4");
        q(U, "d", "nppfs-keypad-div");
        q(U, "jv", "1.13.0");
        var G = T.type.toString().toLowerCase();
        var H = p(T, X + "type") || "num";
        if (H == "alpha") {
            q(U, "t", K.i8)
        } else {
            if (H == "korean") {
                q(U, "t", K.n3)
            } else {
                q(U, "t", K.K1)
            }
        }
        if (H == "korean" && G == "password") {
            alert(N.m46);
            Mc.log(N.m46);
            bM.aO(ad.bb);
            return
        }
        var F = p(T, X + "action");
        if (F == "account") {
            q(U, "at", K.u7)
        } else {
            if (F == "amount") {
                q(U, "at", K.eV)
            } else {
                if (F == "number") {
                    q(U, "at", K.w3)
                } else {
                    if (F == "replace") {
                        q(U, "at", K.b5)
                    } else {
                        if (H == "num" && (G == "text" || G == "tel")) {
                            q(U, "at", K.w3)
                        } else {
                            if (H == "alpha" && G == "text") {
                                q(U, "at", K.ju)
                            } else {
                                if (F == "password" || F == "pin") {
                                    q(U, "at", K.x8)
                                } else {
                                    q(U, "at", K.b5)
                                }
                            }
                        }
                    }
                }
            }
        }
        var O = p(T, X + "show");
        if (O == "div") {
            q(U, "st", K.x4);
            q(U, "dp", "show")
        } else {
            if (O == "block") {
                q(U, "st", K.s8);
                q(U, "dp", "hide")
            } else {
                q(U, "st", K.b4);
                q(U, "dp", "hide")
            }
        }
        var V = p(T, X + "useyn-type");
        var Y = p(T, X + "useyn-input");
        var Q = nq(T).attr(zp.aG.AN);
        if (Q == "mo") {
            if (L.bn(V) || L.bn(Y)) {
                V = "focus"
            }
        } else {
            if (bh.isRunning()) {
                if (!L.bn(V) && L.bn(Y)) {
                    alert(N.m77.replace("%p1%", T.name).replace("%p1%", X + "useyn-input"))
                }
                var I = p(T, "npexecutetype");
                if (I == "v") {
                    V = "focus"
                } else {
                    if (L.bn(V) || V == "focus" || !L.bn(V) && L.bn(Y)) {
                        return
                    }
                }
            } else {
                if (L.bn(V) || L.bn(Y)) {
                    V = "focus"
                }
            }
        }
        if (!L.bn(V) && V != "focus" && L.bn(Y)) {
            alert(N.m77.replace("%p1%", T.name).replace("%p1%", X + "useyn-input"));
            return
        }
        if (V == "checkbox") {
            q(U, "ut", K.i9);
            q(U, "ui", Y);
            var y = L.bZ(Y, C);
            if (L.au(y)) {}
        } else {
            if (V == "radio") {
                q(U, "ut", K.s2);
                q(U, "ui", Y)
            } else {
                if (V == "toggle") {
                    q(U, "ut", K.gQ);
                    q(U, "ui", Y);
                    var P = p(T, X + "toggle-active");
                    var M = p(T, X + "toggle-on");
                    var E = p(T, X + "toggle-off");
                    M = L.bn(M) ? "/pluginfree/icon/icon_mouse_on.gif" : M;
                    E = L.bn(E) ? "/pluginfree/icon/icon_mouse_off.gif" : E;
                    q(U, "ta", L.bn(P) ? "false" : P);
                    q(U, "to", M);
                    q(U, "tf", E);
                    var y = L.bZ(Y, C);
                    if (L.au(y)) {}
                } else {
                    q(U, "ut", K.q2)
                }
            }
        }
        var S = p(T, X + "input-range");
        if (H == "alpha" && !L.bn(S)) {
            q(U, "ir", S)
        }
        var W = p(T, X + "preview");
        if (!L.bn(W)) {
            q(U, "up", W)
        }
        q(U, "f", nq(C).attr("data-nppfs-form-id"));
        q(U, "i", T.name);
        q(U, "il", p(T, "maxlength"));
        q(U, "ni", p(T, X + "next"));
        q(U, "th", p(T, X + "theme"));
        q(U, "x", p(T, X + "x"));
        q(U, "y", p(T, X + "y"));
        q(U, "tx", p(T, X + "type-x"));
        q(U, "ty", p(T, X + "type-y"));
        q(U, "w", document.body.offsetWidth);
        q(U, "h", document.body.offsetHeight);
        q(U, "cf", p(T, X + "enter"));
        q(U, "ln", p(T, X + "language"));
        q(U, "ar", D.isMobileDevice() ? "true" : "false");
        var B = p(T, X + "mapping");
        if (!L.bn(B)) {
            q(U, "um", B)
        }

        function J() {
            var aa = uV.dV.zo;
            if (aa.indexOf("http:") != 0 && aa.indexOf("https:") != 0 && aa.indexOf("//:") != 0) {
                var Z = location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "");
                aa = Z + aa
            }
            return aa
        }
        q(U, "ip", J());
        if (this.isAbsoluteUse()) {
            T.readOnly = true
        }
        var A = "task_" + nq(T.form).attr("name") + "_" + nq(T).attr("name");
        if (L.indexOf(n, A) < 0) {
            n.push(A)
        }
        return U.join("&")
    };
    this.Iq = function(A, y, B) {
        L.send(uV.dV.zo, B, {
            ax: function(K) {
                if (K.readyState == 4) {
                    var E = "task_" + nq(A).attr("name") + "_" + nq(y).attr("name");
                    n.splice(L.indexOf(n, E), 1);
                    if (K.status == 200) {
                        var I = K.responseText;
                        if (!L.bn(I)) {
                            var G = nq.parseJSON(I);
                            if (!L.au(k) && !L.au(k.eK)) {
                                if (!L.bn(k.eK.hl)) {
                                    G.info.color.nfc = k.eK.hl
                                }
                                if (!L.bn(k.eK.gW)) {
                                    G.info.color.nbc = k.eK.gW
                                }
                                if (!L.bn(k.eK.jJ)) {
                                    G.info.color.ffc = k.eK.jJ
                                }
                                if (!L.bn(k.eK.kM)) {
                                    G.info.color.fbc = k.eK.kM
                                }
                            }
                            nq(y).keypad({
                                data: G
                            });
                            npPfsCtrl.putDynamicField(A, nq(y).attr("name"), [G.info.inputs.info]);
                            npPfsCtrl.putDynamicField(A, nq(y).attr("name"), [G.info.inputs.hash]);
                            npPfsCtrl.putDynamicField(A, nq(y).attr("name"), [G.info.inputs.useyn]);
                            if (!L.au(G.actionItems)) {
                                var F = G.actionItems.substring(0, 64);
                                var I = G.actionItems.substring(64);
                                var J = L.gu(L.ha(I), L.ha(F), "ECB", AES.blackSizeInBits);
                                var H = JSON.parse(J);
                                m(y, H)
                            }
                            var C = nq(y).attr("npexecutetype");
                            if ((typeof(C) != "undefined" && C.indexOf("k") == -1) && (typeof(bh) != "undefined" && bh.isRunning())) {
                                if (C == "v") {
                                    npVCtrl.setKeypadUse(nq(y).attr("name"), true)
                                }
                            }
                            nq(document).trigger({
                                type: "nppfs-npv-after-regist-field",
                                message: N.m78.replace("%p1%", y.name),
                                target: y,
                                form: nq(A).attr("name"),
                                name: y.name,
                                time: new Date()
                            })
                        }
                    }
                    if (n.length == 0) {
                        nq(document).trigger({
                            type: "nppfs-npv-jvi",
                            time: new Date()
                        })
                    }
                }
            }
        })
    };

    function q(y, B, A) {
        if (!L.bn(A)) {
            y.push(B + "=" + L.sz(A))
        }
    }

    function g(F) {
        var y;
        var E = /^[A-Z]+$/;
        var C = /^[a-z]+$/;
        var B = /[\{\}\[\]\/?.,;:|\)*~`!^\-_+<>@#$%&\\\=\(\'\"]/gi;
        var A = /^[0-9]*$/;
        if (!L.bn(F)) {
            if (F.match(E)) {
                y = "upper"
            } else {
                if (F.match(C)) {
                    y = "lower"
                } else {
                    if (F.match(B)) {
                        y = "special"
                    } else {
                        if (F.match(A)) {
                            y = "number"
                        }
                    }
                }
            }
        }
        return y
    }
    var p = function(y, A, C) {
        var B = nq(y).attr(A);
        if (!L.au(C)) {
            C = true
        }
        return L.bn(B) ? "" : ((C) ? B.toLowerCase() : B)
    };
    this.setColor = function(y) {
        k.eK.hl = y.OnTextColor;
        k.eK.gW = y.OnFieldBgColor;
        k.eK.jJ = y.OffTextColor;
        k.eK.kM = y.OffFieldBgColor
    };
    this.encryptData = function(A, H) {
        var F = (typeof(A) == "object") ? A : nq("input[name='" + A + "']");
        var Q = (F.form != null) ? F.form : document.body;
        var B = F.attr("maxlength");
        var J;
        if (L.au(F.attr("data-keypad-mapping"))) {
            return
        }
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == F.attr("name")) {
                J = this._hashelement;
                var T = J.val();
                if (!L.bn(T)) {
                    J.val("");
                    F.val("")
                }
            }
        });
        if (!L.au(B) && (H.length > B)) {
            H = H.substring(0, B)
        }
        for (var I = 0; I < H.length; I++) {
            var E = H.charAt(I);
            var G = f(A, E.charCodeAt(0));
            var S = G.indexOf(":", 5) == -1 ? 45 : G.indexOf(":", 5);
            var R = G.substring(5, S);
            var C = (S >= 0 && G.length > S + 1) ? G.substring(S + 1) : "*";
            if (R == "korean") {
                C = String.fromCharCode(C);
                var K = hashelement;
                if (C.charCodeAt(0) < 128) {
                    L.val(F, L.val(K) + C);
                    L.val(K, L.val(K) + C)
                } else {
                    var y = L.val(K) + C;
                    var M = npVCtrl.Hangul.splitWord(y, 2);
                    var P = npVCtrl.Hangul.composeHangul(M[1]);
                    Mc.log("putHangul 001 : [" + C + "][" + y + "][" + M[0] + "][" + M[1] + "][" + P + "]");
                    L.val(F, M[0] + P);
                    L.val(K, M[0] + P)
                }
                L.val(F, L.val(K))
            } else {
                var O = npVCtrl.encrypt(R);
                if (C.indexOf("p") == 0) {
                    C = String.fromCharCode(parseInt(C.substring(1)))
                }
                F.val(F.val() + C);
                J.val(J.val() + O)
            }
        }
    };
    this.iu = function(A, E) {
        if (L.au(E)) {
            return
        }
        if (L.au(document.getElementsByName(E)[0])) {
            return
        }
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(E)) {
            var G = npVCtrl.getKeypadHash(E);
            var y = L.bZ(ad.wG, A);
            var H = L.bZ(ad.jd, A);
            var F = L.bZ("__KI_" + E, A);
            if (L.au(y) || L.au(H) || L.au(F) || L.au(y.value) || L.au(H.value) || L.au(F.value)) {
                return
            }
            var C = [];
            C.push("m=r");
            C.push("u=" + L.sz(y.value));
            C.push("r=" + L.sz(H.value));
            C.push("k=" + L.sz(F.value));
            C.push("v=" + L.sz(G));
            var B = L.send(uV.dV.zo, C.join("&"));
            return B
        }
    };
    this.im = function(A, E) {
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(E)) {
            var y = L.bZ(ad.wG, A);
            var G = L.bZ(ad.jd, A);
            var F = L.bZ("__KI_" + E, A);
            if (L.au(y) || L.au(G) || L.au(F) || L.au(y.value) || L.au(G.value) || L.au(F.value)) {
                return
            }
            var C = [];
            C.push("m=t");
            C.push("u=" + L.sz(y.value));
            C.push("r=" + L.sz(G.value));
            C.push("k=" + L.sz(F.value));
            var B = L.send(uV.dV.zo, C.join("&"));
            return B
        }
    };
    this.GetEncryptResult = function(A, E) {
        if (L.au(E)) {
            return
        }
        if (L.au(document.getElementsByName(E)[0])) {
            return
        }
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(E)) {
            var G = npVCtrl.getKeypadHash(E);
            var y = L.bZ(ad.wG, A);
            var H = L.bZ(ad.jd, A);
            var F = L.bZ("__KI_" + E, A);
            if (L.au(y) || L.au(H) || L.au(F) || L.au(y.value) || L.au(H.value) || L.au(F.value)) {
                return
            }
            var C = [];
            C.push("m=c");
            C.push("u=" + L.sz(y.value));
            C.push("r=" + L.sz(H.value));
            C.push("k=" + L.sz(F.value));
            C.push("v=" + L.sz(G));
            var B = L.send(uV.dV.zo, C.join("&"));
            return B
        }
    };
    this.eX = function(y, C) {
        var B = null;

        function A() {
            if (npVCtrl.bA() == true) {
                if (!L.bn(y)) {
                    if (typeof(y) == "string") {
                        y = nq("form[name='" + y + "']").get(0)
                    }
                }
                if (typeof(C) == "string") {
                    C = L.bZ(C, y)
                }
                if (C == null || typeof(C) == "undefined") {
                    return
                }
                var E = p(C, zp.aG.AN);
                if (L.arrayIn([zp.aG.AV, "db", "re", "sub", "des", "key", "mo"], E)) {
                    if (npVCtrl.isRunning() == true) {
                        npVCtrl.startup()
                    }
                }
            } else {
                B = setTimeout(A, uV.dV.kK)
            }
        }
        A()
    };
    this.isAbsoluteUse = function() {
        var y = bh.isRunning();
        return !y
    };
    this.setKeypadUse = function(y, A) {
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            var B = nq(this._element);
            if (nq(this._element).attr("name") == y) {
                this.setUseYn(A);
                return false
            }
        })
    };
    this.setKeypadUi = function(A, B) {
        var y = nq("input[name=" + A + "]");
        if (nq(y).attr("data-keypad-mapping") == "true") {
            nq(y).attr("data-keypad-ui", B);
            if (B) {
                nq(y).focus()
            } else {
                npVCtrl.hideAll()
            }
        }
        return false
    };
    this.isUseYn = function(y, A) {
        var B = false;
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == y && (L.bn(A) || nq(this._parent).attr("name") == A)) {
                B = this.isUseYn();
                return false
            }
        });
        return B
    };
    this.isKeypadUse = function(y) {
        return this.isUseYn(y)
    };
    this.hideKeypad = function(y) {
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == y) {
                this.hide();
                return true
            }
        })
    };
    this.hideAll = function(y) {
        nq("div.nppfs-div-keypad").hide();
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (this._uuid != y) {
                this.hide()
            }
        })
    };
    this.showKeypad = function(A, B) {
        var y = {};
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == A) {
                y.data = {
                    info: this._keypadinfo
                };
                this.show(y, npVCtrl.isKeypadUse(A), A, B);
                return true
            }
        })
    };
    this.stopKeypad = function(y) {
        nq(this.keypadObject).each(function() {
            var A = nq("#" + this._uuid);
            if (A.is(":visible") == true) {
                npVCtrl.closeKeypad(nq(this._element).attr("name"));
                nq(this._element).focus();
                if (bh.isRunning() == true) {
                    y.stopPropagation();
                    y.preventDefault();
                    y.stopImmediatePropagation()
                }
            }
        })
    };
    this.closeKeypad = function(y) {
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == y) {
                this.close();
                return true
            }
        })
    };
    this.closeAll = function(y) {
        nq("div.nppfs-div-keypad").hide();
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (this._uuid != y) {
                this.close()
            }
        })
    };
    this.getKeypadHash = function(A) {
        var y = false;
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == A) {
                y = this.hash();
                return false
            }
        });
        return y
    };
    this.resetKeypad = function(y, A) {
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == y && (L.bn(A) || nq(this._parent).attr("name") == A)) {
                this.reset();
                return false
            }
        })
    };
    this.destroyKeypad = function(y, A) {
        nq(this.keypadObject).each(function(B) {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == y && (L.bn(A) || nq(this._parent).attr("name") == A)) {
                this.destroy();
                npVCtrl.keypadObject.splice(B, 1);
                return false
            }
        })
    };
    this.enableUI = function(y, A) {
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == y && (L.bn(A) || nq(this._parent).attr("name") == A)) {
                nq(this._element).attr("keypad-disabled-ui", "false");
                return false
            }
        })
    };
    this.disableUI = function(y, A) {
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == y && (L.bn(A) || nq(this._parent).attr("name") == A)) {
                nq(this._element).attr("keypad-disabled-ui", "true");
                return false
            }
        })
    };
    this.text = function(A, B) {
        var y = "";
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == A && (L.bn(B) || nq(this._parent).attr("name") == B)) {
                y = nq(this._element).val()
            }
        });
        return y
    };
    this.value = function(F, C) {
        var I = "";
        var G = "";
        var A = "";
        var y = null;
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == F && (L.bn(C) || nq(this._parent).attr("name") == C)) {
                y = this
            }
        });
        G = y._encvalue;
        A = y._hval;
        if (L.bn(G) || L.bn(A)) {
            return
        }
        if (L.sha256(G) != A) {
            y._encvalue = "";
            y._hval = "";
            y._element.value = "";
            Mc.log("intergrity check failed.");
            return ""
        }
        var E = G.length / 32;
        for (var H = 0; H < E; H++) {
            var B = G.substring(H * 32, (H + 1) * 32);
            I = I + L.gu(L.ha(B), L.ha(npVCtrl.standalonekey), "ECB", AES.eU)
        }
        return I
    };
    this.Hangul = {
        initial: [12593, 12594, 12596, 12599, 12600, 12601, 12609, 12610, 12611, 12613, 12614, 12615, 12616, 12617, 12618, 12619, 12620, 12621, 12622],
        finale: [0, 12593, 12594, 12595, 12596, 12597, 12598, 12599, 12601, 12602, 12603, 12604, 12605, 12606, 12607, 12608, 12609, 12610, 12612, 12613, 12614, 12615, 12616, 12618, 12619, 12620, 12621, 12622],
        dMedial: [0, 0, 0, 0, 0, 0, 0, 0, 0, 800, 801, 820, 0, 0, 1304, 1305, 1320, 0, 0, 1820],
        dFinale: [0, 0, 0, 119, 0, 422, 427, 0, 0, 801, 816, 817, 819, 825, 826, 827, 0, 0, 1719, 0, 1919],
        SBase: 44032,
        VCount: 21,
        LCount: 19,
        TCount: 28,
        NCount: 588,
        VBase: 12623,
        SCount: 11172,
        composeHangul: function(A) {
            var S = A.length;
            var C = A.charCodeAt(0);
            var B = A;
            for (var G = 1; G < S; G++) {
                var Q = A.charCodeAt(G - 1);
                var I = A.charCodeAt(G);
                var R = String.fromCharCode(Q);
                var J = "";
                var E = "";
                var y = "";
                var H = this.findCode(this.initial, Q);
                if (H != -1) {
                    E = I - this.VBase;
                    if (0 <= E && E < this.VCount) {
                        combineKeyCode = this.SBase + (H * this.VCount + E) * this.TCount;
                        B = R.slice(0, R.length - 1) + String.fromCharCode(combineKeyCode);
                        continue
                    }
                }
                y = Q - this.SBase;
                if (0 <= y && y < 11145 && (y % this.TCount) == 0) {
                    J = this.findCode(this.finale, I);
                    if (J != -1) {
                        combineKeyCode = Q + J;
                        B = R.slice(0, R.length - 1) + String.fromCharCode(combineKeyCode);
                        continue
                    }
                    E = (y % this.NCount) / this.TCount;
                    var F = this.findCode(this.dMedial, (E * 100) + (I - this.VBase));
                    if (F > 0) {
                        combineKeyCode = Q + (F - E) * this.TCount;
                        B = R.slice(0, R.length - 1) + String.fromCharCode(combineKeyCode)
                    }
                }
                if (0 <= y && y < 11172 && (y % this.TCount) != 0) {
                    J = y % this.TCount;
                    E = I - this.VBase;
                    if (0 <= E && E < this.VCount) {
                        I = this.findCode(this.initial, this.finale[J]);
                        if (0 <= I && I < this.LCount) {
                            var M = R.slice(0, R.length - 1) + String.fromCharCode(C - J);
                            var K = this.SBase + (I * this.VCount + E) * this.TCount;
                            B = M + String.fromCharCode(K);
                            continue
                        }
                        if (J < this.dFinale.length && this.dFinale[J] != 0) {
                            var M = R.slice(0, R.length - 1) + String.fromCharCode(C - J + Math.floor(this.dFinale[J] / 100));
                            var F = this.findCode(this.initial, this.finale[(this.dFinale[J] % 100)]);
                            var K = this.SBase + (F * this.VCount + E) * this.TCount;
                            B = M + String.fromCharCode(K)
                        }
                    }
                    var P = this.findCode(this.finale, I);
                    var O = this.findCode(this.dFinale, (J * 100) + P);
                    if (O > 0) {
                        combineKeyCode = Q + O - J;
                        B = R.slice(0, R.length - 1) + String.fromCharCode(combineKeyCode);
                        continue
                    }
                }
            }
            return B
        },
        findCode: function(B, A) {
            for (var y = 0; y < B.length; y++) {
                if (B[y] == A) {
                    return y
                }
            }
            return -1
        },
        backSpace: function(y) {
            var I = y.length;
            var A = "";
            var F, H, G;
            for (var C = 0; C < I; C++) {
                var E = y.charCodeAt(C);
                var B = E - this.SBase;
                if (B < 0 || B >= this.SCount) {
                    A = String.fromCharCode(E);
                    continue
                }
                F = this.initial[Math.floor(B / this.NCount)];
                H = this.VBase + (B % this.NCount) / this.TCount;
                G = this.finale[B % this.TCount];
                A = String.fromCharCode(F, H);
                if (G != 0) {
                    A = A + String.fromCharCode(G)
                }
            }
            return A
        },
        splitWord: function(C, y) {
            var E = C.substring(0, C.length - y);
            var B = C.substring(C.length - y, C.length);
            var A = new Array(E, B);
            return A
        }
    }
};
w.hI.define({
    id: npVCtrl.id,
    name: "nProtect Online Security V1.0, Virtual Keypad",
    handshake: false,
    endtoend: false,
    runvirtualos: true,
    controller: npVCtrl,
    isExecutable: function(a) {
        return true
    }
});
var AES = new function() {
    var y = [1, 2, 4, 8, 16, 32, 64, 128, 27, 54, 108, 216, 171, 77, 154, 47, 94, 188, 99, 198, 151, 53, 106, 212, 179, 125, 250, 239, 197, 145];
    var f = [99, 124, 119, 123, 242, 107, 111, 197, 48, 1, 103, 43, 254, 215, 171, 118, 202, 130, 201, 125, 250, 89, 71, 240, 173, 212, 162, 175, 156, 164, 114, 192, 183, 253, 147, 38, 54, 63, 247, 204, 52, 165, 229, 241, 113, 216, 49, 21, 4, 199, 35, 195, 24, 150, 5, 154, 7, 18, 128, 226, 235, 39, 178, 117, 9, 131, 44, 26, 27, 110, 90, 160, 82, 59, 214, 179, 41, 227, 47, 132, 83, 209, 0, 237, 32, 252, 177, 91, 106, 203, 190, 57, 74, 76, 88, 207, 208, 239, 170, 251, 67, 77, 51, 133, 69, 249, 2, 127, 80, 60, 159, 168, 81, 163, 64, 143, 146, 157, 56, 245, 188, 182, 218, 33, 16, 255, 243, 210, 205, 12, 19, 236, 95, 151, 68, 23, 196, 167, 126, 61, 100, 93, 25, 115, 96, 129, 79, 220, 34, 42, 144, 136, 70, 238, 184, 20, 222, 94, 11, 219, 224, 50, 58, 10, 73, 6, 36, 92, 194, 211, 172, 98, 145, 149, 228, 121, 231, 200, 55, 109, 141, 213, 78, 169, 108, 86, 244, 234, 101, 122, 174, 8, 186, 120, 37, 46, 28, 166, 180, 198, 232, 221, 116, 31, 75, 189, 139, 138, 112, 62, 181, 102, 72, 3, 246, 14, 97, 53, 87, 185, 134, 193, 29, 158, 225, 248, 152, 17, 105, 217, 142, 148, 155, 30, 135, 233, 206, 85, 40, 223, 140, 161, 137, 13, 191, 230, 66, 104, 65, 153, 45, 15, 176, 84, 187, 22];
    var n = [2774754246, 2222750968, 2574743534, 2373680118, 234025727, 3177933782, 2976870366, 1422247313, 1345335392, 50397442, 2842126286, 2099981142, 436141799, 1658312629, 3870010189, 2591454956, 1170918031, 2642575903, 1086966153, 2273148410, 368769775, 3948501426, 3376891790, 200339707, 3970805057, 1742001331, 4255294047, 3937382213, 3214711843, 4154762323, 2524082916, 1539358875, 3266819957, 486407649, 2928907069, 1780885068, 1513502316, 1094664062, 49805301, 1338821763, 1546925160, 4104496465, 887481809, 150073849, 2473685474, 1943591083, 1395732834, 1058346282, 201589768, 1388824469, 1696801606, 1589887901, 672667696, 2711000631, 251987210, 3046808111, 151455502, 907153956, 2608889883, 1038279391, 652995533, 1764173646, 3451040383, 2675275242, 453576978, 2659418909, 1949051992, 773462580, 756751158, 2993581788, 3998898868, 4221608027, 4132590244, 1295727478, 1641469623, 3467883389, 2066295122, 1055122397, 1898917726, 2542044179, 4115878822, 1758581177, 0, 753790401, 1612718144, 536673507, 3367088505, 3982187446, 3194645204, 1187761037, 3653156455, 1262041458, 3729410708, 3561770136, 3898103984, 1255133061, 1808847035, 720367557, 3853167183, 385612781, 3309519750, 3612167578, 1429418854, 2491778321, 3477423498, 284817897, 100794884, 2172616702, 4031795360, 1144798328, 3131023141, 3819481163, 4082192802, 4272137053, 3225436288, 2324664069, 2912064063, 3164445985, 1211644016, 83228145, 3753688163, 3249976951, 1977277103, 1663115586, 806359072, 452984805, 250868733, 1842533055, 1288555905, 336333848, 890442534, 804056259, 3781124030, 2727843637, 3427026056, 957814574, 1472513171, 4071073621, 2189328124, 1195195770, 2892260552, 3881655738, 723065138, 2507371494, 2690670784, 2558624025, 3511635870, 2145180835, 1713513028, 2116692564, 2878378043, 2206763019, 3393603212, 703524551, 3552098411, 1007948840, 2044649127, 3797835452, 487262998, 1994120109, 1004593371, 1446130276, 1312438900, 503974420, 3679013266, 168166924, 1814307912, 3831258296, 1573044895, 1859376061, 4021070915, 2791465668, 2828112185, 2761266481, 937747667, 2339994098, 854058965, 1137232011, 1496790894, 3077402074, 2358086913, 1691735473, 3528347292, 3769215305, 3027004632, 4199962284, 133494003, 636152527, 2942657994, 2390391540, 3920539207, 403179536, 3585784431, 2289596656, 1864705354, 1915629148, 605822008, 4054230615, 3350508659, 1371981463, 602466507, 2094914977, 2624877800, 555687742, 3712699286, 3703422305, 2257292045, 2240449039, 2423288032, 1111375484, 3300242801, 2858837708, 3628615824, 84083462, 32962295, 302911004, 2741068226, 1597322602, 4183250862, 3501832553, 2441512471, 1489093017, 656219450, 3114180135, 954327513, 335083755, 3013122091, 856756514, 3144247762, 1893325225, 2307821063, 2811532339, 3063651117, 572399164, 2458355477, 552200649, 1238290055, 4283782570, 2015897680, 2061492133, 2408352771, 4171342169, 2156497161, 386731290, 3669999461, 837215959, 3326231172, 3093850320, 3275833730, 2962856233, 1999449434, 286199582, 3417354363, 4233385128, 3602627437, 974525996];
    var i = [1667483301, 2088564868, 2004348569, 2071721613, 4076011277, 1802229437, 1869602481, 3318059348, 808476752, 16843267, 1734856361, 724260477, 4278118169, 3621238114, 2880130534, 1987505306, 3402272581, 2189565853, 3385428288, 2105408135, 4210749205, 1499050731, 1195871945, 4042324747, 2913812972, 3570709351, 2728550397, 2947499498, 2627478463, 2762232823, 1920132246, 3233848155, 3082253762, 4261273884, 2475900334, 640044138, 909536346, 1061125697, 4160222466, 3435955023, 875849820, 2779075060, 3857043764, 4059166984, 1903288979, 3638078323, 825320019, 353708607, 67373068, 3351745874, 589514341, 3284376926, 404238376, 2526427041, 84216335, 2593796021, 117902857, 303178806, 2155879323, 3806519101, 3958099238, 656887401, 2998042573, 1970662047, 151589403, 2206408094, 741103732, 437924910, 454768173, 1852759218, 1515893998, 2694863867, 1381147894, 993752653, 3604395873, 3014884814, 690573947, 3823361342, 791633521, 2223248279, 1397991157, 3520182632, 0, 3991781676, 538984544, 4244431647, 2981198280, 1532737261, 1785386174, 3419114822, 3200149465, 960066123, 1246401758, 1280088276, 1482207464, 3486483786, 3503340395, 4025468202, 2863288293, 4227591446, 1128498885, 1296931543, 859006549, 2240090516, 1162185423, 4193904912, 33686534, 2139094657, 1347461360, 1010595908, 2678007226, 2829601763, 1364304627, 2745392638, 1077969088, 2408514954, 2459058093, 2644320700, 943222856, 4126535940, 3166462943, 3065411521, 3671764853, 555827811, 269492272, 4294960410, 4092853518, 3537026925, 3452797260, 202119188, 320022069, 3974939439, 1600110305, 2543269282, 1145342156, 387395129, 3301217111, 2812761586, 2122251394, 1027439175, 1684326572, 1566423783, 421081643, 1936975509, 1616953504, 2172721560, 1330618065, 3705447295, 572671078, 707417214, 2425371563, 2290617219, 1179028682, 4008625961, 3099093971, 336865340, 3739133817, 1583267042, 185275933, 3688607094, 3772832571, 842163286, 976909390, 168432670, 1229558491, 101059594, 606357612, 1549580516, 3267534685, 3553869166, 2896970735, 1650640038, 2442213800, 2509582756, 3840201527, 2038035083, 3890730290, 3368586051, 926379609, 1835915959, 2374828428, 3587551588, 1313774802, 2846444000, 1819072692, 1448520954, 4109693703, 3941256997, 1701169839, 2054878350, 2930657257, 134746136, 3132780501, 2021191816, 623200879, 774790258, 471611428, 2795919345, 3031724999, 3334903633, 3907570467, 3722289532, 1953818780, 522141217, 1263245021, 3183305180, 2341145990, 2324303749, 1886445712, 1044282434, 3048567236, 1718013098, 1212715224, 50529797, 4143380225, 235805714, 1633796771, 892693087, 1465364217, 3115936208, 2256934801, 3250690392, 488454695, 2661164985, 3789674808, 4177062675, 2560109491, 286335539, 1768542907, 3654920560, 2391672713, 2492740519, 2610638262, 505297954, 2273777042, 3924412704, 3469641545, 1431677695, 673730680, 3755976058, 2357986191, 2711706104, 2307459456, 218962455, 3216991706, 3873888049, 1111655622, 1751699640, 1094812355, 2576951728, 757946999, 252648977, 2964356043, 1414834428, 3149622742, 370551866];
    var A = [1673962851, 2096661628, 2012125559, 2079755643, 4076801522, 1809235307, 1876865391, 3314635973, 811618352, 16909057, 1741597031, 727088427, 4276558334, 3618988759, 2874009259, 1995217526, 3398387146, 2183110018, 3381215433, 2113570685, 4209972730, 1504897881, 1200539975, 4042984432, 2906778797, 3568527316, 2724199842, 2940594863, 2619588508, 2756966308, 1927583346, 3231407040, 3077948087, 4259388669, 2470293139, 642542118, 913070646, 1065238847, 4160029431, 3431157708, 879254580, 2773611685, 3855693029, 4059629809, 1910674289, 3635114968, 828527409, 355090197, 67636228, 3348452039, 591815971, 3281870531, 405809176, 2520228246, 84545285, 2586817946, 118360327, 304363026, 2149292928, 3806281186, 3956090603, 659450151, 2994720178, 1978310517, 152181513, 2199756419, 743994412, 439627290, 456535323, 1859957358, 1521806938, 2690382752, 1386542674, 997608763, 3602342358, 3011366579, 693271337, 3822927587, 794718511, 2215876484, 1403450707, 3518589137, 0, 3988860141, 541089824, 4242743292, 2977548465, 1538714971, 1792327274, 3415033547, 3194476990, 963791673, 1251270218, 1285084236, 1487988824, 3481619151, 3501943760, 4022676207, 2857362858, 4226619131, 1132905795, 1301993293, 862344499, 2232521861, 1166724933, 4192801017, 33818114, 2147385727, 1352724560, 1014514748, 2670049951, 2823545768, 1369633617, 2740846243, 1082179648, 2399505039, 2453646738, 2636233885, 946882616, 4126213365, 3160661948, 3061301686, 3668932058, 557998881, 270544912, 4293204735, 4093447923, 3535760850, 3447803085, 202904588, 321271059, 3972214764, 1606345055, 2536874647, 1149815876, 388905239, 3297990596, 2807427751, 2130477694, 1031423805, 1690872932, 1572530013, 422718233, 1944491379, 1623236704, 2165938305, 1335808335, 3701702620, 574907938, 710180394, 2419829648, 2282455944, 1183631942, 4006029806, 3094074296, 338181140, 3735517662, 1589437022, 185998603, 3685578459, 3772464096, 845436466, 980700730, 169090570, 1234361161, 101452294, 608726052, 1555620956, 3265224130, 3552407251, 2890133420, 1657054818, 2436475025, 2503058581, 3839047652, 2045938553, 3889509095, 3364570056, 929978679, 1843050349, 2365688973, 3585172693, 1318900302, 2840191145, 1826141292, 1454176854, 4109567988, 3939444202, 1707781989, 2062847610, 2923948462, 135272456, 3127891386, 2029029496, 625635109, 777810478, 473441308, 2790781350, 3027486644, 3331805638, 3905627112, 3718347997, 1961401460, 524165407, 1268178251, 3177307325, 2332919435, 2316273034, 1893765232, 1048330814, 3044132021, 1724688998, 1217452104, 50726147, 4143383030, 236720654, 1640145761, 896163637, 1471084887, 3110719673, 2249691526, 3248052417, 490350365, 2653403550, 3789109473, 4176155640, 2553000856, 287453969, 1775418217, 3651760345, 2382858638, 2486413204, 2603464347, 507257374, 2266337927, 3922272489, 3464972750, 1437269845, 676362280, 3752164063, 2349043596, 2707028129, 2299101321, 219813645, 3211123391, 3872862694, 1115997762, 1758509160, 1099088705, 2569646233, 760903469, 253628687, 2960903088, 1420360788, 3144537787, 371997206];
    var a = [3332727651, 4169432188, 4003034999, 4136467323, 4279104242, 3602738027, 3736170351, 2438251973, 1615867952, 33751297, 3467208551, 1451043627, 3877240574, 3043153879, 1306962859, 3969545846, 2403715786, 530416258, 2302724553, 4203183485, 4011195130, 3001768281, 2395555655, 4211863792, 1106029997, 3009926356, 1610457762, 1173008303, 599760028, 1408738468, 3835064946, 2606481600, 1975695287, 3776773629, 1034851219, 1282024998, 1817851446, 2118205247, 4110612471, 2203045068, 1750873140, 1374987685, 3509904869, 4178113009, 3801313649, 2876496088, 1649619249, 708777237, 135005188, 2505230279, 1181033251, 2640233411, 807933976, 933336726, 168756485, 800430746, 235472647, 607523346, 463175808, 3745374946, 3441880043, 1315514151, 2144187058, 3936318837, 303761673, 496927619, 1484008492, 875436570, 908925723, 3702681198, 3035519578, 1543217312, 2767606354, 1984772923, 3076642518, 2110698419, 1383803177, 3711886307, 1584475951, 328696964, 2801095507, 3110654417, 0, 3240947181, 1080041504, 3810524412, 2043195825, 3069008731, 3569248874, 2370227147, 1742323390, 1917532473, 2497595978, 2564049996, 2968016984, 2236272591, 3144405200, 3307925487, 1340451498, 3977706491, 2261074755, 2597801293, 1716859699, 294946181, 2328839493, 3910203897, 67502594, 4269899647, 2700103760, 2017737788, 632987551, 1273211048, 2733855057, 1576969123, 2160083008, 92966799, 1068339858, 566009245, 1883781176, 4043634165, 1675607228, 2009183926, 2943736538, 1113792801, 540020752, 3843751935, 4245615603, 3211645650, 2169294285, 403966988, 641012499, 3274697964, 3202441055, 899848087, 2295088196, 775493399, 2472002756, 1441965991, 4236410494, 2051489085, 3366741092, 3135724893, 841685273, 3868554099, 3231735904, 429425025, 2664517455, 2743065820, 1147544098, 1417554474, 1001099408, 193169544, 2362066502, 3341414126, 1809037496, 675025940, 2809781982, 3168951902, 371002123, 2910247899, 3678134496, 1683370546, 1951283770, 337512970, 2463844681, 201983494, 1215046692, 3101973596, 2673722050, 3178157011, 1139780780, 3299238498, 967348625, 832869781, 3543655652, 4069226873, 3576883175, 2336475336, 1851340599, 3669454189, 25988493, 2976175573, 2631028302, 1239460265, 3635702892, 2902087254, 4077384948, 3475368682, 3400492389, 4102978170, 1206496942, 270010376, 1876277946, 4035475576, 1248797989, 1550986798, 941890588, 1475454630, 1942467764, 2538718918, 3408128232, 2709315037, 3902567540, 1042358047, 2531085131, 1641856445, 226921355, 260409994, 3767562352, 2084716094, 1908716981, 3433719398, 2430093384, 100991747, 4144101110, 470945294, 3265487201, 1784624437, 2935576407, 1775286713, 395413126, 2572730817, 975641885, 666476190, 3644383713, 3943954680, 733190296, 573772049, 3535497577, 2842745305, 126455438, 866620564, 766942107, 1008868894, 361924487, 3374377449, 2269761230, 2868860245, 1350051880, 2776293343, 59739276, 1509466529, 159418761, 437718285, 1708834751, 3610371814, 2227585602, 3501746280, 2193834305, 699439513, 1517759789, 504434447, 2076946608, 2835108948, 1842789307, 742004246];

    function c(C) {
        return (C & 255)
    }

    function o(C) {
        return ((C >> 8) & 255)
    }

    function m(C) {
        return ((C >> 16) & 255)
    }

    function b(C) {
        return ((C >> 24) & 255)
    }

    function s(G, F, C, E) {
        return o(n[G & 255]) | (o(n[(F >> 8) & 255]) << 8) | (o(n[(C >> 16) & 255]) << 16) | (o(n[E >>> 24]) << 24)
    }

    function j(H) {
        var F, E;
        var G = H.length;
        var C = new Array(G / 4);
        if (!H || G % 4) {
            return
        }
        for (F = 0, E = 0; E < G; E += 4) {
            C[F++] = H[E] | (H[E + 1] << 8) | (H[E + 2] << 16) | (H[E + 3] << 24)
        }
        return C
    }

    function g(G) {
        var F;
        var E = 0,
            C = G.length;
        var H = new Array(C * 4);
        for (F = 0; F < C; F++) {
            H[E++] = c(G[F]);
            H[E++] = o(G[F]);
            H[E++] = m(G[F]);
            H[E++] = b(G[F])
        }
        return H
    }
    var v = 8;
    var x = 14;
    this.F = function(O) {
        var I, H, G, C, R;
        var K;
        var E = new Array(x + 1);
        var M = O.length;
        var F = new Array(v);
        var Q = new Array(v);
        var J = 0;
        if (M == 16) {
            K = 10;
            I = 4
        } else {
            if (M == 24) {
                K = 12;
                I = 6
            } else {
                if (M == 32) {
                    K = 14;
                    I = 8
                } else {
                    return
                }
            }
        }
        for (H = 0; H < x + 1; H++) {
            E[H] = new Array(4)
        }
        for (H = 0, G = 0; G < M; G++, H += 4) {
            F[G] = O.charCodeAt(H) | (O.charCodeAt(H + 1) << 8) | (O.charCodeAt(H + 2) << 16) | (O.charCodeAt(H + 3) << 24)
        }
        for (G = I - 1; G >= 0; G--) {
            Q[G] = F[G]
        }
        C = 0;
        R = 0;
        for (G = 0;
            (G < I) && (C < K + 1);) {
            for (;
                (G < I) && (R < 4); G++, R++) {
                E[C][R] = Q[G]
            }
            if (R == 4) {
                C++;
                R = 0
            }
        }
        while (C < K + 1) {
            var P = Q[I - 1];
            Q[0] ^= f[o(P)] | (f[m(P)] << 8) | (f[b(P)] << 16) | (f[c(P)] << 24);
            Q[0] ^= y[J++];
            if (I != 8) {
                for (G = 1; G < I; G++) {
                    Q[G] ^= Q[G - 1]
                }
            } else {
                for (G = 1; G < I / 2; G++) {
                    Q[G] ^= Q[G - 1]
                }
                P = Q[I / 2 - 1];
                Q[I / 2] ^= f[c(P)] | (f[o(P)] << 8) | (f[m(P)] << 16) | (f[b(P)] << 24);
                for (G = I / 2 + 1; G < I; G++) {
                    Q[G] ^= Q[G - 1]
                }
            }
            for (G = 0;
                (G < I) && (C < K + 1);) {
                for (;
                    (G < I) && (R < 4); G++, R++) {
                    E[C][R] = Q[G]
                }
                if (R == 4) {
                    C++;
                    R = 0
                }
            }
        }
        this.aU = K;
        this.bo = E;
        return this
    };
    this.eU = 128;
    this.gl = 256;
    var r = [82, 9, 106, 213, 48, 54, 165, 56, 191, 64, 163, 158, 129, 243, 215, 251, 124, 227, 57, 130, 155, 47, 255, 135, 52, 142, 67, 68, 196, 222, 233, 203, 84, 123, 148, 50, 166, 194, 35, 61, 238, 76, 149, 11, 66, 250, 195, 78, 8, 46, 161, 102, 40, 217, 36, 178, 118, 91, 162, 73, 109, 139, 209, 37, 114, 248, 246, 100, 134, 104, 152, 22, 212, 164, 92, 204, 93, 101, 182, 146, 108, 112, 72, 80, 253, 237, 185, 218, 94, 21, 70, 87, 167, 141, 157, 132, 144, 216, 171, 0, 140, 188, 211, 10, 247, 228, 88, 5, 184, 179, 69, 6, 208, 44, 30, 143, 202, 63, 15, 2, 193, 175, 189, 3, 1, 19, 138, 107, 58, 145, 17, 65, 79, 103, 220, 234, 151, 242, 207, 206, 240, 180, 230, 115, 150, 172, 116, 34, 231, 173, 53, 133, 226, 249, 55, 232, 28, 117, 223, 110, 71, 241, 26, 113, 29, 41, 197, 137, 111, 183, 98, 14, 170, 24, 190, 27, 252, 86, 62, 75, 198, 210, 121, 32, 154, 219, 192, 254, 120, 205, 90, 244, 31, 221, 168, 51, 136, 7, 199, 49, 177, 18, 16, 89, 39, 128, 236, 95, 96, 81, 127, 169, 25, 181, 74, 13, 45, 229, 122, 159, 147, 201, 156, 239, 160, 224, 59, 77, 174, 42, 245, 176, 200, 235, 187, 60, 131, 83, 153, 97, 23, 43, 4, 126, 186, 119, 214, 38, 225, 105, 20, 99, 85, 33, 12, 125];
    var k = [1353184337, 1399144830, 3282310938, 2522752826, 3412831035, 4047871263, 2874735276, 2466505547, 1442459680, 4134368941, 2440481928, 625738485, 4242007375, 3620416197, 2151953702, 2409849525, 1230680542, 1729870373, 2551114309, 3787521629, 41234371, 317738113, 2744600205, 3338261355, 3881799427, 2510066197, 3950669247, 3663286933, 763608788, 3542185048, 694804553, 1154009486, 1787413109, 2021232372, 1799248025, 3715217703, 3058688446, 397248752, 1722556617, 3023752829, 407560035, 2184256229, 1613975959, 1165972322, 3765920945, 2226023355, 480281086, 2485848313, 1483229296, 436028815, 2272059028, 3086515026, 601060267, 3791801202, 1468997603, 715871590, 120122290, 63092015, 2591802758, 2768779219, 4068943920, 2997206819, 3127509762, 1552029421, 723308426, 2461301159, 4042393587, 2715969870, 3455375973, 3586000134, 526529745, 2331944644, 2639474228, 2689987490, 853641733, 1978398372, 971801355, 2867814464, 111112542, 1360031421, 4186579262, 1023860118, 2919579357, 1186850381, 3045938321, 90031217, 1876166148, 4279586912, 620468249, 2548678102, 3426959497, 2006899047, 3175278768, 2290845959, 945494503, 3689859193, 1191869601, 3910091388, 3374220536, 0, 2206629897, 1223502642, 2893025566, 1316117100, 4227796733, 1446544655, 517320253, 658058550, 1691946762, 564550760, 3511966619, 976107044, 2976320012, 266819475, 3533106868, 2660342555, 1338359936, 2720062561, 1766553434, 370807324, 179999714, 3844776128, 1138762300, 488053522, 185403662, 2915535858, 3114841645, 3366526484, 2233069911, 1275557295, 3151862254, 4250959779, 2670068215, 3170202204, 3309004356, 880737115, 1982415755, 3703972811, 1761406390, 1676797112, 3403428311, 277177154, 1076008723, 538035844, 2099530373, 4164795346, 288553390, 1839278535, 1261411869, 4080055004, 3964831245, 3504587127, 1813426987, 2579067049, 4199060497, 577038663, 3297574056, 440397984, 3626794326, 4019204898, 3343796615, 3251714265, 4272081548, 906744984, 3481400742, 685669029, 646887386, 2764025151, 3835509292, 227702864, 2613862250, 1648787028, 3256061430, 3904428176, 1593260334, 4121936770, 3196083615, 2090061929, 2838353263, 3004310991, 999926984, 2809993232, 1852021992, 2075868123, 158869197, 4095236462, 28809964, 2828685187, 1701746150, 2129067946, 147831841, 3873969647, 3650873274, 3459673930, 3557400554, 3598495785, 2947720241, 824393514, 815048134, 3227951669, 935087732, 2798289660, 2966458592, 366520115, 1251476721, 4158319681, 240176511, 804688151, 2379631990, 1303441219, 1414376140, 3741619940, 3820343710, 461924940, 3089050817, 2136040774, 82468509, 1563790337, 1937016826, 776014843, 1511876531, 1389550482, 861278441, 323475053, 2355222426, 2047648055, 2383738969, 2302415851, 3995576782, 902390199, 3991215329, 1018251130, 1507840668, 1064563285, 2043548696, 3208103795, 3939366739, 1537932639, 342834655, 2262516856, 2180231114, 1053059257, 741614648, 1598071746, 1925389590, 203809468, 2336832552, 1100287487, 1895934009, 3736275976, 2632234200, 2428589668, 1636092795, 1890988757, 1952214088, 1113045200];
    var u = [2817806672, 1698790995, 2752977603, 1579629206, 1806384075, 1167925233, 1492823211, 65227667, 4197458005, 1836494326, 1993115793, 1275262245, 3622129660, 3408578007, 1144333952, 2741155215, 1521606217, 465184103, 250234264, 3237895649, 1966064386, 4031545618, 2537983395, 4191382470, 1603208167, 2626819477, 2054012907, 1498584538, 2210321453, 561273043, 1776306473, 3368652356, 2311222634, 2039411832, 1045993835, 1907959773, 1340194486, 2911432727, 2887829862, 986611124, 1256153880, 823846274, 860985184, 2136171077, 2003087840, 2926295940, 2692873756, 722008468, 1749577816, 4249194265, 1826526343, 4168831671, 3547573027, 38499042, 2401231703, 2874500650, 686535175, 3266653955, 2076542618, 137876389, 2267558130, 2780767154, 1778582202, 2182540636, 483363371, 3027871634, 4060607472, 3798552225, 4107953613, 3188000469, 1647628575, 4272342154, 1395537053, 1442030240, 3783918898, 3958809717, 3968011065, 4016062634, 2675006982, 275692881, 2317434617, 115185213, 88006062, 3185986886, 2371129781, 1573155077, 3557164143, 357589247, 4221049124, 3921532567, 1128303052, 2665047927, 1122545853, 2341013384, 1528424248, 4006115803, 175939911, 256015593, 512030921, 0, 2256537987, 3979031112, 1880170156, 1918528590, 4279172603, 948244310, 3584965918, 959264295, 3641641572, 2791073825, 1415289809, 775300154, 1728711857, 3881276175, 2532226258, 2442861470, 3317727311, 551313826, 1266113129, 437394454, 3130253834, 715178213, 3760340035, 387650077, 218697227, 3347837613, 2830511545, 2837320904, 435246981, 125153100, 3717852859, 1618977789, 637663135, 4117912764, 996558021, 2130402100, 692292470, 3324234716, 4243437160, 4058298467, 3694254026, 2237874704, 580326208, 298222624, 608863613, 1035719416, 855223825, 2703869805, 798891339, 817028339, 1384517100, 3821107152, 380840812, 3111168409, 1217663482, 1693009698, 2365368516, 1072734234, 746411736, 2419270383, 1313441735, 3510163905, 2731183358, 198481974, 2180359887, 3732579624, 2394413606, 3215802276, 2637835492, 2457358349, 3428805275, 1182684258, 328070850, 3101200616, 4147719774, 2948825845, 2153619390, 2479909244, 768962473, 304467891, 2578237499, 2098729127, 1671227502, 3141262203, 2015808777, 408514292, 3080383489, 2588902312, 1855317605, 3875515006, 3485212936, 3893751782, 2615655129, 913263310, 161475284, 2091919830, 2997105071, 591342129, 2493892144, 1721906624, 3159258167, 3397581990, 3499155632, 3634836245, 2550460746, 3672916471, 1355644686, 4136703791, 3595400845, 2968470349, 1303039060, 76997855, 3050413795, 2288667675, 523026872, 1365591679, 3932069124, 898367837, 1955068531, 1091304238, 493335386, 3537605202, 1443948851, 1205234963, 1641519756, 211892090, 351820174, 1007938441, 665439982, 3378624309, 3843875309, 2974251580, 3755121753, 1945261375, 3457423481, 935818175, 3455538154, 2868731739, 1866325780, 3678697606, 4088384129, 3295197502, 874788908, 1084473951, 3273463410, 635616268, 1228679307, 2500722497, 27801969, 3003910366, 3837057180, 3243664528, 2227927905, 3056784752, 1550600308, 1471729730];
    var q = [4098969767, 1098797925, 387629988, 658151006, 2872822635, 2636116293, 4205620056, 3813380867, 807425530, 1991112301, 3431502198, 49620300, 3847224535, 717608907, 891715652, 1656065955, 2984135002, 3123013403, 3930429454, 4267565504, 801309301, 1283527408, 1183687575, 3547055865, 2399397727, 2450888092, 1841294202, 1385552473, 3201576323, 1951978273, 3762891113, 3381544136, 3262474889, 2398386297, 1486449470, 3106397553, 3787372111, 2297436077, 550069932, 3464344634, 3747813450, 451248689, 1368875059, 1398949247, 1689378935, 1807451310, 2180914336, 150574123, 1215322216, 1167006205, 3734275948, 2069018616, 1940595667, 1265820162, 534992783, 1432758955, 3954313000, 3039757250, 3313932923, 936617224, 674296455, 3206787749, 50510442, 384654466, 3481938716, 2041025204, 133427442, 1766760930, 3664104948, 84334014, 886120290, 2797898494, 775200083, 4087521365, 2315596513, 4137973227, 2198551020, 1614850799, 1901987487, 1857900816, 557775242, 3717610758, 1054715397, 3863824061, 1418835341, 3295741277, 100954068, 1348534037, 2551784699, 3184957417, 1082772547, 3647436702, 3903896898, 2298972299, 434583643, 3363429358, 2090944266, 1115482383, 2230896926, 0, 2148107142, 724715757, 287222896, 1517047410, 251526143, 2232374840, 2923241173, 758523705, 252339417, 1550328230, 1536938324, 908343854, 168604007, 1469255655, 4004827798, 2602278545, 3229634501, 3697386016, 2002413899, 303830554, 2481064634, 2696996138, 574374880, 454171927, 151915277, 2347937223, 3056449960, 504678569, 4049044761, 1974422535, 2582559709, 2141453664, 33005350, 1918680309, 1715782971, 4217058430, 1133213225, 600562886, 3988154620, 3837289457, 836225756, 1665273989, 2534621218, 3330547729, 1250262308, 3151165501, 4188934450, 700935585, 2652719919, 3000824624, 2249059410, 3245854947, 3005967382, 1890163129, 2484206152, 3913753188, 4238918796, 4037024319, 2102843436, 857927568, 1233635150, 953795025, 3398237858, 3566745099, 4121350017, 2057644254, 3084527246, 2906629311, 976020637, 2018512274, 1600822220, 2119459398, 2381758995, 3633375416, 959340279, 3280139695, 1570750080, 3496574099, 3580864813, 634368786, 2898803609, 403744637, 2632478307, 1004239803, 650971512, 1500443672, 2599158199, 1334028442, 2514904430, 4289363686, 3156281551, 368043752, 3887782299, 1867173430, 2682967049, 2955531900, 2754719666, 1059729699, 2781229204, 2721431654, 1316239292, 2197595850, 2430644432, 2805143000, 82922136, 3963746266, 3447656016, 2434215926, 1299615190, 4014165424, 2865517645, 2531581700, 3516851125, 1783372680, 750893087, 1699118929, 1587348714, 2348899637, 2281337716, 201010753, 1739807261, 3683799762, 283718486, 3597472583, 3617229921, 2704767500, 4166618644, 334203196, 2848910887, 1639396809, 484568549, 1199193265, 3533461983, 4065673075, 337148366, 3346251575, 4149471949, 4250885034, 1038029935, 1148749531, 2949284339, 1756970692, 607661108, 2747424576, 488010435, 3803974693, 1009290057, 234832277, 2822336769, 201907891, 3034094820, 1449431233, 3413860740, 852848822, 1816687708, 3100656215];
    var p = [1364240372, 2119394625, 449029143, 982933031, 1003187115, 535905693, 2896910586, 1267925987, 542505520, 2918608246, 2291234508, 4112862210, 1341970405, 3319253802, 645940277, 3046089570, 3729349297, 627514298, 1167593194, 1575076094, 3271718191, 2165502028, 2376308550, 1808202195, 65494927, 362126482, 3219880557, 2514114898, 3559752638, 1490231668, 1227450848, 2386872521, 1969916354, 4101536142, 2573942360, 668823993, 3199619041, 4028083592, 3378949152, 2108963534, 1662536415, 3850514714, 2539664209, 1648721747, 2984277860, 3146034795, 4263288961, 4187237128, 1884842056, 2400845125, 2491903198, 1387788411, 2871251827, 1927414347, 3814166303, 1714072405, 2986813675, 788775605, 2258271173, 3550808119, 821200680, 598910399, 45771267, 3982262806, 2318081231, 2811409529, 4092654087, 1319232105, 1707996378, 114671109, 3508494900, 3297443494, 882725678, 2728416755, 87220618, 2759191542, 188345475, 1084944224, 1577492337, 3176206446, 1056541217, 2520581853, 3719169342, 1296481766, 2444594516, 1896177092, 74437638, 1627329872, 421854104, 3600279997, 2311865152, 1735892697, 2965193448, 126389129, 3879230233, 2044456648, 2705787516, 2095648578, 4173930116, 0, 159614592, 843640107, 514617361, 1817080410, 4261150478, 257308805, 1025430958, 908540205, 174381327, 1747035740, 2614187099, 607792694, 212952842, 2467293015, 3033700078, 463376795, 2152711616, 1638015196, 1516850039, 471210514, 3792353939, 3236244128, 1011081250, 303896347, 235605257, 4071475083, 767142070, 348694814, 1468340721, 2940995445, 4005289369, 2751291519, 4154402305, 1555887474, 1153776486, 1530167035, 2339776835, 3420243491, 3060333805, 3093557732, 3620396081, 1108378979, 322970263, 2216694214, 2239571018, 3539484091, 2920362745, 3345850665, 491466654, 3706925234, 233591430, 2010178497, 728503987, 2845423984, 301615252, 1193436393, 2831453436, 2686074864, 1457007741, 586125363, 2277985865, 3653357880, 2365498058, 2553678804, 2798617077, 2770919034, 3659959991, 1067761581, 753179962, 1343066744, 1788595295, 1415726718, 4139914125, 2431170776, 777975609, 2197139395, 2680062045, 1769771984, 1873358293, 3484619301, 3359349164, 279411992, 3899548572, 3682319163, 3439949862, 1861490777, 3959535514, 2208864847, 3865407125, 2860443391, 554225596, 4024887317, 3134823399, 1255028335, 3939764639, 701922480, 833598116, 707863359, 3325072549, 901801634, 1949809742, 4238789250, 3769684112, 857069735, 4048197636, 1106762476, 2131644621, 389019281, 1989006925, 1129165039, 3428076970, 3839820950, 2665723345, 1276872810, 3250069292, 1182749029, 2634345054, 22885772, 4201870471, 4214112523, 3009027431, 2454901467, 3912455696, 1829980118, 2592891351, 930745505, 1502483704, 3951639571, 3471714217, 3073755489, 3790464284, 2050797895, 2623135698, 1430221810, 410635796, 1941911495, 1407897079, 1599843069, 3742658365, 2022103876, 3397514159, 3107898472, 942421028, 3261022371, 376619805, 3154912738, 680216892, 4282488077, 963707304, 148812556, 3634160820, 1687208278, 2069988555, 3580933682, 1215585388, 3494008760];
    var B = [0, 185403662, 370807324, 488053522, 741614648, 658058550, 976107044, 824393514, 1483229296, 1399144830, 1316117100, 1165972322, 1952214088, 2136040774, 1648787028, 1766553434, 2966458592, 3151862254, 2798289660, 2915535858, 2632234200, 2548678102, 2331944644, 2180231114, 3904428176, 3820343710, 4272081548, 4121936770, 3297574056, 3481400742, 3533106868, 3650873274, 2075868123, 1890988757, 1839278535, 1722556617, 1468997603, 1552029421, 1100287487, 1251476721, 601060267, 685669029, 902390199, 1053059257, 266819475, 82468509, 436028815, 317738113, 3412831035, 3227951669, 3715217703, 3598495785, 3881799427, 3964831245, 4047871263, 4199060497, 2466505547, 2551114309, 2233069911, 2383738969, 3208103795, 3023752829, 2838353263, 2720062561, 4134368941, 4250959779, 3765920945, 3950669247, 3663286933, 3511966619, 3426959497, 3343796615, 2919579357, 2768779219, 3089050817, 3004310991, 2184256229, 2302415851, 2485848313, 2670068215, 1186850381, 1303441219, 1353184337, 1537932639, 1787413109, 1636092795, 2090061929, 2006899047, 517320253, 366520115, 147831841, 63092015, 853641733, 971801355, 620468249, 804688151, 2379631990, 2262516856, 2613862250, 2428589668, 2715969870, 2867814464, 3086515026, 3170202204, 3586000134, 3736275976, 3282310938, 3366526484, 4186579262, 4068943920, 4019204898, 3835509292, 1023860118, 906744984, 723308426, 538035844, 288553390, 440397984, 120122290, 203809468, 1701746150, 1852021992, 1937016826, 2021232372, 1230680542, 1113045200, 1598071746, 1414376140, 4158319681, 4242007375, 3787521629, 3939366739, 3689859193, 3504587127, 3455375973, 3338261355, 2947720241, 2764025151, 3114841645, 2997206819, 2206629897, 2290845959, 2510066197, 2660342555, 1191869601, 1275557295, 1360031421, 1511876531, 1799248025, 1613975959, 2099530373, 1982415755, 526529745, 342834655, 158869197, 41234371, 861278441, 945494503, 625738485, 776014843, 2355222426, 2272059028, 2591802758, 2440481928, 2689987490, 2874735276, 3058688446, 3175278768, 3557400554, 3741619940, 3256061430, 3374220536, 4164795346, 4080055004, 3995576782, 3844776128, 1018251130, 935087732, 715871590, 564550760, 277177154, 461924940, 111112542, 227702864, 1691946762, 1876166148, 1925389590, 2043548696, 1223502642, 1138762300, 1593260334, 1442459680, 28809964, 179999714, 397248752, 480281086, 763608788, 646887386, 999926984, 815048134, 1507840668, 1389550482, 1338359936, 1154009486, 1978398372, 2129067946, 1676797112, 1761406390, 2976320012, 3127509762, 2809993232, 2893025566, 2639474228, 2522752826, 2336832552, 2151953702, 3910091388, 3791801202, 4279586912, 4095236462, 3309004356, 3459673930, 3542185048, 3626794326, 2047648055, 1895934009, 1813426987, 1729870373, 1446544655, 1563790337, 1076008723, 1261411869, 577038663, 694804553, 880737115, 1064563285, 240176511, 90031217, 407560035, 323475053, 3403428311, 3251714265, 3703972811, 3620416197, 3873969647, 3991215329, 4042393587, 4227796733, 2461301159, 2579067049, 2226023355, 2409849525, 3196083615, 3045938321, 2828685187, 2744600205];
    var l = [0, 218697227, 437394454, 387650077, 874788908, 959264295, 775300154, 591342129, 1749577816, 1698790995, 1918528590, 2136171077, 1550600308, 1365591679, 1182684258, 1266113129, 3499155632, 3717852859, 3397581990, 3347837613, 3837057180, 3921532567, 4272342154, 4088384129, 3101200616, 3050413795, 2731183358, 2948825845, 2365368516, 2180359887, 2532226258, 2615655129, 3141262203, 3056784752, 2703869805, 2887829862, 2401231703, 2182540636, 2500722497, 2550460746, 3547573027, 3732579624, 3378624309, 3295197502, 3881276175, 3932069124, 4249194265, 4031545618, 1806384075, 1721906624, 1907959773, 2091919830, 1603208167, 1384517100, 1167925233, 1217663482, 65227667, 250234264, 435246981, 351820174, 935818175, 986611124, 768962473, 551313826, 1836494326, 1618977789, 2003087840, 2054012907, 1498584538, 1415289809, 1128303052, 1313441735, 88006062, 137876389, 523026872, 304467891, 823846274, 1007938441, 722008468, 637663135, 3185986886, 2968470349, 2817806672, 2868731739, 2311222634, 2227927905, 2479909244, 2665047927, 3584965918, 3634836245, 3485212936, 3266653955, 3783918898, 3968011065, 4221049124, 4136703791, 3595400845, 3678697606, 3428805275, 3243664528, 3798552225, 4016062634, 4168831671, 4117912764, 3188000469, 3003910366, 2752977603, 2837320904, 2317434617, 2267558130, 2419270383, 2637835492, 115185213, 198481974, 483363371, 298222624, 855223825, 1072734234, 686535175, 635616268, 1855317605, 1671227502, 1955068531, 2039411832, 1521606217, 1471729730, 1084473951, 1303039060, 3672916471, 3622129660, 3237895649, 3455538154, 4006115803, 3821107152, 4107953613, 4191382470, 2997105071, 3215802276, 2830511545, 2780767154, 2256537987, 2341013384, 2626819477, 2442861470, 175939911, 125153100, 275692881, 493335386, 1045993835, 860985184, 608863613, 692292470, 1647628575, 1866325780, 2015808777, 1966064386, 1443948851, 1528424248, 1275262245, 1091304238, 1641519756, 1826526343, 2076542618, 1993115793, 1442030240, 1492823211, 1340194486, 1122545853, 161475284, 76997855, 328070850, 512030921, 1035719416, 817028339, 665439982, 715178213, 2974251580, 3159258167, 2874500650, 2791073825, 2237874704, 2288667675, 2675006982, 2457358349, 3641641572, 3557164143, 3273463410, 3457423481, 3979031112, 3760340035, 4147719774, 4197458005, 3080383489, 3130253834, 2911432727, 2692873756, 2210321453, 2394413606, 2578237499, 2493892144, 3755121753, 3537605202, 3317727311, 3368652356, 3958809717, 3875515006, 4058298467, 4243437160, 1728711857, 1778582202, 2098729127, 1880170156, 1395537053, 1579629206, 1228679307, 1144333952, 256015593, 38499042, 357589247, 408514292, 996558021, 913263310, 561273043, 746411736, 211892090, 27801969, 380840812, 465184103, 948244310, 898367837, 580326208, 798891339, 1693009698, 1776306473, 2130402100, 1945261375, 1355644686, 1573155077, 1256153880, 1205234963, 3694254026, 3510163905, 3324234716, 3408578007, 3893751782, 3843875309, 4060607472, 4279172603, 3027871634, 3111168409, 2926295940, 2741155215, 2153619390, 2371129781, 2588902312, 2537983395];
    var e = [0, 151915277, 303830554, 454171927, 607661108, 758523705, 908343854, 1059729699, 1215322216, 1098797925, 1517047410, 1398949247, 1816687708, 1699118929, 2119459398, 2002413899, 2430644432, 2582559709, 2197595850, 2347937223, 3034094820, 3184957417, 2797898494, 2949284339, 3633375416, 3516851125, 3398237858, 3280139695, 4238918796, 4121350017, 4004827798, 3887782299, 1004239803, 852848822, 700935585, 550069932, 534992783, 384654466, 234832277, 82922136, 1940595667, 2057644254, 1639396809, 1756970692, 1469255655, 1587348714, 1167006205, 1283527408, 2872822635, 2721431654, 3106397553, 2955531900, 2399397727, 2249059410, 2636116293, 2484206152, 3813380867, 3930429454, 4049044761, 4166618644, 3346251575, 3464344634, 3580864813, 3697386016, 1991112301, 2141453664, 1689378935, 1841294202, 1385552473, 1536938324, 1082772547, 1233635150, 1054715397, 936617224, 750893087, 634368786, 451248689, 334203196, 150574123, 33005350, 3863824061, 4014165424, 4098969767, 4250885034, 3262474889, 3413860740, 3496574099, 3647436702, 2923241173, 2805143000, 3156281551, 3039757250, 2315596513, 2198551020, 2551784699, 2434215926, 1299615190, 1148749531, 1600822220, 1449431233, 1766760930, 1614850799, 2069018616, 1918680309, 84334014, 201907891, 387629988, 504678569, 557775242, 674296455, 857927568, 976020637, 3717610758, 3566745099, 3481938716, 3330547729, 4188934450, 4037024319, 3954313000, 3803974693, 2514904430, 2632478307, 2281337716, 2398386297, 2984135002, 3100656215, 2747424576, 2865517645, 3963746266, 3847224535, 4267565504, 4149471949, 3363429358, 3245854947, 3664104948, 3547055865, 2754719666, 2906629311, 3056449960, 3206787749, 2148107142, 2298972299, 2450888092, 2602278545, 2090944266, 1974422535, 1857900816, 1739807261, 1486449470, 1368875059, 1250262308, 1133213225, 886120290, 1038029935, 650971512, 801309301, 283718486, 434583643, 49620300, 201010753, 3617229921, 3734275948, 3313932923, 3431502198, 4087521365, 4205620056, 3787372111, 3903896898, 2682967049, 2531581700, 2381758995, 2230896926, 3151165501, 3000824624, 2848910887, 2696996138, 1199193265, 1316239292, 1432758955, 1550328230, 1665273989, 1783372680, 1901987487, 2018512274, 252339417, 100954068, 488010435, 337148366, 724715757, 574374880, 959340279, 807425530, 2599158199, 2481064634, 2297436077, 2180914336, 3201576323, 3084527246, 2898803609, 2781229204, 3533461983, 3683799762, 3229634501, 3381544136, 4137973227, 4289363686, 3837289457, 3988154620, 168604007, 50510442, 403744637, 287222896, 775200083, 658151006, 1009290057, 891715652, 1115482383, 1265820162, 1348534037, 1500443672, 1715782971, 1867173430, 1951978273, 2102843436, 2704767500, 2822336769, 3005967382, 3123013403, 2232374840, 2348899637, 2534621218, 2652719919, 3913753188, 3762891113, 4217058430, 4065673075, 3447656016, 3295741277, 3747813450, 3597472583, 836225756, 953795025, 600562886, 717608907, 368043752, 484568549, 133427442, 251526143, 2041025204, 1890163129, 1807451310, 1656065955, 1570750080, 1418835341, 1334028442, 1183687575];
    var d = [0, 235605257, 471210514, 303896347, 942421028, 908540205, 607792694, 707863359, 1884842056, 2119394625, 1817080410, 1648721747, 1215585388, 1182749029, 1415726718, 1516850039, 3769684112, 4005289369, 4238789250, 4071475083, 3634160820, 3600279997, 3297443494, 3397514159, 2431170776, 2665723345, 2365498058, 2197139395, 2831453436, 2798617077, 3033700078, 3134823399, 3682319163, 3580933682, 3345850665, 3378949152, 3814166303, 3982262806, 4282488077, 4048197636, 2871251827, 2770919034, 3073755489, 3107898472, 2467293015, 2634345054, 2400845125, 2165502028, 1003187115, 901801634, 668823993, 701922480, 65494927, 233591430, 535905693, 301615252, 1267925987, 1167593194, 1468340721, 1502483704, 1941911495, 2108963534, 1873358293, 1638015196, 2918608246, 2751291519, 2984277860, 3219880557, 2514114898, 2614187099, 2311865152, 2277985865, 3719169342, 3550808119, 3250069292, 3484619301, 3850514714, 3951639571, 4187237128, 4154402305, 1296481766, 1129165039, 1364240372, 1599843069, 1969916354, 2069988555, 1769771984, 1735892697, 1025430958, 857069735, 554225596, 788775605, 87220618, 188345475, 421854104, 389019281, 1989006925, 2022103876, 1788595295, 1687208278, 1319232105, 1084944224, 1387788411, 1555887474, 114671109, 148812556, 449029143, 348694814, 1056541217, 821200680, 586125363, 753179962, 2520581853, 2553678804, 2318081231, 2216694214, 2920362745, 2686074864, 2986813675, 3154912738, 3865407125, 3899548572, 4201870471, 4101536142, 3729349297, 3494008760, 3261022371, 3428076970, 1106762476, 1341970405, 1575076094, 1407897079, 2044456648, 2010178497, 1707996378, 1808202195, 833598116, 1067761581, 767142070, 598910399, 159614592, 126389129, 362126482, 463376795, 2705787516, 2940995445, 3176206446, 3009027431, 2573942360, 2539664209, 2239571018, 2339776835, 3508494900, 3742658365, 3439949862, 3271718191, 3912455696, 3879230233, 4112862210, 4214112523, 2592891351, 2491903198, 2258271173, 2291234508, 2728416755, 2896910586, 3199619041, 2965193448, 3939764639, 3839820950, 4139914125, 4173930116, 3539484091, 3706925234, 3471714217, 3236244128, 2050797895, 1949809742, 1714072405, 1747035740, 1108378979, 1276872810, 1577492337, 1343066744, 174381327, 74437638, 376619805, 410635796, 843640107, 1011081250, 777975609, 542505520, 3959535514, 3792353939, 4028083592, 4263288961, 3559752638, 3659959991, 3359349164, 3325072549, 2623135698, 2454901467, 2152711616, 2386872521, 2759191542, 2860443391, 3093557732, 3060333805, 212952842, 45771267, 279411992, 514617361, 882725678, 982933031, 680216892, 645940277, 2095648578, 1927414347, 1627329872, 1861490777, 1153776486, 1255028335, 1490231668, 1457007741, 930745505, 963707304, 728503987, 627514298, 257308805, 22885772, 322970263, 491466654, 1193436393, 1227450848, 1530167035, 1430221810, 2131644621, 1896177092, 1662536415, 1829980118, 3620396081, 3653357880, 3420243491, 3319253802, 4024887317, 3790464284, 4092654087, 4261150478, 2811409529, 2845423984, 3146034795, 3046089570, 2680062045, 2444594516, 2208864847, 2376308550];
    this.gU = function(E) {
        var H, C;
        var G = new Array(x + 1);
        var F = new AES.F(E);
        var I = F.aU;
        for (H = 0; H < x + 1; H++) {
            G[H] = new Array(4);
            G[H][0] = F.bo[H][0];
            G[H][1] = F.bo[H][1];
            G[H][2] = F.bo[H][2];
            G[H][3] = F.bo[H][3]
        }
        for (H = 1; H < I; H++) {
            C = G[H][0];
            G[H][0] = B[c(C)] ^ l[o(C)] ^ e[m(C)] ^ d[b(C)];
            C = G[H][1];
            G[H][1] = B[c(C)] ^ l[o(C)] ^ e[m(C)] ^ d[b(C)];
            C = G[H][2];
            G[H][2] = B[c(C)] ^ l[o(C)] ^ e[m(C)] ^ d[b(C)];
            C = G[H][3];
            G[H][3] = B[c(C)] ^ l[o(C)] ^ e[m(C)] ^ d[b(C)]
        }
        this.bo = G;
        this.aU = I;
        return this
    };
    this.J = function(F, R) {
        var C;
        var E, I, H, G;
        var O = j(F);
        var J = R.aU;
        var Q = O[0];
        var P = O[1];
        var M = O[2];
        var K = O[3];
        for (C = 0; C < J - 1; C++) {
            E = Q ^ R.bo[C][0];
            I = P ^ R.bo[C][1];
            H = M ^ R.bo[C][2];
            G = K ^ R.bo[C][3];
            Q = n[E & 255] ^ i[(I >> 8) & 255] ^ A[(H >> 16) & 255] ^ a[G >>> 24];
            P = n[I & 255] ^ i[(H >> 8) & 255] ^ A[(G >> 16) & 255] ^ a[E >>> 24];
            M = n[H & 255] ^ i[(G >> 8) & 255] ^ A[(E >> 16) & 255] ^ a[I >>> 24];
            K = n[G & 255] ^ i[(E >> 8) & 255] ^ A[(I >> 16) & 255] ^ a[H >>> 24]
        }
        C = J - 1;
        E = Q ^ R.bo[C][0];
        I = P ^ R.bo[C][1];
        H = M ^ R.bo[C][2];
        G = K ^ R.bo[C][3];
        O[0] = s(E, I, H, G) ^ R.bo[J][0];
        O[1] = s(I, H, G, E) ^ R.bo[J][1];
        O[2] = s(H, G, E, I) ^ R.bo[J][2];
        O[3] = s(G, E, I, H) ^ R.bo[J][3];
        return g(O)
    };
    this.er = function(F, M) {
        var C;
        var E, I, H, G;
        var J = M.aU;
        var K = j(F);
        for (C = J; C > 1; C--) {
            E = K[0] ^ M.bo[C][0];
            I = K[1] ^ M.bo[C][1];
            H = K[2] ^ M.bo[C][2];
            G = K[3] ^ M.bo[C][3];
            K[0] = k[c(E)] ^ u[o(G)] ^ q[m(H)] ^ p[b(I)];
            K[1] = k[c(I)] ^ u[o(E)] ^ q[m(G)] ^ p[b(H)];
            K[2] = k[c(H)] ^ u[o(I)] ^ q[m(E)] ^ p[b(G)];
            K[3] = k[c(G)] ^ u[o(H)] ^ q[m(I)] ^ p[b(E)]
        }
        E = K[0] ^ M.bo[1][0];
        I = K[1] ^ M.bo[1][1];
        H = K[2] ^ M.bo[1][2];
        G = K[3] ^ M.bo[1][3];
        K[0] = r[c(E)] | (r[o(G)] << 8) | (r[m(H)] << 16) | (r[b(I)] << 24);
        K[1] = r[c(I)] | (r[o(E)] << 8) | (r[m(G)] << 16) | (r[b(H)] << 24);
        K[2] = r[c(H)] | (r[o(I)] << 8) | (r[m(E)] << 16) | (r[b(G)] << 24);
        K[3] = r[c(G)] | (r[o(H)] << 8) | (r[m(I)] << 16) | (r[b(E)] << 24);
        K[0] ^= M.bo[0][0];
        K[1] ^= M.bo[0][1];
        K[2] ^= M.bo[0][2];
        K[3] ^= M.bo[0][3];
        return g(K)
    }
};
var dbits;
var canary = 244837814094590;
var j_lm = ((canary & 16777215) == 15715070);

function b0(e, d, f) {
    if (e != null) {
        if ("number" == typeof e) {
            this.fromNumber(e, d, f)
        } else {
            if (d == null && "string" != typeof e) {
                this.fromString(e, 256)
            } else {
                this.fromString(e, d)
            }
        }
    }
}

function nbi() {
    return new b0(null)
}
if (j_lm && (navigator.appName == "Microsoft Internet Explorer")) {
    b0.prototype.am = function(f, p, q, e, k, a) {
        var j = p & 32767,
            o = p >> 15;
        while (--a >= 0) {
            var d = this[f] & 32767;
            var g = this[f++] >> 15;
            var b = o * d + g * j;
            d = j * d + ((b & 32767) << 15) + q[e] + (k & 1073741823);
            k = (d >>> 30) + (b >>> 15) + o * g + (k >>> 30);
            q[e++] = d & 1073741823
        }
        return k
    };
    dbits = 30
} else {
    if (j_lm && (navigator.appName != "Netscape")) {
        b0.prototype.am = function(f, a, b, e, j, g) {
            while (--g >= 0) {
                var d = a * this[f++] + b[e] + j;
                j = Math.floor(d / 67108864);
                b[e++] = d & 67108863
            }
            return j
        };
        dbits = 26
    } else {
        b0.prototype.am = function(f, p, q, e, k, a) {
            var j = p & 16383,
                o = p >> 14;
            while (--a >= 0) {
                var d = this[f] & 16383;
                var g = this[f++] >> 14;
                var b = o * d + g * j;
                d = j * d + ((b & 16383) << 14) + q[e] + k;
                k = (d >> 28) + (b >> 14) + o * g;
                q[e++] = d & 268435455
            }
            return k
        };
        dbits = 28
    }
}
b0.prototype.DB = dbits;
b0.prototype.hs = ((1 << dbits) - 1);
b0.prototype.DV = (1 << dbits);
var BI_FP = 52;
b0.prototype.FV = Math.pow(2, BI_FP);
b0.prototype.h = BI_FP - dbits;
b0.prototype.F2 = 2 * dbits - BI_FP;
var BI_RM = "0123456789abcdefghijklmnopqrstuvwxyz";
var BI_RC = new Array();
var rr, vv;
rr = "0".charCodeAt(0);
for (vv = 0; vv <= 9; ++vv) {
    BI_RC[rr++] = vv
}
rr = "a".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) {
    BI_RC[rr++] = vv
}
rr = "A".charCodeAt(0);
for (vv = 10; vv < 36; ++vv) {
    BI_RC[rr++] = vv
}

function int2char(a) {
    return BI_RM.charAt(a)
}

function intAt(b, a) {
    var d = BI_RC[b.charCodeAt(a)];
    return (d == null) ? -1 : d
}

function bnpCopyTo(b) {
    for (var a = this.t - 1; a >= 0; --a) {
        b[a] = this[a]
    }
    b.t = this.t;
    b.s = this.s
}

function bnpFromInt(a) {
    this.t = 1;
    this.s = (a < 0) ? -1 : 0;
    if (a > 0) {
        this[0] = a
    } else {
        if (a < -1) {
            this[0] = a + this.DV
        } else {
            this.t = 0
        }
    }
}

function nbv(a) {
    var b = nbi();
    b.fromInt(a);
    return b
}

function bnpFromString(j, c) {
    var e;
    if (c == 16) {
        e = 4
    } else {
        if (c == 8) {
            e = 3
        } else {
            if (c == 256) {
                e = 8
            } else {
                if (c == 2) {
                    e = 1
                } else {
                    if (c == 32) {
                        e = 5
                    } else {
                        if (c == 4) {
                            e = 2
                        } else {
                            this.fromRadix(j, c);
                            return
                        }
                    }
                }
            }
        }
    }
    this.t = 0;
    this.s = 0;
    var g = j.length,
        d = false,
        f = 0;
    while (--g >= 0) {
        var a = (e == 8) ? j[g] & 255 : intAt(j, g);
        if (a < 0) {
            if (j.charAt(g) == "-") {
                d = true
            }
            continue
        }
        d = false;
        if (f == 0) {
            this[this.t++] = a
        } else {
            if (f + e > this.DB) {
                this[this.t - 1] |= (a & ((1 << (this.DB - f)) - 1)) << f;
                this[this.t++] = (a >> (this.DB - f))
            } else {
                this[this.t - 1] |= a << f
            }
        }
        f += e;
        if (f >= this.DB) {
            f -= this.DB
        }
    }
    if (e == 8 && (j[0] & 128) != 0) {
        this.s = -1;
        if (f > 0) {
            this[this.t - 1] |= ((1 << (this.DB - f)) - 1) << f
        }
    }
    this.clamp();
    if (d) {
        b0.ZERO.subTo(this, this)
    }
}

function bnpClamp() {
    var a = this.s & this.hs;
    while (this.t > 0 && this[this.t - 1] == a) {
        --this.t
    }
}

function bnToString(c) {
    if (this.s < 0) {
        return "-" + this.negate().toString(c)
    }
    var e;
    if (c == 16) {
        e = 4
    } else {
        if (c == 8) {
            e = 3
        } else {
            if (c == 2) {
                e = 1
            } else {
                if (c == 32) {
                    e = 5
                } else {
                    if (c == 4) {
                        e = 2
                    } else {
                        return this.toRadix(c)
                    }
                }
            }
        }
    }
    var g = (1 << e) - 1,
        n, a = false,
        j = "",
        f = this.t;
    var l = this.DB - (f * this.DB) % e;
    if (f-- > 0) {
        if (l < this.DB && (n = this[f] >> l) > 0) {
            a = true;
            j = int2char(n)
        }
        while (f >= 0) {
            if (l < e) {
                n = (this[f] & ((1 << l) - 1)) << (e - l);
                n |= this[--f] >> (l += this.DB - e)
            } else {
                n = (this[f] >> (l -= e)) & g;
                if (l <= 0) {
                    l += this.DB;
                    --f
                }
            }
            if (n > 0) {
                a = true
            }
            if (a) {
                j += int2char(n)
            }
        }
    }
    return a ? j : "0"
}

function bnNegate() {
    var a = nbi();
    b0.ZERO.subTo(this, a);
    return a
}

function bnAbs() {
    return (this.s < 0) ? this.negate() : this
}

function bnCompareTo(b) {
    var d = this.s - b.s;
    if (d != 0) {
        return d
    }
    var c = this.t;
    d = c - b.t;
    if (d != 0) {
        return (this.s < 0) ? -d : d
    }
    while (--c >= 0) {
        if ((d = this[c] - b[c]) != 0) {
            return d
        }
    }
    return 0
}

function nbits(a) {
    var c = 1,
        b;
    if ((b = a >>> 16) != 0) {
        a = b;
        c += 16
    }
    if ((b = a >> 8) != 0) {
        a = b;
        c += 8
    }
    if ((b = a >> 4) != 0) {
        a = b;
        c += 4
    }
    if ((b = a >> 2) != 0) {
        a = b;
        c += 2
    }
    if ((b = a >> 1) != 0) {
        a = b;
        c += 1
    }
    return c
}

function bnBitLength() {
    if (this.t <= 0) {
        return 0
    }
    return this.DB * (this.t - 1) + nbits(this[this.t - 1] ^ (this.s & this.hs))
}

function bnpDLShiftTo(c, b) {
    var a;
    for (a = this.t - 1; a >= 0; --a) {
        b[a + c] = this[a]
    }
    for (a = c - 1; a >= 0; --a) {
        b[a] = 0
    }
    b.t = this.t + c;
    b.s = this.s
}

function bnpDRShiftTo(c, b) {
    for (var a = c; a < this.t; ++a) {
        b[a - c] = this[a]
    }
    b.t = Math.max(this.t - c, 0);
    b.s = this.s
}

function bnpLShiftTo(k, e) {
    var b = k % this.DB;
    var a = this.DB - b;
    var g = (1 << a) - 1;
    var f = Math.floor(k / this.DB),
        j = (this.s << b) & this.hs,
        d;
    for (d = this.t - 1; d >= 0; --d) {
        e[d + f + 1] = (this[d] >> a) | j;
        j = (this[d] & g) << b
    }
    for (d = f - 1; d >= 0; --d) {
        e[d] = 0
    }
    e[f] = j;
    e.t = this.t + f + 1;
    e.s = this.s;
    e.clamp()
}

function bnpRShiftTo(g, d) {
    d.s = this.s;
    var e = Math.floor(g / this.DB);
    if (e >= this.t) {
        d.t = 0;
        return
    }
    var b = g % this.DB;
    var a = this.DB - b;
    var f = (1 << b) - 1;
    d[0] = this[e] >> b;
    for (var c = e + 1; c < this.t; ++c) {
        d[c - e - 1] |= (this[c] & f) << a;
        d[c - e] = this[c] >> b
    }
    if (b > 0) {
        d[this.t - e - 1] |= (this.s & f) << a
    }
    d.t = this.t - e;
    d.clamp()
}

function bnpSubTo(d, f) {
    var e = 0,
        g = 0,
        b = Math.min(d.t, this.t);
    while (e < b) {
        g += this[e] - d[e];
        f[e++] = g & this.hs;
        g >>= this.DB
    }
    if (d.t < this.t) {
        g -= d.s;
        while (e < this.t) {
            g += this[e];
            f[e++] = g & this.hs;
            g >>= this.DB
        }
        g += this.s
    } else {
        g += this.s;
        while (e < d.t) {
            g -= d[e];
            f[e++] = g & this.hs;
            g >>= this.DB
        }
        g -= d.s
    }
    f.s = (g < 0) ? -1 : 0;
    if (g < -1) {
        f[e++] = this.DV + g
    } else {
        if (g > 0) {
            f[e++] = g
        }
    }
    f.t = e;
    f.clamp()
}

function bnpMultiplyTo(c, e) {
    var b = this.abs(),
        f = c.abs();
    var d = b.t;
    e.t = d + f.t;
    while (--d >= 0) {
        e[d] = 0
    }
    for (d = 0; d < f.t; ++d) {
        e[d + b.t] = b.am(0, f[d], e, d, 0, b.t)
    }
    e.s = 0;
    e.clamp();
    if (this.s != c.s) {
        b0.ZERO.subTo(e, e)
    }
}

function bnpSquareTo(d) {
    var a = this.abs();
    var b = d.t = 2 * a.t;
    while (--b >= 0) {
        d[b] = 0
    }
    for (b = 0; b < a.t - 1; ++b) {
        var e = a.am(b, a[b], d, 2 * b, 0, 1);
        if ((d[b + a.t] += a.am(b + 1, 2 * a[b], d, 2 * b + 1, e, a.t - b - 1)) >= a.DV) {
            d[b + a.t] -= a.DV;
            d[b + a.t + 1] = 1
        }
    }
    if (d.t > 0) {
        d[d.t - 1] += a.am(b, a[b], d, 2 * b, 0, 1)
    }
    d.s = 0;
    d.clamp()
}

function bnpDivRemTo(o, j, g) {
    var x = o.abs();
    if (x.t <= 0) {
        return
    }
    var l = this.abs();
    if (l.t < x.t) {
        if (j != null) {
            j.fromInt(0)
        }
        if (g != null) {
            this.copyTo(g)
        }
        return
    }
    if (g == null) {
        g = nbi()
    }
    var d = nbi(),
        a = this.s,
        n = o.s;
    var v = this.DB - nbits(x[x.t - 1]);
    if (v > 0) {
        x.lShiftTo(v, d);
        l.lShiftTo(v, g)
    } else {
        x.copyTo(d);
        l.copyTo(g)
    }
    var s = d.t;
    var b = d[s - 1];
    if (b == 0) {
        return
    }
    var p = b * (1 << this.h) + ((s > 1) ? d[s - 2] >> this.F2 : 0);
    var C = this.FV / p,
        B = (1 << this.h) / p,
        A = 1 << this.F2;
    var u = g.t,
        k = u - s,
        f = (j == null) ? nbi() : j;
    d.dlShiftTo(k, f);
    if (g.compareTo(f) >= 0) {
        g[g.t++] = 1;
        g.subTo(f, g)
    }
    b0.ONE.dlShiftTo(s, f);
    f.subTo(d, d);
    while (d.t < s) {
        d[d.t++] = 0
    }
    while (--k >= 0) {
        var c = (g[--u] == b) ? this.hs : Math.floor(g[u] * C + (g[u - 1] + A) * B);
        if ((g[u] += d.am(0, c, g, k, 0, s)) < c) {
            d.dlShiftTo(k, f);
            g.subTo(f, g);
            while (g[u] < --c) {
                g.subTo(f, g)
            }
        }
    }
    if (j != null) {
        g.drShiftTo(s, j);
        if (a != n) {
            b0.ZERO.subTo(j, j)
        }
    }
    g.t = s;
    g.clamp();
    if (v > 0) {
        g.rShiftTo(v, g)
    }
    if (a < 0) {
        b0.ZERO.subTo(g, g)
    }
}

function bnMod(b) {
    var c = nbi();
    this.abs().divRemTo(b, null, c);
    if (this.s < 0 && c.compareTo(b0.ZERO) > 0) {
        b.subTo(c, c)
    }
    return c
}

function Classic(a) {
    this.m = a
}

function cConvert(a) {
    if (a.s < 0 || a.compareTo(this.m) >= 0) {
        return a.mod(this.m)
    } else {
        return a
    }
}

function cRevert(a) {
    return a
}

function cReduce(a) {
    a.divRemTo(this.m, null, a)
}

function cMulTo(a, c, b) {
    a.multiplyTo(c, b);
    this.reduce(b)
}

function cSqrTo(a, b) {
    a.squareTo(b);
    this.reduce(b)
}
Classic.prototype.convert = cConvert;
Classic.prototype.revert = cRevert;
Classic.prototype.reduce = cReduce;
Classic.prototype.mulTo = cMulTo;
Classic.prototype.sqrTo = cSqrTo;

function bnpInvDigit() {
    if (this.t < 1) {
        return 0
    }
    var a = this[0];
    if ((a & 1) == 0) {
        return 0
    }
    var b = a & 3;
    b = (b * (2 - (a & 15) * b)) & 15;
    b = (b * (2 - (a & 255) * b)) & 255;
    b = (b * (2 - (((a & 65535) * b) & 65535))) & 65535;
    b = (b * (2 - a * b % this.DV)) % this.DV;
    return (b > 0) ? this.DV - b : -b
}

function m0(a) {
    this.m = a;
    this.mp = a.invDigit();
    this.mpl = this.mp & 32767;
    this.mph = this.mp >> 15;
    this.um = (1 << (a.DB - 15)) - 1;
    this.mt2 = 2 * a.t
}

function montConvert(a) {
    var b = nbi();
    a.abs().dlShiftTo(this.m.t, b);
    b.divRemTo(this.m, null, b);
    if (a.s < 0 && b.compareTo(b0.ZERO) > 0) {
        this.m.subTo(b, b)
    }
    return b
}

function montRevert(a) {
    var b = nbi();
    a.copyTo(b);
    this.reduce(b);
    return b
}

function montReduce(a) {
    while (a.t <= this.mt2) {
        a[a.t++] = 0
    }
    for (var c = 0; c < this.m.t; ++c) {
        var b = a[c] & 32767;
        var d = (b * this.mpl + (((b * this.mph + (a[c] >> 15) * this.mpl) & this.um) << 15)) & a.hs;
        b = c + this.m.t;
        a[b] += this.m.am(0, d, a, c, 0, this.m.t);
        while (a[b] >= a.DV) {
            a[b] -= a.DV;
            a[++b]++
        }
    }
    a.clamp();
    a.drShiftTo(this.m.t, a);
    if (a.compareTo(this.m) >= 0) {
        a.subTo(this.m, a)
    }
}

function montSqrTo(a, b) {
    a.squareTo(b);
    this.reduce(b)
}

function montMulTo(a, c, b) {
    a.multiplyTo(c, b);
    this.reduce(b)
}
m0.prototype.convert = montConvert;
m0.prototype.revert = montRevert;
m0.prototype.reduce = montReduce;
m0.prototype.mulTo = montMulTo;
m0.prototype.sqrTo = montSqrTo;

function bnpIsEven() {
    return ((this.t > 0) ? (this[0] & 1) : this.s) == 0
}

function bnpExp(j, k) {
    if (j > 4294967295 || j < 1) {
        return b0.ONE
    }
    var f = nbi(),
        a = nbi(),
        d = k.convert(this),
        c = nbits(j) - 1;
    d.copyTo(f);
    while (--c >= 0) {
        k.sqrTo(f, a);
        if ((j & (1 << c)) > 0) {
            k.mulTo(a, d, f)
        } else {
            var b = f;
            f = a;
            a = b
        }
    }
    return k.revert(f)
}

function bnModPowInt(b, a) {
    var c;
    if (b < 256 || a.isEven()) {
        c = new Classic(a)
    } else {
        c = new m0(a)
    }
    return this.exp(b, c)
}
b0.prototype.copyTo = bnpCopyTo;
b0.prototype.fromInt = bnpFromInt;
b0.prototype.fromString = bnpFromString;
b0.prototype.clamp = bnpClamp;
b0.prototype.dlShiftTo = bnpDLShiftTo;
b0.prototype.drShiftTo = bnpDRShiftTo;
b0.prototype.lShiftTo = bnpLShiftTo;
b0.prototype.rShiftTo = bnpRShiftTo;
b0.prototype.subTo = bnpSubTo;
b0.prototype.multiplyTo = bnpMultiplyTo;
b0.prototype.squareTo = bnpSquareTo;
b0.prototype.divRemTo = bnpDivRemTo;
b0.prototype.invDigit = bnpInvDigit;
b0.prototype.isEven = bnpIsEven;
b0.prototype.exp = bnpExp;
b0.prototype.toString = bnToString;
b0.prototype.negate = bnNegate;
b0.prototype.abs = bnAbs;
b0.prototype.compareTo = bnCompareTo;
b0.prototype.bitLength = bnBitLength;
b0.prototype.mod = bnMod;
b0.prototype.modPowInt = bnModPowInt;
b0.ZERO = nbv(0);
b0.ONE = nbv(1);

function a0() {
    this.i = 0;
    this.ap = 0;
    this.S = new Array()
}
a0.prototype.init = function(d) {
    var c, b, a;
    for (c = 0; c < 256; ++c) {
        this.S[c] = c
    }
    b = 0;
    for (c = 0; c < 256; ++c) {
        b = (b + this.S[c] + d[c % d.length]) & 255;
        a = this.S[c];
        this.S[c] = this.S[b];
        this.S[b] = a
    }
    this.i = 0;
    this.ap = 0
};
a0.prototype.next = function() {
    var a;
    this.i = (this.i + 1) & 255;
    this.ap = (this.ap + this.S[this.i]) & 255;
    a = this.S[this.i];
    this.S[this.i] = this.S[this.ap];
    this.S[this.ap] = a;
    return this.S[(a + this.S[this.i]) & 255]
};

function prng_newstate() {
    return new a0()
}
var rng_psize = 256;
var rng_state;
var rng_pool;
var rng_pptr;

function rng_seed_int(a) {
    rng_pool[rng_pptr++] ^= a & 255;
    rng_pool[rng_pptr++] ^= (a >> 8) & 255;
    rng_pool[rng_pptr++] ^= (a >> 16) & 255;
    rng_pool[rng_pptr++] ^= (a >> 24) & 255;
    if (rng_pptr >= rng_psize) {
        rng_pptr -= rng_psize
    }
}

function rng_seed_time() {
    rng_seed_int(new Date().getTime())
}
if (rng_pool == null) {
    rng_pool = new Array();
    rng_pptr = 0;
    var t;
    if (window.crypto && window.crypto.getRandomValues) {
        var ua = new Uint8Array(32);
        window.crypto.getRandomValues(ua);
        for (t = 0; t < 32; ++t) {
            rng_pool[rng_pptr++] = ua[t]
        }
    }
    if (navigator.appName == "Netscape" && navigator.appVersion < "5" && window.crypto) {
        var z = window.crypto.random(32);
        for (t = 0; t < z.length; ++t) {
            rng_pool[rng_pptr++] = z.charCodeAt(t) & 255
        }
    }
    while (rng_pptr < rng_psize) {
        t = Math.floor(65536 * Math.random());
        rng_pool[rng_pptr++] = t >>> 8;
        rng_pool[rng_pptr++] = t & 255
    }
    rng_pptr = 0;
    rng_seed_time()
}

function rng_get_byte() {
    if (rng_state == null) {
        rng_seed_time();
        rng_state = prng_newstate();
        rng_state.init(rng_pool);
        for (rng_pptr = 0; rng_pptr < rng_pool.length; ++rng_pptr) {
            rng_pool[rng_pptr] = 0
        }
        rng_pptr = 0
    }
    return rng_state.next()
}

function rng_get_bytes(b) {
    var a;
    for (a = 0; a < b.length; ++a) {
        b[a] = rng_get_byte()
    }
}

function SecureRandom() {}
SecureRandom.prototype.nextBytes = rng_get_bytes;

function parseBigInt(b, a) {
    return new b0(b, a)
}

function linebrk(c, d) {
    var a = "";
    var b = 0;
    while (b + d < c.length) {
        a += c.substring(b, b + d) + "\n";
        b += d
    }
    return a + c.substring(b, c.length)
}

function byte2Hex(a) {
    if (a < 16) {
        return "0" + a.toString(16)
    } else {
        return a.toString(16)
    }
}

function pkcs1pad2(e, j) {
    if (j < e.length + 11) {
        alert("Message too long for RSA");
        return null
    }
    var g = new Array();
    var d = e.length - 1;
    while (d >= 0 && j > 0) {
        var f = e.charCodeAt(d--);
        if (f < 128) {
            g[--j] = f
        } else {
            if ((f > 127) && (f < 2048)) {
                g[--j] = (f & 63) | 128;
                g[--j] = (f >> 6) | 192
            } else {
                g[--j] = (f & 63) | 128;
                g[--j] = ((f >> 6) & 63) | 128;
                g[--j] = (f >> 12) | 224
            }
        }
    }
    g[--j] = 0;
    var b = new SecureRandom();
    var a = new Array();
    while (j > 2) {
        a[0] = 0;
        while (a[0] == 0) {
            b.nextBytes(a)
        }
        g[--j] = a[0]
    }
    g[--j] = 2;
    g[--j] = 0;
    return new b0(g)
}

function RSAKey() {
    this.n = null;
    this.e = 0;
    this.d = null;
    this.p = null;
    this.q = null;
    this.dmp1 = null;
    this.dmq1 = null;
    this.coeff = null
}
RSAKey.prototype = {
    doPublic: function(a) {
        return a.modPowInt(this.e, this.n)
    },
    setPublic: function(b, a) {
        if (b != null && a != null && b.length > 0 && a.length > 0) {
            this.n = parseBigInt(b, 16);
            this.e = parseInt(a, 16)
        } else {
            Mc.log("Invalid RSA public key")
        }
    },
    encrypt: function(d) {
        var a = pkcs1pad2(d, (this.n.bitLength() + 7) >> 3);
        if (a == null) {
            return null
        }
        var e = this.doPublic(a);
        if (e == null) {
            return null
        }
        var b = e.toString(16);
        if ((b.length & 1) == 0) {
            return b
        } else {
            return "0" + b
        }
    },
    encrypt_b64: function(b) {
        var a = this.encrypt(b);
        if (a) {
            return hex2b64(a)
        } else {
            return null
        }
    }
};
var Base64 = {
    base64: "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=",
    encode: function(b) {
        if (!b) {
            return false
        }
        var d = "";
        var j, f, c;
        var i, g, e, a;
        var k = 0;
        do {
            j = b.charCodeAt(k++);
            f = b.charCodeAt(k++);
            c = b.charCodeAt(k++);
            i = j >> 2;
            g = ((j & 3) << 4) | (f >> 4);
            e = ((f & 15) << 2) | (c >> 6);
            a = c & 63;
            if (isNaN(f)) {
                e = a = 64
            } else {
                if (isNaN(c)) {
                    a = 64
                }
            }
            d += this.base64.charAt(i) + this.base64.charAt(g) + this.base64.charAt(e) + this.base64.charAt(a)
        } while (k < b.length);
        return d
    },
    decode: function(g) {
        if (!g) {
            return false
        }
        g = g.replace(/[^A-Za-z0-9\+\/\=]/g, "");
        var d = "";
        var e, c, b, a;
        var f = 0;
        do {
            e = this.base64.indexOf(g.charAt(f++));
            c = this.base64.indexOf(g.charAt(f++));
            b = this.base64.indexOf(g.charAt(f++));
            a = this.base64.indexOf(g.charAt(f++));
            d += String.fromCharCode((e << 2) | (c >> 4));
            if (b != 64) {
                d += String.fromCharCode(((c & 15) << 4) | (b >> 2))
            }
            if (a != 64) {
                d += String.fromCharCode(((b & 3) << 6) | a)
            }
        } while (f < g.length);
        return d
    }
};
var Hex = {
    dE: "0123456789abcdef",
    encode: function(d) {
        if (!d) {
            return false
        }
        var a = "";
        var b;
        var c = 0;
        do {
            b = d.charCodeAt(c++);
            a += this.dE.charAt((b >> 4) & 15) + this.dE.charAt(b & 15)
        } while (c < d.length);
        return a
    },
    decode: function(c) {
        if (!c) {
            return false
        }
        c = c.replace(/[^0-9abcdef]/g, "");
        var a = "";
        var b = 0;
        do {
            a += String.fromCharCode(((this.dE.indexOf(c.charAt(b++)) << 4) & 240) | (this.dE.indexOf(c.charAt(b++)) & 15))
        } while (b < c.length);
        return a
    }
};
var ASN1Data = function(a) {
    this.error = false;
    this.parse = function(d) {
        if (!d) {
            this.error = true;
            return null
        }
        var c = [];
        while (d.length > 0) {
            var b = d.charCodeAt(0);
            d = d.substr(1);
            var g = 0;
            if ((b & 31) == 5) {
                d = d.substr(1)
            } else {
                if (d.charCodeAt(0) & 128) {
                    var f = d.charCodeAt(0) & 127;
                    d = d.substr(1);
                    if (f > 0) {
                        g = d.charCodeAt(0)
                    }
                    if (f > 1) {
                        g = ((g << 8) | d.charCodeAt(1))
                    }
                    if (f > 2) {
                        this.error = true;
                        return null
                    }
                    d = d.substr(f)
                } else {
                    g = d.charCodeAt(0);
                    d = d.substr(1)
                }
            }
            var e = "";
            if (g) {
                if (g > d.length) {
                    this.error = true;
                    return null
                }
                e = d.substr(0, g);
                d = d.substr(g)
            }
            if (b & 32) {
                c.push(this.parse(e))
            } else {
                c.push(this.value((b & 128) ? 4 : (b & 31), e))
            }
        }
        return c
    };
    this.value = function(f, e) {
        if (f == 1) {
            return e ? true : false
        } else {
            if (f == 2) {
                return e
            } else {
                if (f == 3) {
                    return this.parse(e.substr(1))
                } else {
                    if (f == 5) {
                        return null
                    } else {
                        if (f == 6) {
                            var c = [];
                            var l = e.charCodeAt(0);
                            c.push(Math.floor(l / 40));
                            c.push(l - c[0] * 40);
                            var g = [];
                            var i = 0;
                            var k;
                            for (k = 1; k < e.length; k++) {
                                var d = e.charCodeAt(k);
                                g.push(d & 127);
                                if (d & 128) {
                                    i++
                                } else {
                                    var j;
                                    var b = 0;
                                    for (j = 0; j < g.length; j++) {
                                        b += g[j] * Math.pow(128, i--)
                                    }
                                    c.push(b);
                                    i = 0;
                                    g = []
                                }
                            }
                            return c.join(".")
                        }
                    }
                }
            }
        }
        return null
    };
    this.data = this.parse(a)
};
var RSAPublicKey = function(b, a) {
    this.modulus = Hex.encode(b);
    this.encryptionExponent = Hex.encode(a)
};
var getPublicKey = function(a) {
    if (a.length < 50) {
        return false
    }
    if (a.substr(0, 26) != "-----BEGIN PUBLIC KEY-----") {
        return false
    }
    a = a.substr(26);
    if (a.substr(a.length - 24) != "-----END PUBLIC KEY-----") {
        return false
    }
    a = a.substr(0, a.length - 24);
    a = new ASN1Data(Base64.decode(a));
    if (a.error) {
        return false
    }
    a = a.data;
    if (a[0][0][0] == "1.2.840.113549.1.1.1") {
        return new RSAPublicKey(a[0][1][0][0], a[0][1][0][1])
    }
    return false
};

// 기존 함수 호환용
function npPfsStartup(form, firewall, securekey, fds, keypad, e2eattr, e2eval) {
    npPfsStartupV2(form, [firewall, securekey, fds, keypad], e2eattr, e2eval);
}

var startupParameters = null;

function npPfsStartupV2(form, flags, e2eattr, e2eval) {
    var flags = flags || [];
    var firewall = false;
    var securekey = false;
    var fds = false;
    var keypad = false;
    var submit = false;
    var device = false;
    var pinauth = false;
    for (var i = 0; i < flags.length; i++) {
        switch (i) {
            case 0:
                firewall = flags[i];
                break;
            case 1:
                securekey = flags[i];
                break;
            case 2:
                fds = flags[i];
                break;
            case 3:
                keypad = flags[i];
                break;
            case 4:
                submit = flags[i];
                break;
            case 5:
                device = flags[i];
                break;
            case 6:
                pinauth = flags[i];
                break;
        }
    }

    var options = {
        Firewall: firewall,
        SecureKey: securekey,
        Fds: fds,
        Keypad: keypad,
        Submit: submit,
        Device: device,
        PinAuth: pinauth,
        AutoStartup: true,
        Debug: false,
        Form: !!!form ? null : form,
        AutoScanAttrName: e2eattr || "npkencrypt",
        //		AutoScanAttrName : e2eattr || "enc",
        AutoScanAttrValue: e2eval || "on",
        MoveToInstall: function(url, isUpdate, useLayer, callback) {
            callback = callback || function() {};
            var obj = typeof npMessage != "undefined" ? npMessage : window.N;
            var message = isUpdate ? obj.m96 : obj.m95;
            if (url !== null && url !== "") {
                if (useLayer) {
                    startupParameters = {
                        form: form,
                        flags: flags,
                        e2eattr: e2eattr,
                        e2eval: e2eval
                    };
                    url = url + "?redirect=" + encodeURIComponent(location.href);
                    npPfsCtrl.showInstallLayer(url);
                    return;
                }

                if (confirm(message)) {
                    callback(false);
                    var postback = document.getElementById("nppfs-postback");
                    if (!!postback && postback.tagName.toLowerCase() == "form") {
                        postback.action = url;
                        postback.submit();
                        return;
                    }

                    url = url + "?redirect=" + encodeURIComponent(location.href);
                    var a = document.createElement("a");
                    if (a.click) {
                        a.setAttribute("href", url);
                        a.style.display = "none";
                        document.body.appendChild(a);
                        a.click();
                        return;
                    }

                    location.href = url;
                    //location.replace(url);
                } else {
                    callback(true);
                    //					npPfsCtrl.setCookie("npPfsIgnore", "true");
                }
            } else {
                callback(true);
                alert((typeof(npMessage) != "undefined") ? npMessage.m97 : N.m97);
            }
        },
        Loading: {
            Default: true,
            Before: function() {
                //alert("작업시작 전에 사용자 로딩함수를 여기에 구현합니다.");
            },
            After: function() {
                //alert("작업시작 후에 사용자 로딩함수를 여기에 구현합니다.");
            }
        }

    };

    //npPfsCtrl.setCookie("npPfsIgnore", "");
    //	if("true" !== npPfsCtrl.getCookie("npPfsIgnore")) {
    //		npPfsCtrl.setCookie("npPfsIgnore", "");
    npPfsCtrl.launch(options);
    //	}

    /*
    	npPfsCtrl.isInstall({
    		success:function() {
    			options.Loading.Default = false;
    			npPfsCtrl.launch(options);
    		},
    		fail : function() {
    			options.Loading.Default = true;
    			npPfsCtrl.launch(options);
    		}
    	});
    */
}

/*
w.uV.dV.Gf = "/pluginfree/jsp/nppfs.key.jsp";    // 키발급 경로
w.uV.dV.zf = "/pluginfree/jsp/nppfs.remove.jsp"; // 키삭제 경로
w.uV.dV.zo = "/pluginfree/jsp/nppfs.keypad.jsp;  // 마우스입력기 페이지
w.uV.dV.eP = "/pluginfree/jsp/nppfs.ready.jsp";  // 초기화상태 확인경로 
w.uV.dV.Fz = "/pluginfree/jsp/nppfs.install.jsp; // 설치안내 페이지
w.uV.dV.de = "/pluginfree/jsp/nppfs.session.jsp; // 세션유지 페이지
w.uV.dV.iB = "/pluginfree/jsp/nppfs.submit.jsp; // 구간암호화 페이지
 */

/*
function checkInstallKeyCryptPlugin(){
	if(typeof(bh) == "undefined") {
		return false;
	}
	if(typeof(D) != "undefined" && D.virtualMachine == true){
		return false;
	}
	return true;
}

npPfsCtrl.SetGlobalKeyValidation(function(keyCode, element) {
	//console.log("global key validataion");
	// true : do process biz logic, false : stop event
	if(keyCode >= 48 && keyCode <=57) return false;
	return true;
});


npPfsCtrl.makeJson = function(original, formname, keyName){
	var ret = original;

	if(typeof(ret) == "undefined" || ret == null) ret = {};
	if(typeof(keyName) == "undefined" || keyName == null || keyName == "") keyName = "__nppfs_json_vo__";
	
	ret[keyName] = npPfsCtrl.toJson(formname);
	
	return original;
}
*/


/*
 * ----- NOS 확장기능 스크립트 -----
 *  npPfsStartup() 함수 호출 전 선언되야 함
 * ------------------------------
 * 1. 키 유효성체크
 * 2. 페이지 벗어남 경고
 * 3. 키보드보안 초기화 전 추가 옵션적용
 * 4. 마우스입력기 초기화 전 추가 옵션적용
 * 5. 단말정보수집 추가정보 데이터 반환
 */
/*
npPfsExtension = new function() {
	// 입력양식의 키 유효성 체크
	this.keyValidation = function(element, keyCode) {
		// 0 = 48, 9 = 57, a = 97, z = 122, A = 65, Z = 90
		var key = parseInt("" + keyCode);
		if(key < 48 || key > 57) {
			return false;
		}
		
		return true;			// true : 입력가능문자, false : 정합성불가/입력불가문자
	},
	// 페이지 벗어나기 전의 경고메시지 추가
	this.beforeFinalize = function(event) {
		if(false) {
			event = (event || window.event);
			var m = '작업이 아직 진행중에 있습니다. 저장하지 않은 채로 다른 페이지로 이동하시겠습니까?';  // a space
			(event || window.event).returnValue = m;
			return m;
		}
		return null;
	},
	// 키보드보안 초기화 전 추가 옵션적용
	this.secureKeyUiModifier = function(element) {
		var attr = jQuery(element).attr("enc");
		if(typeof(attr) == "undefined" || attr == "") {
			jQuery(element).attr({"enc" : "off"});
		}
	},
	// 마우스입력기 초기화 전 추가 옵션적용
	this.keypadUiModifier = function(element) {
		
	},
	// 단말정보수집 추가정보 데이터 반환
	this.additionalData = function() {
		return "";
	}
};

// 필드 색상 변경
npPfsCtrl.setColor({
	TextColor : "", 			// 키보드보안 글자 색상
	FieldBgColor : "", 			// 키보드보안 배경 색상
	ReTextColor : "", 			// 키보드보안 치환 글자 색상
	ReFieldBgColor : "", 		// 키보드보안 치환 배경 색상
	OnTextColor : "#FF0000", 	// 마우스입력기 포커스 글자 색상
	OnFieldBgColor : "#0100FF", // 마우스입력기 포커스 배경 색상
	OffTextColor : "#1DDB16", 	// 마우스입력기 글자 색상
	OffFieldBgColor : "#FF007F" // 마우스입력기 배경 색상
});



jQuery(document).on("nppfs-npv-enabled", function(event){
	console.log(event.message);
});
jQuery(document).on("nppfs-npv-disabled", function(event){
	console.log(event.message);
});

jQuery(document).on("nppfs-npv-before-show", function(event){
	console.log(event.message);
});

jQuery(document).on("nppfs-npv-after-show", function(event){
	console.log(event.message);
});

jQuery(document).on("nppfs-npv-after-hide", function(event){
	console.log(event.message);
});

$(document).ready(function(){
	$(document).bind("nppfs-npk-focusin nppfs-npk-focusout", function(e){
		var element = e.target;
		var type = $(element).attr("data-format");
		if(type == "num") {
		}
		console.log(e.type + " : " + element.name);
		switch(e.type) {
			case "nppfs-npk-focusin" :
				break;
			case "nppfs-npk-focusout" :
			break;
		}
	});
});
*/