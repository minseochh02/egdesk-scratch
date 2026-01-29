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