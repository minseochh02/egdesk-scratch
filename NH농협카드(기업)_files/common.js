 
$(document).ready(function() {
	//2025-02-13, 25년 접근성 추가 s
	function getTitle() {
		setTimeout(function(){
			$('.goods-main .radio-group li').each(function(){
				if ($(this).find('input').is(':checked')) {
					$(this).find('input').attr('title','선택됨');
				}
			});
		},200);
	}
	getTitle();
	$('.goods-main .radio-group li').on('click',function(){
		$('.goods-main .radio-group li').find('input').removeAttr('title');
		getTitle();
	});
	//2025-02-13, 25년 접근성 추가 e
		
	/* 23년 접근성 : 카드상세페이지 iframe title 추가 */
	if($('#box_interest').length > 0){
		$('#box_interest').attr('title','회원별 이용상품별 연체이자율');
	}
	$('.info-area .strong-textpen').attr('aria-live','polite'); //2023 접근성 추가

	// 23년 접근성 : 박하늬  s
	//입력값 삭제버튼 클릭 후 포커스 이동
	$('.btnico-del').on('click',function(){$(this).siblings('input').focus();});
	//가맹점 프린트 버튼 새창열림 title 제공
	//2025-02-13, 접근성 수정 s
	function printTitle() {
		$('.print-download').attr('title','새 창 열림');
	}
	$('.inquire-area .btn-area button, button').on('click',function(){
		setTimeout(printTitle, 3000);
	});
	//2025-02-13, 접근성 수정 e
	//약관보기 버튼 title 제공
	$('.list-item').each(function(){
		var thisLb = $('label',this).text();
		$('button',this).attr('title',thisLb+' 팝업 열림');
	});
	//progress
	$('#nextPage').on('click',function(){
		function progress(){
			for(var  i = 0 ; i < $('.progress').length ; ++i ){
				if( $('.progress').eq(i).hasClass('uiAct') == false ){
					$('.progress').eq(i).addClass('uiAct');
					$('.progress:eq('+i+') ol').attr('aria-hidden','true');
					var num = $('.progress').eq(i).find('li').length;
					var nowStep = $('.progress').eq(i).find('li.on').index() + 1;
					var stepName = $('.progress:eq('+i+') li.on').text();  
					var stepName = stepName.replace(new RegExp("[(0-9)]", "gi", "."), "");
					var stepName = stepName.replace('.','');
					var stepName = stepName.replace(/ /g, '');
					$('.progress:eq('+i+')').attr('role','img');
					$('.progress:eq('+i+')').attr('aria-label','총 '+num+'단계 중 '+nowStep+'단계 '+stepName + ' 진행중');
					if( $('.progress:eq('+i+') li.on span').length == 0 ){
						$('.progress:eq('+i+') li.on').wrapInner('<span/>');
					}
				}
			}
		} 
		setInterval(progress, 1000);
		//약관보기 버튼 title 제공2
		function termsTt() {
			$('.list-item').each(function(){
				var thisLb = $('label',this).text();
				$('button',this).attr('title',thisLb+' 팝업 열림');
			});
		}
		setInterval(termsTt, 1000);
	});
	//location 선택 title 제공
	$('.drop-menu li').removeAttr('title');
	$('.drop-menu li.on').attr('title','선택됨');
	//기업-더보기 페이지 넘버 관련
	$('.btn-more span em').prepend('<i class="blind">현재 페이지 : </i>');
	$('.btn-more span em').after('<i class="blind">전체 페이지 : </i>');
	/*$('.btn-more').on('click',function(){
		setTimeout(function(){
			$('.btn-more span em').prepend('<i class="blind">현재 페이지 : </i>');
			$('.btn-more span em').after('<i class="blind">전체 페이지 : </i>');
		},500);
	});*/
    // 23년 접근성 : 박하늬  e


/*************************     모달 팝업    ***************************/
/*************************                 ***************************/  
// jQuery 환경에서만 작동할 수 있게 처리
if (typeof jQuery === "undefined") throw new Error("Modal requires jQuery.");  
	jQuery.jQueryPopup = function (div_id, current) {
		var op = $(current);
		pop_arr.push(div_id);

		var lp = $("#" + div_id);
		var lpObj = lp.children(".pop-wrap");

		var lpObjClose = lp.find(".layer-pop-close");
		var lpObjTabbable = lpObj.find("button, input:not([type='hidden']), select, iframe, textarea, [href], [tabindex]:not([tabindex='-1'])");
		var lpObjTabbableFirst = lpObjTabbable && lpObjTabbable.first();
		var lpObjTabbableLast = lpObjTabbable && lpObjTabbable.last();
		var lpOuterObjHidden = $(".skip-links, .masthead, .initial-content, .search-content, .page__footer"); // 레이어 바깥 영역의 요소
		var all = $(".masthead, .page__footer").add(lp);
		var tabDisable;
		var nowScrollPos = $(window).scrollTop();      
  
		function lpClose() { // 레이어 닫기 함수
			$("html").removeClass("popup-open");
			$("body").removeClass("popup-open").css("top", "").off("scroll touchmove mousewheel");
			$(window).scrollTop(nowScrollPos); // 레이어 닫은 후 화면 최상단으로 이동 방지
			if (tabDisable === true) lpObj.attr("tabindex", "-1");
			all.removeClass("on");
			lpOuterObjHidden.removeAttr("aria-hidden");
			op.focus(); // 레이어 닫은 후 원래 있던 곳으로 초점 이동

			if (typeof popup_FOCUS_LAYER_ID == "object") {
				popup_FOCUS_LAYER_ID = null;
		   }

			$(document).off("keydown.lp_keydown");

			lpObjClose.off("click");
			createCommon.arrpop();
		}  
		$(this).blur();
		all.addClass("on");        
		lpOuterObjHidden.attr("aria-hidden", "true"); // 레이어 바깥 영역을 스크린리더가 읽지 않게
		lpObjTabbable.length ? lpObjTabbableFirst.focus().on("keydown", function(event) { 
			// 레이어 열리자마자 초점 받을 수 있는 첫번째 요소로 초점 이동
			if (event.shiftKey && (event.keyCode || event.which) === 9) {
				// Shift + Tab키 : 초점 받을 수 있는 첫번째 요소에서 마지막 요소로 초점 이동
				event.preventDefault();
				lpObjTabbableLast.focus();
			}
		}) : lpObj.attr("tabindex", "0").focus().on("keydown", function(event){
			tabDisable = true;
			if ((event.keyCode || event.which) === 9) event.preventDefault();
			// Tab키 / Shift + Tab키 : 초점 받을 수 있는 요소가 없을 경우 레이어 밖으로 초점 이동 안되게
		});  
		lpObjTabbableLast.on("keydown", function(event) {
			if (!event.shiftKey && (event.keyCode || event.which) === 9) {
				// Tab키 : 초점 받을 수 있는 마지막 요소에서 첫번째 요소으로 초점 이동
				event.preventDefault();
				lpObjTabbableFirst.focus();
			}
		});      
		lpObjClose.on("click", lpClose); // 닫기 버튼 클릭 시 레이어 닫기

		$(document).on("keydown.lp_keydown", function(event) {
			// Esc키 : 레이어 닫기
			var keyType = event.keyCode || event.which;
			if (keyType === 27 && lp.hasClass("on")) {
				lpClose();
			}
		});  
		layerpop.loop();
	};  
	/*************************   커스텀 팝업    ***************************/
	/*************************  jquery.alert   ***************************/  
	$.fn.alert = function(msg,op) {$(this).queue(function(){$.alert(msg,op);});};
	var con = {
		idx:'IDX'+Math.floor(Math.random()*1000),
		tt :'TT'+Math.floor(Math.random()*1000),
		tb :'TB'+Math.floor(Math.random()*1000),
		em:'EM'+Math.floor(Math.random()*1000),
		btn:'BTN'+Math.floor(Math.random()*1000),
		opClass:'popup-open',
		sp:'body',
		op : {
			em:'',
			callEvent:null,
			cancelEvent:null,
			yesButton:'예',
			confirmButton:'확인',
			cancelButton:'아니오',
			loginButton:'로그인',
			value:null
		}
	},frame = function(){
		return $('<div id="'+con.idx+'" class="pop-wrap on">').append(
			$('<div class="popup">').append(
				$('<div class="pop-contain">').append(
					$('<div class="pop-cont">').append(
						$('<div class="pop-body">').append(
							$('<div class="pop-inner">').append(
								$('<p id="'+con.tb+'" class="data">')
							)
						)
					).append(
						$('<div class="btn-area sticky" id="'+con.btn+'">')
					).append(
						$('<button type="button"  class="btn-close"><span>팝업 닫기</span></button>')
					)
				)
			)
		)
	}
	,button = {     
		alert:function(op){return $('<div>')
			.append($('<button type="button" class="confirm btn-primary s2" tabindex="0"><span>'+op.confirmButton+'</span></button>'))},
		confirm:function(op){return $('<div>')        
			.append($('<button type="button" class="close btn-secondary s3 btn-line" tabindex="0"><span>'+op.cancelButton+'</span></button>'))
			.append($('<button type="button" class="confirm btn-primary s2" tabindex="0"><span>'+op.yesButton+'</span></button>'))},        
	},event = {
		creation:function(fn){$(con.sp).append(frame());fn();},
		confirm: function(op){event.close();event.callEvent(op)},
		cancel: function(op){event.close();event.cancelEvent(op)},
		close: function(){$(con.sp).removeClass(con.opClass);$('#'+con.idx).remove();},
		show: function(){$(con.sp).addClass(con.opClass);},
		callEvent:function(op){if (typeof op.callEvent == 'function') op.callEvent(op.value);},
		cancelEvent:function(op){if (typeof op.cancelEvent == 'function') op.cancelEvent();},
	}
	function init(){
	}
	$.alert = function(msg,op) {
		if($("body").hasClass(con.opClass))return false;
		if(typeof msg =='function' || typeof msg =='object') msg='['+typeof msg+']';
		op = $.extend({}, con.op,op);
		event.creation(function(){
			$("#"+con.idx).addClass('alert');
			$("#"+con.idx).find('#'+con.btn).append(button.alert(op));
			if(op.title)$("#"+con.idx).find('#'+con.tt).html(op.title); else $("#"+con.idx).find('#'+con.tt).remove();
			$("#"+con.idx).find('#'+con.tb).html(msg);
			$("#"+con.idx).find('#'+con.em).html(op.em);
			$("#"+con.idx).find('#'+con.btn).find('.confirm').unbind('click.confirm').bind('click.confirm',function(e){
				e.preventDefault()
				event.confirm(op);
			})
			// 닫기버튼 추가
			$('.btn-close').unbind('click.btn-close').bind('click.btn-close', function (e) {
				$(createCommon._popupbtn).focus();
				e.preventDefault()
				event.confirm(op);
			})
			event.show();
			layerpop.loop();
		})
	};
	$.confirm = function(msg,op) {
		if($("body").hasClass(con.opClass))return false;
		if(typeof msg =='function' || typeof msg =='object') msg='['+typeof msg+']';
		op = $.extend({}, con.op,op);
		event.creation(function() {
				$("#" + con.idx).addClass('confirm');
				$("#" + con.idx).find('#' + con.btn).append(button.confirm(op));
				$("#" + con.idx).find('#' + con.tt).html(op.title);
				$("#" + con.idx).find('#' + con.tb).html(msg);
				$("#" + con.idx).find('#' + con.em).html(op.em);
				$("#" + con.idx).find('#' + con.btn).find('.confirm').unbind('click.confirm').bind('click.confirm', function (e) {
						e.preventDefault()
						event.confirm(op);
				})
				$("#" + con.idx).find('#' + con.btn).find('.close').unbind('click.close').bind('click.close', function (e) {
						e.preventDefault()
						event.cancel(op);
				})
				// 닫기버튼 추가
				$('.btn-close').unbind('click.btn-close').bind('click.btn-close', function (e) {
					$(createCommon._popupbtn).focus();
					e.preventDefault()
					event.cancel(op);
				})
				event.show();
				layerpop.loop();
		})
	};
	$.close = function(){
		if($("body").hasClass(con.opClass)) event.close()
	}     
});    


