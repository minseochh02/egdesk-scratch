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
    Qd: "20220307042352888",
    x5: "f3b18678a74855043e436acacb3d02a743fc37b4f01dddfa2d55d0c4d0ca1c50"
};
w.uV = {
    dV: {
        Fz: "/pluginfree/jsp/nppfs.install.jsp",
        Gf: "/pluginfree/jsp/nppfs.key.jsp",
        zf: "/pluginfree/jsp/nppfs.remove.jsp",
        eP: "/pluginfree/jsp/nppfs.ready.jsp",
        zo: "/pluginfree/jsp/nppfs.keypad.jsp",
        KeyPadJsonUrl: "",
        CryptoUrl: "/pluginfree/jsp/nppfs.crypto.jsp",
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
        FW: false,
        SK: true,
        FD: true,
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
    this.edge = f("Mozilla") === 0 && (a("Edge/") || a("Edg/"));
    this.ff = a("Firefox") && f("Mozilla") === 0 && e == "Netscape" && !a("Navigator");
    this.ns = a("Gecko") && a("Navigator");
    this.b360 = a("360Browser") && a("Chrome") && a("Safari");
    this.qq = a("QQBrowser") && a("Trident");
    this.sf = a("Safari") && !a("Chrome");
    this.op = a("Opera") || a("OPR/");
    this.cr = a("Chrome") && a("Safari") && !a("OPR/") && !a("360Browser") && !a("Edg/") && !a("Edge/");
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
        var n;
        var m = nua;
        if (D.ff) {
            g = m.substring(m.toLowerCase().lastIndexOf("firefox"));
            if (g.indexOf(" ") > -1) {
                g = g.substring(0, g.indexOf(" "))
            }
            n = g.split("/");
            return n[1]
        } else {
            if (D.op) {
                if (m.indexOf("OPR/") > -1) {
                    g = m.split("OPR/")[1]
                } else {
                    if (m.indexOf("Opera") > -1) {
                        g = m.split("Opera/")[1]
                    }
                }
                if (g.indexOf(" ") > -1) {
                    n = g.split(" ");
                    return n[0]
                } else {
                    return g
                }
            } else {
                if (D.cr || D.b360) {
                    g = m.substring(m.toLowerCase().lastIndexOf("chrome"));
                    if (g.indexOf(" ") != -1) {
                        g = g.substring(0, g.indexOf(" "));
                        n = g.split("/");
                        return n[1]
                    }
                } else {
                    if (D.sf) {
                        var j = new RegExp(/Version[\/\s](\d+\.\d+)/.test(nua));
                        var o = RegExp["$1"];
                        return o
                    } else {
                        if (D.ie || D.qq) {
                            if (m.indexOf("MSIE") > -1) {
                                fw = m.substring(m.indexOf("MSIE") + 4, m.length);
                                fw = fw.replace(/(^\s*)|(\s*$)/gi, "");
                                n = fw.split(";");
                                n = n[0].split(" ");
                                return n[0]
                            } else {
                                return m.substring(m.indexOf("rv:") + 3, m.indexOf("rv:") + 7)
                            }
                        } else {
                            if (D.edge) {
                                var k = m.lastIndexOf("Edge/");
                                var i = m.lastIndexOf("Edg/");
                                var l = k >= 0 ? k : i;
                                g = m.substring(l);
                                if (g.indexOf(" ") != -1) {
                                    g = g.substring(0, g.indexOf(" "));
                                    n = g.split("/");
                                    return n[1]
                                } else {
                                    n = g.split("/");
                                    return n[1]
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
            L.alert("제품 식별 고유코드가 필요합니다.");
            return
        }
        if (L.bn(c.controller)) {
            L.alert("제품 제어 스크립트 객체가 필요합니다.");
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
    d3: "b6037193533b1406c991ce3d27bdb675b8e31840f4f58e291a7f606bacafff39",
    x2: "ff151fa9a8c61c7c99e1c670b68d032ed1fdbdade37c9bfe494f6dc3040cf380",
    h4: "e976344b1975d3b7a1b7823482d42dd23a72000ef51b0a2f9011ebff24274c72",
    x5: "f3b18678a74855043e436acacb3d02a743fc37b4f01dddfa2d55d0c4d0ca1c50",
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
    h6: "03b6f7b756387e86b13e9abc0036b199365475e676f364af571b1042d9f5c740",
    j0: "5202618e44557969d635e3a48b9b1aec82ecc81ecb6ddfeb0f4ba0c250285c75",
    d8: "84a419e906bf0e2abad3862537d7baa05e0750e7a0c72ad67bf8fd4d34feda0b",
    am: "ba88ee1b143a42101c9606aa7d483a8510ce91a1afed9e9e92d950c85848b3df",
    dG: "df3825c23762842581fbe668806d9e3afd17a987495356755614d48934cfa0ca",
    CMD_GET_OS_VERSION: "94bc084160e05e4ff7b249604edd780985551f87c015291a362df3eb08f3dd42",
    CMD_DISABLE_USER_PORXY: "29e3c05df8e1734ccf95316279b866c3a24161006eb9aead52c9ac7bb56ec7ef",
    CMD_IGNORE_PORXY: "929878ced6ae9be97b1f3395e70cf428d80f4d8d55d1432ce0e1b1c0d08f64fa",
    CMD_DISABLE_PORXY: "6f0f1d30da23d213da9df96a8e5f6a78f516fba037763980cdc3266937f38602"
};
w.nq = (typeof(nosQuery) != "undefined") ? nosQuery : jQuery;
w.L = new function() {
    function j(l, m) {
        if (l === undefined) {
            l = 1
        } else {
            if (m === undefined) {
                m = "0"
            }
        }
        var n = "";
        while (n.length < l) {
            n += m
        }
        this.bY = function(o) {
            var p = o.toString();
            return n.substring(0, n.length - p.length) + p
        }
    }
    this.au = function(l) {
        if (typeof(l) == "undefined" || l == null) {
            return true
        }
        return false
    };
    this.bn = function(l) {
        if (typeof(l) == "undefined" || l == null || l == "") {
            return true
        }
        return false
    };
    this.n2b = function(m, l) {
        if (this.au(l)) {
            l = ""
        }
        if (this.au(m)) {
            return l
        }
        return m
    };
    this.selectorByName = function(m, l) {
        if (!L.bn(m) && m.indexOf(":") >= 0) {
            if (typeof(l) != "undefined") {
                return nq(document.getElementsByName(m)[0], l)
            } else {
                return nq(document.getElementsByName(m)[0])
            }
        } else {
            if (typeof(l) != "undefined") {
                return nq("[name='" + m + "']", l)
            } else {
                return nq("[name='" + m + "']")
            }
        }
    };
    this.selectorById = function(m, l) {
        if (!L.bn(m) && m.indexOf(":") >= 0) {
            if (typeof(l) != "undefined") {
                return nq(document.getElementById(m), l)
            } else {
                return nq(document.getElementById(m))
            }
        } else {
            if (typeof(l) != "undefined") {
                return nq("#" + m, l)
            } else {
                return nq("#" + m)
            }
        }
    };
    this.dispatchEvent = function(m, p, o, r, u) {
        var l;
        var v = L.bj(o);
        try {
            l = new Event(p, {
                bubbles: r,
                cancelable: u
            })
        } catch (q) {
            l = document.createEvent("HTMLEvents");
            l.initEvent(p, r, u)
        }
        for (var n = 0; n < v.length; n++) {
            var s = v[n];
            l[s] = o[s]
        }
        m.dispatchEvent(l)
    };
    this.eraseSpecialChars = function(n) {
        var l = /[\{\}\[\]\/?.,;:|\)*~`!^\-+<>@#$%&\\\=\(\'\"]/gi;
        if (l.test(n)) {
            var m = n.replace(l, "");
            n = m
        }
        return n
    };
    this.gv = function() {
        var l = new j(15);
        var m = Math.floor(Math.random() * 99) + 1;
        if (m < 10) {
            m = m + 10
        }
        return l.bY((new Date().getTime()).toString() + m)
    };
    this.cC = function(n) {
        if (this.au(n)) {
            n = ""
        }
        var m = n.length;
        var l = new j(4);
        return l.bY((m).toString(16))
    };
    this.sz = function(m, l) {
        return (typeof(l) != "undefined" && l == true) ? escape(encodeURIComponent(m)) : encodeURIComponent(m)
    }, this.bj = function(n) {
        var m = [];
        for (var l in n) {
            if (typeof nexacro == "object" && nexacro._bInitPlatform) {
                if (l == "getSetter" || l == "getNumSetter") {
                    continue
                }
            }
            m.push(l)
        }
        return m
    };
    this.jC = function(l) {
        this.bj(l).length
    };
    this.hH = function(m) {
        var l = "";
        if (!m) {
            return
        }
        for (var n = 0; n < m.length; n++) {
            l += ((m[n] < 16) ? "0" : "") + m[n].toString(16)
        }
        return l
    };
    this.ha = function(n, p) {
        if (L.bn(n)) {
            return ""
        }
        var m = "";
        if (n.indexOf("0x") == 0 || n.indexOf("0X") == 0) {
            n = n.substr(2)
        }
        if (n.length % 2) {
            n += "0"
        }
        var o = [];
        for (var l = 0; l < n.length; l += 2) {
            o.push(parseInt(n.slice(l, l + 2), 16))
        }
        if (p == "UTF8") {
            return d(o)
        } else {
            for (l = 0; l < o.length; l++) {
                m += String.fromCharCode(o[l])
            }
        }
        return m
    };

    function d(r) {
        var o, n;
        var l = "";
        var p = r.length;
        var m = 0;
        while (m < p) {
            var q = r[m++];
            switch (q >> 4) {
                case 0:
                case 1:
                case 2:
                case 3:
                case 4:
                case 5:
                case 6:
                case 7:
                    l += String.fromCharCode(q);
                    break;
                case 12:
                case 13:
                    o = r[m++];
                    l += String.fromCharCode(((q & 31) << 6) | (o & 63));
                    break;
                case 14:
                    o = r[m++];
                    n = r[m++];
                    l += String.fromCharCode(((q & 15) << 12) | ((o & 63) << 6) | ((n & 63) << 0));
                    break
            }
        }
        return l
    }
    this.comma = function(l) {
        l = String(l);
        return l.replace(/(\d)(?=(?:\d{3})+(?!\d))/g, "$1,")
    };
    this.uncomma = function(l) {
        l = String(l);
        return l.replace(/[^\d]+/g, "")
    };
    this.arrayIn = function(n, m) {
        for (var l = 0; l < n.length; l++) {
            if (n[l] === m) {
                return true
            }
        }
        return false
    };
    this.indexOf = function(n, m) {
        for (var l = 0; l < n.length; l++) {
            if (n[l] === m) {
                return l
            }
        }
        return -1
    };
    this.arrayNotIn = function(n, m) {
        for (var l = 0; l < n.length; l++) {
            if (n[l] === m) {
                return false
            }
        }
        return true
    };
    this.mL = function(n) {
        var m;
        var l = new Array();
        for (m = 0; m < n; m++) {
            l[m] = Math.round(Math.random() * 255)
        }
        return l
    };
    this.wm = function(n, o) {
        var l = AES.eU / 8;
        var m;
        if (typeof n == "string" || n.indexOf) {
            n = n.split("");
            for (m = 0; m < n.length; m++) {
                n[m] = n[m].charCodeAt(0) & 255
            }
        }
        for (m = l - (n.length % l); m > 0 && m < l; m--) {
            n[n.length] = 0
        }
        return n
    };
    this.getBytes = function(p) {
        var o;
        var l = [];
        if (typeof p == "string" || p.indexOf) {
            var m = [];
            var q = p;
            for (var o = 0; o < q.length; o++) {
                var n = q.charCodeAt(o);
                if (n < 128) {
                    m.push(n)
                } else {
                    if (n < 2048) {
                        m.push(192 | (n >> 6), 128 | (n & 63))
                    } else {
                        if (n < 55296 || n >= 57344) {
                            m.push(224 | (n >> 12), 128 | ((n >> 6) & 63), 128 | (n & 63))
                        } else {
                            o++;
                            n = 65536 + (((n & 1023) << 10) | (q.charCodeAt(o) & 1023));
                            m.push(240 | (n >> 18), 128 | ((n >> 12) & 63), 128 | ((n >> 6) & 63), 128 | (n & 63))
                        }
                    }
                }
            }
            return m
        }
        return l
    };
    this.encrypt = function(l, v, r, q) {
        AES.eU = L.au(q) ? 128 : q;
        AES.gl = L.au(v) ? 256 : v.length * 8;
        var o = AES.eU / 8;
        var p, u;
        var s;
        if (!l || !v) {
            return
        }
        if (v.length * 8 != AES.gl) {
            return
        }
        if (r == "CBC") {
            s = this.mL(o)
        } else {
            r = "ECB";
            s = new Array()
        }
        l = this.wm(l);
        var m = new AES.F(v);
        for (var n = 0; n < l.length / o; n++) {
            u = l.slice(n * o, (n + 1) * o);
            if (r == "CBC") {
                for (var p = 0; p < o; p++) {
                    u[p] ^= s[n * o + p]
                }
            }
            s = s.concat(AES.J(u, m))
        }
        return L.hH(s)
    };
    this.gu = function(y, v, s, r, m, q) {
        AES.eU = L.au(r) ? 128 : r;
        AES.gl = L.au(v) ? 256 : v.length * 8;
        var o = AES.eU / 8;
        var A = new Array();
        var u;
        var n;
        if (!y || !v) {
            return
        }
        if (typeof(y) == "string") {
            y = y.split("");
            for (p = 0; p < y.length; p++) {
                y[p] = y[p].charCodeAt(0) & 255
            }
        }
        if (v.length * 8 != AES.gl) {
            return
        }
        if (!s) {
            s = "ECB"
        }
        var l = new AES.gU(v);
        for (n = (y.length / o) - 1; n > 0; n--) {
            u = AES.er(y.slice(n * o, (n + 1) * o), l);
            if (s == "CBC") {
                for (var p = 0; p < o; p++) {
                    A[(n - 1) * o + p] = u[p] ^ y[(n - 1) * o + p]
                }
            } else {
                A = u.concat(A)
            }
        }
        if (s == "ECB") {
            A = AES.er(y.slice(0, o), l).concat(A)
        }
        var x = A[A.length - 1];
        while (typeof(x) == "undefined" || x == null || x == 0) {
            A.pop();
            x = A[A.length - 1]
        }
        return (q == "array") ? A : L.ha(L.hH(A), m)
    };
    this.send = function(m, u, p) {
        var B = "";
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.ajax) == "function") {
            var v = m.split("?")[1];
            var s = v.split("=");
            var n = u.split("&");
            var A = {};
            for (var r = 0; r < n.length; r++) {
                var q = n[r].split("=");
                var l = q[0];
                var y = q[1];
                A[l] = y
            }
            A[s[0]] = s[1];
            npPfsExtension.ajax(A, function(o) {
                if (o.code == "1000") {
                    B = o.data;
                    p.ax({
                        readyState: 4,
                        status: 200,
                        responseText: o.data
                    })
                } else {
                    p.ax({
                        readyState: 4,
                        status: 999,
                        responseText: ""
                    })
                }
            }, m)
        } else {
            if (this.au(p)) {
                p = {}
            }
            if (this.au(p.async)) {
                p.async = false
            }
            if (this.au(p.timeout) || p.timeout <= 0) {
                p.timeout = 3000
            }
            if (this.au(p.ax)) {
                p.ax = function(C) {
                    var o = "";
                    if (C.readyState == 4) {
                        if (C.status == 200) {
                            o = C.responseText
                        } else {}
                    } else {}
                    return o
                }
            }
            Mc.log("REQ : " + u);
            try {
                nq.ajax({
                    url: m,
                    cache: false,
                    async: p.async,
                    type: "post",
                    global: false,
                    data: u,
                    error: function(E, C, o) {
                        return p.ax(E)
                    },
                    success: function(C, o, E) {
                        B = C;
                        return p.ax(E)
                    }
                })
            } catch (x) {
                p.ax({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                });
                Mc.error("ERR : " + x)
            }
        }
        return B
    };
    this.jI = {};
    var c = false;
    var f = 0;
    this.fs = function(n, m, l) {
        if (L.au(m)) {
            m = {}
        }
        if (L.au(m.async)) {
            m.async = true
        }
        if (L.au(m.host)) {
            m.host = zp.c6
        }
        if (L.au(m.port)) {
            m.port = zp.cB
        }
        if (L.au(m.direct)) {
            m.direct = false
        }
        if (L.au(m.ax)) {
            m.ax = function(o) {}
        }
        var l = !L.au(l) ? l : function(q) {
            var o = "";
            if (q.readyState == 4) {
                if (q.status == 200 || q.status == 999) {
                    try {
                        o = q.responseText;
                        Mc.log("RES : " + q.responseText);
                        m.ax(q.responseText)
                    } catch (p) {}
                } else {}
            } else {}
            return o
        };
        if(D.isSupportWebSocket && zp.handshakeMode == 2) {
           return this.sendWebSocketCommand(n, l, m);
        } else 
        if (D.cO() || c) {
            return this.gb(n, l, m)
        } else {
            if (m.direct == true) {
                return this.sendDirectCommand(n, l, m)
            } else {
                if (m.byiframe == true && (D.ie || D.qq)) {
                    return this.sendIFrameCommand(n, l, m)
                } else {
                    if (f > 20) {
                        return this.gj(n, l, m)
                    } else {
                        return this.gb(n, function(p) {
                            var o = "";
                            if (p.readyState == 4) {
                                if (p.status == 200) {
                                    c = true;
                                    l.call(null, p)
                                } else {
                                    f++;
                                    return L.gj(n, l, m)
                                }
                            } else {}
                            return o
                        }, m)
                    }
                }
            }
        }
    };
    var b = null;
    this.sendWebSocketCommand = function(r, l, p) {
        if (L.au(p.timeout)) {
            p.timeout = 3000
        }
        var v = null;
        var s = false;

        function q(o) {
            if (s == false) {
                l(o);
                s = true
            }
        }

        function m() {
            if (v != null) {
                clearTimeout(v);
                v = null
            }
        }
        var n = zp.makeWebSocketUrl(p.port, p.host);
        if (p.timeout > 0) {
            v = setTimeout(function() {
                if (v != null) {
                    q({
                        readyState: 4,
                        status: 999,
                        responseText: ""
                    })
                }
            }, p.timeout)
        }
        Mc.log("REQ : " + r);
        try {
            var x = new WebSocket(n);
            x.onopen = function(o) {
                x.send(r)
            };
            x.onclose = function(o) {};
            x.onerror = function(o) {
                x.close();
                if (v != null) {
                    m()
                }
                q({
                    readyState: 4,
                    status: 999,
                    responseText: "WebSocket Error."
                })
            };
            x.onmessage = function(o) {
                if (v != null) {
                    m()
                }
                q({
                    readyState: 4,
                    status: 200,
                    responseText: o.data
                });
                x.close()
            }
        } catch (u) {
            m();
            q({
                readyState: 4,
                status: 999,
                responseText: ""
            });
            Mc.error("ERR : " + u)
        }
    };
    this.gb = function(u, q, s) {
        if (L.au(s.timeout)) {
            s.timeout = 3000
        }
        var m = false;

        function n(o) {
            if (m == false) {
                q(o);
                m = true
            }
        }
        var l = zp.cZ(s.port, s.host);
        var p = null;
        if (s.timeout > 0) {
            p = setTimeout(function() {
                n({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                })
            }, s.timeout)
        }
        try {
            Mc.log("REQ : " + u);
            nq.ajax({
                url: l,
                cache: false,
                async: s.async,
                type: "post",
                global: false,
                data: u,
                error: function(x, v, o) {
                    n({
                        readyState: 4,
                        status: 999,
                        responseText: v + ":" + o
                    })
                },
                success: function(v, o, x) {
                    n(x)
                },
                complete: function(v, o) {
                    if (p != null) {
                        clearTimeout(p)
                    }
                }
            })
        } catch (r) {
            n({
                readyState: 4,
                status: 999,
                responseText: ""
            });
            Mc.error("ERR : " + r)
        }
    };
    this.lock = false;
    this.commandQueue = [];
    this.executeQueue = function() {
        var l = L.commandQueue.shift();
        if (typeof(l) == "function") {
            l()
        }
    };
    this.gj = function(r, n, q) {
        if (L.au(q.timeout)) {
            q.timeout = 3000
        } else {
            if (q.timeout <= 0) {
                q.timeout = 60 * 1000
            }
        }
        if (L.lock == true) {
            if (L.commandQueue.length > 0) {
                L.executeQueue()
            }
            L.commandQueue.push(function() {
                L.gj(r, n, q)
            })
        } else {
            L.lock = true;
            var l = zp.cZ(q.port, q.host);
            var m = setTimeout(function() {
                n({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                });
                try {
                    L.lock = false;
                    L.executeQueue()
                } catch (o) {}
            }, q.timeout);
            Mc.log("REQ : " + r);
            try {
                nq.ajax({
                    url: l,
                    cache: false,
                    crossDomain: true,
                    async: false,
                    type: "GET",
                    global: false,
                    dataType: "jsonp",
                    jsonp: "jsonp_callback",
                    contentType: "application/javascript",
                    timeout: q.timeout,
                    data: {
                        Code: r
                    },
                    error: function(u, s, o) {
                        if (s == "abort" || s == "timeout" || s == "parsererror" || s == "error") {
                            n({
                                readyState: 4,
                                status: 999,
                                responseText: s + ":" + o
                            })
                        }
                    },
                    success: function(s, o, u) {
                        if (s != null && s.RESULT != null) {
                            n({
                                readyState: 4,
                                status: 200,
                                responseText: s.RESULT
                            })
                        }
                    },
                    complete: function(u, o) {
                        clearTimeout(m);
                        try {
                            L.lock = false;
                            L.executeQueue()
                        } catch (s) {}
                    }
                })
            } catch (p) {
                n({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                });
                Mc.error("ERR : " + p);
                L.lock = false;
                L.executeQueue()
            }
        }
    };
    this.sendDirectCommand = function(r, n, q) {
        var l = zp.cZ(q.port, q.host);
        if (L.au(q.timeout)) {
            q.timeout = 3000
        } else {
            if (q.timeout <= 0) {
                q.timeout = 60 * 1000
            }
        }
        var m = setTimeout(function() {
            n({
                readyState: 4,
                status: 999,
                responseText: ""
            })
        }, q.timeout);
        Mc.log("REQ : " + r);
        try {
            nq.ajax({
                url: l,
                cache: false,
                crossDomain: true,
                async: false,
                type: "GET",
                global: false,
                dataType: "jsonp",
                jsonp: "jsonp_callback",
                contentType: "application/javascript",
                timeout: q.timeout,
                data: {
                    Code: r
                },
                error: function(u, s, o) {
                    if (s == "abort" || s == "timeout" || s == "parsererror" || s == "error") {
                        n({
                            readyState: 4,
                            status: 999,
                            responseText: s + ":" + o
                        })
                    }
                },
                success: function(s, o, u) {
                    if (s != null && s.RESULT != null) {
                        n({
                            readyState: 4,
                            status: 200,
                            responseText: s.RESULT
                        })
                    }
                },
                complete: function(s, o) {
                    clearTimeout(m)
                }
            })
        } catch (p) {
            clearTimeout(m);
            n({
                readyState: 4,
                status: 999,
                responseText: ""
            });
            Mc.error("ERR : " + p)
        }
    };
    var g = false;
    this.sendIFrameCommand = function(s, n, r) {
        var m = zp.cZ(r.port, r.host);
        m += "?ifrm=" + s;
        var l = zp.cZ(r.port, r.host);
        var q = document.getElementById("keep-alive-iframe");
        var p = nq("#keep-alive-iframe");
        if (p.length == 0) {
            q = document.createElement("iframe");
            q.id = "keep-alive-iframe";
            q.style.display = "none";
            nq("body").append(q);
            p = nq("#keep-alive-iframe");
            if (g == false) {
                g = true;
                if (!D.CB()) {
                    nq(window).on("message", function(o) {
                        try {
                            var u = o.origin || o.originalEvent.origin;
                            var x = o.data || o.originalEvent.data;
                            if (u === l) {
                                var v = nq.parseJSON(x);
                                if (v.caller == "nppfs-nos-response") {
                                    n({
                                        readyState: 4,
                                        status: 200,
                                        responseText: v.response
                                    })
                                }
                            }
                        } catch (y) {}
                    })
                }
            }
            p.on("load", function(o) {
                if (!D.CB()) {
                    q.contentWindow.postMessage("", l)
                }
                try {
                    n({
                        readyState: 4,
                        status: 200,
                        responseText: Ye.a4
                    })
                } catch (u) {}
            });
            p.on("error", function(o) {
                n({
                    readyState: 4,
                    status: 999,
                    responseText: ""
                })
            })
        }
        Mc.log("REQ : " + s);
        p.attr("src", m)
    };
    dW = {};
    this.iV = function(l, n) {
        var m = l;
        if (!L.bn(n)) {
            if (typeof(n) == "string") {
                m = l + "_" + n
            } else {
                if (typeof(n) == "object") {}
            }
        }
        if (dW[m]) {
            dW[m] = null
        }
    };
    this.bZ = function(l, p) {
        var o = null;
        var n = l;
        var q = null;
        if (!L.bn(p)) {
            if (typeof(p) == "string") {
                o = nq("form[name='" + p + "']").get(0)
            }
            if (typeof(p) == "object") {
                o = nq(p)
            }
            if (!L.au(o)) {
                o = this.findParentForm(o);
                p = nq(o).attr("name");
                n = l + "_" + nq(o).attr("name")
            }
        }
        if (typeof(l) === "string") {
            if (L.selectorById(l).get(0)) {
                q = L.selectorById(l).get(0)
            } else {
                var m = (o != null && o.length > 0) ? L.selectorByName(l, o) : L.selectorByName(l);
                q = (m != null && m.length > 0) ? m.get(0) : L.selectorById(l).get(0)
            }
        }
        if (typeof(l) === "object") {
            q = l
        }
        return q
    };
    this.n5 = function(l) {
        return document.createElement(l)
    };
    this.c1 = function(l, n, A) {
        if (this.au(l)) {
            return
        }
        var m = n;
        var p = A;
        if (!L.au(p)) {
            if (m.length != p.length) {
                L.alert(N.m44)
            }
        }
        var v = L.bZ(l);
        var y = L.xw(v, "byclass", "nppfs-elements");
        if (!D.CB()) {
            nq(y).hide()
        }
        var s = [];
        var q = false;
        for (var r = 0; r < m.length; r++) {
            var o = this.bZ(m[r], l);
            if (L.au(o)) {
                if (q == false) {
                    q = true
                }
                var x = m[r];
                var u = "";
                if (!L.au(p)) {
                    u = p[r]
                }
                if (uV.dV.dk == ad.fJ) {
                    s.push('<input type="hidden" name="' + x + '" value="' + u + '">')
                } else {
                    s.push(x + '<input type="text" name="' + x + '" value="' + u + '"><br />')
                }
            } else {
                if (!L.au(p)) {
                    nq(o).val(p[r])
                }
            }
        }
        if (q == true) {
            nq(y).append(s.join("\n"));
            if (uV.dV.dk == ad.jt && (!D.cr || D.bd < 49)) {
                nq(y).show()
            }
        }
    };
    this.copyDivision = function(l, n) {
        var m = L.xw(l, "byclass", "nppfs-elements");
        var o = L.xw(n, "byclass", "nppfs-elements");
        if (!L.au(m) && !L.au(o)) {
            nq("input", nq(m)).each(function(q, p) {
                var r = p.name;
                var s = p.value;
                if (!L.au(n.elements[r])) {
                    n.elements[r].value = s
                } else {
                    if (uV.dV.dk == ad.fJ) {
                        nq(o).append('<input type="hidden" name="' + r + '" value="' + s + '" />')
                    } else {
                        nq(o).append(r + ' : <input type="text" name="' + r + '" value="' + s + '" />')
                    }
                }
            })
        }
    };
    this.tY = false;
    this.wT = function(n, m, l) {
        var o = L.n5("div");
        if (m == "byclass") {
            o.setAttribute("class", l)
        } else {
            n = document.body;
            o.setAttribute("id", l)
        }
        o.setAttribute("style", "display:none;");
        nq(n).prepend(o);
        return o
    };
    this.findParentForm = function(o) {
        var m = o;
        var l = nq(o).parents("form");
        if (l.length > 0) {
            var n = l.last();
            m = n.get(0)
        }
        return m
    };
    this.xw = function(n, m, l) {
        if (L.bn(l)) {
            return null
        }
        n = n || document;
        if (n.tagName && n.tagName.toLowerCase() === "form") {
            n = this.findParentForm(n)
        }
        var o = (m == "byid") ? nq("#" + l).get(0) : nq("div." + l, nq(n)).get(0);
        return o || this.wT(n, m, l)
    };
    this.so = function(l) {
        l.preventDefault ? l.preventDefault() : l.returnValue = false
    };
    this.eD = function(n) {
        var l = -1;
        try {
            var o = new Date();
            l = o - n;
            if (l > 100000) {
                l = 99999
            }
        } catch (m) {}
        return l + ""
    };
    this.gn = function(o) {
        var p = o.split(/ |,|\.|\_|\//g);
        var n = new Array();
        var m = 0;
        for (var l = 0; l < p.length; l++) {
            if (!L.bn(p[l])) {
                n[m] = p[l];
                m++
            }
        }
        if (n.length > 0) {
            return n
        }
        return null
    };
    this.db = function(p, l, r) {
        if (this.bn(p)) {
            return false
        }
        if (this.bn(l)) {
            return false
        }
        var o = this.gn("" + p);
        var n = o.length;
        var q = this.gn("" + l);
        var m = 0;
        for (m = 0; m < n; m++) {
            if (L.au(q[m])) {
                q[m] = 0
            }
            o[m] = parseInt(o[m], 10);
            q[m] = parseInt(q[m], 10);
            if (o[m] > q[m]) {
                return true
            } else {
                if (o[m] < q[m]) {
                    return false
                }
            }
        }
        if (m == n) {
            return true
        }
        if (o.toString() == q.toString()) {
            return true
        }
        return false
    };
    this.ak = function(o, n, m) {
        var l = true;
        if (!L.bn(n)) {
            l = l && L.db(o, n)
        }
        if (!L.bn(m)) {
            l = l && L.db(m, o)
        }
        return l
    };
    this.hf = function(m, p, l, r, o) {
        try {
            var n = m + "=" + escape(p) + ";";
            if (l) {
                if (l instanceof Date) {
                    if (isNaN(l.getTime())) {
                        l = new Date()
                    }
                } else {
                    l = new Date(new Date().getTime() + parseInt(l, 10) * 1000 * 60 * 60 * 24)
                }
                n += "expires=" + l.toGMTString() + ";"
            }
            if (!!r) {
                n += "path=" + r + ";"
            }
            if (!!o) {
                n += "domain=" + o + ";"
            }
            document.cookie = n
        } catch (q) {}
    };
    this.jv = function(m) {
        m = m + "=";
        var o = document.cookie;
        var p = o.indexOf(m);
        var n = "";
        if (p != -1) {
            p += m.length;
            var l = o.indexOf(";", p);
            if (l == -1) {
                l = o.length
            }
            n = o.substring(p, l)
        }
        return unescape(n)
    };
    this.show = function(m) {
        if (this.bn(m)) {
            return
        }
        if (typeof(m) !== "object") {
            m = L.bZ(m)
        }
        try {
            nq(m).show()
        } catch (l) {}
    };
    this.hide = function(m) {
        if (this.bn(m)) {
            return
        }
        if (typeof(m) !== "object") {
            m = L.bZ(m)
        }
        try {
            nq(m).hide()
        } catch (l) {}
    };
    this.val = function(l, m) {
        if (!L.au(l) && typeof(l) == "object") {
            if (typeof(m) == "undefined") {
                return nq(l).val() || ""
            } else {
                nq(l).val(m)
            }
        }
    };
    this.readOnly = function(l, m) {
        if (!L.au(l) && typeof(l) == "object") {
            if (typeof(m) == "undefined") {
                return nq(l).prop("readonly")
            } else {
                nq(l).prop("readonly", m)
            }
        }
    };
    this.ja = function(l, o, n, m) {
        nq(o).bind(l, function(p) {
            n(m)
        })
    };
    this.removeEvent = function(l, o, n, m) {
        nq(o).unbind(l, function(p) {
            n(m)
        })
    };
    this.addLoadEvent = function(n, m) {
        var l = function() {
            if (!L.au(m)) {
                n(m)
            } else {
                n()
            }
        };
        if (L.au(nq)) {
            setTimeout(l, 500)
        } else {
            nq(document).ready(function() {
                l()
            })
        }
    };
    this.u8d = function(l) {
        var m = "";
        var n = 0;
        var o = c1 = c2 = 0;
        while (n < l.length) {
            o = l.charCodeAt(n);
            if (o < 128) {
                m += String.fromCharCode(o);
                n++
            } else {
                if ((o > 191) && (o < 224)) {
                    c2 = l.charCodeAt(n + 1);
                    m += String.fromCharCode(((o & 31) << 6) | (c2 & 63));
                    n += 2
                } else {
                    c2 = l.charCodeAt(n + 1);
                    e = l.charCodeAt(n + 2);
                    m += String.fromCharCode(((o & 15) << 12) | ((c2 & 63) << 6) | (e & 63));
                    n += 3
                }
            }
        }
        return m
    };
    this.h2b = function(s) {
        var o = "0123456789abcdef";
        var l = new Array();
        var r = 0;
        for (var q = 0; q < s.length; q += 2) {
            var p = o.indexOf(s.charAt(q));
            var n = o.indexOf(s.charAt(q + 1));
            var m = (p << 4) | n;
            l[r++] = String.fromCharCode(m)
        }
        return l.join("")
    };
    this.dispatch = function(m, l) {
        m = (typeof(m) == "function") ? m : window[m];
        return m.apply(this, l || [])
    };
    this.getBounds = function(m, l) {
        var m = (typeof(m) == "object") ? m : L.bZ(m, l);
        if (!L.au(m)) {
            var n = nq(m);
            return {
                left: n.offset().left,
                top: n.offset().top,
                width: n.outerWidth(),
                height: n.outerHeight()
            }
        }
    };
    this.ep = function(m, n) {
        function p(v, u) {
            if (typeof(v) == "string") {
                var r = "";
                var q = 0;
                while (q++ < u - v.length) {
                    r += "0"
                }
                return r + v
            } else {
                if (typeof(v) == "number") {
                    return p(v.toString(), u)
                }
            }
            return v
        }
        if (!m.valueOf()) {
            return " "
        }
        var l = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
        var o = m;
        return n.replace(/(yyyy|yy|MM|dd|E|hh|mm|ss|ms|a\/p)/gi, function(q) {
            switch (q) {
                case "yyyy":
                    return o.getFullYear();
                case "yy":
                    return p((o.getFullYear() % 1000), 2);
                case "MM":
                    return p((o.getMonth() + 1), 2);
                case "dd":
                    return p(o.getDate(), 2);
                case "E":
                    return l[o.getDay()];
                case "HH":
                    return p(o.getHours(), 2);
                case "hh":
                    return p(((h = o.getHours() % 12) ? h : 12), 2);
                case "mm":
                    return p(o.getMinutes(), 2);
                case "ss":
                    return p(o.getSeconds(), 2);
                case "ms":
                    return p(o.getMilliseconds(), 3);
                case "a/p":
                    return o.getHours() < 12 ? "AM" : "PM";
                default:
                    return q
            }
        })
    };
    this.trim = function(m) {
        if (m == null) {
            return m
        }
        try {
            return m.replace(/(^\s*)|(\s*$)/gi, "")
        } catch (l) {
            try {
                return m.replace(/^\s+|\s+$/g, "")
            } catch (l) {}
        }
        return m
    };
    this.x7 = false;
    var e = 0;
    this.r9 = function(l, p, o) {
        function m(q) {
            try {
                Mc.log(new Error("Stack Trace").stack)
            } catch (r) {}
            if (!L.au(q)) {
                q.print()
            }
            Mc.log("ERROR COUNT : " + e + "");
            if (e >= uV.dV.Qa) {
                if (this.x7 == false) {
                    L.alert(N.m10);
                    Mc.log(N.m10);
                    this.x7 = true
                }
                if (!L.au(q)) {
                    q.aO(ad.bb)
                }
                bk.JF = true;
                zp.hideLoading();
                try {
                    location.reload()
                } catch (r) {}
                return true
            }
            e++;
            return false
        }
        if (L.bn(l) || l == Ye.h5) {
            var n = (o) ? m(o) : m();
            if (n) {
                return true
            }
            if (p) {
                setTimeout(function() {
                    p()
                }, uV.dV.kK)
            }
            return true
        } else {
            if (l == Ye.p0) {
                zp.mW();
                return true
            }
        }
        e = 0;
        return false
    };
    var i = 0;
    this.parseKeepAliveResult = function(l, o) {
        function m() {
            try {
                Mc.log(new Error("Stack Trace").stack)
            } catch (p) {}
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
        if (L.bn(l) || l == Ye.h5) {
            var n = m();
            if (n) {
                return true
            }
            if (o) {
                setTimeout(function() {
                    o()
                }, uV.dV.kK)
            }
            return true
        } else {
            if (l == Ye.p0) {
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
        var m = L.randomTable.length;
        var l = L.randomIndex;
        var n = L.randomTable[l];
        if (m == l + 1) {
            L.randomIndex = 0
        } else {
            L.randomIndex++
        }
        return n
    };
    this.sha256 = k;

    function k(q) {
        function P(R, Q) {
            return (R >>> Q) | (R << (32 - Q))
        }
        var I = Math.pow;
        var v = I(2, 32);
        var o = "length";
        var G, C;
        var y = "";
        var B = [];
        var n = q[o] * 8;
        var m = k.h = k.h || [];
        var F = k.k = k.k || [];
        var s = F[o];
        var p = {};
        for (var r = 2; s < 64; r++) {
            if (!p[r]) {
                for (G = 0; G < 313; G += r) {
                    p[G] = r
                }
                m[s] = (I(r, 0.5) * v) | 0;
                F[s++] = (I(r, 1 / 3) * v) | 0
            }
        }
        q += "\x80";
        while (q[o] % 64 - 56) {
            q += "\x00"
        }
        for (G = 0; G < q[o]; G++) {
            C = q.charCodeAt(G);
            if (C >> 8) {
                return
            }
            B[G >> 2] |= C << ((3 - G) % 4) * 8
        }
        B[B[o]] = ((n / v) | 0);
        B[B[o]] = (n);
        for (C = 0; C < B[o];) {
            var A = B.slice(C, C += 16);
            var l = m;
            m = m.slice(0, 8);
            for (G = 0; G < 64; G++) {
                var E = G + C;
                var u = A[G - 15],
                    x = A[G - 2];
                var K = m[0],
                    H = m[4];
                var O = m[7] + (P(H, 6) ^ P(H, 11) ^ P(H, 25)) + ((H & m[5]) ^ ((~H) & m[6])) + F[G] + (A[G] = (G < 16) ? A[G] : (A[G - 16] + (P(u, 7) ^ P(u, 18) ^ (u >>> 3)) + A[G - 7] + (P(x, 17) ^ P(x, 19) ^ (x >>> 10))) | 0);
                var M = (P(K, 2) ^ P(K, 13) ^ P(K, 22)) + ((K & m[1]) ^ (K & m[2]) ^ (m[1] & m[2]));
                m = [(O + M) | 0].concat(m);
                m[4] = (m[4] + O) | 0
            }
            for (G = 0; G < 8; G++) {
                m[G] = (m[G] + l[G]) | 0
            }
        }
        for (G = 0; G < 8; G++) {
            for (C = 3; C + 1; C--) {
                var J = (m[G] >> (C * 8)) & 255;
                y += ((J < 16) ? 0 : "") + J.toString(16)
            }
        }
        return y
    }
    this.decodeXss = a;

    function a(m) {
        if (m != null && typeof m === "string") {
            var l = m;
            l = l.replace(/&#x27;/gi, "'");
            l = l.replace(/&amp;/gi, "&");
            l = l.replace(/&quot;/gi, '"');
            l = l.replace(/&lt;/gi, "<");
            l = l.replace(/&gt;/gi, ">");
            l = l.replace(/&#x2F;/gi, "/");
            return l
        }
    }
    this.alert = function(l, m) {
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.alert) == "function") {
            npPfsExtension.alert(l, m)
        } else {
            alert(l);
            if (!L.au(m) && typeof(m) == "function") {
                m()
            }
        }
    };
    this.confirm = function(l, m) {
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.confirm) == "function") {
            npPfsExtension.confirm(l, m)
        } else {
            if (!L.au(m) && typeof(m) == "function") {
                if (confirm(l)) {
                    m(true)
                } else {
                    m(false)
                }
            }
        }
    }
};
w.zp = new function() {
    this.uuid = null;
    this.cB = -1;
    this.cz = false;
    this.dn = null;
    this.JF = false;
    this.handshakeMode = 2;
    var o = false;
    var y = false;
    var s = false;
    this.aG = {
        FW: true,
        SK: true,
        FD: true,
        KV: true
    };

    function c(A) {
        var B = {
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
            MoveToInstall: function(C, E) {
                location.replace(C)
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
        nq.extend(B, A);
        zp.aG = {
            FW: B.Firewall && uV.ki.FW,
            SK: B.SecureKey && uV.ki.SK,
            FD: B.Fds && uV.ki.FD,
            KV: B.Keypad && uV.ki.KV,
            SS: B.Submit,
            DV: B.Device,
            PA: B.PinAuth,
            AS: B.AutoStartup,
            FM: B.Form,
            LD: {
                DF: B.Loading.Default,
                BF: B.Loading.Before,
                AF: B.Loading.After
            },
            AN: B.AutoScanAttrName,
            AV: (L.au(B.AutoScanAttrValue) ? "" : B.AutoScanAttrValue.toLowerCase()),
            MI: B.MoveToInstall
        };
        if (B.Debug == true) {
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
        var A = zp.functionQueue.shift();
        if (typeof(A) == "function") {
            A()
        }
    };
    this.init = function(H) {
        npPfsCtrl.isStarting = true;
        npPfsCtrl.JF = false;
        c(H);
        if (uV.dV.dk == ad.jt) {
            var E = nq.event.trigger;
            nq.event.trigger = function(K, M, J, I) {
                if (!L.au(K) && !L.bn(K.type) && K.type.indexOf("nppfs") == 0) {
                    Mc.log(K.message)
                }
                E(K, M, J, I)
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
        var C = null;
        try {
            C = document.activeElement;
            if (C.tagName.toLowerCase() === "input" && !L.au(C.form) && !L.au(nq(C).attr("name"))) {
                this.v4 = C;
                Mc.log(N.m25.replace("%p%", nq(C).attr("name")));
                C.blur()
            }
        } catch (F) {}
        Mc.check("NOS 포커스된 입력양식 찾기 완료");
        if (zp.eventBinded == false) {
            nq(document).unbind("keydown mousedown unload beforeunload");
            nq(document).bind("keydown", function(O) {
                var Q = (O || window.event);
                if (L.au(Q)) {
                    return
                }
                var K = Q.keyCode;
                var J = Q.altKey;
                var R = Q.ctrlKey;
                var M = Q.shiftKey;
                var I = Q.metaKey;
                var P = false;
                if (D.win || D.lnx) {
                    P = (K == 123) || (R && M && K == 73);
                    if (D.ff) {
                        P = P || (R && M && (K == 75 || K == 81 || K == 83));
                        P = P || (M && (K == 113 || K == 116 || K == 118))
                    }
                } else {
                    if (D.mac) {
                        P = (J && I && (K == 73));
                        if (D.ff) {
                            P = P || (J && I && (K == 75 || K == 81 || K == 83));
                            P = P || (M && (K == 113 || K == 116 || K == 118))
                        }
                    }
                }
                if (P == true) {
                    Mc.log(N.m38);
                    L.so(Q);
                    return false
                }
                bh.jw(Q)
            });
            nq(document).bind("mousedown", function(I) {
                var J = (I || window.event);
                if ((J.button == 2) || (J.button == 3)) {
                    Mc.log(N.m39);
                    L.so(J);
                    return false
                }
            });
            Mc.check("NOS 단축키 차단");
            try {
                function G(J) {
                    J = (J || window.event);
                    try {
                        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.beforeFinalize) == "function") {
                            var I = npPfsExtension.beforeFinalize(J);
                            if (!L.au(I)) {
                                return I
                            }
                        }
                        hI.bm();
                        if (hI.iK() == true) {
                            i()
                        }
                    } catch (K) {}
                }
                if (typeof(window.onbeforeunload) != "undefined") {
                    nq(window).bind("beforeunload", G)
                } else {
                    nq(window).bind("unload", G)
                }
            } catch (F) {
                Mc.log(F)
            }
            Mc.check("NOS 종료 이벤트 추가");
            zp.eventBinded = true
        }
        nq(document).unbind("nppfs-nos-jlk nppfs-nos-jhs nppfs-nos-jvc nppfs-nos-init nppfs-nos-startup");
        nq(document).bind("nppfs-nos-jlk nppfs-nos-jhs nppfs-nos-jvc nppfs-nos-init nppfs-nos-startup", q);
        if (hI.io() == true && L.bn(zp.dn)) {
            var A = uV.dV.Gf;
            Mc.log(A);
            var B = L.send(A, "id=" + zp.uuid, {
                async: false,
                ax: function(J) {
                    if (J.readyState == 4) {
                        if (J.status == 200) {
                            var I = J.responseText;
                            if (L.bn(I)) {
                                Mc.log(N.m04)
                            }
                            zp.dn = L.trim(I)
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
                if (s == true || zp.cz == false) {
                    if (zp.JF == true) {
                        return
                    }
                    zp.JF = true;
                    Mc.log(s ? N.m01 : N.m02);
                    if (typeof(zp.aG.MI) == "function") {
                        zp.aG.MI(uV.dV.Fz, s, false)
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

    function q(A) {
        nq(document).unbind(A);
        switch (A.type) {
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
                zp.isVirtualMachine(function(B) {
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
    this.startup = function(A) {
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
    var v = false;
    this.resetVirtualMachine = function() {
        v = false
    };
    this.isVirtualMachine = function(A) {
        A = A || function() {};
        if (v == true) {
            A(D.virtualMachine);
            return
        }
        if (D.isMobileDevice() || D.isMetroUi()) {
            D.virtualMachine = false;
            Mc.log("Can not be checked a virtual machine at Metro UI or Mobile.");
            A(false);
            return
        }
        if (!hI.iK()) {
            v = true;
            D.virtualMachine = false;
            if (!L.au(A) && typeof(A) == "function") {
                A(D.virtualMachine)
            }
            return
        }
        if (zp.cz == false) {
            A(false);
            return
        }
        var B = zp.cQ(Ye.d3, Ye.j3, Ye.j0, null);
        L.fs(B, {
            ax: function(C) {
                if (L.bn(C)) {
                    setTimeout(function() {
                        zp.isVirtualMachine(A)
                    }, uV.dV.kK);
                    return
                } else {
                    if (C == Ye.a4) {
                        zp.aG.SK = false;
                        Mc.log(N.m48);
                        D.virtualMachine = true
                    } else {
                        if (C == Ye.h5) {
                            Mc.log(N.m49);
                            D.virtualMachine = false
                        } else {
                            if (C == Ye.p0) {
                                zp.mW()
                            } else {
                                D.virtualMachine = false
                            }
                        }
                    }
                }
                v = true;
                if (!L.au(A) && typeof(A) == "function") {
                    A(D.virtualMachine)
                }
            }
        })
    };
    this.waitSubmit = function(C) {
        if (typeof(this.isStartup) == "undefined") {
            this.isStartup = true
        }
        if (this.isStartup == true && zp.aG.FD == true && Xv.isRunnable()) {
            var B = setTimeout(function() {
                C()
            }, 30000);

            function A() {
                if (Xv.isFinish() == true) {
                    C();
                    clearTimeout(B)
                } else {
                    setTimeout(A, uV.dV.kK)
                }
            }
            A()
        } else {
            C()
        }
    };
    var b = false;
    this.mW = function() {
        if (D.sf == true) {
            L.alert("보안프로그램에서 개발자도구나 디버그도구를 탐지하였습니다.\n보안을 위하여 개발자도구를 종료합니다.");
            return
        } else {
            if (!b) {
                b = true;
                L.alert(N.m09, function() {
                    location.reload()
                })
            }
        }
    };
    this.copy = function(A, B) {
        L.copyDivision(A, B)
    };
    this.Wb = function() {
        var A = L.xw(document, "byid", "nppfs-loading-modal");
        if (L.au(A)) {
            return
        }
        try {
            nq(A).css({
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
        } catch (B) {}
        l = 0
    };
    this.v3 = function() {
        var A = L.xw(document, "byid", "nppfs-loading-modal");
        if (L.au(A)) {
            return
        }
        nq(A).css({
            display: "none",
            width: "0px",
            height: "0px"
        });
        r = 0
    };
    var l = 0;
    this.showLoading = function() {
        if (L.au(zp.aG) || L.au(zp.aG.LD) || L.au(zp.aG.LD.DF) || zp.aG.LD.DF == true) {
            this.Wb()
        } else {
            if (!L.au(zp.aG.LD.BF) && typeof(zp.aG.LD.BF) == "function") {
                if (l > 0) {
                    this.Wb()
                } else {
                    l++;
                    zp.aG.LD.BF()
                }
            } else {
                this.Wb()
            }
        }
    };
    var r = 0;
    this.hideLoading = function() {
        if (L.au(zp.aG) || L.au(zp.aG.LD) || L.au(zp.aG.LD.DF) || zp.aG.LD.DF == true) {
            this.v3()
        } else {
            if (!L.au(zp.aG.LD.AF) && typeof(zp.aG.LD.AF) == "function") {
                if (r > 0) {
                    this.v3()
                } else {
                    r++;
                    zp.aG.LD.AF()
                }
            } else {
                this.v3()
            }
        }
    };
    this.makeWebSocketUrl = function(A, C) {
        var E = uV.dV.dZ === "https" ? "wss" : "ws";
        var B = [];
        B.push(E);
        B.push("://");
        B.push(C);
        B.push(((uV.dV.dZ == "http" && A == 80) || (uV.dV.dZ == "https" && A == 443)) ? "" : ":" + A);
        B.push(uV.dV.iI);
        return B.join("")
    };
    this.cZ = function(A, C) {
        var B = [];
        B.push(uV.dV.dZ);
        B.push("://");
        B.push(C);
        B.push(((uV.dV.dZ == "http" && A == 80) || (uV.dV.dZ == "https" && A == 443)) ? "" : ":" + A);
        B.push(uV.dV.iI);
        return B.join("")
    };
    this.qh = function(A, F, H) {
        if (L.au(H) || typeof(H) != "array") {
            var E = L.mL(16);
            H = new Array(4);
            H[0] = "";
            H[1] = Ye.x5;
            H[2] = L.hH(E) + L.encrypt(document.domain, L.ha(L.hH(E)), "ECB", 128);
            H[3] = "1000"
        }
        var C = H.length;
        var G = [];
        G.push(A);
        if (L.bn(F)) {
            G.push("1")
        } else {
            G.push(F)
        }
        G.push(C);
        for (var B = 0; B < C; B++) {
            G.push(L.cC(H[B]));
            G.push(H[B])
        }
        return G
    };
    this.cQ = function(A, B, C, F) {
        var E = zp.qh(A, B);
        if (!L.bn(C)) {
            E.push(C)
        }
        if (!L.bn(F)) {
            E.push(L.cC(F));
            E.push(F)
        }
        return E.join("")
    };
    var u = false;
    var k = false;
    var d = false;
    var p = [];
    var f = false;
    var g = [];
    var j = function() {
        for (var A = 0; A < g.length; A++) {
            if (typeof(g[A]) == "function") {
                L.dispatch(g[A])
            }
        }
        g = []
    };
    this.eC = function(E) {
        p = [];
        if (f == true) {
            if (typeof(E) == "function") {
                g.push(E)
            }
            return
        }
        f = true;
        if (typeof(E) == "function") {
            g.push(E)
        }
        zp.cz = false;
        if (k == false) {
            var B = L.jv("npPfsHost");
            var A = L.jv("npPfsPort");
            if (!L.bn(B) && !L.bn(A) && A > 0 && u == false) {
                Mc.log(N.m13.replace("%h%", B).replace("%p%", A));
                F(B, A, j);
                u = true
            } else {
                F("127.0.0.1", uV.dV.l5, j);
                u = true;
                k = true
            }
        } else {
            for (var C = 0; C < uV.dV.Cc; C++) {
                F("127.0.0.1", uV.dV.l5 + C, j)
            }
            d = true
        }

        function F(I, H, J) {
            if (zp.JF == true) {
                return
            }
            var G = "task_" + I.split(".").join("_") + "_" + H;
            if (L.indexOf(p, G) < 0) {
                p.push(G)
            }

            function K(S) {
                var Q = "1";
                var O = L.mL(16);
                var P = L.hH(O) + L.encrypt(nua, L.ha(L.hH(O)), "ECB", 128);
                var M = Q + L.cC(P) + P;
                var R = zp.cQ(Ye.d3, Ye.j3, Ye.h6, M);

                // chrome 엔진 버전이 94일 경우 websocket 사용
				if(D.isSupportWebSocket) {
					var version = D.iT();
					var aM; 
					if(D.op){
						//opera의 기존 iT 사용 시 opera 버전을 추출하여 별도 크롬 버전 추출
						var opVersion = nua.substring(nua.toLowerCase().lastIndexOf("chrome"));
						if (opVersion.indexOf(" ") != -1) {
							opVersion = opVersion.substring(0, opVersion.indexOf(" "));
							aM = opVersion.split("/");
							version = aM[1];
						}
					}
					if(L.db(version, 94)){
						zp.handshakeMode = 2;
					}
				}

                L.fs(R, S, function(U) {
                    if (U.readyState == 4) {
                        var T = "";
                        if (U.status == 200) {
                            T = U.responseText
                        }
                        S.ax(T, S.host, S.port)
                    }
                })
            }(function(O) {
                try {
                    nq.extend(O, {
                        host: I,
                        port: H,
                        timeout: 3 * 1000
                    });
                    K(O);
                    return;
                    var M = false
                } catch (P) {
                    if (M == false) {
                        O.ax("", I, H)
                    }
                    M = true;
                    Mc.log(P)
                }
            })({
                ax: function(O, Q, P) {
                    var M = "task_" + Q.split(".").join("_") + "_" + P;
                    p.splice(L.indexOf(p, M), 1);
                    var R = false;
                    switch (O) {
                        case Ye.a4:
                            R = true;
                            break;
                        case Ye.p0:
                            R = true;
                            zp.mW();
                            break;
                        case Ye.ag:
                            R = true;
                            s = true;
                            break;
                        case Ye.aj:
                            R = true;
                            Mc.log(N.m51.replace("%p1%", Q).replace("%p2%", P));
                            y = true;
                            break;
                        case Ye.d4:
                            R = false;
                            o = true;
                            Mc.log(N.m15);
                            break;
                        default:
                            R = false
                    }
                    if (zp.cz == false && R == true) {
                        o = false;
                        zp.cz = true;
                        zp.c6 = Q;
                        zp.cB = P;
                        Mc.log(N.m14.replace("%h%", Q).replace("%p%", P));
                        L.hf("npPfsHost", zp.c6, 7, "/");
                        L.hf("npPfsPort", zp.cB, 7, "/");
                        k = true;
                        d = true;
                        if (y == true) {
                            zp.ak(J)
                        } else {
                            J();
                            nq(document).trigger({
                                type: "nppfs-nos-jhs",
                                time: new Date()
                            })
                        }
                    }
                    if (p.length == 0) {
                        f = false;
                        handshakeCallback = null;
                        if (o == true) {
                            d = false;
                            setTimeout(function() {
                                zp.eC()
                            }, uV.dV.kK)
                        } else {
                            if (d == false) {
                                zp.eC()
                            } else {
                                if (zp.cz == false) {
                                    L.hf("npPfsHost", "", -1, "/");
                                    L.hf("npPfsPort", "", -1, "/");
                                    J();
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
    this.ak = function(E) {
        var A = "";
        var B = uV.dV.cM;
        Mc.log("업데이트버전 경로 : " + B + "");
        var C = setTimeout(function() {
            Mc.log("업데이트버전 다운로드 실패(Timeout 10초).");
            E();
            nq(document).trigger({
                type: "nppfs-nos-jhs",
                time: new Date()
            })
        }, 10 * 1000);
        zp.cz = true;
        s = false;
        y = false;
        nq.ajax({
            url: B,
            cache: false,
            crossDomain: true,
            async: false,
            type: "GET",
            global: false,
            dataType: "jsonp",
            jsonp: "jsonp_callback",
            jsonpCallback: "VersionInfo",
            contentType: "application/json",
            error: function(H, G, F) {
                clearTimeout(C);
                E();
                nq(document).trigger({
                    type: "nppfs-nos-jhs",
                    time: new Date()
                })
            },
            success: function(H, G, K) {
                clearTimeout(C);
                if (L.bn(H)) {
                    E();
                    nq(document).trigger({
                        type: "nppfs-nos-jhs",
                        time: new Date()
                    });
                    return
                }
                var F = H;
                Mc.log("업데이트버전 정보 : " + F);
                var I = "1";
                var J = zp.cQ(Ye.d3, Ye.j3, Ye.am, (I + L.cC(F) + F));
                L.fs(J, {
                    ax: function(M) {
                        switch (M) {
                            case Ye.h5:
                                s = false;
                                break;
                            case Ye.a4:
                                s = true;
                            default:
                                break
                        }
                        y = false;
                        E();
                        nq(document).trigger({
                            type: "nppfs-nos-jhs",
                            time: new Date()
                        });
                        Mc.check("NOS 핸드쉐이크 - 버전비교 종료")
                    }
                })
            },
            complete: function(G, F) {
                clearTimeout(C);
                Mc.check("NOS 핸드쉐이크 - 버전얻기 종료")
            }
        })
    };
    this.isInstall = function(A) {
        if (L.au(A)) {
            A = {}
        }
        if (L.au(A.success)) {
            A.success = function() {}
        }
        if (L.au(A.fail)) {
            A.fail = function() {}
        }
        if (L.bn(this.cB) || this.cB <= 0 || s == true) {
            zp.eC(function() {
                if (zp.cz == false || s == true) {
                    A.fail()
                } else {
                    A.success()
                }
            })
        } else {
            A.success()
        }
    };
    var n = false;
    this.checkInstall = function(A) {
        if (L.au(A)) {
            A = {}
        }
        if (L.au(A.before)) {
            A.before = function() {}
        }
        if (L.au(A.after)) {
            A.after = function() {}
        }
        if (n == false) {
            A.before();
            n = true
        }
        zp.eC(function() {
            if (zp.cz == false || s == true || y == true) {
                if (s == true || L.bn(this.cB) || this.cB <= 0) {
                    s = false
                }
                setTimeout(function() {
                    k = false;
                    d = false;
                    Mc.log("zp.checkInstall(callbacks);");
                    zp.checkInstall(A)
                }, 2 * 1000);
                return
            } else {
                A.after()
            }
        })
    };
    var e = null;

    function x() {
        if (zp.cz == false || zp.JF == true) {
            return
        }

        function B(K) {
            try {
                if (L.parseKeepAliveResult(K, function() {
                        if (e != null) {
                            clearInterval(e);
                            e == null
                        }
                        setTimeout(function() {
                            x()
                        }, 3000)
                    })) {
                    return
                }
                if (e == null) {
                    e = setInterval(x, 3000)
                }
            } catch (M) {}
        }
        nq(document).trigger({
            type: "nppfs-keep-alive",
            message: N.m52,
            time: new Date()
        });

        function A(M, K) {
            M = M + "";
            return M.length >= K ? M : new Array(K - M.length + 1).join("0") + M
        }
        var H = 0;
        if (zp.aG.FW && npNCtrl.isRunning()) {
            H += 1
        }
        if (zp.aG.SK && bh.isRunning()) {
            H += 2
        }
        if (zp.aG.FD && Xv.isRunning()) {
            H += 4
        }
        if (zp.aG.KV && npVCtrl.isRunning()) {
            H += 8
        }
        H = A(H, 4);
        var C = L.mL(16);
        var E = [];
        E.push(L.hH(C) + L.encrypt(H, L.ha(L.hH(C)), "ECB", 128));
        var I = E.length.toString(16);
        for (var G = 0; G < E.length; G++) {
            var J = E[G];
            I += L.cC(J) + J
        }
        var F = zp.cQ(Ye.d3, Ye.j3, Ye.d8, I);
        if (D.win) {
            L.fs(F, {
                ax: B
            })
        } else {
            L.fs(F, {
                ax: B
            })
        }
    }

    function a() {
        if (zp.JF == true) {
            return
        }
        if (e != null) {
            clearInterval(e)
        }
        e = setInterval(x, 3000)
    }

    function i() {
        if (e != null) {}
    }
    this.isSupport = function() {
        var A = hI.iS();
        var B = false;
        nq(A).each(function() {
            if (!L.au(this.controller) && !L.au(this.controller.isSupported) && typeof(this.controller.isSupported) == "function") {
                if (this.id === "nppfs.npk.module") {
                    B = this.controller.isSupported() || npVCtrl.isSupported()
                } else {
                    B = this.controller.isSupported()
                }
                return !B
            }
        });
        return B
    };
    this.GetReplaceField = function(A, B) {
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(B)) {
            return npVCtrl.iu(A, B)
        }
        if (bh.isRunning() == true) {
            return bh.iu(A, B)
        }
    };
    this.GetResultField = function(A, B) {
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(B)) {
            return npVCtrl.im(A, B)
        }
        if (bh.isRunning() == true) {
            return bh.im(A, B)
        }
    };
    this.GetEncryptResult = function(A, B) {
        if (npVCtrl.isRunning() == true && npVCtrl.isKeypadUse(B)) {
            return npVCtrl.GetEncryptResult(A, B).trim()
        }
        if (bh.isRunning() == true) {
            return bh.GetEncryptResult(A, B).trim()
        }
    };
    this.ReuseModules = function() {
        if (bh.isRunning() == true) {
            return bh.ReuseModules()
        } else {
            return
        }
    };
    this.RegistDynamicField = function(B, E) {
        try {
            var A = document.activeElement;
            if (!L.au(A) && A.tagName && A.tagName.toLowerCase() == "input" && (A.type == "password" || A.type == "text" || A.type == "tel")) {
                zp.v4 = A
            }
        } catch (C) {}
        if (bh.isRunning() == true) {
            bh.eX(B, E)
        }
        if (npVCtrl.isRunning() == true) {
            npVCtrl.eX(B, E)
        }
    };
    this.ResetField = function(B, A) {
        if (npVCtrl.isRunning() == true) {
            npVCtrl.resetKeypad(A);
            npVCtrl.hideKeypad(A)
        }
        if (bh.isRunning() == true) {
            bh.iM(B, A)
        }
    };
    this.RescanField = function() {
        try {
            var A = document.activeElement;
            if (!L.au(A) && A.tagName && A.tagName.toLowerCase() == "input" && (A.type == "password" || A.type == "text" || A.type == "tel")) {
                zp.v4 = A
            }
        } catch (B) {}
        this.jl();
        if (bh.isRunning() == true) {
            bh.cU()
        }
        if (npVCtrl.isRunning() == true) {
            npVCtrl.cU()
        }
    };
    this.cI = null;
    this.SetGlobalKeyValidation = function(A) {
        this.cI = null;
        if (L.au(A)) {
            return
        }
        if (typeof(A) !== "function") {
            return
        }
        this.cI = A
    };
    this.jl = function() {
        nq(nq("form")).each(function(B, C) {
            var A = nq(this);
            L.xw(this, "byclass", "nppfs-elements");
            var E = "d" + L.hH(L.mL(8));
            if (L.bn(A.attr("name"))) {
                A.attr({
                    name: E
                })
            }
            if (L.bn(A.attr("data-nppfs-form-id"))) {
                A.attr({
                    "data-nppfs-form-id": E
                })
            }
        });
        nq("input").each(function() {
            var A = nq(this).attr("type");
            if (L.bn(A)) {
                nq(this).attr("type", "text");
                A = "text"
            }
            if (!L.bn(A) && A != "text" && A != "password" && A != "tel") {
                return true
            }
        })
    };
    this.encryptValue = function(B, A) {
        if (typeof(A) != "function") {
            L.alert(N.m53);
            return
        }
        if (L.bn(B)) {
            A("");
            return
        }
        if (zp.cz == false || zp.JF == true) {
            L.alert("NOS와 통신할 수 없습니다. npPfsStartup()으로 먼저 페이지를 초기화하십시오.");
            A("");
            return
        }
        var F = L.hH(L.getBytes(B));
        var C = "1";
        var G = C + L.cC(F) + F;
        var E = zp.cQ(Ye.d3, Ye.j3, Ye.dG, G);
        L.fs(E, {
            ax: function(H) {
                if (!L.bn(H)) {
                    A(H);
                    return
                }
                A("")
            }
        })
    };
    this.dynamicField = {};
    this.putDynamicField = function(B, E, G) {
        var C = (typeof(B) == "object" && B != null) ? nq(B).attr("name") + "_" : B + "_";
        var A = C + nq("input[name='" + E + "']").attr("name");
        var F = this.dynamicField[A];
        if (L.au(F)) {
            this.dynamicField[A] = [G]
        } else {
            this.dynamicField[A].push(G)
        }
    };
    this.getDynamicField = function(B, E) {
        var C = (typeof(B) == "object" && B != null) ? nq(B).attr("name") + "_" : B + "_";
        var A = C + nq("input[name='" + E + "']").attr("name");
        var F = this.dynamicField[A];
        if (L.au(F)) {
            return []
        }
        return this.dynamicField[A]
    };

    function m(B) {
        var C = [ad.wG, ad.Ix, ad.jd, "i_borun", "i_e2e_id", "i_e2e_key", "i_tot_hash", "i_log_total", "i_elapsed_tm", "i_log_yn", "i_version", "i_tot_log", "f_uuid", "f_key", "f_uuid"];
        for (var A = 0; A < C.length; A++) {
            if (C[A] == B) {
                return A
            }
        }
        return -1
    }
    this.serializeArray = function(B, C) {
        var A = (typeof(B) == "object" && B != null) ? B : L.bZ(B);
        C = typeof(C) == "undefined" ? true : C;
        if (C == false) {
            return nq(A).serializeArray()
        }
        var E = [];
        nq.each(nq(A).serializeArray(), function() {
            if (this.name.indexOf("__E2E__") > 0 || this.name.indexOf("__KI_") == 0 || this.name.indexOf("__KIEXT_") == 0 || this.name.indexOf("__KH_") == 0 || this.name.indexOf("__KU_") == 0 || m(this.name) >= 0) {
                E.push(this)
            }
        });
        return E
    };
    this.toJson = function(B) {
        var C = {};
        var A = (typeof(B) == "object" && B != null) ? B : L.bZ(B);
        nq.each(nq(A).serializeArray(), function() {
            if (C[this.name] !== undefined) {
                if (!C[this.name].push) {
                    C[this.name] = [C[this.name]]
                }
                C[this.name].push(this.value || "")
            } else {
                C[this.name] = this.value || ""
            }
        });
        return C
    };
    this.setColor = function(A) {
        bh.setColor(A);
        npVCtrl.setColor(A)
    };
    this.doFocusOut = function(B, A) {
        bh.doFocusOut(B, A)
    };
    this.enableUI = function(A, B) {
        bh.enableUI(A, B);
        npVCtrl.enableUI(A, B)
    };
    this.disableUI = function(A, B) {
        bh.disableUI(A, B);
        npVCtrl.disableUI(A, B)
    };
    this.IsVirtualMachine = this.isVirtualMachine;
    this.IsMetroUi = this.isMetroUi;
    this.IsInstall = this.isInstall;
    this.IsSupport = this.isSupport;
    this.CheckInstall = this.checkInstall;
    this.isMobileDevice = this.IsMobileDevice = D.isMobileDevice;
    this.launch = function(A) {
        npPfsCtrl.init(A)
    }
};
w.npPfsCtrl = zp;
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
        var W = zp.aG.SK && this.isSupported();
        return W
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
    var T = "7e769d757a766f8c11a1b049b7b342342a6f182751ed77d013f0b874a64ab53e";
    var g = "9bc5a0de9bc3981187888b8e96f1294477f9fb569d80c4e1daf5ce3c8e978513";
    var r = "9f2632c32af86b7ee0f2898f5538f26f41511a2d21b6cd0fb2eb93ae2082a8d5";
    var O = "cb0e140a3aa5ccb9772563578c53cf1ba04cbb6b710245b4a6f9e5f3253efe0f";
    var a = "e415f238b749c37ceffd49eaeadbd7fd7558abd01b81912a777e19f561e790fe";
    var d = "a39a0f55a549eeca013d70067e602ba3e47e5fc527ec7c8c3025f9fde0b58c5a";
    var R = "74152f6edcf64638596b5653332da969c52f113d9a2f983d2f8aad8bcdbe6550";
    var j = "8df7390b2d1e776364b182a74451971d084c499527407d7186837743d89093dd";
    var P = "063f0935dcfb510cc301c29cc6471e2d5494eb58ca20fb807e7d58f6ff9e2bd8";
    var M = "ffe6dafe034449474eb32ca6c5f01b97a9a23f637b41f6be44ce64554a73d037";
    var J = "a789bc0bf601beb37e105e188f294fa6736cff0f58597445674f94a481cd4dc5";
    var U = "ffb5a6a5d44cbaf38e22ece875de265384f690619ec0a54d3caa2de36fd594e3";
    var u = "0e095aa0abf61ab94e7accc4797b7cc1d51f7995df3dd83e2cb730489b9b4117";
    var V = "d1686fb69265e8e6c3b5f39280c0ab4014df325dc326876d8196032cb1162294";
    var y = "c5050122baf49e24f1080336264f9137473360a733a0863755cd4c8d7b77a369";
    this.ID = "";
    this.av = null;
    this.uuid = null;
    this.dn = null;
    this.hb = null;
    this.Qb = "";
    this.useInitechHex = "off";
    this.resetElements = [];

    function C(W, aa, Z) {
        try {
            var Y = zp.qh(b.gP, Ye.j3);
            Y.push(W);
            Y.push(aa);
            return L.fs(Y.join(""), Z)
        } catch (X) {}
    }
    this.send = function(W, Y, X) {
        C(W, Y, X)
    };
    var p = function(X, Y) {
        var W = nq(X).attr(Y);
        return (L.au(W)) ? "" : W.toLowerCase()
    };
    this.init = function() {
        this.uuid = zp.uuid;
        this.dn = zp.dn
    };
    var S = false;
    this.bA = function() {
        if (!this.isSupported() || !this.isRunnable()) {
            return true
        }
        return S
    };
    var E = false;
    this.startup = function() {
        if (zp.cz == false || zp.JF == true) {
            return
        }
        H()
    };
    this.bm = function() {
        if (zp.cz == false) {
            return
        }
        bh.doFocusOut();
        var W = R + "=" + bh.ID;
        C(T, W, {
            async: false,
            direct: true
        });
        nq(document).trigger({
            type: "nppfs-npk-finalized",
            message: N.m99,
            time: new Date()
        })
    };
    this.GetEncryptResult = function(Y, ab) {
        if (L.au(ab)) {
            return
        }
        if (L.au(document.getElementsByName(ab))) {
            return
        }
        if (bh.isRunning() == true) {
            var W = L.bZ(ad.wG, Y);
            var ac = L.bZ(ad.Ix, Y);
            var X = B(ab);
            if (L.au(W) || L.au(ac) || L.au(X) || L.au(W.value) || L.au(ac.value) || L.au(X.value)) {
                return
            }
            var aa = [];
            aa.push("m=c");
            aa.push("u=" + L.sz(W.value));
            aa.push("r=" + L.sz(ac.value));
            aa.push("v=" + L.sz(X.value));
            var Z = L.send(uV.dV.CryptoUrl, aa.join("&"));
            return Z
        }
    };

    function H() {
        Mc.check("NPK 초기화 시작");
        if (!bh.isSupported()) {
            nq(document).trigger({
                type: "nppfs-npk-jksc",
                time: new Date()
            });
            S = true;
            return
        }
        nq(document).trigger({
            type: "nppfs-npk-before-startup",
            message: "키보드보안을 시작합니다.",
            time: new Date()
        });
        nq(document).bind("nppfs-npk-jks nppfs-npk-jkc nppfs-npk-jki nppfs-npk-jkrf nppfs-npk-jksc", function(W) {
            nq(document).unbind(W);
            switch (W.type) {
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
                    S = true;
                    E = true;
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
        if (S == true) {
            bh.cU();
            return
        }
        m = true;
        C(T, d, {
            ax: function(W) {
                if (L.r9(W, function() {
                        H()
                    })) {
                    return
                }
                var X = W.split("&&");
                if (X[0] == "ID") {
                    if (L.bn(X[1])) {
                        bh.startup();
                        return
                    }
                    bh.ID = X[1]
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
                var W = zp.v4;
                if (!L.au(W) && W.tagName && W.tagName.toLowerCase() == "input" && (W.type == "password" || W.type == "text" || W.type == "tel")) {
                    W.blur();
                    W.focus();
                    zp.v4 = null;
                    if (!L.bn(W.name)) {
                        Mc.log(N.m24.replace("%p%", W.name))
                    }
                }
            }
        } catch (X) {}
    }

    function i() {
        if (zp.JF == true) {
            return
        }

        function Y(Z) {
            setTimeout(function() {
                nq(document).trigger({
                    type: Z,
                    time: new Date()
                })
            }, uV.dV.kK)
        }
        var X = 0;
        nq(document).bind("nppfs-npk-jkci", function(Z) {
            if (X >= uV.dV.Qa) {
                L.alert(N.m19);
                X = 0;
                nq(document).trigger({
                    type: "nppfs-npk-jkc",
                    time: new Date()
                });
                return
            }
            var aa = U + "=" + bh.ID;
            C(T, aa, {
                ax: function(ab) {
                    if (L.r9(ab, function() {
                            X++;
                            Y("nppfs-npk-jkci")
                        })) {
                        return
                    }
                    var ae = ab.split("&&");
                    if (L.au(ae) || ae.length != 2) {
                        X++;
                        Y("nppfs-npk-jkci");
                        return
                    }
                    if (ae[0] == "CLIENTADDRESS") {
                        var ac = ae[1].split("&^&");
                        if (L.au(ac) || ac.length != 2 || L.bn(ac[1])) {
                            X++;
                            Y("nppfs-npk-jkci");
                            return
                        }
                        bh.hb = ac[1]
                    }
                    nq(document).trigger({
                        type: "nppfs-npk-jkc",
                        time: new Date()
                    });
                    X = 0
                }
            })
        });
        var W = [];
        W.push("Cert=");
        W.push("PKI=5");
        W.push("CertEnc=" + bh.dn);
        W.push("ID=" + bh.ID);
        C(g, W.join("&"), {
            ax: function(Z) {
                if (L.r9(Z, function() {
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
        var W = u + "=" + bh.ID;
        C(T, W, {
            ax: function(X) {
                if (L.r9(X, function() {
                        s()
                    })) {
                    return
                }
                var Z = X.split("&&");
                if (L.au(Z) || Z.length != 2) {
                    s();
                    return
                }
                if (Z[0] == "ENCREPLACETABLE") {
                    var Y = Z[1].split("&^&");
                    if (L.au(Y) || Y.length != 2 || L.bn(Y[1])) {
                        s();
                        return
                    }
                    if (L.bn(bh.Qb)) {
                        bh.Qb = Y[1]
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
        var X = null;

        function W() {
            if (S == true) {
                clearTimeout(X);
                q();
                nq(document).bind("nppfs-npk-jkrf", function(Y) {
                    nq(document).unbind(Y);
                    k()
                })
            } else {
                X = setTimeout(W, uV.dV.kK)
            }
        }
        W()
    };

    function q() {
        var W = 0;
        nq("input").each(function() {
            var Y = nq(this).attr("type");
            if (L.bn(Y)) {
                nq(this).attr("type", "text");
                Y = "text"
            }
            if (!L.bn(Y) && Y != "text" && Y != "password" && Y != "tel") {
                return true
            }
            var X = nq(this).attr("name");
            if (L.bn(X)) {
                nq(this).attr("name", nq(this).attr("id"))
            }
        });
        nq("input[type=text], input[type=password], input[type=tel]").each(function() {
            var X = this;
            var Z = this.form;
            var Y = nq(X).attr("name");
            if (L.bn(Y) || Y == ad.Ix || Y == ad.wG || Y == ad.jd) {
                return true
            }
            if (Y.indexOf("__E2E__") > 0 || Y.indexOf("__KI_") == 0 || Y.indexOf("__KH_") == 0) {
                return true
            }
            if (nq(X).hasClass("nppfs-npk")) {
                return true
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                if (Y.indexOf("__FORMATTER__") > 0) {
                    return true
                }
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.secureKeyUiModifier) == "function") {
                npPfsExtension.secureKeyUiModifier(X)
            }
            var aa = p(X, "npexecutetype");
            if (aa != "" && aa.indexOf("k") == -1) {
                return true
            }
            L.c1(Z, [ad.Ix, ad.wG], [bh.hb, bh.uuid]);
            var ab = p(X, zp.aG.AN);
            if (ab === "off" || L.arrayNotIn([zp.aG.AV, "re", "sub", "des", "db", "key", "wl2"], ab)) {
                return true
            }
            X.blur();
            nq(document).trigger({
                type: "nppfs-npk-before-regist-field",
                message: N.m61.replace("%p1%", X.name),
                target: X,
                form: (!L.au(Z)) ? nq(Z).attr("name") : null,
                name: X.name,
                time: new Date()
            });
            bh.f7(Z, X);
            W++
        });
        if (W == 0) {
            nq(document).trigger({
                type: "nppfs-npk-jkrf",
                time: new Date()
            });
            return
        }
    }

    function K(W) {
        var Y = p(W, zp.aG.AN);
        var X = "OFF";
        if (L.bn(Y)) {
            X = "OFF"
        } else {
            if (Y === "key") {
                X = "OFF"
            } else {
                if (Y === "re") {
                    X = "RE"
                } else {
                    if (Y === "sub") {
                        X = "SUB"
                    } else {
                        if (Y === "des") {
                            X = "DES"
                        } else {
                            if (Y === "wl2") {
                                X = "WL2"
                            } else {
                                if (Y == zp.aG.AV) {
                                    X = "ON"
                                } else {
                                    if (Y === "db") {
                                        X = "DB"
                                    } else {
                                        X = "OFF"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        return X
    }

    function A(W) {
        var aa = "ON";
        try {
            var ab = p(W, "style");
            var ae = ab.split(";");
            for (var Z = 0; Z < ae.length; Z++) {
                var X = L.trim(ae[Z]);
                if (X.indexOf("ime-mode:") == 0 || X.indexOf("-ms-ime-mode:") == 0) {
                    var Y = ae[Z].split(":");
                    if (L.trim(Y[1]) == "disabled") {
                        aa = "OFF";
                        break
                    }
                }
            }
        } catch (ac) {}
        return aa
    }

    function e(W) {
        var Y = nq(W).attr("name");
        var X = "";
        var Z = p(W, zp.aG.AN);
        if (L.arrayIn([zp.aG.AV, "db", "re", "sub", "des", "wl2"], Z)) {
            X = Y + "__E2E__"
        }
        return X
    }

    function c(X) {
        var Y = "";
        var W = nq(X);
        var Z = p(X, zp.aG.AN);
        if (L.arrayIn(["re", "sub", "des", "wl2"], Z)) {
            W.css({
                color: b.eK.Kq,
                "background-color": b.eK.Xe
            })
        } else {
            if (L.arrayIn([zp.aG.AV, "db"], Z) && true) {
                W.css({
                    color: b.eK.hZ,
                    "background-color": b.eK.gx
                })
            }
        }
    }
    var f = [];
    this.f7 = function(ab, Y) {
        if (typeof(Y) == "string") {
            Y = L.bZ(Y, ab)
        }
        if (typeof(Y) == "undefined") {
            return bs
        }
        var X = nq(Y);
        var Z = nq(ab);
        if (X.hasClass("nppfs-npk")) {
            return true
        }
        if (nq(Y).hasClass("nppfs-npv")) {
            npVCtrl.resetKeypad(X.attr("name"), aa);
            npVCtrl.setKeypadUse(X.attr("name"), false);
            npVCtrl.destroyKeypad(X.attr("name"), aa)
        }
        var ae = p(Y, zp.aG.AN);
        var aa = L.au(ab) ? "blank" : Z.attr("name");
        var W = "task_" + X.attr("name") + "_" + aa;
        if (L.indexOf(f, W) < 0) {
            f.push(W)
        }
        if (D.ie) {
            X.bind("contextmenu dragstart click focusin focusout keypress selectstart keydown", function(af) {
                return l(af)
            })
        } else {
            X.bind("contextmenu dragstart click focus blur keypress selectstart keydown", function(af) {
                return l(af)
            })
        }
        if (L.arrayIn([zp.aG.AV, "db"], ae)) {
            X.attr({
                autocorrect: "off",
                spellcheck: "false",
                autocomplete: "off",
                autocapitalize: "off"
            })
        }
        var ac = [];
        ac.push("name=" + Y.name);
        ac.push("Length=" + Y.maxLength);
        ac.push("type=" + Y.type);
        ac.push("E2E=" + K(Y));
        ac.push("ID=" + bh.ID);
        ac.push("IME=" + A(Y));
        ac.push("Dummy=ON");
        C(r, ac.join("&"), {
            ax: function(af) {
                if (L.r9(af, function() {
                        bh.f7(ab, Y)
                    })) {
                    return
                }
                var ag = p(Y, zp.aG.AN);
                if (!L.bn(af)) {
                    c(Y);
                    X.addClass("nppfs-npk");
                    nq(document).trigger({
                        type: "nppfs-npk-after-regist-field",
                        message: N.m62.replace("%p1%", X.attr("name")),
                        target: Y,
                        form: (!L.au(ab)) ? Z.attr("name") : null,
                        name: Y.name,
                        time: new Date()
                    })
                }
                f.splice(L.indexOf(f, W), 1);
                if (f.length == 0) {
                    nq(document).trigger({
                        type: "nppfs-npk-jkrf",
                        time: new Date()
                    })
                }
            }
        });
        if (!L.bn(e(Y))) {
            L.c1(ab, [e(Y)]);
            if (X.attr("nppfs-formatter-type") != undefined) {
                L.c1(ab, [Y.name + "__FORMATTER__"])
            }
            npPfsCtrl.putDynamicField(ab, Y.name, [e(Y)])
        }
    };
    this.iM = function(X, W) {
        if (typeof(W) == "string") {
            W = L.bZ(W, X)
        }
        if (typeof(W) == "undefined") {
            return
        }
        W.value = "";
        var Y = B(W);
        if (!L.au(Y)) {
            Y.value = ""
        }
        this.resetElements.push(W.name)
    };
    this.enableUI = function(W, X) {
        if (typeof(W) == "string") {
            as = L.bZ(W, X)
        }
        if (typeof(as) == "undefined") {
            return
        }
        nq(as).attr("keypad-disabled-ui", "false")
    };
    this.disableUI = function(W, X) {
        if (typeof(W) == "string") {
            as = L.bZ(W, X)
        }
        if (typeof(as) == "undefined") {
            return
        }
        nq(as).attr("keypad-disabled-ui", "true")
    };
    this.setColor = function(W) {
        b.eK.hZ = W.TextColor;
        b.eK.gx = W.FieldBgColor;
        b.eK.Kq = W.ReTextColor;
        b.eK.Xe = W.ReFieldBgColor
    };

    function l(Y) {
        var X = true;
        var Z = Y.target ? Y.target : Y.srcElement;
        try {
            if (L.au(Y) || zp.JF == true || bh.ID == "") {
                L.so(Y);
                return false
            }
            switch (Y.type) {
                case "contextmenu":
                case "dragstart":
                    L.so(Y);
                    break;
                case "selectstart":
                    if (D.op) {
                        L.so(Y);
                        X = false
                    }
                    break;
                case "focusin":
                case "focus":
                    X = x(Y);
                    break;
                case "focusout":
                case "blur":
                    X = n(Y);
                    break;
                case "click":
                    X = I(Y);
                    break;
                case "keydown":
                    X = o(Y);
                    break;
                case "keypress":
                    if (typeof(bh) == "undefined" || bh == null) {
                        return false
                    }
                    if (D.ff) {
                        var W = W = Y.which;
                        if (W == 8 || Y.keyCode == 9) {
                            return true
                        }
                        if (112 <= Y.keyCode && Y.keyCode <= 123) {
                            return true
                        }
                        L.so(Y);
                        if ((Y.ctrlKey == true && W == 97) || (Y.ctrlKey == true && W == 99) || (Y.ctrlKey == true && W == 118) || (Y.ctrlKey == true && W == 120)) {
                            X = false
                        }
                    }
                    break
            }
        } catch (aa) {}
        return X
    }

    function I(X) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        try {
            var Y = X.target ? X.target : X.srcElement;
            if (Y.type == "text" || Y.type == "password" || Y.type == "tel") {
                var aa = Y.value.length;
                if (Y.createTextRange) {
                    var W = Y.createTextRange();
                    W.move("character", aa);
                    W.select()
                } else {
                    if (Y.setSelectionRange) {
                        Y.setSelectionRange(aa, aa)
                    } else {}
                }
            }
        } catch (Z) {}
    }

    function x(X) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        try {
            function W() {
                var ac = X.target ? X.target : X.srcElement;
                if (typeof(npVCtrl) != "undefined" && npVCtrl.isRunning() == true) {
                    npVCtrl.hideAll(ac)
                }
                if (nq(ac).prop("readonly") == true || nq(ac).prop("disabled") == true) {
                    L.so(X);
                    return
                }
                if (nq(ac).attr("keypad-disabled-ui") == "true") {
                    return
                }
                if (!nq(ac).is(":visible")) {
                    ac = null;
                    L.so(X);
                    return false
                }
                if (!L.au(ac)) {
                    ac.selectionStart = 0;
                    ac.selectionEnd = 0;
                    if (!D.ie && !D.qq) {
                        ac.focus()
                    }
                    bh.av = ac;
                    ac.value = "";
                    var ab = B(ac);
                    if (!L.au(ab)) {
                        ab.value = ""
                    }
                    var aa = nq(ac);
                    if (aa.attr("nppfs-formatter-type") != undefined) {
                        var Z = nq("input[name='" + aa.attr("name") + "__FORMATTER__']");
                        Z.val("")
                    }
                    var ae = j + "=" + bh.ID + "=" + ac.name;
                    C(T, ae, {
                        ax: function(af) {
                            if (!D.CB()) {
                                if (L.r9(af, function() {
                                        x(X)
                                    })) {
                                    return
                                }
                            }
                        }
                    });
                    nq(document).trigger({
                        type: "nppfs-npk-focusin",
                        message: N.m63.replace("%p1%", nq(ac).attr("name")),
                        target: ac,
                        form: (!L.au(ac.form)) ? nq(ac.form).attr("name") : null,
                        name: ac.name,
                        time: new Date()
                    })
                }
            }
            if (!L.au(bh.av)) {
                bh.doFocusOut(bh.av, W)
            } else {
                W()
            }
        } catch (Y) {}
    }
    this.doFocusOut = function(Y, W) {
        if (L.au(bh.av)) {
            return
        }
        if (L.au(Y)) {
            Y = bh.av
        }
        var X = P + "=" + bh.ID + "=" + Y.name;
        C(T, X, {
            direct: true,
            ax: function(Z) {
                nq(document).trigger({
                    type: "nppfs-npk-focusout",
                    message: N.m64.replace("%p1%", nq(Y).attr("name")),
                    target: Y,
                    form: (!L.au(Y.form)) ? nq(Y.form).attr("name") : null,
                    name: nq(Y).attr("name"),
                    time: new Date()
                });
                nq(Y).trigger({
                    type: "change"
                });
                if (typeof(W) == "function") {
                    W(Y)
                }
            }
        });
        bh.av = null
    };

    function n(W) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        var X = W.target ? W.target : W.srcElement;
        bh.doFocusOut(X)
    }

    function Q(X, W) {
        nq(X).trigger({
            type: "keypress",
            which: W,
            keyCode: W
        });
        nq(X).trigger({
            type: "keyup",
            which: W,
            keyCode: W
        })
    }

    function o(W) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        try {
            var X = W.target ? W.target : W.srcElement;
            if (L.au(X) || (X.type != "text" && X.type != "password" && X.type != "tel") || L.au(bh.av)) {
                L.so(W);
                return false
            }
            var X = bh.av;
            var aa = p(X, zp.aG.AN);
            Mc.log("키보드보안 키다운 이벤트발생 : " + X.name + " : " + X.value + " : " + W.keyCode);
            try {
                if (W.keyCode == 8) {
                    L.so(W)
                }
            } catch (Z) {}
            if (D.mac && D.sf) {
                if (W.keyCode == 38) {
                    W.keyCode = 49
                } else {
                    if (W.keyCode == 40) {
                        W.keyCode = 32
                    }
                }
            }
            if ((W.ctrlKey == true || W.metaKey == true) && (W.keyCode == 67 || W.keyCode == 86 || W.keyCode == 88)) {
                L.so(W);
                return false
            }
            if (W.keyCode == 93) {
                L.so(W);
                return false
            }
            if (L.arrayIn([33, 34, 36, 37, 38, 39, 40, 45, 46], W.keyCode)) {
                L.so(W);
                return false
            }
            if (!L.au(W.charCode) && W.charCode != 0) {
                return false
            }
            if (W.keyCode == 32 || W.keyCode == 49 || (W.keyCode == 16 && D.win)) {
                if (D.lnx || D.mac) {
                    var Y = M + "=" + bh.ID + "=" + X.name
                } else {
                    var Y = M + "=" + bh.ID + "=" + X.name + "=" + bh.useInitechHex
                }
                C(T, Y, {
                    ax: function(ab) {
                        if (L.r9(ab, function() {
                                o(W)
                            })) {
                            return
                        }
                        var ac = ab.split("&&");
                        v(ac[1], ac[2], W.keyCode)
                    }
                });
                L.so(W);
                return false
            } else {
                if (W.keyCode == 8) {
                    var Y = J + "=" + bh.ID + "=" + X.name;
                    C(T, Y, {
                        ax: function(ab) {
                            if (L.r9(ab, function() {
                                    o(W)
                                })) {
                                return
                            }
                            var ac = ab.split("&&");
                            G()
                        }
                    })
                } else {
                    if (W.keyCode == 9) {} else {
                        if (W.keyCode == 13) {} else {
                            if ((aa === "" || aa === "key") && D.mac && D.ff) {
                                if (D.lnx || D.mac) {
                                    var Y = M + "=" + bh.ID + "=" + X.name
                                } else {
                                    var Y = M + "=" + bh.ID + "=" + X.name + "=" + bh.useInitechHex
                                }
                                C(T, Y, {
                                    ax: function(ab) {
                                        if (ab === Ye.kk || ab === Ye.a4) {} else {
                                            if (L.r9(ab, function() {
                                                    o(W)
                                                })) {
                                                return
                                            }
                                            var ac = ab.split("&&");
                                            v(ac[1], ac[2], W.keyCode)
                                        }
                                    }
                                })
                            } else {
                                if (W.keyCode == 229) {} else {
                                    if (W.keyCode == 255) {
                                        L.so(W);
                                        return false
                                    } else {
                                        L.so(W);
                                        return false
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (Z) {}
    }
    var F = false;
    this.he = null;
    this.jw = function(W) {
        if (typeof(bh) == "undefined" || bh == null) {
            return false
        }
        if (!L.au(W) && W.keyCode == 9) {
            var X = new Date().getTime();
            if (L.au(bh.he)) {} else {
                if (X - bh.he <= 150) {
                    L.so(W)
                } else {}
            }
            bh.he = X
        }
    };

    function v(ai, Z, ae) {
        if (L.au(bh.av)) {
            return
        }
        var af = bh.av;
        var am = nq(af);
        var Y = af.value;
        if (am.prop("readonly") == true || am.prop("disabled") == true) {
            return
        }
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
            Y = npPfsExtension.formatter(am, false)
        }
        if (am.attr("data-keypad-action") == "amount") {
            Y = L.uncomma(am.val())
        }
        var X = nq(af).prop("maxlength");
        if (!L.bn(X) && !L.bn(Y) && X > 0 && Y.length >= X) {
            Q(af, ae);
            return
        }
        try {
            var ak = L.ha(ai);
            if (L.bn(ak)) {
                return
            }
            var al = L.gu(ak, L.ha(bh.ID), "ECB", 128);
            if (L.bn(al)) {
                return
            }
            if (al.length > 0) {
                al = al.substring(0, 1)
            }
            if (L.bn(al)) {
                return
            }
            var an = al.charCodeAt(0);
            var ac = L.au(zp.cI);
            ac = ac || typeof(zp.cI) !== "function";
            ac = ac || zp.cI(an, af);
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.keyValidation) == "function") {
                ac = ac && npPfsExtension.keyValidation(af, an)
            }
            if (ac == false) {
                var ah = J + "=" + bh.ID + "=" + af.name;
                C(T, ah, {
                    ax: function(ao) {
                        if (L.r9(ao, function() {
                                v(ai, Z, ae)
                            })) {
                            return
                        }
                        var ap = ao.split("&&")
                    }
                });
                Mc.log("The key value(" + an + ") is invalid, clear the keystroke.");
                return
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                am.val(npPfsExtension.formatter(am, false))
            }
            if (am.attr("data-keypad-action") == "amount") {
                am.val(L.uncomma(am.val()))
            }
            var W = p(af, zp.aG.AN);
            if ((L.arrayIn([zp.aG.AV, "db"], W) && true) || L.arrayIn(["re", "sub", "des", "wl2"], W)) {
                var ab = B(af);
                if (L.au(ab)) {
                    return
                }
                if (L.arrayIn(["re", "sub"], W)) {
                    var ak = L.ha(Z);
                    if (L.bn(ak)) {
                        return
                    }
                    var aa = L.gu(ak, L.ha(bh.ID), "ECB", 128);
                    if (L.bn(aa)) {
                        return
                    }
                    if (aa.length > 0) {
                        aa = aa.substring(0, 1)
                    }
                    af.value += al;
                    ab.value += aa
                } else {
                    if (L.arrayIn([zp.aG.AV, "des", "db", "wl2"], W)) {
                        if (bh.useInitechHex == "on") {
                            var ak = L.ha(Z);
                            if (L.bn(ak)) {
                                return
                            }
                            af.value += al;
                            ab.value += ak
                        } else {
                            af.value += al;
                            ab.value += Z
                        }
                        if (am.attr("nppfs-formatter-type") != undefined) {
                            var aj = nq("input[name='" + am.attr("name") + "__FORMATTER__']");
                            aj.val(aj.val() + "a")
                        }
                    }
                }
            } else {
                af.value += al
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                am.val(npPfsExtension.formatter(am, true))
            }
            if (am.attr("data-keypad-action") == "amount") {
                am.val(L.comma(am.val()))
            }
            Mc.log(N.m65.replace("%p1%", af.name).replace("%p2%", al.charCodeAt(0)));
            nq(document).trigger({
                type: "nppfs-npk-put-complete",
                message: N.m66,
                target: af,
                form: (!L.au(af.form)) ? nq(af.formm).attr("name") : null,
                name: af.name,
                time: new Date()
            });
            var an = al.charCodeAt(0);
            Q(af, an)
        } catch (ag) {}
    }

    function B(Y) {
        var W = (typeof(Y) == "object") ? e(Y) : e(nq("input[name='" + Y + "']"));
        var X = !L.au(Y.form) ? Y.form : null;
        return L.bZ(W, X)
    }

    function G() {
        try {
            var Z = bh.av;
            var Y = B(Z);
            var X = nq(Z);
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                X.val(npPfsExtension.formatter(X, false))
            }
            if (X.attr("data-keypad-action") == "amount") {
                X.val(L.uncomma(X.val()))
            }
            var ab = p(Z, zp.aG.AN);
            if (L.bn(ab)) {
                return
            }
            if (!L.au(Y)) {
                Z.value = Z.value.substring(0, Z.value.length - 1);
                if (L.arrayIn(["re", "sub"], ab)) {
                    Y.value = Y.value.substring(0, Y.value.length - 1)
                } else {
                    if (L.arrayIn([zp.aG.AV, "des", "db"], ab)) {
                        Y.value = Y.value.substring(0, Y.value.length - 64)
                    } else {
                        if (L.arrayIn([zp.aG.AV, "wl2"], ab)) {
                            Y.value = Y.value.substring(0, Y.value.length - 45)
                        }
                    }
                }
            } else {
                if (ab == "key") {
                    Z.value = Z.value.substring(0, Z.value.length - 1)
                }
            }
            if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function") {
                var W = nq("input[name='" + X.attr("name") + "__FORMATTER__']");
                W.val(W.val().substring(0, W.val().length - 1));
                X.val(npPfsExtension.formatter(X, true))
            }
            if (X.attr("data-keypad-action") == "amount") {
                X.val(L.comma(X.val()))
            }
            Mc.log(N.m67.replace("%p1%", Z.name).replace("%p2%", Z.value))
        } catch (aa) {}
    }
    this.resetColor = function(W) {
        if (L.au(W)) {
            return
        }
        var X = p(W, zp.aG.AN);
        if (L.arrayIn(["re", "sub", "des", "wl2"], X)) {
            W.style.color = b.eK.Kq;
            W.style.backgroundColor = b.eK.Xe
        } else {
            if (L.arrayIn([zp.aG.AV, "db"], X) && true) {
                W.style.color = b.eK.hZ;
                W.style.backgroundColor = b.eK.gx
            }
        }
    };
    this.iu = function(X, Z) {
        if (L.au(Z)) {
            return ""
        }
        var W = (typeof(Z) == "object") ? Z : L.bZ(Z, X);
        var Y = B(W);
        if (L.au(Y) || L.au(Y.value)) {
            return ""
        }
        if (bh.isRunnable() && (npVCtrl.isRunning() == false || !npVCtrl.isKeypadUse(Z))) {
            return Y.value
        }
        return ""
    };
    this.im = function(X, Z) {
        if (bh.isRunnable() && (npVCtrl.isRunning() == false || !npVCtrl.isKeypadUse(Z))) {
            if (L.au(bh.Qb)) {
                return
            }
            var W = Z;
            if (typeof(W) == "string") {
                W = L.bZ(Z, X)
            }
            if (typeof(W) == "undefined") {
                return ""
            }
            try {
                var aa = nq(W).attr(zp.aG.AN);
                aa = (L.au(aa)) ? "" : aa.toLowerCase();
                if (L.arrayIn(["sub", "des", "wl2"], aa)) {
                    return bh.ID + "=" + W.name
                }
                return bh.Qb
            } catch (Y) {}
            return bh.Qb
        }
    };
    this.ReuseModules = function() {
        if (!bh.isRunnable() && E != true) {
            return
        }
        if (L.bn(bh.hb) && L.bn(bh.uuid)) {
            return
        }
        nq("input[type=text], input[type=password], input[type=tel]").each(function() {
            var W = this;
            var Y = this.form;
            var X = nq(W).attr("name");
            if (L.bn(X) || X == ad.Ix || X == ad.wG || X == ad.jd) {
                nq(W).remove()
            }
            if (X.indexOf("__E2E__") > 0 || X.indexOf("__KI_") == 0 || X.indexOf("__KH_") == 0) {
                nq(W).remove()
            }
            if (nq(W).hasClass("nppfs-npk")) {
                nq(W).removeClass("nppfs-npk")
            }
            if (nq(W).val().length > 0) {
                nq(W).val("")
            }
        });
        nq(".nppfs-elements").html("");
        S = false;
        bh.init();
        bh.startup()
    };
    this.eX = function(W, Z) {
        var Y = null;

        function X() {
            if (bh.bA() == true) {
                if (!L.bn(W)) {
                    if (typeof(W) == "string") {
                        W = nq("form[name='" + W + "']").get(0)
                    }
                }
                if (typeof(Z) == "string") {
                    Z = L.bZ(Z, W)
                }
                if (Z == null || typeof(Z) == "undefined") {
                    return
                }
                if (!bh.isRunnable()) {
                    return
                }
                var aa = p(Z, zp.aG.AN);
                if (aa === "off" || L.arrayNotIn([zp.aG.AV, "re", "sub", "des", "db", "key", "wl2"], aa)) {
                    return
                }
                bh.f7(W, Z);
                nq(document).bind("nppfs-npk-jkrf", function(ab) {
                    k()
                })
            } else {
                Y = setTimeout(X, uV.dV.kK)
            }
        }
        X()
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
w.Xv = new function() {
    this.id = "nppfs.npf.module";
    var a = {
        gP: Ye.h4,
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
    var p = false;
    this.isRunning = function() {
        return p
    };
    this.isRunnable = function() {
        var ab = zp.aG.FD && this.isSupported();
        return ab
    };
    this.isSupported = function() {
        if (D.isMobileDevice() || D.isMetroUi()) {
            return false
        }
        return D.isSupported(a.support)
    };
    var V = false;
    this.bA = function() {
        if (!this.isSupported() || !this.isRunnable()) {
            return true
        }
        return V
    };
    var q = false;
    this.isFinish = function() {
        if (!this.isSupported() || !this.isRunnable()) {
            return true
        }
        return q
    };
    var l = "71c59f2730e1f7d67a6bf8834c18799755858eba0c431548da9ff315b37bf11c";
    var F = "3a1672831d2c722656e473159db7712e12f8f7945fe202f872767e21984eb2ba";
    var C = "b665d10dad166eefde1b72367eae22f8a146ee4fa4525a3bd78d75e2829747dc";
    var f = "6f32350380ba709e5ca4860adf4a2e09098aa9c38b922404376d21ff0302c8ff";
    var y = "a6af339cf2a94909c1a11af5582bde3f74053e18c98edc1b39dd14b540a35370";
    var S = "11432d109a46221a19ad8fc800c93253e18a5b1307422d1a39d0cb86c092c8ae";
    var A = "67a27008328cb41353045d6c006851222a945aead9fcb5396dfc13b73b55f92a";
    var j = "540791fd16273c45276ef8df567d54acacd74e82a53dbce1991a7b55ecf31b855c22e567f2fec48255314a909067d382eecf5f482843e350737d8aa53f8617dd06c2d01740befbdfe403967bfa790b44dfeb65c19a92f552001db9f969080d73ddb7272de6bbbd0e9e0e7fecfabaa4d145bb47dd0761109dc93473e5be54b7a88eb5f518b32c3e7c56bf0bc162ecdadd29b461128f67b7a8d8c6a47b1288b06d58fa8b54bb5dcf05d2be606ff3f8aa2298d8e189c7293fb0f1e443de9a79ab9a89c2d1995c3e300fa058f8d2c0095ca38998092eb43819d42aeacb06a9dd19dee6eaf9e97190b24457fdf535fbc2cae4a517db1e4e68f7f8b0c43f016ad080487b1808c6df3beeb56e8c7a604f0bdda760a75f90309c247256689f605ce331ac";
    var n = "9a65a3e4ca37a52f7f9a8514b413502e5d1f474082b619baab6b9d6f3877537eae4e4dca0d8cfdf34bdb77a973efad90";
    var B = "a991fc7ea0d98f2fe0a22b7734e864011eaf4efc02c709e6ae1dc04f2ca5d252";
    var v = "d48bb40403ece6c741c11996ae9c2dc7e05488e8d974827c1fa2b84729063ecf";
    var U = "b6a115941ae7bdaa05bb6b5b9f2323c72656b3583348772ab75cda6daa97a237";
    var H = "dd3f1d9ab75a85b7a435b05942566b5acf80763558786c5fd997b3002032831d";
    var T = "aaedec060c26408c09e5a523e39526075975a5f25688196732ca267d449df5cf";
    var Z = "43c1e5113d2aeb83d81df97e66fb3fa31883f6c1fbc62866e96ffc637315a054";
    var E = "ec556552a894abf2ffe8ab12b0288c7b9016fb42557a6aefdb6d02d8637203ce";
    var m = "d5d72cfd36229ee1ab098d844326e43526e91699651f7c4e5aa0b37f439b025c";
    var r = "514d9eaec893af429f62da659e80d8f1e789d376433575bd498761c33037234b";
    var x = "59f357bf9c74cbe1d973741e983464cb2bf4ee24ef2d856301defbac2994775e9e7a191c58703dd5c0064066b94a2ab4c911c8549fde5f9c1f78e2fd51cc31693dc3d5ec08a2668a3a583a531c0f78cc56876d3316def7e14b7debb83245974c1d9faf4c0eb924d25f2e08f6f1ab412081ffaa46e027148d5b24edb17fb7861c7604da5ac9c3a1fd3f464f78af7482c6fd3ae7d87da32f72139a0599d95f049839ad0bfad576f42b3b79f54fa74e19044b618e7b55684648eed302d41e2847f35f02ebcb0c51c76009fdf84d2df3fe3a5bc9839317b247c2adf38f0c94448654652c7cef3ce350da725153afb866f5dd32dc5a7e5dac80294559ff81bead502d8ec4268661b16834760bf8d82901c568";
    this.uuid = null;
    this.form = null;
    this.dn = null;
    this.iP = null;

    function G(ab, ai, ac, ah) {
        try {
            var ag = zp.qh(a.gP, Ye.j3);
            if (!L.bn(Xv.uuid)) {
                ag.push(Xv.uuid)
            }
            ag.push(ab);
            if (!L.au(ai)) {
                var af = [];
                af.push(L.cC(ai));
                af.push(ai);
                if (!L.bn(ac)) {
                    af.push(ac)
                }
                ag.push(L.cC(af.join("")));
                ag.push(af.join(""))
            }
            L.fs(ag.join(""), ah)
        } catch (ae) {}
    }
    this.init = function(ae) {
        nq(document).bind("nppfs-npf-jfs nppfs-npf-jfa nppfs-npf-jfi nppfs-npf-jfg nppfs-npf-jfp nppfs-npf-jfb nppfs-npf-jfc", o);
        this.uuid = zp.uuid;
        this.dn = zp.dn;
        if (L.au(ae) || L.au(ae.form)) {
            this.form = nq("form").get(0)
        } else {
            this.form = ae.form
        }
        if (L.au(this.form)) {
            Mc.log(N.m27);
            nq(document).trigger({
                type: "nppfs-npf-jfc",
                time: new Date()
            });
            return
        }
        var ac = nq(this.form).attr("name");
        var ab = nq("form[name=" + ac + "]");
        if (ab.length > 1) {
            L.alert(N.m21.replace("%p%", ac));
            this.form = ab.get(0)
        }
    };
    this.bm = function() {
        nq(document).trigger({
            type: "nppfs-npf-finalized",
            message: N.m68,
            time: new Date()
        })
    };
    var Q = null;
    var c = null;
    var O = null;
    var g = null;
    var aa = null;
    this.startup = function() {
        if (zp.cz == false) {
            return
        }
        if (V == true) {
            i();
            u("i_borun", I.gb);
            u("i_e2e_key", I.gk);
            u("i_log_yn", I.sv_y);
            u("i_e2e_id", Xv.uuid);
            u("i_version", Q);
            u("i_log_total", c);
            u("i_elapsed_tm", aa);
            u("i_tot_hash", O);
            if (uV.dV.dk == ad.jt) {
                u("i_tot_log", g)
            }
            return
        }
        p = true;
        nq(document).trigger({
            type: "nppfs-npf-before-startup",
            message: N.m69,
            time: new Date()
        });
        nq(document).trigger({
            type: "nppfs-npf-jfs",
            time: new Date()
        })
    };

    function o(ab) {
        if (zp.JF == true) {
            return
        }
        nq(document).unbind(ab);
        switch (ab.type) {
            case "nppfs-npf-jfs":
                s();
                break;
            case "nppfs-npf-jfa":
                k();
                break;
            case "nppfs-npf-jfi":
                i();
                e();
                V = true;
                nq(document).trigger({
                    type: "nppfs-module-startup",
                    target: Xv.id,
                    time: new Date()
                });
                nq(document).trigger({
                    type: "nppfs-npf-after-startup",
                    message: N.m70,
                    time: new Date()
                });
                break;
            case "nppfs-npf-jfg":
                J();
                break;
            case "nppfs-npf-jfp":
                M();
                break;
            case "nppfs-npf-jfb":
                P();
                nq(document).trigger({
                    type: "nppfs-npf-complete",
                    message: N.m71,
                    time: new Date()
                });
                break;
            case "nppfs-npf-jfc":
                q = true;
                break
        }
    }

    function s() {
        G(l, j, null, {
            ax: function(ab) {
                if (L.r9(ab, function() {
                        s()
                    })) {
                    return
                }
                nq(document).trigger({
                    type: "nppfs-npf-jfa",
                    time: new Date()
                })
            }
        })
    }

    function k() {
        var ab = n;
        G(F, ab, Xv.dn, {
            ax: function(ac) {
                if (L.r9(ac, function() {
                        k()
                    })) {
                    return
                }
                if (ac != "true" && ac != "Y") {
                    Mc.log(N.m29)
                } else {
                    Mc.log(N.m28)
                }
                nq(document).trigger({
                    type: "nppfs-npf-jfi",
                    time: new Date()
                })
            }
        })
    }

    function i() {
        var ab = ["i_borun", "i_e2e_id", "i_e2e_key", "i_tot_hash", "i_log_total", "i_elapsed_tm", "i_log_yn", "i_version"];
        if (uV.dV.dk == ad.jt) {
            ab.push("i_tot_log")
        }
        L.c1(Xv.form, ab)
    }
    var I = {};
    var d = [];

    function e() {
        if(D.isSupportWebSocket && !bh.bA()) {
			setTimeout(function() {
				e()
			}, 1000);
			return;
		}
        Xv.iP = new Date();
        W("s", "Y", function(ab) {
            I.sv_y = ab
        });
        W("s", "01", function(ab) {
            I.sv_01 = ab
        });
        W("s", "02", function(ab) {
            I.sv_02 = ab
        });
        W("s", "03", function(ab) {
            I.sv_03 = ab
        });
        W("o", B, function(ab) {
            I.gb = ab
        });
        W("o", v, function(ab) {
            I.gk = ab
        });
        if (D.win) {
            W("v", "e63ca9882e97201b51cd82220986737b86243706277efba144f393497eddede1", function(ab) {
                Q = ab
            })
        } else {
            if (D.lnx) {
                W("v", "597a8f5a7b9921e7ef5509c875a20b8ae80db0d34099f31c82903f8666066404", function(ab) {
                    Q = ab
                })
            } else {
                if (D.mac) {
                    W("v", "4f204a588f47540ba718625e0dfce676ccef050b50246d7952a4882a67de4fb4", function(ab) {
                        Q = ab
                    })
                }
            }
        }
    }

    function J() {
        Y("pbc", Z, D.makeBrowserVersionCode());
        Y("pfs", E, R(X.ij()));
        Y("pss", m, R(X.gO()));
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.additionalData) == "function") {
            var ac = npPfsExtension.additionalData();
            var ab = L.hH(L.getBytes(ac));
            if (!L.bn(ab)) {
                Y("bY", r, ab)
            }
        }
    }

    function W(ac, ag, af) {
        function ae(ah) {
            d.splice(L.indexOf(d, ab), 1);
            if (!L.bn(ah) && L.r9(ah, function() {
                    W(ac, ag, af)
                })) {
                return
            }
            af(ah);
            if (d.length == 0) {
                nq(document).trigger({
                    type: "nppfs-npf-jfg",
                    time: new Date()
                })
            }
        }
        var ab = "task_jfg_" + ac + "_" + ag;
        if (L.indexOf(d, ab) < 0) {
            d.push(ab)
        }
        switch (ac) {
            case "v":
                G(C, ag, null, {
                    ax: ae
                });
                break;
            case "o":
                G(f, ag, null, {
                    ax: ae
                });
                break;
            case "s":
                G(f, T, ag, {
                    ax: ae
                });
                break;
            case "m":
                G(CMD_FD_multiFunc, PRM_FD_multiFunc, null, {
                    ax: ae
                });
                break
        }
    }

    function P() {
        G(A, null, null, {
            ax: function(ab) {
                nq(document).trigger({
                    type: "nppfs-npf-jfc",
                    time: new Date()
                })
            }
        })
    }

    function u(ac, ae) {
        try {
            var ab = L.bZ(ac, Xv.form);
            if (!L.au(ab)) {
                ab.value = ae
            }
        } catch (af) {
            Mc.log(af)
        }
    }

    function R(ab) {
        switch (ab) {
            case I.sv_02:
                return "02";
                break;
            case I.sv_03:
                return "03";
                break
        }
        return "01"
    }
    var K = 0;
    var b = [];

    function Y(ac, af, ae) {
        var ab = "task_" + ac;
        b.push(ab);
        G(y, af, ae, {
            ax: function(ag) {
                b.splice(L.indexOf(b, ab), 1);
                if (ag == Ye.h5) {
                    Mc.log("Put Error ... " + ac + "...");
                    if (K < 5) {
                        K++;
                        setTimeout(function() {
                            Y(ac, af, ae)
                        }, uV.dV.kK);
                        return
                    } else {
                        K = 0
                    }
                } else {
                    if (ag == Ye.p0) {
                        zp.mW();
                        return
                    }
                }
                if (b.length == 0) {
                    nq(document).trigger({
                        type: "nppfs-npf-jfp",
                        time: new Date()
                    })
                }
            }
        })
    }

    function M() {
        if (uV.dV.eP != "") {
            L.send(uV.dV.eP, "id=" + Xv.uuid)
        }
        u("i_version", Q);
        u("i_e2e_id", Xv.uuid);
        u("i_borun", I.gb);
        u("i_e2e_key", I.gk);
        G(S, x, null, {
            ax: function(ac) {
                if (L.r9(ac, function() {
                        M()
                    })) {
                    return
                }
                c = ac;
                u("i_log_yn", I.sv_y);
                u("i_log_total", ac);

                function ab() {
                    G(f, T, L.eD(Xv.iP), {
                        ax: function(ag) {
                            if (L.r9(ag, function() {
                                    ab()
                                })) {
                                return
                            }
                            aa = ag;
                            u("i_elapsed_tm", ag)
                        }
                    })
                }
                ab();

                function af() {
                    G(f, H, null, {
                        ax: function(ag) {
                            if (L.r9(ag, function() {
                                    af()
                                })) {
                                return
                            }
                            O = ag;
                            u("i_tot_hash", ag);
                            if (uV.dV.dk == ad.fJ) {
                                nq(document).trigger({
                                    type: "nppfs-npf-jfb",
                                    time: new Date()
                                })
                            }
                        }
                    })
                }
                af();
                if (uV.dV.dk == ad.jt) {
                    function ae() {
                        G(f, U, null, {
                            ax: function(ag) {
                                if (L.r9(ag, function() {
                                        ae()
                                    })) {
                                    return
                                }
                                g = ag;
                                u("i_tot_log", ag);
                                nq(document).trigger({
                                    type: "nppfs-npf-jfb",
                                    time: new Date()
                                })
                            }
                        })
                    }
                    ae()
                }
            },
            timeout: 30000
        })
    }
    var X = new function() {
        this.ij = function() {
            return I.sv_01
        };
        this.gO = function() {
            if (bh.isRunning()) {
                return I.sv_03
            } else {
                return I.sv_02
            }
        }
    }
};
w.hI.define({
    id: Xv.id,
    name: "nProtect Online Security V1.0, Fraud Dection System",
    handshake: true,
    endtoend: true,
    runvirtualos: true,
    controller: Xv,
    isExecutable: function(a) {
        return (typeof(a.FD) != "undefined") ? a.FD : true
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
        var y = nq(this._element);
        var A = nq(this._parent);
        if (y.hasClass("nppfs-npv")) {
            return true
        }
        y.attr("nppfs-keypad-uuid", this._uuid);
        var o = navigator.userAgent.match(/MSIE ([0-9]{1,}[\.0-9]{0,})/),
            u = !!o;
        this._isOldIe = (u && parseInt(o[1], 10) <= 8) || document.documentMode <= 8;
        this._isVeryOldIe = (u && parseInt(o[1], 10) <= 7) || document.documentMode <= 7;
        this.makeKeyPadDivHtml(A);
        var G = this._keypadinfo;
        this._useynfield = G.inputs.useyn;
        this._hashfield = G.inputs.hash;
        this._togglefield = G.inputs.toggle;
        var H = nq(".nppfs-elements", A);
        if (!L.au(G.dynamic) && G.dynamic.length > 0) {
            for (var C = 0; C < G.dynamic.length; C++) {
                var K = G.dynamic[C].k;
                var M = G.dynamic[C].v;
                if (nq("input[name='" + K + "']", A).length > 0) {
                    continue
                }
                if (uV.dV.dk == ad.jt) {
                    H.append(K + ' : <input type="text" name="' + K + '" value="' + M + '" /><br />');
                    if (y.attr("nppfs-formatter-type") != undefined) {
                        var B = y.attr("name") + "__FORMATTER__";
                        if (nq("input[name='" + B + "']", A).length == 0) {
                            H.append(B + ' : <input type="text" name="' + B + '" value="' + M + '" /><br />')
                        }
                    }
                } else {
                    H.append('<input type="hidden" name="' + K + '" value="' + M + '" />');
                    if (y.attr("nppfs-formatter-type") != undefined) {
                        var B = y.attr("name") + "__FORMATTER__";
                        if (nq("input[name='" + B + "']", A).length == 0) {
                            H.append('<input type="hidden" name="' + B + '" value="' + M + '" />')
                        }
                    }
                }
            }
        }
        this._hashelement = nq("input[name='" + this._hashfield + "']", A);
        var E = nq("#" + this._uuid);
        Mc.log("이전마우스입력기 기 생성여부 : " + E.length + ", UUID : " + this._uuid);
        if (E.length > 0) {
            E.remove()
        }
        var x = [];
        x.push('<div id="' + this._uuid + '" class="nppfs-keypad" data-width="' + G.iw + '" data-height="' + G.ih + '">');
        this._uuid = this._uuid.replace(".", "\\.");
        x.push('<style type="text/css">');
        x.push("	#" + this._uuid + " .kpd-wrap { position:relative; width:" + G.iw + "px; height:" + G.ih + "px; white-space:normal;}");
        x.push("	#" + this._uuid + " .kpd-preview .preview{ background-repeat:no-repeat; background-position:0px 0px; }");
        x.push("	#" + this._uuid + " .kpd-button { position:absolute; width:" + G.coords.bw + "px; height:" + G.coords.bh + "px; overflow:hidden; /* border:1px solid #f88; */ }");
        if (G.touch.use == true) {
            x.push("	#" + this._uuid + " .kpd-touch .kpd-button { background-color : " + G.touch.color + "; opacity : " + (G.touch.opacity / 100) + "; filter: alpha(opacity=" + G.touch.opacity + "); }")
        }
        x.push("	#" + this._uuid + " .kpd-group { width:" + G.iw + "px; height:" + G.ih + "px; overflow:hidden;}");
        if (!this._useMultiCursor && typeof G.text != "undefined" && G.text.use == true && y.attr("data-keypad-text") == "on") {
            x.push("	#" + this._uuid + " .kpd-text {" + G.text.style + "position:absolute;width:" + G.text.dw + "px; height:" + G.text.dh + "px; left:" + G.text.dx + "px; top:" + G.text.dy + "px; font-size:" + G.text.spanFontSize + "px;}");
            x.push("	#" + this._uuid + " .textfield {" + G.text.spanStyle + "}")
        }
        x.push("</style>");
        x.push('<div class="kpd-wrap ' + G.type + '">');
        var p = "";
        p = 'tabindex="0" ';
        x.push('		<img  style="position:absolute;left:0;top:0;border:0px;width:100%;height:100%" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAADAFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALI7fhAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAAApJREFUCJljYAAAAAIAAfRxZKYAAAAASUVORK5CYII=" alt="키패드" id="' + G.keypadUuid + '_bg_img"' + p + " /> ");
        if (G.touch.use == true) {
            x.push('<div class="kpd-touch">');
            x.push('	<div class="kpd-button touch1"></div>');
            x.push('	<div class="kpd-button touch2"></div>');
            x.push("</div>")
        }
        if (G.preview.use == true) {
            x.push('<div class="kpd-preview">');
            x.push('	<div class="preview ' + G.type + '"></div>');
            x.push("</div>")
        }
        if (typeof G.text != "undefined" && G.text.use == true && y.attr("data-keypad-text") == "on") {
            x.push('<div class="kpd-text" data-left="' + G.text.dx + '" data-top="' + G.text.dy + '" data-width="' + G.text.dw + '" data-height="' + G.text.dh + '" data-font-size="' + G.text.spanFontSize + '">');
            x.push('	<span class="textfield"></span>');
            x.push("</div>")
        }
        var s = this._uuid;
        nq(this._keypaditems).each(function(P) {
            var O = this;
            if (P == 0) {
                x.push('<div class="kpd-group ' + O.id + '" style="position:relative;">')
            } else {
                x.push('<div class="kpd-group ' + O.id + '" style="position:relative;display:none;";>')
            }
            var Q = 0;
            if (O.id == "upper") {
                Q = G.ih
            } else {
                if (O.id == "special") {
                    Q = G.ih * 2
                } else {
                    Q = 0
                }
            }
            x.push('		<img class="kpd-image-button" style="position:absolute;left:0;top:0;border:0px;margin-top:-' + Q + 'px;" aria-hidden="true" /> ');
            nq(this.buttons).each(function(V) {
                var T = this.coord.x1 + "," + this.coord.y1 + "," + this.coord.x2 + "," + this.coord.y2;
                var S = this.preCoord.x1 + "," + this.preCoord.y1 + "," + this.preCoord.x2 + "," + this.preCoord.y2;
                var R = this.label;
                if (typeof(R) == "undefined" || R == "") {
                    R = "키패드"
                }
                var U = "position: absolute;";
                U += "left: " + this.coord.x1 + "px;";
                U += "top: " + (this.coord.y1 - Q) + "px;";
                U += "width: " + (this.coord.x2 - this.coord.x1) + "px;";
                U += "height: " + (this.coord.y2 - this.coord.y1) + "px;";
                U += "margin-top: " + Q;
                U += "border: 1px solid #ff0000;";
                x.push('		<img class="kpd-data" aria-label="' + R + '" alt="' + R + '" style="' + U + '" data-coords="' + T + '" pre-coords="' + S + '" precoords="' + S + '" data-action="' + this.action + '" tabindex="0" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAADAFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALI7fhAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAAApJREFUCJljYAAAAAIAAfRxZKYAAAAASUVORK5CYII=" role="button" /> ')
            });
            x.push("</div>")
        });
        x.push("</div>");
        x.push("</div>");
        var q = false;
        var J = nq(this._element).attr("data-keypad-extui");
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.ExtendUI) != "undefined" && typeof(npPfsExtension.ExtendUI[J]) == "object") {
            this.useExtendUI = true;
            this.extendUI = npPfsExtension.ExtendUI[J]
        }
        if (this.useExtendUI) {
            var F = this.extendUI;
            var n = F.html();
            if (n != null) {
                var m = L.xw(document, "byid", b.div);
                var r = (m) ? nq(m) : nq("div." + b.div, nq(this._parent));
                r.append(n);
                F.mounted()
            }
            F.append(this, x.join("\n"))
        } else {
            nq("div." + b.div, nq(this._parent)).append(x.join("\n"));
            this.useExtendUI = false
        }
        var v = nq("#" + this._uuid);
        var I = nq(".kpd-npk-template", v);
        if (typeof(I) != "undefined") {
            I.removeClass("kpd-npk-template");
            I.addClass("kpd-npk-template-" + G.type)
        }
        nq("div.kpd-group img.kpd-image-button", v).attr("src", G.src);
        nq(".kpd-preview .preview", v).css({
            "background-image": "url('" + G.src + "')"
        });
        if (this.useExtendUI) {
            v.show()
        } else {
            v.hide()
        }
        this.bindEvents(b);
        if (typeof(G.range) != "undefined" && G.range != "") {
            nq(".kpd-group", v).hide();
            if (G.range.indexOf("lower") >= 0) {
                nq(".kpd-group.lower", v).show()
            } else {
                if (G.range.indexOf("upper") >= 0) {
                    nq(".kpd-group.upper", v).show()
                } else {
                    if (G.range.indexOf("special") >= 0) {
                        nq(".kpd-group.special", v).show()
                    } else {
                        nq(".kpd-group.lower", v).show()
                    }
                }
            }
        }
        y.addClass("nppfs-npv")
    };
    this.makeKeyPadDivHtml = function(p) {
        var n = nq("form");
        var m = nq(this._element);
        if (nq(".nppfs-keypad-div", p).length == 0) {
            var o = '<div class="nppfs-keypad-div"></div>';
            if (n.length == 0) {
                nq("body").prepend(o)
            } else {
                n.each(function() {
                    var r = nq(this);
                    nq(this).append(o)
                })
            }
        }
        if (nq(".nppfs-elements", p).length == 0) {
            var o = '<div class="nppfs-elements"></div>';
            if (n.length == 0) {
                nq("body").prepend(o)
            } else {
                n.each(function() {
                    var r = nq(this);
                    nq(this).append(o)
                })
            }
        }
        if (nq(".nppfs-keypad-style", nq("body")).length == 0) {
            var q = [];
            q.push('<style type="text/css" class="nppfs-keypad-style">');
            q.push("	div.nppfs-keypad-div { position:absolute; display:none; width:0px; height:0px; white-space:normal; overflow:visible;}");
            q.push("	div.nppfs-keypad-wrap { position:absolute; white-space:normal;}");
            q.push("	div.nppfs-keypad { position:relative; margin:0px; z-index:9999; white-space:normal;}");
            q.push("	div.nppfs-keypad .kpd-group { position:relative; z-index:10; width:0px; height:0px; white-space:normal;}");
            q.push("	div.nppfs-keypad .kpd-touch { position:relative; z-index:30; display:none; white-space:normal;}");
            q.push("	div.nppfs-keypad .kpd-preview { position:relative; z-index:40; margin-left:50%; white-space:normal;}");
            if (!this._useMultiCursor) {
                q.push("	div.nppfs-keypad .kpd-data { cursor:pointer; }");
                q.push("	div.nppfs-keypad .kpd-blank { cursor:default; }")
            }
            q.push("</style>");
            nq("body").prepend(q.join("\n"))
        }
    };
    this.touch = function(y, s) {
        if (L.au(y)) {
            return
        }
        var A = nq(y);
        var C = A.attr("data-action");
        if (C.indexOf("data:") < 0) {
            return
        }
        var v = A.css("left");
        var F = A.css("top");
        var H = A.css("width");
        var p = A.css("height");
        var n = parseInt(A.css("margin-top").replace("px", ""));
        var B = [];
        nq(".kpd-data", A.parent()).each(function() {
            if (nq(this).attr("data-action").indexOf("data:") != -1) {
                B.push(this)
            }
        });
        var x = (B.length <= 2) ? 0 : Math.round(Math.random() * (B.length) * 10) % (B.length);
        var q = B[x];
        var u = nq(q).css("left");
        var E = nq(q).css("top");
        var m = parseInt(nq(q).css("margin-top").replace("px", ""));
        if (v == u && F == E) {
            x = (x + 1) % B.length;
            q = B[x];
            u = nq(q).css("left");
            E = nq(q).css("top")
        }
        var G = nq(q).css("width");
        var o = nq(q).css("height");
        var r = nq(".kpd-touch", A.parent().parent());
        if (s != "single") {
            if (n < 0) {
                F = parseInt(F.replace("px", "")) - (n * -1) + "px"
            }
            if (m < 0) {
                E = parseInt(E.replace("px", "")) - (m * -1) + "px"
            }
        } else {
            if (n < 0) {
                F = parseInt(F.replace("px", "")) - (n * -1) + "px"
            }
        }
        nq(".kpd-button.touch1", r).css({
            left: v,
            top: F,
            width: H,
            height: p
        });
        nq(".kpd-button.touch2", r).css({
            left: u,
            top: E,
            width: G,
            height: o
        });
        if (s != "single") {
            nq(".kpd-button.touch2", r).css({
                left: u,
                top: E,
                width: G,
                height: o
            })
        } else {
            nq(".kpd-button.touch2", r).css({
                display: "none"
            })
        }
        if (this._isOldIe) {
            r.css({
                opacity: 1
            }).show();
            setTimeout(function() {
                r.hide()
            }, this._keypadinfo.touch.timeout)
        } else {
            r.stop().animate({
                opacity: 1
            }, 1);
            r.show().animate({
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
    this.activate = function() {
        var m = {};
        m.data = {
            info: this._keypadinfo
        };
        this.show(m, npVCtrl.isKeypadUse(i._element.name), i._element.name, i._element.form)
    };
    this.show = function(O, aa, n, v, ah) {
        var r = this;
        var s = nq(r._element);
        var H = nq(r._parent);
        var u = nq("#" + r._uuid);
        var Q = nq("div.kpd-text", u);
        if (u == null || u.length <= 0) {
            return
        }
        var ac = nq(window);
        if (r.useExtendUI && r.extendUI && r.extendUI.ancestor) {
            var X = u.parents(r.extendUI.ancestor);
            if (X.length > 0) {
                ac = X
            }
        }
        var J = {
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
        nq.extend(J, O.data.info);
        npVCtrl.hideAll(r._uuid);
        if (!r.isUseYn()) {
            r.hide();
            return
        }
        var Z = u.is(":visible");
        if (Z == false) {
            nq(document).trigger({
                type: "nppfs-npv-before-show",
                form: (L.au(r._element.form)) ? "" : nq(r._element.form).attr("name"),
                message: N.m90.replace("%p1%", s.attr("name")),
                target: r._element,
                name: s.attr("name"),
                time: new Date()
            })
        }
        var Y = u.parents(".nppfs-keypad-div");
        Y.show();
        if (J.resize === true && !r._isOldIe) {
            var ag = false;
            var B = u.attr("data-width");
            var I = u.attr("data-height");
            var m = B;
            var U = I;
            var W = J.resizeRadio / 100;
            var af = ac.width();
            if (af < Math.round(B / W)) {
                m = Math.round(af * W);
                W = m / B;
                U = Math.round(I * W);
                ag = true
            } else {
                if (D.isMobileDevice() && ac.width() <= ac.height() && af >= (B / " + rate + ")) {
                    m = Math.round(af * W);
                    W = m / B;
                    U = Math.round(I * W);
                    ag = true
                } else {
                    m = B;
                    U = I;
                    W = 1;
                    ag = false
                }
            }
            u.css({
                width: m + "px",
                height: U + "px"
            });
            nq("div.kpd-wrap", u).css({
                width: m + "px",
                height: U + "px",
                overflow: "hidden"
            });
            nq("div.kpd-wrap .keypad", u).css({
                "background-size": m * 2 + "px " + U + "px"
            });
            nq("div.kpd-wrap .keyboard", u).css({
                "background-size": m * 2 + "px " + U * 3 + "px"
            });
            nq("div.kpd-preview.preview.keypad", u).css({
                "background-size": m * 2 + "px " + U + "px"
            });
            nq("div.kpd-preview.preview.keyboard", u).css({
                "background-size": m * 2 + "px " + U + "px"
            });
            nq("div.kpd-group.number img.kpd-image-button", u).css({
                width: m * 2 + "px",
                height: U + "px"
            });
            nq("div.kpd-group.lower img.kpd-image-button", u).css({
                width: m * 2 + "px",
                height: U * 3 + "px"
            });
            nq("div.kpd-group.upper img.kpd-image-button", u).css({
                width: m * 2 + "px",
                height: U * 3 + "px",
                "margin-top": "-" + U + "px"
            });
            nq("div.kpd-group.special img.kpd-image-button", u).css({
                width: m * 2 + "px",
                height: U * 3 + "px",
                "margin-top": "-" + U * 2 + "px"
            });
            nq("div.kpd-group.upper img.kpd-data", u).css({
                "margin-top": "-" + U + "px"
            });
            nq("div.kpd-group.special img.kpd-data", u).css({
                "margin-top": "-" + U * 2 + "px"
            });
            if (typeof r._keypadinfo.text != "undefined" && r._keypadinfo.text.use == true && s.attr("data-keypad-text") == "on") {
                nq("div.kpd-text", u).css({
                    width: Math.floor(Q.attr("data-width") * W) + 1 + "px",
                    height: Math.floor(Q.attr("data-height") * W) + 1 + "px",
                    top: Math.floor(Q.attr("data-top") * W) + "px",
                    left: Math.floor(Q.attr("data-left") * W) + "px",
                    "font-size": Math.floor(Q.attr("data-font-size") * W) + "px",
                    "z-index": "20"
                })
            }
            nq("img.kpd-data", nq("div.kpd-group", u)).each(function() {
                var ak = nq(this).attr("data-coords");
                var ai = nq(this).attr("pre-coords");
                var aj = ak.split(",");
                nq(this).css({
                    left: parseInt(aj[0] * W) + "px",
                    top: parseInt(aj[1] * W) + "px",
                    width: parseInt((aj[2] - aj[0]) * W) + "px",
                    height: parseInt((aj[3] - aj[1]) * W) + "px"
                });
                aj = ai.split(",");
                newCoords = "";
                newCoords += parseInt(aj[0] * W) + ",";
                newCoords += parseInt(aj[1] * W) + ",";
                newCoords += parseInt(aj[2] * W) + ",";
                newCoords += parseInt(aj[3] * W);
                nq(this).attr("preCoords", newCoords)
            })
        }
        if (J.mode == "layer") {
            var P = s;
            var q = r.getBounds(P);
            var M = u.parents(".nppfs-keypad-div");
            var p = r.getBounds(M);
            var K = u;
            var o = r.getBounds(K);
            var x = parseInt(m, 10);
            var C = parseInt(U, 10);
            var T = ac.width();
            var A = ac.height();
            if ("left" === J.position.x) {
                if (ag) {
                    K.css("left", ((T - x) / 2 - p.left) + "px")
                } else {
                    K.css("left", (J.position.deltax - p.left) + "px")
                }
            } else {
                if ("right" === J.position.x) {
                    if (ag) {
                        K.css("left", ((T - x) / 2 - p.left) + "px")
                    } else {
                        K.css("left", (T - x - (J.position.deltax) - p.left) + "px")
                    }
                } else {
                    if ("center" === J.position.x) {
                        if (ag) {
                            K.css("left", ((T - x) / 2 - p.left) + "px")
                        } else {
                            K.css("left", ((T - x) / 2 + (J.position.deltax) - p.left) + "px")
                        }
                    } else {
                        if (ag) {
                            K.css("left", ((T - x) / 2 - p.left) + "px")
                        } else {
                            var G = q.left - p.left + (J.position.deltax);
                            if (G + x + 10 > T) {
                                G = T - x - 10
                            }
                            if (G < -1 * p.left) {
                                G = -1 * p.left
                            }
                            K.css("left", G + "px")
                        }
                    }
                }
            }
            if ("top" === J.position.y) {
                var F = (ac.scrollTop() + (J.position.deltay) - p.top);
                K.css("top", F + "px")
            } else {
                if ("bottom" === J.position.y) {
                    var F = (ac.scrollTop() + A - C - (J.position.deltay) - p.top);
                    K.css("top", F + "px")
                } else {
                    if ("middle" === J.position.y) {
                        K.css("top", (ac.scrollTop() + (A - C) / 2 + (J.position.deltay) - p.top) + "px")
                    } else {
                        if ("auto" === J.position.y) {
                            var F = 0;
                            var V = (q.top + q.height + C + (J.position.deltay));
                            var S = (q.top - C - (J.position.deltay));
                            var R = ac.scrollTop();
                            if (V > R + A) {
                                if (S < R) {
                                    F = ((q.top + q.height) - p.top + (J.position.deltay))
                                } else {
                                    F = ((q.top - C) - p.top - (J.position.deltay))
                                }
                            } else {
                                F = ((q.top + q.height) - p.top + (J.position.deltay))
                            }
                            K.css("top", F + "px")
                        } else {
                            var F = ((q.top + q.height) - p.top + (J.position.deltay));
                            K.css("top", F + "px")
                        }
                    }
                }
            }
        }
        if (s.attr("data-keypad-action") != "pin") {
            s.css({
                "background-color": r._keypadinfo.color.nbc,
                color: r._keypadinfo.color.nfc
            })
        }
        if (Z == false) {
            g(r._uuid, r._keypadinfo);
            u.show();
            nq(document).trigger({
                type: "nppfs-npv-after-show",
                form: (L.au(r._element.form)) ? "" : nq(r._element.form).attr("name"),
                message: N.m91.replace("%p1%", s.attr("name")),
                target: r._element,
                name: s.attr("name")
            })
        }
        if (D.isMobileDevice()) {
            var E = 3000;
            var y = Date.now();
            var ab = setInterval(function() {
                if (u.is(":visible")) {
                    nq("#" + r._keypadinfo.keypadUuid + "_bg_img").focus();
                    clearInterval(ab)
                } else {
                    if (Date.now() - y > E) {
                        clearInterval(ab)
                    }
                }
            }, 100)
        } else {
            nq("#" + r._keypadinfo.keypadUuid + "_bg_img").focus()
        }
        if (Z == false || J.mode == "extendui") {
            if (r.useExtendUI && r.extendUI) {
                var ae = r.extendUI;
                ae.show(r, ah)
            }
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
        var u = this;
        var o = nq(u._element);
        var r = nq(u._parent);
        var p = nq("#" + u._uuid, r);
        var q = p.is(":visible");
        if (q && o.attr("data-keypad-refresh") == "on") {
            p.hide();
            u.refreshDiv("")
        } else {
            p.hide()
        }
        if (o.attr("data-keypad-action") != "pin") {
            o.css({
                "background-color": u._keypadinfo.color.fbc,
                color: u._keypadinfo.color.ffc
            })
        }
        if (!u.isUseYn() && bh.isRunning()) {
            bh.resetColor(u._element)
        }
        if (typeof(o.attr("nppfs-readonly")) == "undefined") {
            o.removeAttr("readonly")
        }
        if (D.and) {
            o.removeAttr("readonly")
        }
        if (q) {
            var m = (typeof(event) == "undefined") ? "" : nq(event.target);
            var s = (L.bn(m)) ? "" : m.attr("data-action");
            nq(document).trigger({
                type: "nppfs-npv-after-hide",
                form: (L.au(u._element.form)) ? "" : nq(u._element.form).attr("name"),
                message: N.m92.replace("%p1%", o.attr("name")),
                target: u._element,
                name: o.attr("name"),
                time: new Date(),
                action: (!L.bn(s) ? s.substring(7) : "")
            });
            o.trigger({
                type: "change"
            })
        }
        if (u.useExtendUI && u.extendUI) {
            var n = u.extendUI;
            n.hide(u)
        }
    };
    var i = this;
    this.close = function() {
        this.hide();
        var n = {
            type: "nppfs-npv-closed",
            message: N.m93.replace("%p1%", nq(i._element).attr("name")),
            target: i._element,
            name: nq(i._element).attr("name"),
            form: (L.au(i._element.form)) ? "" : nq(i._element.form).attr("name"),
            time: new Date()
        };
        nq(document).trigger(n);
        if (i.useExtendUI && i.extendUI) {
            var m = i.extendUI;
            m.close()
        }
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
        var o = nq("#" + i._uuid);
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
                r.push('		<img class="kpd-data" aria-label="' + y + '" alt="' + y + '" style="' + C + '" data-coords="' + B + '" pre-coords="' + A + '" precoords="' + A + '" data-action="' + this.action + '" tabindex="0" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAMAAAAoyzS7AAADAFBMVEX///8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALI7fhAAAAAXRSTlMAQObYZgAAAAlwSFlzAAAOwwAADsMBx2+oZAAAAApJREFUCJljYAAAAAIAAfRxZKYAAAAASUVORK5CYII=" role="button" /> ')
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
                m.on("click keyup", i.ai)
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
    this.doenter = function() {
        var p = i._keypadinfo;
        var n = i._element;
        if (p.enter.indexOf("function") == 0) {
            var m = p.enter.substring(9);
            try {
                if (window.execScript) {
                    window.execScript(m)
                } else {
                    window["eval"].call(window, m)
                }
            } catch (o) {
                Mc.log(o)
            }
        } else {
            if (p.enter == "hideall") {
                npVCtrl.hideAll()
            } else {
                if (p.enter == "hide") {
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
            message: N.m94.replace("%p1%", nq(n).attr("name")),
            target: n,
            name: nq(n).attr("name"),
            form: (L.au(n.form)) ? "" : nq(n.form).attr("name"),
            time: new Date()
        })
    };
    this.deleteone = function() {
        var q = i._keypadinfo;
        var x = nq(i._element);
        var m = nq(i._hashelement);
        var s = null;
        var o = (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function" && x.attr("nppfs-formatter-type") != undefined);
        var n = (typeof q.text != "undefined" && q.text.use == true && x.attr("data-keypad-text") == "on");
        if (n) {
            s = nq("div.kpd-text span.textfield", $divkeypad)
        }
        if (o) {
            x.val(npPfsExtension.formatter(x, false))
        }
        if (x.attr("data-keypad-action") == "amount") {
            x.val(L.uncomma(x.val()))
        }
        var v = x.val();
        var p = m.val();
        var r = i.length();
        if (npVCtrl.rsa == true) {
            x.val(v.substring(0, v.length - 1));
            m.val(p.substring(0, p.length - 96));
            if (n) {
                s.text(s.text().substring(0, s.text().length - 1))
            }
        } else {
            x.val(v.substring(0, v.length - 1));
            m.val(p.substring(0, p.length - 40))
        }
        if (o) {
            x.val(npPfsExtension.formatter(x, true));
            var u = nq("input[name='" + x.attr("name") + "__FORMATTER__']");
            u.val(u.val().substring(0, u.val().length - 1));
            if (n) {
                s.text(x.val())
            }
        }
        if (x.attr("data-keypad-action") == "amount") {
            x.val(L.comma(x.val()));
            if (n) {
                s.text(x.val())
            }
        }
        x.trigger({
            type: "keypress",
            which: 8,
            keyCode: 8
        });
        x.trigger({
            type: "keyup",
            which: 8,
            keyCode: 8
        });
        if (i.useExtendUI && i.extendUI) {
            if (r === 0) {
                i.extendUI.input(i, 8, "ignore")
            } else {
                i.extendUI.input(i, 8, "delete")
            }
        }
    };
    this.ai = function(P) {
        P.stopPropagation();
        P.preventDefault();
        P.stopImmediatePropagation();
        if (P.type == "keyup" && P.keyCode != "13") {
            return
        }
        var T = i._keypadinfo;
        var F = i._keypaditems;
        var E = nq(i._element);
        var B = nq(i._hashelement);
        var G = nq(i._parent);
        var v = nq("#" + i._uuid);
        var W = P.target;
        var O = nq(W).attr("data-action");
        var M = null;
        if (T.touch.use == true && !i._useMultiCursor) {
            i.touch(W, L.n2b(T.touch.touchEventMode, "default"))
        }
        if (T.preview.use == true && !i._useMultiCursor) {
            i.preview(W)
        }
        if (O == null || O == "") {
            return
        }
        var p = (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.formatter) == "function" && E.attr("nppfs-formatter-type") != undefined);
        var U = (typeof T.text != "undefined" && T.text.use == true && E.attr("data-keypad-text") == "on");
        if (U) {
            M = nq("div.kpd-text span.textfield", v)
        }
        var S = E.prop("maxlength");
        if (L.au(S)) {
            S = 0
        }
        if (O.indexOf("action") == 0) {
            if (O.indexOf("show") == 7) {
                var o = O.substring(12);
                nq(".kpd-group", v).hide();
                nq(".kpd-group." + o, v).show();
                if (D.and) {
                    i.close();
                    npVCtrl.isRefresh = true;
                    setTimeout(function() {
                        v.show();
                        nq(".kpd-group." + o, v).show();
                        nq("#" + i._keypadinfo.keypadUuid + "_bg_img").focus();
                        npVCtrl.isRefresh = false
                    }, 100)
                } else {
                    nq("#" + i._keypadinfo.keypadUuid + "_bg_img").focus()
                }
            } else {
                if (O.indexOf("hide") == 7) {
                    i.hide()
                } else {
                    if (O.indexOf("close") == 7) {
                        i.close()
                    } else {
                        if (O.indexOf("delete") == 7) {
                            i.deleteone()
                        } else {
                            if (O.indexOf("clear") == 7) {
                                E.val("");
                                B.val("");
                                if (U) {
                                    M.text("")
                                }
                                if (p) {
                                    var Y = nq("input[name='" + E.attr("name") + "__FORMATTER__']");
                                    Y.val("");
                                    npPfsExtension.formatter(E, false)
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
                                });
                                if (i.useExtendUI && i.extendUI) {
                                    i.extendUI.input(i, 8, "clear")
                                }
                            } else {
                                if (O.indexOf("enter") == 7) {
                                    i.doenter()
                                } else {
                                    if (O.indexOf("refresh") == 7) {
                                        var o = O.substring(15);
                                        i.refreshDiv(o);
                                        nq(window).trigger({
                                            type: "resize",
                                            form: (L.au(i._element.form)) ? "" : nq(i._element.form).attr("name"),
                                            target: i._element,
                                            name: E.attr("name")
                                        })
                                    } else {
                                        if (O.indexOf("link") == 7) {
                                            var x = O.split("|");
                                            var J = "";
                                            var K = [];
                                            var X = x[1];
                                            if (x.length > 3) {
                                                for (var R = 2; R < x.length; R++) {
                                                    K.push(x[R])
                                                }
                                                J = K.join("|")
                                            } else {
                                                J = x[2]
                                            }
                                            window.open(J, X)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } else {
            if (O.indexOf("data") == 0) {
                var V = O.indexOf(":", 5) == -1 ? 45 : O.indexOf(":", 5);
                var I = O.substring(5, V);
                var u = (V >= 0 && O.length > V + 1) ? O.substring(V + 1) : "*";
                if (I == "korean") {
                    u = String.fromCharCode(u);
                    var C = i._element;
                    var Q = i._hashelement;
                    if (u.charCodeAt(0) < 128) {
                        L.val(C, L.val(Q) + u);
                        L.val(Q, L.val(Q) + u)
                    } else {
                        var H = L.val(Q) + u;
                        var r = npVCtrl.Hangul.splitWord(H, 2);
                        var A = npVCtrl.Hangul.composeHangul(r[1]);
                        L.val(C, r[0] + A);
                        L.val(Q, r[0] + A)
                    }
                    L.val(C, L.val(Q));
                    if (U) {
                        M.text(nq(C).val())
                    }
                } else {
                    var m = npVCtrl.encrypt(I);
                    if (u.indexOf("p") == 0) {
                        u = String.fromCharCode(parseInt(u.substring(1)))
                    }
                    if (p) {
                        E.val(npPfsExtension.formatter(E, false))
                    }
                    if (E.attr("data-keypad-action") == "amount") {
                        E.val(L.uncomma(E.val()))
                    }
                    if (S <= 0 || E.val().length < S) {
                        E.val(E.val() + u);
                        B.val(B.val() + m);
                        if (p) {
                            var Y = nq("input[name='" + E.attr("name") + "__FORMATTER__']");
                            Y.val(Y.val() + "1")
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
                        var q = i.length();
                        if (i.useExtendUI && i.extendUI) {
                            i.extendUI.input(i, s, "data")
                        }
                        var n = E.attr("data-keypad-next");
                        if (S > 0 && q >= S && !L.bn(n)) {
                            if (n == "__hide__") {
                                i.hide()
                            } else {
                                if (n == "__doenter__") {
                                    i.doenter()
                                } else {
                                    var y = nq("input[name='" + n + "']");
                                    if (y.is(":visible") && y.css("visibility") === "visible") {
                                        y[0].focus()
                                    } else {
                                        npVCtrl.showKeypad(n)
                                    }
                                }
                            }
                        }
                        if (U) {
                            if (E.attr("type") == "password") {
                                M.text(M.text() + "*")
                            } else {
                                M.text(M.text() + u)
                            }
                        }
                    }
                    if (p) {
                        E.val(npPfsExtension.formatter(E, true));
                        if (U && typeof E.attr("nppfs-formatter-type") != "undefined") {
                            M.text(E.val())
                        }
                    }
                    if (E.attr("data-keypad-action") == "amount") {
                        E.val(L.comma(E.val()));
                        if (U) {
                            M.text(E.val())
                        }
                    }
                }
                if (T.type == "keyboard") {
                    if (typeof(T.capslock) != "undefined" && T.capslock == false) {
                        if (typeof(T.shift) != "undefined" && T.shift == true && nq(".kpd-group.upper", v).css("display") != "none") {
                            if (typeof(T.range) != "undefined" && T.range != "") {
                                nq(".kpd-group", v).hide();
                                if (T.range.indexOf("lower") >= 0) {
                                    nq(".kpd-group.lower", v).show()
                                } else {
                                    if (T.range.indexOf("upper") >= 0) {
                                        nq(".kpd-group.upper", v).show()
                                    } else {
                                        if (T.range.indexOf("special") >= 0) {
                                            nq(".kpd-group.special", v).show()
                                        } else {
                                            nq(".kpd-group.lower", v).show()
                                        }
                                    }
                                }
                            } else {
                                nq(".kpd-group", v).hide();
                                nq(".kpd-group.lower", v).show()
                            }
                        }
                    }
                }
            } else {}
        }
        P.stopPropagation();
        P.preventDefault();
        P.stopImmediatePropagation()
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
    this.bindEvents = function(n) {
        var p = this;
        var v = nq(p._element);
        var o = nq(p._parent);
        var s = nq("#" + p._uuid);
        var u = v.attr("data-keypad-useyn-type");
        var q = v.attr("data-keypad-useyn-input");
        var m = ".kpd-group .kpd-data";
        if (D.isMobileDevice() && !D.ff) {
            if (D.ios) {
                nq(m, s).on("touchstart", this.ai)
            } else {
                nq(m, s).on("click", this.ai)
            }
        } else {
            nq(m, s).on("click keyup", this.ai)
        }
        v.on("focus", function(A) {
            npVCtrl.hideAll(p._uuid);
            if (p._keypadinfo.mode == "layer" && nq("#" + p._uuid).css("display") == "block" && !D.isMobileDevice()) {
                A.preventDefault();
                A.stopPropagation();
                return
            }
            var x = L.n2b(v.attr("data-keypad-mapping"));
            var y = L.n2b(v.attr("data-keypad-ui"));
            if (x == "true" && y != "true") {
                A.preventDefault();
                A.stopPropagation();
                return
            }
            if ((v.attr("readonly") == true || v.attr("readonly") == "readonly") && (typeof(bh) != "undefined" && bh.isRunning())) {
                v.attr("nppfs-readonly", true)
            }
            if (v.prop("disabled") == true) {
                A.preventDefault();
                A.stopPropagation();
                return
            }
            if (v.attr("keypad-disabled-ui") == "true") {
                return
            }
            if (p.isUseYn()) {
                v.attr("readonly", true);
                if (u != "checkbox" && u != "radio") {
                    p.show(n, u, p._useynfield)
                } else {
                    p.show(n, u, q)
                }
                v.blur()
            } else {
                if (v.attr("nppfs-readonly") != "true") {
                    v.attr("readonly", false)
                } else {
                    v.attr("readonly", true)
                }
            }
            if (p._keypadinfo.focusmode == "clear") {
                if (v.attr("nppfs-readonly") != "true" && !npVCtrl.isRefresh) {
                    p.reset()
                }
            }
            npVCtrl.isRefresh = false;
            A.stopPropagation();
            A.preventDefault()
        });
        v.on("focusout blur", function(x) {});
        v.on("keydown", function(y) {
            y = (y) ? y : ((typeof(y) != "undefined") ? y : null);
            var x = (y.charCode) ? y.charCode : ((y.keyCode) ? y.keyCode : y.which);
            if (p.isUseYn() == true) {
                L.so(y)
            }
        });
        if (u == "checkbox" || u == "radio") {
            if (npVCtrl.isAbsoluteUse()) {
                nq("input[name='" + q + "'][value='Y']").prop("checked", true)
            }
            nq("input[name='" + q + "']").on("click", function(y) {
                if (v.attr("keypad-disabled-ui") == "true") {
                    y.preventDefault();
                    return
                }
                if (!nq("input[name='" + q + "']").hasClass("nppfs-npv")) {
                    nq("input[name='" + q + "']").addClass("nppfs-npv")
                }
                if (v.prop("disabled") == true) {
                    y.preventDefault();
                    y.stopPropagation();
                    return
                }
                var x = L.n2b(nq("input[name='" + q + "']").attr("data-keypad-focus-field"), "");
                if (npVCtrl.isAbsoluteUse() && ((u == "checkbox" && !this.checked) || u == "radio" && this.value != "Y")) {
                    L.alert(N.m88);
                    nq("input[name='" + q + "'][value='Y']").prop("checked", true);
                    y.preventDefault()
                } else {
                    if (x != "") {
                        if (x == v.attr("name")) {
                            p.show(n, u, q)
                        }
                    } else {
                        p.show(n, u, q)
                    }
                }
                y.stopPropagation();
                v.attr("readonly", p.isUseYn());
                p.setUseYn(p.isUseYn());
                p.reset()
            })
        } else {
            if (u == "toggle") {
                var r = npVCtrl.isAbsoluteUse() ? "Y" : "N";
                if (npVCtrl.isAbsoluteUse()) {
                    if (D.and) {
                        v.attr({
                            readonly: false,
                            "data-input-useyn-type": "toggle",
                            "data-keypad-useyn-input": p._useynfield
                        })
                    } else {
                        v.attr({
                            readonly: true,
                            "data-input-useyn-type": "toggle",
                            "data-keypad-useyn-input": p._useynfield
                        })
                    }
                    p.reset();
                    nq(".nppfs-elements", o).append('<input type="hidden" name="' + p._useynfield + '" value="Y" class="nppfs-dynamic-field" />');
                    nq("#" + q).attr("src", p._keypadinfo.inputs.toggleon)
                } else {
                    v.attr({
                        readonly: false,
                        "data-input-useyn-type": "toggle",
                        "data-keypad-useyn-input": p._useynfield
                    });
                    nq(".nppfs-elements", o).append('<input type="hidden" name="' + p._useynfield + '" value="N" class="nppfs-dynamic-field" />');
                    nq("#" + q).attr("src", p._keypadinfo.inputs.toggleoff)
                }
                nq("#" + q).css("cursor", "pointer").on("click", function(y) {
                    if (v.attr("keypad-disabled-ui") == "true") {
                        y.preventDefault();
                        return
                    }
                    if (!nq("#" + q).hasClass("nppfs-npv")) {
                        nq("#" + q).addClass("nppfs-npv")
                    }
                    if (v.prop("disabled") == true) {
                        y.preventDefault();
                        y.stopPropagation();
                        return
                    }
                    $input = nq("input[name='" + p._useynfield + "']");
                    if (npVCtrl.isAbsoluteUse() && $input.val() == "Y") {
                        L.alert(N.m88)
                    } else {
                        if ($input.val() == "Y") {
                            v.attr("readonly", false);
                            $input.val("N");
                            nq(this).attr("src", p._keypadinfo.inputs.toggleoff)
                        } else {
                            v.attr("readonly", true);
                            $input.val("Y");
                            nq(this).attr("src", p._keypadinfo.inputs.toggleon)
                        }
                        p.show(n, u, p._useynfield);
                        var x = L.n2b(nq("#" + q).attr("data-keypad-focus-field"), "");
                        if (x != "") {
                            nq("input[name='" + x + "']").focus()
                        }
                    }
                    v.attr("readonly", p.isUseYn());
                    p.setUseYn(p.isUseYn());
                    p.reset();
                    y.stopPropagation()
                })
            } else {
                var r = npVCtrl.isAbsoluteUse() ? "Y" : "N";
                if (D.and) {
                    v.attr({
                        readonly: false,
                        "data-input-useyn-type": "toggle",
                        "data-keypad-useyn-input": p._useynfield
                    })
                } else {
                    v.attr({
                        readonly: npVCtrl.isAbsoluteUse(),
                        "data-input-useyn-type": "toggle",
                        "data-keypad-useyn-input": p._useynfield
                    })
                }
                nq(".nppfs-elements", o).append('<input type="hidden" name="' + p._useynfield + '" value="' + r + '" class="nppfs-dynamic-field" />')
            }
        }
        if (this.useExtendUI) {
            this.extendUI.on(this)
        }
        if (!this._isVeryOldIe) {
            var s = nq("#" + p._uuid);
            nq(window).on("resize scroll", function(x) {
                if (s.is(":visible")) {
                    if (x.type === "scroll" || (x.type === "resize" && !x.name || (x.name === v.attr("name") && (!x.form || x.form === nq(p._element.form).attr("name"))))) {
                        if (u == "checkbox" || u == "radio") {
                            p.show(n, u, q)
                        } else {
                            p.show(n, u, p._useynfield)
                        }
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
            L.alert(N.m88);
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
    this.length = function() {
        var m = nq(i._hashelement);
        return (npVCtrl.rsa == true) ? m.val().length / 96 : m.val().length / 40
    };
    this.text = function() {
        var n = this;
        var m = nq(n._element);
        return m.val()
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
        if (this.useExtendUI) {
            this.extendUI.off(this)
        }
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
                    L.alert(N.m30)
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
        if (!npVCtrl.Qh || !npVCtrl.Nw || !npVCtrl.rsa) {
            npVCtrl.Qh = npVCtrl.Qh ? npVCtrl.Qh : L.hH(L.mL(32));
            L.send(uV.dV.zo, "m=p&u=" + npVCtrl.uuid, {
                async: false,
                ax: function(A) {
                    if (A.readyState == 4) {
                        if (A.status == 200) {
                            y(A.responseText, npVCtrl.Qh, false)
                        } else {
                            Mc.log(N.m30);
                            npVCtrl.rsa = false
                        }
                    }
                }
            })
        } else {
            nq(document).trigger({
                type: "nppfs-npv-jvp",
                time: new Date()
            })
        }
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
            if (!L.au(nq(E).attr("data-keypad-useyn-input")) && nq(E).attr("data-keypad-useyn-input").indexOf("__KU_") < 0) {
                nq(E).attr("ori-data-keypad-useyn-input", nq(E).attr("data-keypad-useyn-input"))
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
            SHOW_EXTEND_UI: "u",
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
        var Y = "data-keypad-";
        var Z = p(T, Y + "useyn");
        var V = [];
        q(V, "m", (!!R) ? R : "e");
        q(V, "u", npVCtrl.uuid);
        q(V, "ev", "v4");
        q(V, "d", p(T, Y + "div") || "nppfs-keypad-div");
        q(V, "jv", "1.13.0");
        var G = T.type.toString().toLowerCase();
        var H = p(T, Y + "type") || "num";
        if (H == "alpha") {
            q(V, "t", K.i8)
        } else {
            if (H == "korean") {
                q(V, "t", K.n3)
            } else {
                q(V, "t", K.K1)
            }
        }
        if (H == "korean" && G == "password") {
            L.alert(N.m46);
            Mc.log(N.m46);
            bM.aO(ad.bb);
            return
        }
        var F = p(T, Y + "action");
        if (F == "account") {
            q(V, "at", K.u7)
        } else {
            if (F == "amount") {
                q(V, "at", K.eV)
            } else {
                if (F == "number") {
                    q(V, "at", K.w3)
                } else {
                    if (F == "replace") {
                        q(V, "at", K.b5)
                    } else {
                        if (H == "num" && (G == "text" || G == "tel")) {
                            q(V, "at", K.w3)
                        } else {
                            if (H == "alpha" && G == "text") {
                                q(V, "at", K.ju)
                            } else {
                                if (F == "password" || F == "pin") {
                                    q(V, "at", K.x8)
                                } else {
                                    q(V, "at", K.b5)
                                }
                            }
                        }
                    }
                }
            }
        }
        var aa = false;
        var ab = p(T, Y + "extui");
        if (typeof(npPfsExtension) != "undefined" && typeof(npPfsExtension.ExtendUI) !== "undefined" && typeof(npPfsExtension.ExtendUI[ab]) == "object") {
            aa = true
        }
        if (aa) {
            q(V, "st", K.SHOW_EXTEND_UI);
            q(V, "dp", "show")
        } else {
            var O = p(T, Y + "show");
            if (O == "div") {
                q(V, "st", K.x4);
                q(V, "dp", "show")
            } else {
                if (O == "block") {
                    q(V, "st", K.s8);
                    q(V, "dp", "hide")
                } else {
                    q(V, "st", K.b4);
                    q(V, "dp", "hide")
                }
            }
        }
        var W = p(T, Y + "useyn-type");
        var Z = p(T, Y + "useyn-input");
        var U = p(T, "data-keypad-mode");
        var Q = nq(T).attr(zp.aG.AN);
        if (Q == "mo") {
            if (L.bn(W) || L.bn(Z)) {
                W = "focus"
            }
        } else {
            if (bh.isRunning()) {
                if (!L.bn(W) && L.bn(Z)) {
                    L.alert(N.m77.replace("%p1%", T.name).replace("%p1%", Y + "useyn-input"))
                }
                var I = p(T, "npexecutetype");
                if (I == "v") {
                    W = "focus"
                } else {
                    if (L.bn(W) || W == "focus" || !L.bn(W) && L.bn(Z)) {
                        return
                    }
                }
            } else {
                if (L.bn(W) || L.bn(Z)) {
                    W = "focus"
                }
            }
        }
        if (!L.bn(W) && W != "focus" && L.bn(Z)) {
            L.alert(N.m77.replace("%p1%", T.name).replace("%p1%", Y + "useyn-input"));
            return
        }
        if (W == "checkbox") {
            q(V, "ut", K.i9);
            q(V, "ui", Z);
            var y = L.bZ(Z, C);
            if (L.au(y)) {}
        } else {
            if (W == "radio") {
                q(V, "ut", K.s2);
                q(V, "ui", Z)
            } else {
                if (W == "toggle") {
                    q(V, "ut", K.gQ);
                    q(V, "ui", Z);
                    var P = p(T, Y + "toggle-active");
                    var M = p(T, Y + "toggle-on");
                    var E = p(T, Y + "toggle-off");
                    M = L.bn(M) ? "/pluginfree/icon/icon_mouse_on.gif" : M;
                    E = L.bn(E) ? "/pluginfree/icon/icon_mouse_off.gif" : E;
                    q(V, "ta", L.bn(P) ? "false" : P);
                    q(V, "to", M);
                    q(V, "tf", E);
                    var y = L.bZ(Z, C);
                    if (L.au(y)) {}
                } else {
                    q(V, "ut", K.q2)
                }
            }
        }
        var S = p(T, Y + "input-range");
        if (H == "alpha" && !L.bn(S)) {
            q(V, "ir", S)
        }
        var X = p(T, Y + "preview");
        if (!L.bn(X)) {
            q(V, "up", X)
        }
        q(V, "f", nq(C).attr("data-nppfs-form-id"));
        q(V, "i", T.name);
        q(V, "il", p(T, "maxlength"));
        q(V, "ni", p(T, Y + "next"));
        q(V, "th", p(T, Y + "theme"));
        q(V, "x", p(T, Y + "x"));
        q(V, "y", p(T, Y + "y"));
        q(V, "tx", p(T, Y + "type-x"));
        q(V, "ty", p(T, Y + "type-y"));
        q(V, "w", document.body.offsetWidth);
        q(V, "h", document.body.offsetHeight);
        q(V, "cf", p(T, Y + "enter"));
        q(V, "ln", p(T, Y + "language"));
        q(V, "ar", "true");
        var B = p(T, Y + "mapping");
        if (!L.bn(B)) {
            q(V, "um", B)
        }

        function J() {
            var ae = uV.dV.zo;
            if (ae.indexOf("http:") != 0 && ae.indexOf("https:") != 0 && ae.indexOf("//:") != 0) {
                var ac = location.protocol + "//" + location.hostname + (location.port ? ":" + location.port : "");
                ae = ac + ae
            }
            return ae
        }
        q(V, "ip", J());
        if (this.isAbsoluteUse()) {
            if (!D.and) {
                T.readOnly = true
            }
        }
        var A = "task_" + nq(T.form).attr("name") + "_" + nq(T).attr("name");
        if (L.indexOf(n, A) < 0) {
            n.push(A)
        }
        return V.join("&")
    };
    this.Iq = function(A, y, B) {
        L.send(uV.dV.zo, B, {
            ax: function(K) {
                if (K.readyState == 4) {
                    var E = "task_" + nq(A).attr("name") + "_" + nq(y).attr("name");
                    n.splice(L.indexOf(n, E), 1);
                    if (K.status == 200) {
                        var H = K.responseText;
                        if (!L.bn(H)) {
                            var M = nq.parseJSON(H);
                            if (!L.au(k) && !L.au(k.eK)) {
                                if (!L.bn(k.eK.hl)) {
                                    M.info.color.nfc = k.eK.hl
                                }
                                if (!L.bn(k.eK.gW)) {
                                    M.info.color.nbc = k.eK.gW
                                }
                                if (!L.bn(k.eK.jJ)) {
                                    M.info.color.ffc = k.eK.jJ
                                }
                                if (!L.bn(k.eK.kM)) {
                                    M.info.color.fbc = k.eK.kM
                                }
                            }
                            var C = nq(y).attr("data-keypad-div") || "nppfs-keypad-div";
                            nq(y).keypad({
                                data: M,
                                div: C
                            });
                            npPfsCtrl.putDynamicField(A, nq(y).attr("name"), [M.info.inputs.info]);
                            npPfsCtrl.putDynamicField(A, nq(y).attr("name"), [M.info.inputs.hash]);
                            npPfsCtrl.putDynamicField(A, nq(y).attr("name"), [M.info.inputs.useyn]);
                            if (!L.au(M.actionItems)) {
                                var J = M.actionItems.substring(0, 64);
                                var H = M.actionItems.substring(64);
                                var F = L.gu(L.ha(H), L.ha(J), "ECB", AES.blackSizeInBits);
                                var G = JSON.parse(F);
                                m(y, G)
                            }
                            var I = nq(y).attr("npexecutetype");
                            if ((typeof(I) != "undefined" && I.indexOf("k") == -1) && (typeof(bh) != "undefined" && bh.isRunning())) {
                                if (I == "v") {
                                    nq(npVCtrl.keypadObject).each(function() {
                                        if (L.au(this)) {
                                            return true
                                        }
                                        if (nq(this._element).attr("name") == nq(y).attr("name")) {
                                            this.setUseYn(true)
                                        }
                                    })
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
            if (B == "i" || B == "ui") {
                y.push(B + "=" + L.sz(A, true))
            } else {
                y.push(B + "=" + L.sz(A))
            }
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
    this.setKeypadUse = function(y, A) {};
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
    this.showKeypad = function(A, B, C) {
        var y = {};
        nq(this.keypadObject).each(function() {
            if (L.au(this)) {
                return true
            }
            if (nq(this._element).attr("name") == A) {
                y.data = {
                    info: this._keypadinfo
                };
                this.show(y, npVCtrl.isKeypadUse(A), A, B, C);
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
    this.moveToInstall = function(A) {
        if (A == "layer") {
            var y = "";
            if (y == "undefined" || y.length < 0) {
                y = ""
            }
            if (y !== null && y !== "") {
                y = y + "?redirect=" + encodeURIComponent(location.href);
                npVCtrl.hideAll();
                L.showInstallLayer(y)
            }
        } else {
            if (A == "default") {
                if (typeof(zp.aG.MI) == "function") {
                    zp.aG.MI(uV.dV.Fz, null, false)
                }
            }
        }
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
                    try {
                        L.showInstallLayer(url);
                    } catch (e) {
                        npCommon.showInstallLayer(url);
                    }
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

                    //					npPfsCtrl.setCookie("npPfsIgnore", "true");
                    /*
					try{
						if(npBaseCtrl.foundPort == false){
							npBaseCtrl.terminate = false;
							npBaseCtrl.isStartup = false;
							
							npBaseCtrl.Options.FW = false;
							npBaseCtrl.Options.SK = false;
							npBaseCtrl.Options.FD = false;
						} else {
							callback(true);
						}
					
					} catch(e) {
						if(zp.cz == false){
							zp.JF = false;
							zp.isStartup = false;
							
							zp.aG.FW = false;
							zp.aG.SK = false;
							zp.aG.FD = false;
						} else {
							callback(true);
						}
					}
                    */
                    if (options.Keypad || options.Submit || options.Device) {
                        //npPfsCtrl.isStarting = false;
                        //npPfsCtrl.terminate = false;
                        //npPfsCtrl.isStartup =false;

                        options.Firewall = false;
                        options.SecureKey = false;
                        options.Fds = false;

                        npPfsCtrl.launch(options);
                    } else {
                        callback(true);
                    }
                }
            } else {
                callback(true);
                alert((typeof(npMessage) != "undefined") ? npMessage.m97 : N.m97);
            }
        },
        Loading: {
            Default: false,
            Before: function() {
                //alert("작업시작 전에 사용자 로딩함수를 여기에 구현합니다.");
                getNHIndicator().show();
            },
            After: function() {
                //alert("작업시작 후에 사용자 로딩함수를 여기에 구현합니다.");
                getNHIndicator().hide();
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


w.uV.dV.Gf = "/thirdparty/inca/jsp/nppfs.key.jsp"; // 키발급 경로
w.uV.dV.eP = "/thirdparty/inca/jsp/nppfs.ready.jsp";
w.uV.dV.zo = "/thirdparty/inca/jsp/nppfs.keypad.jsp"; // 마우스입력기 페이지
w.uV.dV.eP = "/thirdparty/inca/jsp/nppfs.ready.jsp"; // 초기화상태 확인경로 
w.uV.dV.Fz = "/iccn0100r.act"; // 보안프로그램 설치화면

//필드 색상 변경
w.npPfsCtrl.setColor({
    //	TextColor : "#", 			// 키보드보안 글자 색상
    FieldBgColor: "#CCFFCC", // 키보드보안 배경 색상
    //	ReTextColor : "", 			// 키보드보안 치환 글자 색상
    ReFieldBgColor: "#CCFFCC", // 키보드보안 치환 배경 색상
    //	OnTextColor : "#FF0000", 	// 마우스입력기 포커스 글자 색상
    //	OnFieldBgColor : "#0100FF", // 마우스입력기 포커스 배경 색상
    //	OffTextColor : "#1DDB16", 	// 마우스입력기 글자 색상
    //	OffFieldBgColor : "#FF007F" // 마우스입력기 배경 색상
});

var npPfsExtension = new function() {
    // $element : 입력양식,
    // isInput : (true : 데이터 포맷 지정 , false : 데이터 포맷 삭제)
    this.formatter = function($element, isInput) {
        var str = $element.val();
        var type = $element.attr("nppfs-formatter-type");
        switch (type) {
            case "card":
                // 1234-56**-****-7890 sample format
                if (isInput) {
                    if (str.length >= 7 && str.length <= 12) {
                        str = str.substring(0, str.length - 1) + "*"
                    }
                    //return str.replace(/([\d*])(?=(?:[\d*]{4})+(?![\d*]))/g, '$1-');

                    if (str.length <= 8) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{1,4})/g, '$1-$2');
                    } else if (str.length <= 12) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{4})([\d*]{1,4})/g, '$1-$2-$3');
                    } else if (str.length > 12) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{4})([\d*]{4})([\d*]{1,4})/g, '$1-$2-$3-$4');
                    }
                } else {
                    return str.replace(/[^\d*]+/g, '');
                }
                break;
            case "card2":
                // 1234 - 56** - **** - 7890 sample format
                if (isInput) {
                    if (str.length >= 7 && str.length <= 12) {
                        str = str.substring(0, str.length - 1) + "*"
                    }
                    //return str.replace(/([\d*])(?=(?:[\d*]{4})+(?![\d*]))/g, '$1-');

                    if (str.length <= 8) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{1,4})/g, '$1 - $2');
                    } else if (str.length <= 12) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{4})([\d*]{1,4})/g, '$1 - $2 - $3');
                    } else if (str.length > 12) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{4})([\d*]{4})([\d*]{1,4})/g, '$1 - $2 - $3 - $4');
                    }
                } else {
                    return str.replace(/[^\d*]+/g, '');
                }
                break;
            case "card3":
                //바우처
                // 1234 - 5678 - 1234 - 7890 sample format
                if (isInput) {
                    if (str.length <= 8) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{1,4})/g, '$1 - $2');
                    } else if (str.length <= 12) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{4})([\d*]{1,4})/g, '$1 - $2 - $3');
                    } else if (str.length > 12) {
                        return str.replace(/-/g, '').replace(/([\d*]{4})([\d*]{4})([\d*]{4})([\d*]{1,4})/g, '$1 - $2 - $3 - $4');
                    }
                } else {
                    return str.replace(/[^\d*]+/g, '');
                }
                break;
            case "rlnbr":
                if (isInput) {
                    if (str.length > 7) {
                        str = str.substring(0, str.length - 1) + "*"
                    }

                    if (str.length >= 7) {
                        return str.replace(/-/g, '').replace(/([\d*]{6})([\d*]{1,6})/g, '$1 - $2');
                    }
                } else {
                    return str.replace(/[^\d*]+/g, '');
                }
                break;
            case "rlnbr2":
                //바우처
                if (isInput) {
                    if (str.length >= 7) {
                        return str.replace(/-/g, '').replace(/([\d*]{6})([\d*]{1,6})/g, '$1 - $2');
                    }
                } else {
                    return str.replace(/[^\d*]+/g, '');
                }
                break;
            case "money":
                if (isInput) {
                    var orgstr = str.replace(/,/g, '');
                    if (orgstr.startsWith("0")) {
                        orgstr = orgstr.substring(1, orgstr.length);
                    }
                    var outputStr = orgstr;
                    outputStr = orgstr.replace(/(\d)(?=(?:\d{3})+(?!\d))/g, '$1,');

                    return outputStr;
                } else {
                    return str.replace(/[^\d*]+/g, '');
                }
                break;
        }
        return str;
    }
};

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
		//console.log(e.type + " : " + element.name);
		switch(e.type) {
			case "nppfs-npk-focusin" :
				break;
			case "nppfs-npk-focusout" :
			break;
		}
	});
});
*/