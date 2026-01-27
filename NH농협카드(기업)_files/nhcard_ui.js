//table sort
if (null == Array.nhcardSort) {
    Array.prototype.nhcardSort = function(func, isAscending) {
        if (func == undefined) {
            func = function(a, b) {
                if (a > b)
                    return 1;
                if (a < b)
                    return -1;
                return 0;

            };
        }
        if (this.length <= 1) {
            return;
        }
        var i, j, newValue;
        for (i = 1; i < this.length; i++) {
            newValue = this[i];
            j = i;
            if (isAscending) {
                while (j > 0 && func(this[j - 1], newValue) > 0) {
                    this[j] = this[j - 1];
                    j--;
                }
            } else {
                while (j > 0 && func(this[j - 1], newValue) < 0) {
                    this[j] = this[j - 1];
                    j--;
                }
            }
            this[j] = newValue;
        }
    };
}

(function($) {
    $.nhcardUtil = {
        initBrowser : function() {
            if ((/iphone|ipad/gi).test(navigator.appVersion) || (/android/gi).test(navigator.appVersion)) {
                window.browser = 'mobile';
            } else if (navigator.userAgent.toLowerCase().indexOf('msie') !== -1) {
                window.browser = 'ie';
            } else if (navigator.userAgent.toLowerCase().indexOf('chrome') !== -1) {
                window.browser = 'chrome';
            } else if (navigator.userAgent.toLowerCase().indexOf('safari') !== -1) {
                window.browser = 'safari';
            } else if (navigator.userAgent.toLowerCase().indexOf('gecko') !== -1) {
                window.browser = 'firefox';
            } else if (navigator.userAgent.toLowerCase().indexOf('opera') !== -1) {
                window.browser = 'opera';
            }
        },
        isEmpty : function(value) {
            if (jexjs.empty(value)) {
                return true;
            }
            return false;
        },
        parseBoolean : function(string) {
            switch (String(string).toLowerCase()) {
            case "true":
            case "1":
            case "yes":
            case "y":
                return true;
            case "false":
            case "0":
            case "no":
            case "n":
                return false;
            default:
                return undefined;
            }
        },
        getDate : function(date, option) {
            var year, month, day;
            if (option == undefined) {
                option = 'ddmm';
            }

            var divider = '/';
            divider = date.match(/\-|\/|\./);
            var dateArr = date.split(divider);
            year = dateArr[2];
            if (option == 'ddmm') {
                month = dateArr[1];
                day = dateArr[0];
            } else {
                month = dateArr[0];
                day = dateArr[1];
            }
            return new Date(year, month, day);
        },
        sortNumber : function(a, b) {
            var num1 = parseFloat(a[0].replace(/[^0-9.-]/g, ''));
            if (isNaN(num1))
                num1 = 0;
            var num2 = parseFloat(b[0].replace(/[^0-9.-]/g, ''));
            if (isNaN(num2))
                num2 = 0;
            return num1 - num2;
        },
        sortDate : function(a, b) { // DD/MM/YYYY
            var date1 = $.nhcardUtil.getDate(a[0]);
            var date2 = $.nhcardUtil.getDate(b[0]);

            if (date1 > date2)
                return 1;
            else if (date1 == date2)
                return 0;
            else
                return -1;
        },
        isNumber : function(strNumber) {
            var regExp = /^[0-9]+$/;
            return regExp.test(strNumber);
        }
    };
    
    $.nhcard = {
        events : [ 'click' ],
        isReadydom : false,
        readyFunctions : []
    };

    $.nhcard = {
        //widget : [ 'select', 'radio', 'checkbox', 'textinput', 'textarea', 'button', 'panel', 'dialog', 'table', 'paging' ],
        widget : [ 'table' ],
        widgetFnName : [ 'setEnabled', 'setChecked', 'setChecked', 'setCheckedAll', 'getValue', 'getValues', 'getTexts', 'setSelected', 'getText', 'open',
                'close', 'refresh' ],
        widgetGetAPI : [ 'getValue', 'getSelectedPage', 'getValues', 'getTexts', 'getText' ],
        events : [ 'click' ],
        isReadydom : false,
        readyFunctions : []
    };

    /**
     * 플러그인 추가
     */
    $.nhcard.addPlugins = function() {
        // nhcardWidget 객체 인스턴스 생성
        $.each($.nhcard.widget.concat($.nhcard.widgetFnName), function(i, v) {
            var name = v;
            $.fn[v] = function() {
                var args = arguments;
                return this.each(function() {
                    if (!$.nhcardUtil.isEmpty(this.getAttribute('data-type'))) {
                        if ($.nhcardWidget[this.getAttribute('data-type')][v]) {
                            $.nhcardWidget[this.getAttribute('data-type')][v].apply(this, args);
                        }
                    }
                });
            };
        });

        // Widget의 내부의 함수 호출
        $.each($.nhcard.widgetGetAPI, function(i, v) {
            var name = v;
            $.fn[v] = function() {
                var args = arguments;
                var el = this[0];
                if (!$.nhcardUtil.isEmpty(el.getAttribute('data-type'))) {
                    if (!$.nhcardUtil.isEmpty($.nhcardWidget[el.getAttribute('data-type')][v])) {
                        return $.nhcardWidget[el.getAttribute('data-type')][v].apply(el, args);
                    }
                }
            };
        });

    };

    /**
     * 업무페이지의 ready 함수 실행
     */
    $.nhcard.executeReadyFunctions = function() {
        //console.log("# executeReadyFunctions");
        function timer() {
            var removed = [];
            for ( var i = 0; i < $.nhcard.readyFunctions.length; i++) {
                try {
                    var condition = $.nhcard.readyFunctions[i].condition();
                    if (condition) {
                        removed.push(i);
                    }
                } catch (e) {
                }
            }

            for ( var i = 0; i < removed.length; i++) {
                var handler = $.nhcard.readyFunctions[removed[i] - i];
                $.nhcard.readyFunctions.splice(removed[i] - i, 1);
                handler.callback.apply();
                //console.log("# handler : " + i);
            }

            if ($.nhcard.readyFunctions.length != 0) {
                setTimeout(timer, 500);
            }
        }

        $.nhcard.convert(document.body);

        //setTimeout(timer, 500);
        setTimeout(timer, 50);
        //timer();

        $(document).trigger('nhcardReady');
    };

    // TODO convert 가 멀까???;
    //
    $.nhcard.convert = function(bodycontianer) {
        //console.log("# convert execute");
        $(bodycontianer).find('[data-type]').each(function() {
            var type = $(this).attr('data-type');
            // TODO this.converted
            if (!$.nhcardUtil.isEmpty($.fn[type]) && !this.converted) {
                $(this)[type].apply($(this));
            }
        });
    };

    /**
     * nhcard ui 객체 init
     */
    $.nhcard.init = function() {
        $.nhcard.isReadydom = true;
        $.nhcard.addPlugins();
        $.nhcardUtil.initBrowser();
        $.nhcard.executeReadyFunctions();
    };

    // nhcardReady 함수 호출
    $.nhcardReady = function(readyHandler, condition) {
        //console.log("# nhcardReady execute");
        $.nhcard.readyFunctions.push({
            callback : readyHandler,
            condition : (condition == undefined) ? function() {
                return true;
            } : condition
        });

        if ($.nhcard.isReadydom) {
            $.nhcard.executeReadyFunctions();
        }
    };
    // execute after dom ready.
    $(document).ready($.nhcard.init);
    
    /***************************************************************************
     * NHCard Widget 정의
     **************************************************************************/
    $.nhcardWidget = {};

    /*********************************************************************************
     * table
     * [ table ]
     * data-type="table"
     * [ td ]
     * data-sortable="string" or "number" or "date"
     * data-sort-function="함수명"
     *********************************************************************************/
    $.nhcardWidget.table = {
        _className : {
            table : 'nh-table',
            header : 'nh-table-head',
            wrapper : 'nh-table-wrapper ',
            sort_icon : 'nh-icon',
            sort_asc : 'btn-up',
            sort_desc : 'btn-down',
            sort_asc_text : '오름차순',
            sort_desc_text : '내림차순'
        },
        table : function(options) {
            var _className = $.nhcardWidget.table._className;
            try {
                var el = this;
                var $el = $(el);

                $.extend(el, {
                    wrapper : null,
                    head : null,
                    sorting : false,
                    theme : null
                });

                //$.nhcardWidget.object.addDefaultStyleClass(el, _className.table);
                $.nhcardWidget.table._addColgroup(el);
                $el.css({
                    "width" : "100%",
                    "table-layout" : "fixed"
                })

                el.head = $.nhcardWidget.table.getTableHead(el);
                el.head.table = el;
                $(el.head).attr('class', _className.header);
                $wrapper = $('<div></div>').attr('class', _className.wrapper + el.theme);
                $el.wrap($wrapper[0]);
                el.wrapper = el.parentNode;

                $el.find('a.sort').each(function(){
                	$(this).html($(this).text().replace('오름차순',''));
                	$(this).attr('title','선택시 ' + $(this).text() + ' 정렬').append('<span class="btn-up"></span>');
                })
                $.nhcardWidget.table.refresh(el);
            } catch (e) {
                throw new Error('[table] ' + e);
            }
        },

        refresh : function(el) {
            if (jexjs.empty(el)) {
                el = this;
            }
            $el = $(el);
            $table = $.nhcardWidget.table;

            $.nhcard.convert(el);

            if (!el.sorting && $el.find("[data-sortable]").length > 0) {
                $.nhcardWidget.table._enableSorting(el);
                el.sorting = true;
            }

            if (!$.nhcardUtil.isEmpty($(el).attr('data-height'))) {
                $(el.wrapper).css('height', $(el).attr('data-height'));
            }
            if (!$.nhcardUtil.isEmpty($(el).attr('data-width'))) {
                $(el).css('width', $(el).attr('data-width'));
            }
        },

        clear : function(e) {
            var el = this;
            el.body = $(el.rows).splice(1, (el.rows.length - 1));
            $(el.body).remove();
        },
        /**
         * table 헤더값 가져옮.
         * 1. thead
         * 2. th 태그를 가진 tr 태그
         */
        getTableHead : function(el) {
            var thead = null;
            if ($(el).find('thead').length > 0) {
                thead = $(el).find('thead')[0];
            } else if ($(el).find('th').length > 0) {
                thead = $(el).find('th')[0].parentNode;
            }
            return thead;
        },
        getTableBody : function(el) {
            var tbody;
            if ($(el).find('tbody').length > 0) {
                tbody = el.tBody ? el.tBody : $(el).find('tbody')[0];
            } else {
                tbody = el;
            }
            return tbody;
        },

        getRowIndex : function(td) {
            var tr = td.parentNode;
            var table = tr;
            while (table.tagName.toLowerCase() != 'table') {
                table = table.parentNode;
            }
            var tbody = table.tableBody;
            var cnt = 0;
            for ( var i = 0; i < tbody.rows.length; i++) {
                if (tbody.rows[i] == table.tableHead) {
                    continue;
                } else if (tbody.rows[i] == tr) {
                    return cnt;
                }
                cnt++;
            }
            return cnt;
        },

        getColumnIndex : function(td) {
            var tr = td.parentNode;
            if (!$.nhcardUtil.isEmpty(tr.cells)) {
                for ( var i = 0; tr.cells.length; i++) {
                    if (tr.cells[i] == td) {
                        return i;
                    }
                }
            }
            return -1;
        },

        resizeThreshold : 10,
        //table 초기화시 colgroup 태그 업슨 경우 생성.
        _addColgroup : function(el) {
            var rowgroups = $(el).find('tr');
            rowgroups = rowgroups[rowgroups.length - 1];
            var colgroup = $(el).find('colgroup');
            if (colgroup.length == 0) {
                colgroup = document.createElement('colgroup');
                for ( var i = 0; i < rowgroups.children.length; i++) {
                    var temp = document.createElement('col');
                    $(temp).appendTo(colgroup);
                }
                $(colgroup).insertBefore(el.children[0]);
            } else {
                colgroup = colgroup[0];
            }
        },
        _refreshColgroup : function(el) {
            var rowgroups = $(el).find('tr');
            rowgroups = rowgroups[rowgroups.length - 1];
            var colgroup = $(el).find('colgroup');
            var widths = [];
            for ( var i = 0; i < rowgroups.children.length; i++) {
                widths.push(rowgroups.children[i].offsetWidth);
            }
            for ( var i = 0; i < rowgroups.children.length; i++) {
                $(el).find('col:nth-child(' + (i + 1) + ')').css('width', widths[i]);
            }
            el.colgroup = colgroup;
        },

        _enableSorting : function(table) {
            var _className = $.nhcardWidget.table._className;
            var tr = table.head;
            $(tr).find('th, td').each(function(index) {
                if (jexjs.empty($(this).attr('data-sortable')) && jexjs.empty($(this).attr('data-sort-function'))) {
                    return;
                }
                this.columnIndex = index;
                this.table = table;
                var icon = document.createElement('span');
                //TODO Table 정렬 아이콘
                $(icon).addClass(_className.sort_icon);
                $(this).append(icon).css('cursor', 'pointer');
            });
            $(table.wrapper).on('click', '[data-sortable], [data-sort-function]', $.nhcardWidget.table._sort);
        },

        _sort : function(e) {
            var _className = $.nhcardWidget.table._className;

            try {
                var target = e.currentTarget;
                var table = target.table;
                var index = target.columnIndex;
                var tbody = table.tBodies[0];

                var array = [];
                var valArr = [];
                for ( var i = 0; i < tbody.rows.length; i++) {
                    if (tbody.rows[i].cells.length > 0 && tbody.rows[i].cells[0].tagName.toLowerCase() == "th") {
                        continue;
                    }
                    array.push([ $.nhcardWidget.table._getInnerText(tbody.rows[i].cells[index]), tbody.rows[i] ]);
                }

                var sort_function;

                if ($(target).attr('data-sort-function') != undefined) {
                    sort_function = window[$(target).attr('data-sort-function')];
                } else {
                    var type = $(target).attr('data-sortable');
                    switch (type) {
                    case 'number':
                        sort_function = $.nhcardUtil.sortNumber;
                        break;
                    case 'date':
                        valArr = $.nhcardUtil.formatDate(valArr);
                        sort_function = $.nhcardUtil.sortDate;
                        break;
                    default:
                        sort_function = undefined;
                        break;
                    }
                }
       
                var order_by_chk = 0;
                
                switch (table.sorting) {
					case true :
						order_by_chk = 1;
						break;
						
					case false :
						order_by_chk = 2;
						break;
						
					default :
						break;
				}
                
                
                $el.find('a.sort').each(function(){
					if(order_by_chk == 1)
					{
	                	$(this).html($(this).text().replace('내림차순',''));
	                	$(this).attr('title','선택시 ' + $(this).text() + ' 정렬').append('<span class="btn-down"></span>'); 
	                	
	                }
	                else if(order_by_chk == 2)
	                {
						$(this).html($(this).text().replace('오름차순',''));
	                	$(this).attr('title','선택시 ' + $(this).text() + ' 정렬').append('<span class="btn-up"></span>');
	                	
					}
					else
					{
						$(this).html($(this).text().replace('에러',''));
					}
                });
                
                
                $(document).on('click', 'a.sort' ,function(e){
                	if( order_by_chk == 1 ){   
    					$(this).attr('title','현재 ' + $(this).text() + ' 내림차순으로 정렬됨');
    				}else {
                		$(this).attr('title','현재 ' + $(this).text() + ' 오름차순으로 정렬됨');
    				}
        		});
                
                if(order_by_chk == 1)
                {
					
	                array.nhcardSort(sort_function, false);          
                    table.sorting = false;
				}
				else
				{
					array.nhcardSort(sort_function, true);				
                    table.sorting = true;
				}
				
                for ( var i = 0; i < array.length; i++) {
                    tbody.appendChild(array[i][1]);
                }
                delete array;

            } catch (e) {
                throw new Error('[table _sort] ' + e.message + '\n' + e.fileNmae + '\n' + e.lineNumber);
            }

        },
        //componenet value를 가져와야 함.
        _getInnerText : function(node) {
            // node가 정의되지 않앗거나, 복합 구조일 경우 빈 스트링 리턴.
            if (!node) {
                return '';
            }
            return node.innerHTML;
        }
    };
    
})(jQuery);