////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////
//////////////////// FAMILY
function familysite(){
	$('#familysite h2 a').click(function(){
		if($($(this).attr('href')).is(':hidden')){
			$($(this).attr('href')).slideDown(300);
			$(this).addClass("active").attr('aria-expanded',true); //2023 접근성 수정
		}else{
			$($(this).attr('href')).slideUp(300);
			$(this).removeClass("active").attr('aria-expanded',false); //2023 접근성 수정
		}  
			$($(this).attr('href')).mouseleave(function(){
			$(this).slideUp(300);
			$('#familysite h2 a').removeClass("active").attr('aria-expanded',false); //2023 접근성 수정
		});
		return false;
	});    
	$('#familyList a:last').bind('focusout',function(){
			$('#familyList').slideUp(300);
			$('#familysite h2 a').removeClass("active").attr('aria-expanded',false); //2023 접근성 수정
	}); 	
}

//////////////////// ACCESSIBILITY
function accessibilityFocus() { 
	$(document).on('keydown', '[data-focus-prev], [data-focus-next]', function(e){ 
		var next = $(e.target).attr('data-focus-next'), 
		prev = $(e.target).attr('data-focus-prev'), 
		target = next || prev || false; 
		if(!target || e.keyCode != 9) { 
			return; 
		} 
		if( (!e.shiftKey && !!next) || (e.shiftKey && !!prev) ) { 
			setTimeout(function(){ 
				$('[data-focus="' + target + '"]').focus(); 
			}, 1); 
		} 
	}); 
}     

//////////////////// TOOLTIP
function tooltip() { 
	var openBtn = '[data-tooltip]', 
	closeBtn = '.tooltip-close'; 
	function getTarget(t) { 
		return $(t).attr('data-tooltip'); 
	}       
	function open(t) { 
		var showTarget = $('[data-tooltip-con="' + t + '"]'); 
		showTarget.show().focus(); 
		showTarget.find('.tooltip-close').data('activeTarget', t); 
	}       
	function close(t) { 
		var activeTarget = $('[data-tooltip-con="' + t + '"]'); 
		activeTarget.hide(); 
		$('[data-tooltip="' + t + '"]').focus(); 
	}       
	$(document) 
	.on('click', openBtn, function(e){ 
		e.preventDefault(); 
		open(getTarget(e.target)); 
	})       
	.on('click', closeBtn, function(e) { 
		e.preventDefault(); 
		close($(this).data('activeTarget')); 
	}) 
}     

//////////////////// TAB
let  tab = {
	init : function(){
		for( var i = 0 ; i < $('.tab-list').length ; ++i ){
			if( $('.tab-list:eq('+i+')').hasClass('uiAct') == false ){
				$('.tab-list:eq('+i+')').addClass('uiAct');

				var tabFunc = false;
				if( $('.tab-list:eq('+i+')').closest('.infra-tab').length > 0 ){
					tabFunc = true;
					$('.tab-list:eq('+i+')').attr('role','tablist'); //2023-02-01 접근성 : role값에 하이픈 제거 
				}
				$('.tab-list:eq('+i+') > li').each(function(idx){
					if( tabFunc == true ){
						if( $(this).attr('id') == undefined ){
							$(this).attr({'id':'tab_'+i+'_'+idx, 'role': 'button', 'aria-controls':'panel_'+i+'_'+idx , 'tabindex': 0, 'aria-selected': false}); //2023 접근성 수정
						} else {
							$(this).attr({'role': 'tab', 'aria-controls':'panel_'+i+'_'+idx , 'tabindex': 0, 'aria-selected': false});
						}
						if( $(this).hasClass('disable') == true ){
							$(this).append('<span class="blind">내용없음</span>');
							$(this).removeAttr('tabindex');

							var tabcontents = $(this).closest('.infra-tab').find('.tabcontents');
							$(tabcontents).find('.tabpanel:eq('+idx+')').before('<div class="tabpanel"></div>');
						}
					} else {
						if( $(this).find('a[href]').length == 0 ){
							$(this).attr({'role': 'button', 'tabindex': 0});
						}
					}
					idx++;
				});
				
				if( tabFunc == true ){
					var tabcontents = $('.tab-list:eq('+i+')').closest('.infra-tab').find('> .tabcontents');
					$(tabcontents).find(' > .tabpanel').each(function(idx){
						if( $(this).attr('id') == undefined ){
							$(this).attr({'id': 'panel_'+i+'_'+idx}); 
						} else {
							$('.tab-list:eq('+i+') > li:eq('+idx+')').attr('aria-controls', $(this).attr('id'));
						}
						$(this).attr({'role':'tabpanel', 'aria-hidden': true, 'aria-labelledby' : $('.tab-list:eq('+i+') > li:eq('+idx+')').attr('id') })
						idx++;
					});
				}

				if( $('.tab-list:eq('+i+') li.on').length == 0 ){
					$('.tab-list:eq('+i+') li').first().addClass('on');
				}

				$('.tab-list:eq('+i+')').on('keydown',' > li[tabindex]', function(e){
					if(e.keyCode == 13){
						$(this).trigger('click');
					}
				});

				if( tabFunc == true ){
					$('.tab-list:eq('+i+')').on('click',' > li', function(e){
						e.preventDefault();
						if( $(this).hasClass('disable') == false ){
							$(this).siblings().removeClass('on').attr('aria-selected', false);
							$(this).addClass('on').attr('aria-selected', true);
							$(this).closest('.infra-tab').find('> .tabpanel').removeClass('on').attr('aria-hidden', true);
							$(this).closest('.infra-tab').find('> .tabcontents > .tabpanel').removeClass('on').attr('aria-hidden', true);
							$(this).closest('.infra-tab').find('#'+$(this).attr('aria-controls')).addClass('on').attr('aria-hidden', false);
	
							// PC전용 기능
							var guidetxt = $(this).text() + " 탭 내용 시작";
							if( $(this).closest('.tab-list').next().is('.guide-txt') == false ){
								$(this).closest('.tab-list').after('<p class="blind guide-txt">'+guidetxt+'</p>');
							} else {
								$(this).closest('.tab-list').next().text( guidetxt );
							}
							$(this).siblings().find('.blind.guide-txt').remove();
							$(this).find('.blind.guide-txt').remove();
							//$(this).append('<span class="blind guide-txt">선택됨</span>'); 2023-02-01 접근성 : 탭버튼선택알림 중복 수정
						}
					});
					$('.tab-list:eq('+i+') li.on').trigger('click');
					$('.tab-list li.tab button').attr("tabindex", "-1");
				} else {
					// $('.tab-list:eq('+i+') li.on').append('<span class="blind guide-txt">선택됨</span>'); 2023-02-01 접근성 : 탭버튼선택알림 중복 수정
				}
			}
		}  	
	}
}

//////////////////// DATEPICKER
let datepicker = {
	_hasFocus: '',
	init : function(){
		this.month('.monthpicker');
		this.day('.date');
		this.click();
	},
	month : function($class){
		var currentYear =(new Date()).getFullYear();
		    startYear = currentYear-5;
		    finalYear = currentYear+5;
		let options = {
			pattern: 'yyyy-mm',
			startYear:startYear,
			finalYear:finalYear,
			monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월']
		};	

		$($class).monthpicker(options);
		$('.ui-datepicker .mtz-monthpicker-month').attr('tabindex', 0);
	},
	day : function($class){
		let	 options = {
			showOn				: 'button',
			monthNames: ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'],
			yearSuffix: '<span class="yr">년</span>',
			monthNamesShort: ['1','2','3','4','5','6','7','8','9','10','11','12'],
			buttonText			: '달력 레이어 열기',
			buttonImageOnly		: false,
			showMonthAfterYear	: true,
			changeYear: true, 
			//YearRange:'c-5:c+5', //날짜범위 설정
			closeText: '닫기',
			showButtonPanel: true,
			dateFormat			: 'yy-mm-dd'	,
			monthNamesShort		: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'], 
			dayNamesMin			: ['일','월','화','수','목','금','토'],
			ignoreReadonly: true,
			onClose: function () {
				$(createCommon._popupbtn).focus();
				createCommon._popupbtn = '';
			},

			beforeShow:function(input){
			},
			onChangeMonthYear: function (year, month, inst) {
				var focus = $(':focus').attr('class'); 
				datepicker._hasFocus = '.'+focus.replace(/ /gi,'.');
				setTimeout(function () {
					datepicker.update();
					$(datepicker._hasFocus).focus();
				}, 100);
			}
		};

		for(var i=0; i< $($class).length; i++ ){
			if( $($class+':eq('+i+')').is('.limit') ){
				options.minDate =0;
			}
			$($class+':eq('+i+')').datepicker(options);
		}
	},
	click : function(){
		$('.btn-date').click(function(e){
			createCommon._popupbtn = $(this).prev();
			e.preventDefault();
			setTimeout(function(){
				$('#ui-datepicker-div .date-wrap').attr('tabindex', -1).focus();
			},10);
			datepicker.update();
			return false;
		});
	},
	update : function(){
		$('#ui-datepicker-div table').prepend('<caption>월달력 - 일,월,화,수,목,금,토요일로 구성되어 있습니다.</caption>');
		if($('.date-wrap').length ===0 ){
			$('#ui-datepicker-div').prepend('<div class="date-wrap"></div>');
			$('#ui-datepicker-div').prepend('<div class="focusSet blind first" tabindex="0"></div>');
			$('#ui-datepicker-div').append('<div class="focusSet blind last" tabindex="0"></div>');			
		}

		$('#ui-datepicker-div a.ui-corner-all').attr('tabindex', 0);
		$('#ui-datepicker-div a.ui-corner-all.ui-state-disabled').attr('tabindex', '-1');
		$('#ui-datepicker-div .focusSet.blind.first').bind({
			'focusin':function(){
				$('#ui-datepicker-div .ui-datepicker-close').focus();
			}
		});
		$('#ui-datepicker-div .focusSet.blind.last').bind({
			'focusin':function(e){
				var popwrap = '.'+$(e.target).closest('.ui-datepicker').attr('class').replace(/ /gi,'.') + ' .ui-datepicker-header';
				$( wa.getEnabledFocus(popwrap) ).first().focus();
			}
		});
		$('#ui-datepicker-div a.ui-corner-all').attr("href", "javascript:;");
		$('#ui-datepicker-div a.ui-corner-all.ui-state-disabled').removeAttr('href');
	},

	accessibillity : function(){
		for(var i = 0; i < $('.ipt.date').length ; ++i ){
			datepicker.day( '.ipt.date' );
			$('.ipt.date:eq('+i+')').next().bind({
				'click':function(){
					$(this).blur();
					if( $(this).hasClass('nowCalendar') == false ){
						$(this).addClass('nowCalendar');
					} else {
						$(this).removeClass('nowCalendar')
					}
				}
			});
		}
		$('.ui-datepicker').each(function(){
			if( $(this).find('.focusSet').length == 0 ){
				$(this).prepend('<div class="focusSet blind first" tabindex="0"></div>');
				$(this).append('<div class="focusSet blind last" tabindex="0"></div>');
				$('#ui-datepicker-div table').prepend('<caption>월달력 - 일,월,화,수,목,금,토요일로 구성되어 있습니다.</caption>');
				$(this).find('.focusSet').bind({
					'focusin':function(e){
						var popwrap = $(e.target).closest('.ui-datepicker');
						if( $(e.target).hasClass('first') ){
							$( wa.getEnabledFocus(popwrap) ).last().focus();
						} else {
							$( wa.getEnabledFocus(popwrap) ).first().focus();
						}
					}
				});
			}
		});

	},
}

//////////////////// ACCORDIAN
let accordian = {
	init : function(){
		for( var i = 0 ; i < $('.acco-btn').length ; ++i ){
			if( $('.acco-btn:eq('+i+')').hasClass('uiAct') == false ){
				$('.acco-btn:eq('+i+')').addClass('uiAct');
				if( $('.acco-btn:eq('+i+')').attr('href') == undefined && $('.acco-btn:eq('+i+')').is('a') ){
					$('.acco-btn:eq('+i+')').attr('href' , '#');
				}                  
				if( $('.acco-btn:eq('+i+')').closest('.accoTbl').length == 0 ){ // accoTable 유무 체크
					$('.acco-btn:eq('+i+')').closest('ul').find(' > *').addClass('acco-item');
				} else {
					$('.acco-btn:eq('+i+')').closest('.accoTbl').find('tbody > tr').addClass('acco-item');
					$('.acco-btn:eq('+i+')').closest('tr').next().addClass('acco-body-wrap');
				}
				$('.acco-btn:eq('+i+')').attr({'role':'button', /*'tabindex':'0', 'aria-expanded': false,*/ 'aria-controls':'acco_'+i}); //2023 접근성 수정  아코디언
				$('.acco-btn:eq('+i+')').find('.waTxt').text('펼치기');
				if( $('.acco-body:eq('+i+')').attr('id') == undefined ){
					$('.acco-body:eq('+i+')').attr('id', 'acco_'+i );
				} else {
					$('.acco-btn:eq('+i+')').attr('aria-controls', $('.acco-body:eq('+i+')').attr('id') );
				}
				if( $('.acco-btn:eq('+i+')').closest('.acco-item.on').length > 0 ){
					$('.acco-btn').attr('aria-expanded', true); //2023 접근성 수정
					$('.acco-btn:eq('+i+') .waTxt').text('접기');
				}            
				if( $('.acco-btn:eq('+i+')').closest('.accoTbl').length == 0 ){ // accoTable 유무 체크
					$('.acco-btn:eq('+i+')').closest('.acco-item.on').find('> .acco-body').show();
				} else {
					$('.acco-btn:eq('+i+')').closest('.acco-item.on').next('.acco-item').find('.acco-body').show();
				}
				$('.acco-btn:eq('+i+')').bind({                
					'click':function(e){
						var target = this;
						e.preventDefault();
						var contents;
						if($(this).closest('ul.accordion-auto').length){
							contents = $(this).closest('.acco-item').find(' > .acco-body');
							if( $(this).closest('li').is('.on') ){
								$(this).closest('li').removeClass('on');
								$(contents).stop(true, true).slideUp(300);
								$('.acco-btn').attr('aria-expanded', false);//2023 접근성 수정
								$(this).find('.waTxt').text('펼치기');
							} else {
								$(this).closest('li').addClass('on').siblings().removeClass('on');
								$(this).parents('.accordion-auto').find('>li').each(function(){
									contents = $(this).closest('.acco-item').find(' > .acco-body');
									if( $(this).is('.on') ) {
										$(contents).stop(true, true).slideDown(300);
                                        $('.acco-btn').attr('aria-expanded', true); //2023 접근성 수정
										$(this).find('.waTxt').text('접기');
										if( $(this).closest('.acco-wrap').data('single') == true || $(this).closest('ul').data('single') == true ){
											$(this).closest('.acco-item').siblings('.acco-item').removeClass('on');
											$(this).closest('.acco-item').siblings('.acco-item').find('>.acco-body').stop(true, true).slideUp(300);
											$(this).closest('.acco-item').siblings('.acco-item').find('> acco-head .acco-btn').attr('aria-expanded', false);
											$(this).closest('.acco-item').siblings('.acco-item').find('> acco-head .acco-btn').find('.waTxt').text('펼치기');
										}
									} else {
										$(contents).stop(true, true).slideUp(300);
										$(this).find('.waTxt').text('펼치기');
									}
								});
							}
						} else {
							if(  $(this).closest('.cutted-accordion').length  ) {
								$(this).closest('.cutted-accordion').toggleClass('on'); 

								if(  $(this).closest('.cutted-accordion').is('.on') ){
									$(this).attr({'aria-expanded':true});
									//$(this).find('span').text('접기');  2023-02-01 접근성 : 중복설명 주석 처리
								} else {
									$(this).attr({'aria-expanded':false});
									//$(this).find('span').text('펼치기'); 2023-02-01 접근성 : 중복설명 주석 처리
								}
							} else {
								if( $(target).closest('.accoTbl').length == 0 ){ // accoTable 유무 체크
									contents = $(target).closest('.acco-item').find(' > .acco-body');
								} else {
									contents = $(target).closest('.acco-item').next().find('.acco-body');
								}									

								$(target).closest('.acco-item').toggleClass('on');                    
								if( $(target).closest('.acco-item').hasClass('on') ){
									$(contents).stop(true, true).slideDown(300);
									$(target).attr('aria-expanded', true);
									$(target).find('.waTxt').text('접기');
									if( $(target).closest('.acco-wrap').data('single') == true || $(target).closest('ul').data('single') == true ){
										$(target).closest('.acco-item').siblings('.acco-item').removeClass('on');
										$(target).closest('.acco-item').siblings('.acco-item').find('>.acco-body').stop(true, true).slideUp(300);
										$(target).closest('.acco-item').siblings('.acco-item').find('> acco-head .acco-btn').attr('aria-expanded', false);
										$(target).closest('.acco-item').siblings('.acco-item').find('> acco-head .acco-btn').find('.waTxt').text('펼치기');
									}
								} else {
									$(contents).stop(true, true).slideUp(300);
									$(target).attr('aria-expanded', false);
									$(target).find('.waTxt').text('펼치기');
								}
							}
						}
					}              
				});
					if( $('.acco-btn:eq('+i+')').closest('.acco-body').length == 0 && $('.acco-btn:eq('+i+')').closest('.info-list').length > 0 ){
						if( $('.acco-btn:eq('+i+')').closest('.info-list').data('expand') != false ){
							$('.acco-btn:eq('+i+')').trigger('click');
						}
					}
				$('.acco-btn.find-btn').blur(function(){
					if( $(this).closest('.tabFocus').length &&  $(this).attr('aria-expanded') == "false" ){
						$(this).trigger('click');
					}
				});
			}
		}	
	},
}

//////////////////// GNB
let gnb = {
	_parent : '#gnb',
	_isOpen : false,
	_isClick : false,
	init:function(){
		gnb.oneDepthInit();
		gnb.dimmedInit();
		gnb.barInit();
		gnb.activeDisplay();
	},
	
	oneDepthInit : function(){
		let _this = gnb;
		$(_this._parent + '>ul.menu>li>a').on('mouseenter',function(e){
			e.preventDefault();
			search.remove();
			if( $('.isSitemap').length == 0 ){
				$(_this._parent + ' .sub-area').hide().parent('li').removeClass('active'); 
				$(this).next('.sub-area').parent('li').addClass('active');
	
				if(_this._isOpen) {
					$(this).next('.sub-area').show();
				} else {
					$(this).next('.sub-area').stop().slideDown(300,'easeInOutQuad');
				}
				$(".dimmed").show();
			} else {
				$(_this._parent + ' .sub-area').hide().parent('li').removeClass('active'); 
				$(this).next('.sub-area').parent('li').addClass('active');
			}
			_this.barMove();
			_this._isOpen = true;
		})
		.click(function(){
			_this._isClick = true
			setTimeout(function(){_this._isClick = false}, 500);

			scroll.set(true);
			sitemap.move(  $(this).parent().index() );
		})
		.focus(function(){
			$(this).mouseover();
		})
		.end()
		$(_this._parent + '>ul.menu').on('mouseleave',function(e){
			_this.leave();
		});

		$(_this._parent).on('focusout', ' li a', function(e){
			setTimeout(function(){
				if($(':focus').closest(_this._parent + '>ul.menu').length ===0 ){
					_this.leave();
				}
			},10);
		});
	},
	
	leave : function(){
		let _this = gnb;
		_this._isOpen = false;
		$(_this._parent + ' .sub-area').stop().slideUp(250,'easeOutQuad');
		$(_this._parent + ' li').removeClass('active');
		$(".dimmed").hide();
		_this.activeDisplay();
	},
	
	dimmedInit : function(){
		$('.header').after('<div class="dimmed"></div>');
	},
	
	barInit : function(){
		$('.header .gnb-area').append('<span class="d1bar"></span>');
	},
	
	barMove : function($b){
		let _this = gnb;
		if(_this._isClick) return;
		var target;
		if( $('.header .gnb .menu > li.active').length > 0 ){
			target = $('.header .gnb .menu > li.active');
		} else {
			target = $('.header .gnb .menu > li.on');
		}
	
		if($b==0){
			$('.header .gnb-area .d1bar').hide();
		} else {
			$('.header .gnb-area .d1bar').show();
		}
	
		if( $(target).length > 0 ){
			var barL = $(target).offset().left + parseInt( $(target).find('a').css('padding-left') ) - 6;
			var barW = $(target).find('a').width() + 12;
			$('.header .gnb-area .d1bar').css({"left":barL + barW*0.5, "width":barW});
		} else {
			$('.header .gnb-area .d1bar').css({"width":0});
		}
	},
	
	activeDisplay : function(){
		$('#gnb .on').addClass('active');
		gnb.barMove();
	},
}

//////////////////// SEARCH
let search = {
	_parent : '.gnb-search',
	init : function(){
		let _this = search;
		$(_this._parent ).on({'click':function(){
				$(this).toggleClass('active');
				$('body').toggleClass('isSearch');

				if( $(this).hasClass('active')){
					$(".header .srch-contain").css('display','block');
					$(this).find("span").text("검색 닫기");
					$(".dimmed").show();
				} else {
					$(".header .srch-contain").css('display','none');
					$(this).find("span").text("검색");
					$(".dimmed").hide();
				}
			}
		});		
	},
	remove : function(){
		let _this = search;
		$(_this._parent).removeClass('active');
		$(".header .srch-contain").css('display','none');
		$(".dimmed").hide();
	},
	dispatch : function(){
		let _this = search;
		$(_this._parent ).trigger('click');
	},
}

//////////////////// SWIPER
let _swiperCnt = 0;
let _cardswiper = {
	init : function($class){
		//메인배너 추가 세팅: s
		if($class === '.eventSwiper'){
			$($class).closest('.visual-section').addClass('ty2');
			$($class).closest('.visual-section').prepend('<div class="visual-bg"><div class="back"></div><div class="front"></div></div>')
			$($class).find('.visual-left').wrapInner('<div class="visual-inner"></div>');
			$($class).find('.visual-right').wrapInner('<div class="visual-inner"></div>');
			$($class).find('.visual-right').attr('data-swiper-parallax-x', '90%');
		}
		//메인배너 추가 세팅: e

		if($($class+' .swiper-slide').length < 2){
			$($class +' .swiper-controls').css('display','none');
			return;
		}

		var _isParallax = false;
		if($($class).find('[data-swiper-parallax]').length || $($class).find('[data-swiper-parallax-x]').length || $($class).find('[data-swiper-parallax-y]').length || $($class).find('[data-swiper-parallax-scale]').length || $($class).find('[data-swiper-parallax-opacity]').length)_isParallax = true;

		var card = new Swiper($class, {
			slidesPerView: 1,
			loop: true,
			observer: true,
			observeParents: true,
			parallax: _isParallax,
			keyboard: {
				enabled: true,
			},
			autoplay: {
				delay: 4000,
				disableOnInteraction: false,
			},
			pagination: {
				el: $class+" .swiper-pagination",
				clickable: true,
			},
			navigation: {
					nextEl: ".swiper-button-next",
					prevEl: ".swiper-button-prev",
			},
			a11y: {
				prevSlideMessage: '이전 슬라이드',
				nextSlideMessage: '다음 슬라이드',
				slideLabelMessage: '총 {{slidesLength}}장의 슬라이드 중 {{index}}번 슬라이드 입니다.',
			},
		});

		//메인배너 추가 세팅: s
		if($class === '.eventSwiper'){
			function eventSwiperEffet(){
				const _frontBg = $('.visual-bg .front');
				const _backBg = $('.visual-bg .back');
				const _frontMarginRight = parseInt(_frontBg.css('margin-right'));
				const _backMarginLeft = parseInt(_backBg.css('margin-left'));
				const _distance = 150;
				const _speed = 300;
				let _startPos = 0;
				function bgSetPos(e){
					_startPos = e.x;
				}
				function bgSliderMove(e){
					let _move = (_startPos - e.x) / 8;
					if(_move < (_distance * -1)) _move = _distance * -1;
					else if(_move > _distance ) _move = _distance;
					const _ratio = Math.round((_move / _distance) * 100) / 100;
					const _frontBgMove = _frontMarginRight + _distance * _ratio;
					const _backBgMove = _backMarginLeft + (_distance/2) * _ratio;

					_frontBg.addClass('_drag').css({
						marginRight: _frontBgMove
					});
					_backBg.addClass('_drag').css({
						marginLeft: _backBgMove
					});
				}
				function bgMove(type){
					if(_frontBg.hasClass('_drag')) return;
					const _frontMove = type ==='prev' ? _frontMarginRight - _distance : _frontMarginRight + _distance;
					const _backMove = type ==='prev' ? _backMarginLeft - (_distance/2) : _backMarginLeft + (_distance/2);
					_frontBg.stop().animate({
						marginRight: _frontMove
					},_speed);
					_backBg.stop().animate({
						marginLeft: _backMove
					},_speed);
				}
				function bgPrev(){
					bgMove('prev');
				}
				function bgNext(){
					bgMove('next');
				}
				function bgReset(){
					_frontBg.stop().animate({
						marginRight: _frontMarginRight
					},_speed, function(){
						_frontBg.removeAttr('style').removeClass('_drag');
					});
					_backBg.stop().animate({
						marginLeft: _backMarginLeft
					},_speed, function(){
						_backBg.removeAttr('style').removeClass('_drag');
					});
				}
				if(_frontBg.length && _backBg.length){
					card.on('sliderFirstMove',bgSetPos);
					card.on('sliderMove',bgSliderMove);
					card.on('slidePrevTransitionStart',bgPrev);
					card.on('slideNextTransitionStart',bgNext);
					card.on('slideResetTransitionEnd',bgReset);
					card.on('slideChangeTransitionEnd',bgReset);
				}
			}
			eventSwiperEffet();
		}
		//메인배너 추가 세팅: e

		card.on('slideChange',function(){
			$($class).find('.swiper-num .idx').text(this.realIndex+1);
			$($class).find('.swiper-num .t_idx').text(this.slides.length-2);

			$($class).find('.swiper-slide a').attr('tabindex', -1);
			setTimeout(function(){  
				$($class).find('.swiper-slide.swiper-slide-active a').attr('tabindex',0);
			}, 500);
		});	
		$($class).find('.swiper-num .idx').text(1);
		$($class).find('.swiper-num .t_idx').text($($class + ' .swiper-slide').length-2);

		$($class).find('.swiper-slide a').attr('tabindex', -1);
		$($class).find('.swiper-slide.swiper-slide-active a').attr('tabindex',0);
		$($class+' .btn-stop, '+$class+' .btn-play').click(function(){
			$(this).css('display','none');
			switch( $(this).attr("class")){
				case "btn-stop":	card.autoplay.stop();	$('.btn-play').css('display','inline-block');		break;
				case "btn-play":	card.autoplay.start();	$('.btn-stop').css('display','inline-block');		break;
			}
		});
		$($class+' .btn-play').trigger('click');

		$($class).attr('_id', 'swiper'+_swiperCnt);
		window['swiper'+_swiperCnt] = card;
		_swiperCnt++;
		$($class).bind({
			'focusin':function(){
				var id = $(this).attr('_id');
				window[id].autoplay.stop();
			},
			'focusout':function(){
				if( $(this).find('.btn-stop').is(':visible') ){
					var id = $(this).attr('_id');
					window[id].autoplay.start();
				}
			}
		});
	}
}
var _swiper = {
	init:function($class){
		new Swiper($class, {
			slidesPerView: 'auto',
			allowTouchMove : false,
			watchOverflow : true,
			observer: true,
			observeParents: true,
			keyboard: {
				enabled: true,
			},
			navigation: {
				nextEl: '.swiper-button-next',
				prevEl: '.swiper-button-prev',
			},
			pagination: {
				el: $class+" .swiper-pagination",
			},
			a11y: {
				prevSlideMessage: '이전 카드',
				nextSlideMessage: '다음 카드',
				slideLabelMessage: '총 {{slidesLength}}장의 카드 중 {{index}}번 카드 입니다.',
			},
		});
	}
}

var _swiperStart = {
	init:function($class){
		new Swiper($class, {
			slidesPerView: 'auto',
			spaceBetween: 30,
			pagination: {
				el: $class +" .swiper-pagination",
				type: "progressbar",
			},
			observer: true,
  			observeParents: true,
		});
	}
}

// 2023-02-13 추가 
var _swiperStart2 = {
	init:function($class){
		new Swiper($class, {
			slidesPerView: 'auto',
			allowTouchMove : true,
			watchOverflow : true,
			observer: true,
			observeParents: true,
			keyboard: {
				enabled: true,
			},
			spaceBetween: 30,
			navigation: {
				nextEl: '.swiper-button-next',
				prevEl: '.swiper-button-prev',
			},
			pagination: {
				el: $class +" .swiper-pagination",
				clickable: true,
			},
			a11y: {
				prevSlideMessage: '이전 서비스',//23년 접근성 : 문구 수정
				nextSlideMessage: '다음 서비스',//23년 접근성 : 문구 수정
				slideLabelMessage: '총 {{slidesLength}}장의 카드 중 {{index}}번 카드 입니다.',
			},
		});
	}

}
//////////////////// CARD OVER
let cardover = {
	_parent : '.goods-list',
	init : function(){
		let _this=  cardover;
		for( var i = 0 ; i < $(_this._parent).length ; ++i ){
			$(_this._parent+':eq('+i+') > li').each(function(){
				//$(_this._parent+' .goods .over').attr('tabindex',0);      
				$(this).find('.goods').on({
					'focusin mouseover':function(){ 
						$(this).addClass('active');  //2023-08-28 추가 법인공용카드 추가 발급
						$(this).find('.over').addClass('on');               
					},
					'focusout mouseout':function(){          
						$(this).removeClass('active');  //2023-08-28 추가 법인공용카드 추가 발급
						$(this).find('.over').removeClass('on');           
					}
				});
			})
		} 
	}
}

//////////////////// SITEMAP
let sitemap = {
	_parent : '.gnb-sitemap',
	_pos : Array,
	init : function(){
		const _this = sitemap;
		$(this._parent).click(function(){
			if($('header.franchise').length){
				$('body').toggleClass('isSitemap franchise');
			} else {
				$('body').toggleClass('isSitemap');
			}

			if( $('.isSearch').length > 0 ){
				search.dispatch();
			}
			if( $('.isSitemap').length == 1 ){
				_this.open();
			} else {
				_this.close( $('#gnb .menu > li[data-active]').length );
				$(window).scrollTop(0);  
			}
			$(':focus').blur();
			if( $(this).closest('.gnb-area').length ){
				$('.sitemap-srch .srch-wrap .ipt-wrap .ipt').focus(); 
			} else {
				$('.gnb-area .gnb-sitemap').focus();   
			}
		});

		$('.gnb-sitemap').before('<div class="sitemapFocusSet start" tabindex="0"></div>');
		$('.sitemap-contain').append('<div class="sitemapFocusSet last" tabindex="0"></div>');
		$('.sitemapFocusSet').bind({
			'focusin':function(){
				if( $(this).hasClass('last') ){
					$('.sitemap-srch .gnb-sitemap').focus(); 
				} else if( $(this).hasClass('start') ){
					$( wa.getEnabledFocus('.sitemap-contain .sub-wrap:last-child ') ).last().focus();
				}
			}
		});
	},
	open : function(){
		const _this = sitemap;
		this._pos[0] = 0;
		$('.sitemap-contain .sub-wrap').each(function(){
			let index = $(this).index();
			_this._pos[index] =  $(this).offset().top -400;
		});

		$('#gnb .menu > li.on').attr('data-active', true).removeClass('active on');
		scroll.init();
	},
	close : function($b){

		$("#gnb .menu > li").removeClass("on active"); 
		$('#gnb .menu > li[data-active]').removeAttr('data-active').addClass('active on');
		gnb.barMove($b);

	},
	move : function($i){
		const _this = sitemap;
		$("body, html").animate({ 
			scrollTop: _this._pos[$i]
		}, {duration : 500, easing: 'easeInOutQuad', complete:function(){
			scroll.set(false);
		}});
		$('.sitemap-contain h3:eq('+$i+')').attr('tabindex', '0').focus(); 
	},
}

//////////////////// 가상계좌 상세보기
let detail = {
	init : function(){
		$('.btn-detail').click(function () {
			$(this).closest('#content').find('#pageCont').hide();
			$(this).closest('#content').find('#pageOpen').show();
		});  
		$('#btn-close').click(function () {                    
			$(this).closest('#content').find('#pageCont').show();
			$(this).closest('#content').find('#pageOpen').hide();         
		});    
	}
}

//////////////////// 스크롤 (전체메뉴)
let scroll = {
	_before:0,
	_length:6,
	_isClick:false,
	_after:null,
	init : function(){
		this._before = 0;
		this._length = $('.menu > li').length;
		$('body, html').scrollTop(0);
		this.dispatch();
	},
	update : function(){
		const _scrollTop = $(document).scrollTop();
		if( $('.isSitemap').length > 0 ){
			for(var i=0; i<this._length; i++) {
				if(_scrollTop >= sitemap._pos[i] && _scrollTop < sitemap._pos[i+1]){
					break;
				} else if(_scrollTop < sitemap._pos[i]){
					break;
				}
			}  
			this._before = Math.min(i, this._length-1);
			if($(window).scrollTop() + $(window).height() > $(document).height()-20){
				this._before = this._length-1;
			}
			if(this._before != this._after){
				this.dispatch();				
			}
			this._after = this._before;
		}

		let _isOne = false;
		if($(window).scrollTop() >= 80) { 
			if(!$(".header").is('.fixed')){
				_isOne = true;
			}
			$(".header").addClass("fixed"); 
			
		} else { 
			if($(".header").is('.fixed')){
				_isOne = true;
			}
			$(".header").removeClass("fixed");
		}
		if(_isOne){
			gnb.barMove();
			if(  $(".header").is('.fixed') ){
				$(".header h1 img").attr('src', '/nhcb_web/content/images/common/h1_logo_s.png');
			} else {
				$(".header h1 img").attr('src', '/nhcb_web/content/images/common/h1_logo.png');
			}
		}
		
		if(  $('.footer-fix').length ){
			if( _scrollTop > 810){
				$('.bottom-fixed').addClass('on');
				$('.footer').addClass('on');
			} else {
				$('.bottom-fixed').removeClass('on');
				$('.footer').removeClass('on');
			}
		}
	},
	open : function(){
	},
	dispatch : function(){
		$("#gnb .menu > li").removeClass("on active");     
		$("#gnb .menu > li").eq(this._before).addClass("on active");
		if(!this._isClick){
			gnb.barMove();	
		}
	},
	set : function($b){
		this._isClick = $b;
	},
}

//////////////////// STICKY
let sticky = {
	_header: 80,
	_isSticky:null,
	_afterSticky:false,
	_beforeSticky:false,
	init : function(){

	},
	update : function(){
		this._isSticky = false;
		if ($(window).scrollTop() >= this._header){
			this._afterSticky = true;
			if(this._afterSticky != this._beforeSticky) this.stickyCtrl(true);
		} else {
			this._afterSticky = false;
			if(this._afterSticky != this._beforeSticky) this.stickyCtrl(false);
		}
		this._beforeSticky = this._afterSticky;
	},
	stickyCtrl : function($b){
		if($b){
			$('.quick').addClass('topVisible');
		} else {
			$('.quick').removeClass('topVisible');
		}
	},
}

let pop_arr = [];
//////////////////// 공통함수들
let createCommon = {
	_popupbtn:'',
	_isFocus:false,
	init : function(){
		this.tooltip('.tooltip-wrap');
		this.openlayerpop();
		this.quicktop();
		this.myprogress('.my-progress');
		this.keypad();
		this.progress();
		this.login();
		this.chromeCheck();
		this.chromeFocus();
	},
	tooltip : function($t){
		$($t + " .btn-tooltip").on("click keypress", function(e){
			$(this).next('.tooltip').show();	
			$(this).attr('aria-expanded',true); //2023 접근성 추가	
		});
		$($t + " .btn-close").on("click blur", function(){      
			$(this).closest('.tooltip').hide();	
			$(this).closest('.tooltip-area').find('.btn-tooltip').attr('aria-expanded',false).focus(); //2023 접근성 추가
		});
		//2023 접근성 으로 주석처리 $($t + " .btn-close").trigger("click");
	},

	login : function() {
		$('.login-diffmethod li').click(function(){
			$(this).parent().find('a').attr({'aria-selected': false});
			$(this).find('a').attr({'aria-selected': true});
			let _i = $(this).index();
			$('.login-diffmethod li').each(function(i){
				let _str = $(this).find('span').text();
				if(i == _i){
					_str  = _str + ' 선택됨';
				} 
				if(i != 3){
					$(this).find('a').attr('title', _str);
				}
			});
		});
		$('.login-diffmethod li:eq(0)').trigger('click');
        $('.login-diffmethod.col5 li:first-child a').attr({'aria-selected': false, 'title':'아이디'}); //2023 접근성 추가 
	},

	openlayerpop : function(){
		const _this = createCommon;
		$(".open-lp").on("click", function() {
			$('html, body').addClass('popup-open');
			var _id = $(this).attr("aria-controls");
			$.jQueryPopup(_id, $(this));// 아이디값 가져오기
			$(window).trigger('resize'); // 팝업강제 리사이징
			_this._popupbtn = $(this);
			layerpop.loop();
		}); 
	},

	quicktop : function(){
		$('.btn-top').on('click', function(){
			$('body, html').animate({scrollTop: 0},300);
			$('#skipNavi a').eq(0).focus(); // 2023-02-01 접근성 : 포커스 문서 처음으로 이동 
		});
	},
	arrpop : function(){
		pop_arr.pop();
	},	
	myprogress : function($t){
		$($t+' .progress-bar>div').each(function () {
			var skills = $(this).data('width');
			$(this).css({'width' : skills + '%'});
			$(this).text(skills + '%');
			$($t+' .percent .use em').text(skills + '%');
			$($t+' .percent .rest em').text((100-skills) + '%');
		});
	},
	// keypad : function(){
	// 	$(".btn-keypad").unbind('click').click(function(){
	// 		$(this).toggleClass('on');
	// 	});
	// },
	keypad : function(){	
		if(!$(".btn-keypad").hasClass("toggleOn")){
			$('.btn-keypad').click(function(){	
				$(this).toggleClass('on');
			});
			$(".btn-keypad").addClass("toggleOn");
		}
	    // 23년 접근성 : 보안키패드 title 관련 추가, 박하늬 s
		$('button.btn-keypad').attr('title','실행하기').attr('alt','실행하기');
		$('button.btn-keypad').on('click',function(){ 
	    	if ($(this).hasClass('on')){
	    		$(this).attr('title','종료하기').attr('alt','종료하기');
	    	} else {
	    		$(this).attr('title','실행하기').attr('alt','실행하기');
	    	} 
	    });
		// 23년 접근성 : 보안키패드 title 관련 추가, 박하늬 e
	},
	progress : function(){
		for(var  i = 0 ; i < $('.progress').length ; ++i ){
			if( $('.progress').eq(i).hasClass('uiAct') == false ){
				$('.progress').eq(i).addClass('uiAct');
				$('.progress:eq('+i+') ol').attr('aria-hidden','true');
				var num = $('.progress').eq(i).find('li').length;
				var nowStep = $('.progress').eq(i).find('li.on').index() + 1;
				var stepName = $('.progress:eq('+i+') li.on').text();  
				var stepName = stepName.replace(new RegExp("[(0-9)]", "gi", "."), "");
				var stepName = stepName.replace('.','');
				var stepName = stepName.replace(/ /g, '');
				$('.progress:eq('+i+')').attr('role','img');
				$('.progress:eq('+i+')').attr('aria-label','총 '+num+'단계 중 '+nowStep+'단계 '+stepName + ' 진행중');
				if( $('.progress:eq('+i+') li.on span').length == 0 ){
					$('.progress:eq('+i+') li.on').wrapInner('<span/>');
				}
			}
		}
	},
	chromeCheck : function(){
		const _this = createCommon;
		var agent = navigator.userAgent.toLowerCase();
		if(  (navigator.appName =='Netscape' && navigator.userAgent.search('Trident') !== -1) || (agent.indexOf('msie') !== -1)) {
			$('body').addClass('isIe');
		} else {
			_this.isChrome = true;
			$('body').addClass('isChrome');
		}

		$('#content').attr('tabindex', '-1');
		$('#gnb').attr('tabindex', '-1');

	},
	chromeFocus : function(){
		const _this = createCommon;
		if( _this.isChrome ){
			$('body').on({
				'keydown':function(e){
					if( e.code == 'Tab' ){
						$('body').addClass('tabFocus');
					}
				},
				'mousedown':function(){
					$('body').removeClass('tabFocus');
				}
			});
		}
	},
}

////////////////////  FOCUS
let wa = {
	init : function(){
		wa.gnbSrchInit();
	},

	getEnabledFocus : function(_target, visible){
		var target = _target + " ";
		if( visible == undefined || visible == null ){
			var str = target + 'div:visible[tabindex="0"],'+target + 'li:visible[tabindex="0"],'+target + 'button:visible:not([tabindex="-1"]),'+target + 'a:visible:not([tabindex="-1"]),'+target+'input:visible:not([tabindex="-1"]),'+target+'select:visible:not([tabindex="-1"]),'+target+'textarea:visible:not([tabindex="-1"])';
		} else {
			str = target + 'div:[tabindex="0"],' + target + 'li:[tabindex="0"],' + target + 'button:not([tabindex="-1"]),'+target + 'a:not([tabindex="-1"]),'+target+'input:not([tabindex="-1"]),'+target+'select:not([tabindex="-1"]),'+target+'textarea:not([tabindex="-1"])';
		}
		return str;
	},
	gnbSrchInit : function(){
		$('.gnb .right .gnb-search').before('<div class="searchFocus btnFirst" tabindex="0"></div>');
		$('.gnb .right .gnb-search').after('<div class="searchFocus btnLast" tabindex="0"></div>');
		$('.srch-contain').prepend('<div class="searchFocus first" tabindex="0"></div>');
		$('.srch-contain').append('<div class="searchFocus last" tabindex="0"></div>');
		$('.searchFocus').bind({
			'focusin':function(e){
				if( $(e.target).hasClass('btnLast') ){
					$('.search-wrap .ipt-wrap .ipt').focus();
				} else if( $(e.target).hasClass('last') ){
					$('.gnb .right .gnb-search').focus();
				} else if( $(e.target).hasClass('first') ){
					$('.gnb .right .gnb-search').focus();
				} else if( $(e.target).hasClass('btnFirst') ){

					$( wa.getEnabledFocus('.search-wrap .keyword') ).last().focus();
				}
			}
		});
	},
}

//////////////////// LAYER POP
let layerpop = {
	init : function(){
	},

	loop : function(){
		$('html, body').addClass('popup-open');
		$('.pop-wrap').each(function(){
			if( $(this).find('.focusSet').length == 0 ){
				$(this).prepend('<div class="focusSet blind first" tabindex="0"></div>');
				$(this).append('<div class="focusSet blind last" tabindex="0"></div>');
				$(this).find('.focusSet').bind({
					'focusin':function(e){
						var id = $(e.target).closest('.pop-wrap').attr('id');
						var popwrap = '.'+$(e.target).closest('.pop-wrap').attr('class').replace(/ /gi,'.') + ' .pop-cont';
						if(id != undefined){
							popwrap  = '#'+id+popwrap;
						} 
						if( $(e.target).hasClass('first') ){
							$( wa.getEnabledFocus(popwrap) ).last().focus();
						} else {
							$( wa.getEnabledFocus(popwrap) ).first().focus();
						}
					}
				});
			}
		});	

		$('.pop-wrap .card-compare-box li:not(".no")').attr('tabindex', 0);
		var _obj = $('.pop-wrap .card-compare-box li');
		_obj.on('focusin',function(e){
			$(this).find('.card-del').css('display', 'block');
		});
		$('.pop-wrap .card-compare-box li .card-del').on('focusout',function(e){
			$(this).css('display', 'none');
		});
		$('.popup-open .pop-wrap.on .pop-cont').attr("tabindex", -1).focus();
	},

	resize : function(){
		$(".pop-body").removeClass('on').removeAttr('tabindex');
		$(".pop-body").css('height','auto');
		winH = $(window).height();
		for(var i=0; i<pop_arr.length; i++){
			let _id = '#'+pop_arr[i];
			try{
				var scrollPos = $(_id +' .pop-body').position().top;
			} catch(error){
				scrollPos = 0;
			}				
			result = $(_id +'.pop-wrap .pop-body').outerHeight();
			$(_id +'.pop-wrap .pop-cont').css('min-height', 0);
			vGap = 60; // 60은 팝업과 검은색 Dimmed 영역의 위아래 합산된 마진
			if( $('body.popup-open').length > 0 ){
				vGap = 0;
				if( $('body.popup-open .pop-wrap .pop-body').length > 0 ){
					vGap = 60;
				}
			}

			if( winH - vGap < $(_id +' .pop-cont').outerHeight() ){
				headerH = $(_id +'.pop-wrap .pop-head').outerHeight() + 30;// 30은 헤더와 스크롤 사이에 간격
				bottomH = $(_id +'.pop-wrap .pop-cont > .btn-area').outerHeight();
				if(bottomH == "" || bottomH == null){
					bottomH = 60;
				} else {
					bottomH = bottomH;
				}
				stickyH = 0;
				maxH = winH - vGap - headerH - bottomH;
				if(result > maxH ){
					result = maxH;
				}
				$(_id +' .pop-body').height(Math.floor(result) - 30);
				$(_id +' .pop-body').addClass('on');
				$(_id +' .pop-body').attr('tabindex','0');
			} 
		}
	},
}

//////////////////// LOCATION
let locationa = {
	init : function(){
		$('.location-area .drop-menu').append('<div class="blind focusSet" tabindex="0"></div>');
		$('.location-area .drop-btn').append('<i class="blind">와 같은 뎁스의 메뉴목록</i><i class="blind off">펼치기</i><i class="blind on">접기</i>');
		$('.location-area .drop-btn').on({'click':function(e){
			e.preventDefault();
			var target = $(this).closest('li');
			if($(target).hasClass('on')){
				$(target).removeClass('on');
				$(target).find('.drop-menu').stop().slideUp(250);
			} else {
				$('.location-area .location > li.on').removeClass('on').find('.drop-menu').stop().slideUp(250);
				$(target).addClass('on');
				$(target).find('.drop-menu').stop().slideDown(250);
			}
			locationa.bodyBind();
		}
		});
		$('.location-area .drop-menu .focusSet').on({'focusin':function(){
			var target = $(this).closest('li');
			$(target).find('>a').trigger('click');
			if( $(target).index() != $('.location-area .location > li').length - 1 ){
				$(target).next('li').find('a').focus();
			} else {
				$(target).find('>a').focus();
			}
		}
		});		
	},
	bodyBind : function (){
		$('body').on({'mousedown':function(e){
				if( $(e.target).closest('.location-area').length == 0 ){
					$('.location-area .location > li.on').removeClass('on').find('.drop-menu').slideUp(250);
					$('body').off('mousedown');
				}
			}
		});
	},
}

//////////////////// NOTICE
let notice = {
	_parent : '.ticker',
	init:function(){
		const _this = notice;
		$(_this._parent).mouseover(function(){
			clearTimeout(tickerTimer);
		  });
		  $(_this._parent).mouseout(function(){
			_this.ticker();
		  }); 
		this.ticker();
	},
	ticker:function(){
		const _this = notice;
		tickerTimer = setTimeout(function(){
            $(_this._parent+ ' li:first').animate( {marginTop: '-38px'}, 400, function()
            {
				$(this).detach().appendTo(_this._parent).removeAttr('style');
            });
            _this.ticker();
        }, 2000);         
	},
}

//////////////////// RADIO EXPEND
let radioChecked = {
	_parent : '.table-radio',
	init : function($name){
		const _this = radioChecked;
		$( this._parent+' tr:not(".expend") input').on('change', function() {
			let _obj = $(_this._parent+' input[name='+$name+']');
			_obj.closest('tr').next().removeClass('on');
			$(_this._parent+' input[name='+$name+']:checked').closest('tr').next().addClass('on');
			let _index = _obj.index(_obj.filter(':checked'));
			_this.accessibility(_index);
		});

		for(var i=0; i< $( _this._parent+' tr.expend').length; i++){
			$( _this._parent+' tbody tr:not(".expend"):eq('+i+')').attr({'aria-expanded': false, 'aria-controls':'acco_'+i});
			$( _this._parent+' tbody tr.expend:eq('+i+')').attr({'id':'acco_'+i});
		}
	},
	accessibility : function($i){
		const _this = radioChecked;
		for(var i=0; i< $( _this._parent+' tbody tr:not(".expend")').length; i++){
			if($i==i){
				$( _this._parent+' tbody tr:not(".expend"):eq('+i+')').attr({'aria-expanded': true});
			} else {
				$( _this._parent+' tbody tr:not(".expend"):eq('+i+')').attr({'aria-expanded': false});
			}
		}
	},
}

let radioGroup = {
	init:function(){
	}
}


//////////////////// NEW WINDOW
function newWindow(href, w, h){
	var xPos = (document.body.offsetWidth/2) - (w/2);
	xPos += window.screenLeft; 
	var yPos = (document.body.offsetHeight/2) - (h/2);
	window.open(href, "popupWin", "width="+w+", height="+h+", left="+xPos+", top="+yPos+", scrollbars=no, menubar=no, status=no, toolbar=no, resizable=no");
}
function windowClose(){
	window.close();
}

//////////////////// AUTO EMAIL
function autoEmail($this){
	let _val = $($this).val();
	let _id = $($this).attr('id');
	let _mailId = _val.split('@');
	let _mailList = ['daum.net','gmail.com','googlemail.com','hanmail.net','kakao.com','korea.com','nate.com','naver.com','outlook.com','yahoo.com'];
	let availableCity = new Array;
	for(var i=0; i < _mailList.length; i++ ){
		availableCity.push( _mailId[0] +'@'+ _mailList[i] );
	}
	$("#"+_id).autocomplete({
		source: availableCity,
		focus: function(event, ui) {
			return false;
		}
	});
}

function stepProgree(){
	var $pp = $('.page-title .progress');
	if($pp.length > 0){
		$pp.find('li').length;
		$pp.find('li').each(function(){
			$(this).attr('role','img');
			$(this).find('*').attr('aria-hidden','true');
			$(this).attr('aria-label','총'+$pp.find('li').length + '단계 중  '+$(this).find('em').text() +'단계 / ' + $(this).find('span').text());
		})
		$pp.find('.on').attr('title','선택됨');
	}	
};

//////////////////// READY
$(document).ready(function(){
	wa.init();

	$(window).scroll(function(){
		scroll.update();
		sticky.update();
	});

	$( window ).resize( function() {
		layerpop.resize();
		gnb.barMove();
	});
	layerpop.init();

	search.init();
	cardover.init();
	sitemap.init();
	detail.init();
	sticky.init();
	
	locationa.init();
	gnb.init();
	accordian.init();
	tab.init();

	createCommon.init();

	datepicker.init();

	tooltip();
	stepProgree();
	accessibilityFocus(); 
	familysite();

	radioChecked.init('radioName');
	radioGroup.init();

	_swiper.init('.recommendSwiper'); //추천카드
	_swiper.init('.corpSwiper');      //법인사업자
	_swiper.init('.personalSwiper');  //개인사업자
	_swiper.init('.paySwiper');       //결제전용

	_swiper.init('.recmmSwiper');       //

	_swiper.init('.popCardSwiper');  		//팝업1
	_swiper.init('.popServiceSwiper');    //팝업2

	_cardswiper.init('.cardSwiper');
	_cardswiper.init('.eventSwiper');

	_swiperStart.init('.startSwiper');
	_swiperStart2.init('.startSwiper2');  // 2023-02-13 추가 
	_swiperStart.init('.benefitSwiper');
	_swiperStart2.init('.benefitSwiper2'); // 2023-02-13 추가 
	_swiperStart.init('.workSwiper');
	_swiperStart2.init('.workSwiper2'); // 2023-02-13 추가 
	_swiperStart.init('.guideSwiper');
	_swiperStart2.init('.guideSwiper2'); // 2023-02-13 추가 
	_swiperStart.init('.businessSwiper');
	_swiperStart2.init('.businessSwiper2'); // 2023-02-13 추가
});











// 에러 코드 열고 닫음
$(function() {
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
});

// 아코디언 
$(function(){  
	$uiAcc.init();  
	})
	var $uiAcc = {
	init:function(){  
	$uiAcc.accordion();  
	},
	accordion:function(){
		var $el = $('.detail_list');
		if($el){
			$el.each(function(index,element){
				var $dt = $(this).eq(index).find('dt');
				$dt.each(function(depth,element){
					if(! $(this).hasClass('sertit2')){
						var $a = $(this).find('a'),
							$button = $(this).find('button');
						$(this).attr({
							'role' : 'presentation'
						})
						if($a){
							$a.attr({
								'id' : 'accHandler' + index + '_' + depth,
								'role' : 'button',
								'aria-expanded' : 'false',
								'aria-controls' : 'accPanel' + index + '_' + depth,
								'title' : '탭 열기',
							});
							$(this).next('dd').attr({
								'id' :  'accPanel' + index + '_' + depth,
								'role' : 'region',
								'aria-labelledby' : 'accHandler' + index + '_' + depth,
							});
							$a.on('focus',function(e){
								$(window).on('keypress',function(e){
									if(e.keyCode == 13 || e.keyCode == 32){
										$a.click();
									}
								})
							})
							$a.on('click',function(e){
								e.preventDefault();
								var $panel = $(this).attr('aria-controls');
								if($(this).hasClass('on')){
									$(this).removeClass('on').attr({
										'aria-expaned' : 'false',
										'title' : '탭 열기',
									});
									$('#'+$panel).css('display','none');
								}else{
									$(this).addClass('on').attr({
										'aria-expaned' : 'true',
										'title' : '탭 닫기',
									});
									$('#'+$panel).css('display','block');
								}
							});
						}else{
							if($button){
									$button.attr({
									'id' : 'accHandler' + index + '_' + depth,
									'type' : 'button',
									'role' : 'heading',
									// 'aria-level' : '3',
									'aria-expanded' : 'false',
									'aria-controls' : 'accPanel' + index + '_' + depth,
								});
								$(this).next('dd').attr({
									'id' :  'accPanel' + index + '_' + depth,
									'role' : 'region',
									'aria-labelledby' : 'accHandler' + index + '_' + depth,
								});
								$button.on('click',function(e){
									e.preventDefault();
									var $panel = $(this).attr('aria-controls');
									if($(this).hasClass('on')){
										$(this).removeClass('on').attr({
											'aria-expaned' : 'false',
										});
										$('#'+$panel).css('display','none');
									}else{
										$(this).removeClass('on').attr({
											'aria-expaned' : 'true',
										});
										$('#'+$panel).css('display','block');
									}
								})
								$button.on('focus',function(e){
								$(window).on('keypress',function(e){
										if(e.keyCode == 13 || e.keyCode == 32){
											$a.click();
										}
									})
								})
							}
						}
					}
				})
			})
		}
	}
}
/* 2023-12-12 제거 kjh $(document).ready(function() {
	$('head').append('<script type="text/javascript" src="/nhcb_web/content/js/ui_front.js"></script>');
});*/
