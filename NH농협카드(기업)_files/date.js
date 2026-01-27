/*****************************************************************************************
* 업무명 : 공통
* 세부업무명 : 공통
* 설명 : 월별말일 Return
*        연, 월, 일 SelectBox Display
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
  * 월마지막날짜 구함 
  * </pre>
  * @param year : 해당년
  * @param month : 해당월
  * @return 월마지막날짜
  */
function date_cfGetMaxDay(year,month){
    if( month ==1 ) return 31;
    if( month ==2 ){
    	var gubun = 28;
		if( (year%4)==0 )gubun=29;
		if( (year%100)==0)gubun=28;
		if( (year%400)==0)gubun=29;
        return gubun;
    }
    if( month==3 ) return 31;
    if( month==4 ) return 30;
    if( month==5 ) return 31;
    if( month==6 ) return 30;
    if( month==7 ) return 31;
    if( month==8 ) return 31;
    if( month==9 ) return 30;
    if( month==10 ) return 31;
    if( month==11 ) return 30;
    if( month==12 ) return 31;
}

/**
  * <pre>
  * 년,월,일,시,분 SelectBox Display
  * </pre>
  * @param objId : HTML을 표시할 영역 ID
  * @param sDate : 날짜
  * @param selectID : SelectBox ID
  * @param iType : Display Type
  * @param iStartYear : 시작 연도
  * @param iEndYear : 마지막 연도
  * @param title : 타이틀
  * @param sMethodStr : 메서드 
  * @param bHasSpace : 비어있는값 여부(기본값: false)
  * @return 
  */
function date_cfPrintDateSelect(sDate, selectID, objId, iType, iStartYear, iEndYear, title, sMethodStr, bHasSpace, locale) {
	  if (iType == null) iType = 0;
	  if (bHasSpace == null || bHasSpace == undefined) bHasSpace = false;
	  var yearSelectID  = selectID + '_year';
	  var monthSelectID = selectID + '_month';
	  var dateSelectID  = selectID + '_date';
	  var timeSelectID  = selectID + '_time';
	  var minuteSelectID  = selectID + '_minute';
	  var weekSelectID  = selectID + '_week';
	  var html = '';
	  
	  var yearSelectTitle = title + ' '+common_cfGetMessage("I0502")+' ' + common_cfGetMessage("I0503");
	  var monthSelectTitle1 = title + ' '+common_cfGetMessage("I0497")+' ' + common_cfGetMessage("I0503");
	  var monthSelectTitle2 = title + ' '+common_cfGetMessage("I0501")+' ' + common_cfGetMessage("I0503");
	  var dateSelectTitle = title + ' '+common_cfGetMessage("I0498")+' ' + common_cfGetMessage("I0503");
	  var timeSelectTitle = title + ' ' +common_cfGetMessage("I0499")+' ' + common_cfGetMessage("I0503");
	  var minuteSelectTitle = title + ' '+common_cfGetMessage("I0500")+' ' + common_cfGetMessage("I0503");   
	  
	  var $objDiv = $("#" + objId );
	  if (iType == 0) {   // 년, 월, 일
		  html += date_cfMakeYearSelect(yearSelectID, sDate.substring(0,4), iStartYear, iEndYear, bHasSpace, yearSelectTitle, "onChange=date_cfLeapRule('" + selectID + "');" ) +' '+common_cfGetMessage("I0496")+' ';
		  html += date_cfMakeMonthSelect(monthSelectID, sDate.substring(4, 6), bHasSpace, monthSelectTitle1, "onChange=date_cfLeapRule('" + selectID + "');") + ' '+common_cfGetMessage("I0497")+' ';
		  html += date_cfMakeDateSelect(dateSelectID, sDate.substring(6), bHasSpace, sDate.substring(0, 4), sDate.substring(4, 6), dateSelectTitle, sMethodStr) + ' '+common_cfGetMessage("I0498");
	  } else if (iType == 1) {  // 월, 일, 년
		  html += date_cfMakeMonthSelect(monthSelectID, sDate.substring(4, 6), null, monthSelectTitle1, "onChange=date_cfLeapRule('" + selectID + "');") + ' '+common_cfGetMessage("I0497")+' ';
		  html += date_cfMakeDateSelect(dateSelectID, sDate.substring(6), null, sDate.substring(0, 4), sDate.substring(4, 6), dateSelectTitle, sMethodStr) + ' '+common_cfGetMessage("I0498")+' ';
		  html += date_cfMakeYearSelect(yearSelectID, sDate.substring(0,4), iStartYear, iEndYear, null, yearSelectTitle, "onChange=date_cfLeapRule('" + selectID + "');") + ' '+common_cfGetMessage("I0496");
	  } else if (iType == 2) {  // 월, 년 
		  html += date_cfMakeYearSelect(yearSelectID, sDate.substring(0,4), iStartYear, iEndYear, null, yearSelectTitle, "onChange=date_cfLeapRule('" + selectID + "');" ) +  ' '+common_cfGetMessage("I0496")+' ';
		  html += date_cfMakeMonthSelect(monthSelectID, sDate.substring(4, 6), null, monthSelectTitle1, null) + ' '+common_cfGetMessage("I0497");
	  } else if (iType == 3) {  // 년
		  html += date_cfMakeYearSelect(yearSelectID, sDate.substring(0,4), iStartYear, iEndYear, null, yearSelectTitle, null ) + ' '+common_cfGetMessage("I0496");
	  } else if (iType == 4) {  // 일
		  html += date_cfMakeDateSelect(dateSelectID, sDate.substring(6), null, null, null, dateSelectTitle );
  	  } else if (iType == 5) {  // 년, 월, 일, 시, 분
		  html += date_cfMakeYearSelect(yearSelectID, sDate.substring(0,4), iStartYear, iEndYear, null, yearSelectTitle, "onChange=date_cfLeapRule('" + selectID + "');" ) +' '+common_cfGetMessage("I0496")+' ';
		  html += date_cfMakeMonthSelect(monthSelectID, sDate.substring(4, 6) , null, monthSelectTitle1, "onChange=date_cfLeapRule('" + selectID + "');") + ' '+common_cfGetMessage("I0497")+' ';
		  html += date_cfMakeDateSelect(dateSelectID, sDate.substring(6, 8), null, sDate.substring(0, 4), sDate.substring(4, 6), dateSelectTitle, sMethodStr) + ' '+common_cfGetMessage("I0498")+' ';
		  html += date_cfMakeTimeSelect(timeSelectID, sDate.substring(8,10), null, timeSelectTitle ) + ' '+common_cfGetMessage("I0499")+' ';
		  html += date_cfMakeMinSelect(minuteSelectID, sDate.substring(10,12), null, minuteSelectTitle ) + ' '+common_cfGetMessage("I0500");
  	  }else if (iType == 6) { // 월, 일 tae.jin.park 2002-06-03 5:19오후
		  html += date_cfMakeMonthSelect(monthSelectID, sDate.substring(4, 6), null, monthSelectTitle2) + ' '+common_cfGetMessage("I0501")+' ';
		  html += date_cfMakeDateSelect(dateSelectID, sDate.substring(6), null, null, null, dateSelectTitle, sMethodStr) + ' '+common_cfGetMessage("I0498");
  	  }else if (iType == 7) {	// 년, 월, 일, 요일
		  html += date_cfMakeYearSelect(yearSelectID, sDate.substring(0,4), iStartYear, iEndYear, bHasSpace, yearSelectTitle, "onChange=date_cfLeapRule('" + selectID + "');" ) +' '+common_cfGetMessage("I0496")+' ';
		  html += date_cfMakeMonthSelect(monthSelectID, sDate.substring(4, 6), bHasSpace, monthSelectTitle1, "onChange=date_cfLeapRule('" + selectID + "');") + ' '+common_cfGetMessage("I0497")+' ';
		  html += date_cfMakeDateSelect(dateSelectID, sDate.substring(6), bHasSpace, sDate.substring(0, 4), sDate.substring(4, 6), dateSelectTitle, sMethodStr) + ' '+common_cfGetMessage("I0498");
		  html += ' <strong id="' + weekSelectID + '">' + date_cfGetWeekName(sDate.substring(0,4), sDate.substring(4, 6), sDate.substring(6), locale) + '</strong>';
  	  }else if (iType == 8) {  // 년도 (고객의 요청으로 ' 년도' 문구 추가)
		  html += date_cfMakeYearSelect(yearSelectID, sDate.substring(0,4), iStartYear, iEndYear, null, yearSelectTitle, null ) + ' '+common_cfGetMessage("I0502");
  	  }else if (iType == 9) {  // 년,개월
		  html += date_cfMakeYear2Select(yearSelectID, sDate.substring(0,2), iStartYear, iEndYear, null, yearSelectTitle, null ) +  ' '+common_cfGetMessage("I0496")+' ';
		  html += date_cfMakeMonth2Select(monthSelectID, sDate.substring(2, 4), null, monthSelectTitle1, null) + ' '+common_cfGetMessage("I0501");
  	  }else if (iType == 10) {  // 월,년
  		  html += date_cfMakeMonthSelect(monthSelectID, sDate.substring(4, 6), bHasSpace, monthSelectTitle1, null) + ' '+common_cfGetMessage("I0497")+' ';
  		  html += date_cfMakeYearSelect(yearSelectID, sDate.substring(0, 4), iStartYear, iEndYear, bHasSpace, yearSelectTitle, null ) +  ' '+common_cfGetMessage("I0496")+' ';
  	  }
	  $objDiv.html(html);
}

/**
 * <pre>
 * 일 SelectBox Display
 * </pre>
 * @param dateselectID : SelectBox ID
 * @param sSelectedDay : Selected 일
 * @param bHasSpace : 비어있는값 여부
 * @param year : 특정연도
 * @param month : 특정일자
 * @param title : SelectBox 타이틀
 * @param sMethodStr : 메서드
 * @return 
 */
function date_cfMakeDateSelect( dateselectID, sSelectedDay , bHasSpace, year, month, title, sMethodStr) {
    if (bHasSpace == null) bHasSpace = false;
    var html = "";
    var k = "";
    if (sMethodStr != null && sMethodStr !="" ) {
        html = "<select data-type='select' id='" + dateselectID + "' name='" + dateselectID + "' title='" + title + "' "+sMethodStr+">";
    } else {
        html = "<select data-type='select' id='" + dateselectID + "' name='" + dateselectID + "' title='" + title + "'>";
    }   
    if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
    var leapEndDate = 31;
      
    try {
       if ( month == null || $.trim(month) == '' || month == undefined )  { // month가 비워져 있는 경우
    	   leapEndDate = 31;
       } else {
    	   leapEndDate = date_cfGetMaxDay(year, month);
       }	   
    } catch(e) {
       leapEndDate = 31;
    }
    
    for ( var i = 1; i <= leapEndDate; i++ ) {
        if (i<10) k = '0' + i; 
        else k = "" + i;
        if (k == sSelectedDay) html    +=  '<option value="' + k + '"' +   ' selected>' + k + '</option>';
        else html    +=  '<option value="' + k + '"' +   '>' + k + '</option>';
    }
    html += '</select>';
    return html;
}

/**
 * <pre>
 * 일 SelectBox Display - class값 추가
 * </pre>
 * @param dateselectID : SelectBox ID
 * @param sSelectedDay : Selected 일
 * @param iClass : SelectBox class 값
 * @param bHasSpace : 비어있는값 여부
 * @param year : 특정연도
 * @param month : 특정일자
 * @param title : SelectBox 타이틀
 * @param sMethodStr : 메서드
 * @return 
 */
function date_cfMakeDateSelect2( dateselectID, sSelectedDay , iClass, bHasSpace, year, month, title, sMethodStr) {
    if (bHasSpace == null) bHasSpace = false;
    var html = "";
    var k = "";
    if (sMethodStr != null && sMethodStr !="" ) {
        html = "<select data-type='select' class='" + iClass + "' id='" + dateselectID + "' name='" + dateselectID + "' title='" + title + "' "+sMethodStr+">";
    } else {
        html = "<select data-type='select' class='" + iClass + "' id='" + dateselectID + "' name='" + dateselectID + "' title='" + title + "'>";
    }   
    if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
    var leapEndDate = 31;
      
    try {
       if ( month == null || $.trim(month) == '' || month == undefined )  { // month가 비워져 있는 경우
    	   leapEndDate = 31;
       } else {
    	   leapEndDate = date_cfGetMaxDay(year, month);
       }	   
    } catch(e) {
       leapEndDate = 31;
    }
    
    for ( var i = 1; i <= leapEndDate; i++ ) {
        if (i<10) k = '0' + i; 
        else k = "" + i;
        if (k == sSelectedDay) html    +=  '<option value="' + k + '"' +   ' selected>' + k + '</option>';
        else html    +=  '<option value="' + k + '"' +   '>' + k + '</option>';
    }
    html += '</select>';
    return html;
}

/**
 * <pre>
 * 월 SelectBox Display
 * </pre>
 * @param monthselectID : SelectBox ID
 * @param sSelectedMonth : Selected 월
 * @param bHasSpace : 비어있는값 여부
 * @param title : SelectBox 타이틀
 * @param sMethodStr : 메서드
 * @return 
 */
function date_cfMakeMonthSelect( monthselectID, sSelectedMonth, bHasSpace, title, sMethodStr ) {
   if (bHasSpace == null) bHasSpace = false;
   var html = "";
   var k = ""; 
   week = new Array("01","02","03","04","05","06","07","08","09","10","11","12");
   if (sMethodStr != null && sMethodStr !="" ) {
       html = "<select data-type='select' id='" + monthselectID + "' name='" + monthselectID + "' title='" + title + "' "+sMethodStr+">";
   } else {
       html = "<select data-type='select' id='" + monthselectID + "' name='" + monthselectID + "' title='" + title + "' >";
   }   
   if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
   for ( var i = 1; i <= 12; i++ ) {
       if (i<10) k = '0' + i; 
       else k = "" + i;
       if (k == sSelectedMonth) html +=  '<option value="' + k + '"' +   ' selected>' + week[i-1] + '</option>\n';
       else html +=  '<option value="' + k + '"' +   '>' + week[i-1] + '</option>\n';
   }    
   html += '</select>';    
   return html;
}

/**
 * <pre>
 * 월 SelectBox Display - class값 추가
 * </pre>
 * @param monthselectID : SelectBox ID
 * @param sSelectedMonth : Selected 월
 * @param iClass : SelectBox class 값
 * @param bHasSpace : 비어있는값 여부
 * @param title : SelectBox 타이틀
 * @param sMethodStr : 메서드
 * @return 
 */
function date_cfMakeMonthSelect2( monthselectID, sSelectedMonth, iClass, bHasSpace, title, sMethodStr ) {
   if (bHasSpace == null) bHasSpace = false;
   var html = "";
   var k = ""; 
   week = new Array("01","02","03","04","05","06","07","08","09","10","11","12");
   if (sMethodStr != null && sMethodStr !="" ) {
       html = "<select data-type='select' class='" + iClass + "' id='" + monthselectID + "' name='" + monthselectID + "' title='" + title + "' "+sMethodStr+">";
   } else {
       html = "<select data-type='select' class='" + iClass + "'id='" + monthselectID + "' name='" + monthselectID + "' title='" + title + "' >";
   }   
   if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
   for ( var i = 1; i <= 12; i++ ) {
       if (i<10) k = '0' + i; 
       else k = "" + i;
       if (k == sSelectedMonth) html +=  '<option value="' + k + '"' +   ' selected>' + week[i-1] + '</option>\n';
       else html +=  '<option value="' + k + '"' +   '>' + week[i-1] + '</option>\n';
   }    
   html += '</select>';    
   return html;
}

/**
 * <pre>
 * 월 SelectBox Display(2자리: 00, 01, 02, ...)
 * </pre>
 */
function date_cfMakeMonth2Select( monthselectID, sSelectedMonth, bHasSpace, title, sMethodStr ) {
   if (bHasSpace == null) bHasSpace = false;
   var html = "";
   if (sMethodStr != null && sMethodStr !="" ) {
       html = "<select data-type='select' id='" + monthselectID + "' name='" + monthselectID + "' title='" + title + "' "+sMethodStr+">";
   } else {
       html = "<select data-type='select' id='" + monthselectID + "' name='" + monthselectID + "' title='" + title + "' >";
   }   
   if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
   for ( var i = 0; i <= 12; i++ ) {
       if ((i>9?i:"0"+i) == sSelectedMonth) {
    	   html +=  '<option value="' + (i>9?i:"0"+i) + '"' +   ' selected>' + (i>9?i:"0"+i) + '</option>\n';
       } else {
    	   html +=  '<option value="' + (i>9?i:"0"+i) + '"' +   '>' + (i>9?i:"0"+i) + '</option>\n';
       }
   }    
   html += '</select>';    
   return html;
}

/**
 * <pre>
 * 시간 SelectBox Display
 * </pre>
 * @param timeselectID : SelectBox ID
 * @param sSelectedTime : Selected 시간
 * @param bHasSpace : 비어있는값 여부
 * @param title : SelectBox 타이틀
 * @return 
 */
function date_cfMakeTimeSelect( timeselectID, sSelectedTime , bHasSpace, title) {
   if (bHasSpace == null) bHasSpace = false;
   var html = "";
   var k = "";
   html = "<select data-type='select' id='" + timeselectID + "' name='" + timeselectID + "' title='" + title + "' >";
   if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
       for ( var i = 0; i <= 23; i++ ) {
       if (i<10) k = '0' + i; 
       else k = "" + i;
       if (k == sSelectedTime) html    +=  '<option value="' + k + '"' +   ' selected>' + i + '</option>';
       else html    +=  '<option value="' + k + '"' +   '>' + i + '</option>';
   }
   html += '</select>';       
   return html;
}      

/**
* <pre>
* 분 SelectBox Display
* </pre>
* @param timeselectID : SelectBox ID
* @param sSelectedTime : Selected 분
* @param bHasSpace : 비어있는값 여부
* @param title : SelectBox 타이틀 
* @return 
*/
function date_cfMakeMinSelect( minselectID, sSelectedMin , bHasSpace, title ) {
   if (bHasSpace == null) bHasSpace = false;
   var html = "";
   var k = "";
   html = "<select data-type='select' id='" + minselectID + "' name='" + minselectID + "' title='" + title + "' >";
   if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
   for ( var i = 0; i <= 59; i++ ) {
       if (i<10) k = '0' + i; 
       else k = "" + i;
       if (k == sSelectedMin) html    +=  '<option value="' + k + '"' +   ' selected>' + i + '</option>';
       else html    +=  '<option value="' + k + '"' +   '>' + i + '</option>';
   }
   html += '</select>';       
   return html;
}

/**
 * <pre>
 * 연도 SelectBox Display
 * </pre>
 * @param yearselectID : SelectBox ID
 * @param sSelectedYear : Selected 연도
 * @param iStartYear : 시작 연도
 * @param iEndYear : 마지막 연도
 * @param bHasSpace : 비어있는값 여부
 * @param title : SelectBox 타이틀
 * @param sMethodStr : 메서드 
 * @return 
 */
function date_cfMakeYearSelect(yearselectID, sSelectedYear, iStartYear, iEndYear, bHasSpace , title, sMethodStr) {
   if (iStartYear == null) iStartYear = 1900;
   if (iEndYear == null) iEndYear = (new Date()).getFullYear();
   if (bHasSpace == null) bHasSpace = false;
   var html = "";   
 
   if (sMethodStr != null && sMethodStr !="" ) {
       html = "<select data-type='select' id='" + yearselectID + "' name='" + yearselectID + "' title='" + title + "' "+sMethodStr+">";
   } else {
       html = "<select data-type='select' id='" + yearselectID + "' name='" + yearselectID + "' title='" + title + "' >";
   }   
   if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
   for ( var i = iStartYear; i <= iEndYear; i++ ) {    
      if ((i+"") == sSelectedYear) html += '<option value="' + i + '"' + ' selected>' + i + '</option>\n';
      else html += '<option value="' + i + '"' + '>' + i + '</option>\n';
   }
   html += '</select>';       
   return html;
}

/**
 * <pre>
 * 연도 SelectBox Display - class값 추가
 * </pre>
 * @param yearselectID : SelectBox ID
 * @param sSelectedYear : Selected 연도
 * @param iStartYear : 시작 연도
 * @param iEndYear : 마지막 연도
 * @param iClass : SelectBox class 값
 * @param bHasSpace : 비어있는값 여부
 * @param title : SelectBox 타이틀
 * @param sMethodStr : 메서드 
 * @return 
 */
function date_cfMakeYearSelect2(yearselectID, sSelectedYear, iStartYear, iEndYear, iClass, bHasSpace , title, sMethodStr) {
   if (iStartYear == null) iStartYear = 1900;
   if (iEndYear == null) iEndYear = (new Date()).getFullYear();
   if (bHasSpace == null) bHasSpace = false;
   var html = "";   
 
   if (sMethodStr != null && sMethodStr !="" ) {
       html = "<select data-type='select' class='"+ iClass +"' id='" + yearselectID + "' name='" + yearselectID + "' title='" + title + "' "+sMethodStr+">";
   } else {
       html = "<select data-type='select' class='"+ iClass +"' id='" + yearselectID + "' name='" + yearselectID + "' title='" + title + "' >";
   }   
   if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
   for ( var i = iStartYear; i <= iEndYear; i++ ) {    
      if ((i+"") == sSelectedYear) html += '<option value="' + i + '"' + ' selected>' + i + '</option>\n';
      else html += '<option value="' + i + '"' + '>' + i + '</option>\n';
   }
   html += '</select>';       
   return html;
}

/**
 * <pre>
 * 연도 SelectBox Display(2자리: 00, 01, 02, ...)
 * </pre>
 */
function date_cfMakeYear2Select(yearselectID, sSelectedYear, iStartYear, iEndYear, bHasSpace , title, sMethodStr) {
   if (iStartYear == null) iStartYear = 0;
   if (iEndYear == null) iEndYear = 1;
   if (bHasSpace == null) bHasSpace = false;
   var html = "";   
 
   if (sMethodStr != null && sMethodStr !="" ) {
       html = "<select data-type='select' id='" + yearselectID + "' name='" + yearselectID + "' title='" + title + "' "+sMethodStr+">";
   } else {
       html = "<select data-type='select' id='" + yearselectID + "' name='" + yearselectID + "' title='" + title + "' >";
   }   
   if (bHasSpace) html += '<option value="">'+common_cfGetMessage("I0503")+'</option>';
   for ( var i = iStartYear; i <= iEndYear; i++ ) {
      if ((i>9?i:"0"+i) == sSelectedYear) {
    	  html += '<option value="' + (i>9?i:"0"+i) + '"' + ' selected>' + (i>9?i:"0"+i) + '</option>\n';
      } else {
    	  html += '<option value="' + (i>9?i:"0"+i) + '"' + '>' + (i>9?i:"0"+i) + '</option>\n';
      }
   }
   html += '</select>';       
   return html;
}

/**
 * <pre>
 * 윤년체크후 일SelectBox 생성
 * printDateSelect와 같이 사용
 * </pre>
 * @param selectID : SelectBox ID
 * @param fm : Form 이름
 * @return 
 */
function date_cfLeapRule(selectID) {
  var $year_selected  = $( "#"+ selectID+"_year option:selected");
  var $month_selected  = $( "#"+ selectID+"_month option:selected");
  var $date_selectbox = $( "#"+ selectID+"_date");

  var i = 1;
  var k = 1;
  var total_days = date_cfGetMaxDay($year_selected.val(), $month_selected.val());
  
  //삭제
  $date_selectbox.find("option").not("[value='']").remove();
  
  for (i=1 ;i <= total_days;i++) {
    k = i;
    if(i < 10) k = '0' + k;
    $date_selectbox.append($('<option>', {
        value: k,
        text: k
     })); 
  }
  $date_selectbox.refresh();
  
}

/**
 * 특정 날짜의 요일 이름을 반환
 * @param year : 특정연도
 * @param month : 특정월
 * @param date : 특정일자
 * @return 요일이름(예: 일요일)
 */
function date_cfGetWeekName(year, month, date, locale) {
	var tmpDate = new Date(year + '/' + month + '/' + date);
	var nWeek = tmpDate.getDay();
	if (locale == 'en' || locale == 'en_US') {
		var weekName = new Array('Sun','Mon','Tue','Wed','Thu','Fri','Sat');
		return weekName[nWeek];
	} else {
		var weekName = new Array('일','월','화','수','목','금','토');
		return weekName[nWeek] + '요일';
	}
}

/**
 * 오늘날짜가져오기.
 *
 * @return yyyymmdd 20121107
 */
function getToday()
{
    var today = new Date();
    var _year = today.getFullYear();
    var _mon = today.getMonth()+1;
    
    //getHours()
    //getMinutes()
    //getSeconds()
    
    
    if(_mon < 10)
        _mon = "0"+_mon+"";
    
    var _date = today.getDate();
    if(_date < 10)
        _date = "0" + _date + "";
    
    var _fulldate = _year + ""+ _mon +""+ _date+"";
    
    return _fulldate;
}

/**
 * 날짜 유효셩 체크
 */
function date_chkDate(dat){
	if(dat == '' || dat == undefined || dat == null || dat == "") {
		return;
	}
	if(dat.indexOf('-') > -1) {
		dat = dat.replace(/-/gi,'');
	}
	if(dat.length != 8 ) {
		return;
	}
	
	var y = dat.substring(0,4);
	var m = dat.substring(4,6);
	var d = "";
	if(dat.length == 8)	d = dat.substring(6,8);
	else if(dat.length == 6)	d = 01;
	var errorVal = true;
	var dateArr = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
	
	if(y%1000 != 0 && y%4 ==0){
		//윤년
		dateArr[1] = 29;
	}
	if(d > dateArr[m-1] || d < 1){
		errorVal = false;
	}
	if(m < 1 || m > 12){
		errorVal = false;
	}
	if(m % 1 !=0 || y%1 !=0 || d%1 !=0 ){
		errorVal = false;
	}
	
	return errorVal;
}

/**
 * [설명]
 * 오늘, 어제, 1주전, 2주전, 3주전, 4주전 데이타를 가져옴
 * 기준일은 항상 오늘임.
 * yyyy-mm-dd 의 형식임.
 *
 * 일 기준으로 조회를 할 경우는 d를 붙인다.
 * ex) getTermDate("3d", '20130304','');// 미래
 *     getTermDate("-7d", '20130304', '');// 과거
 *
 * 월 기준으로 조회를 할 경우는 m을 붙인다.
 * ex) getTermDate("2m", '20130304', '');// 미래
 *     getTermDate("-1m", '20130304', '');// 과거
 *
 * 년 기준으로 조회를 할 경우는 y을 붙인다.
 * ex) getTermDate("3y", '20130304', '');// 미래
 *     getTermDate("-2y", '20130304', '');// 과거
 *
 * @param dat 요청 값
 * @param curdate 기준일자
 * @param pattern 패턴
 * @return 결과
 */
 
function date_getTermDate(dat, curdate, pattern){
	 if(curdate.length != 8 && curdate.length != 6) {
		if(pattern == null) {
	    	return "0000"+"-"+"00"+"-"+"00";
		} else {
	    	return "0000"+pattern+"00"+pattern+"00";
		}
	}
	
	var year = curdate.substring(0,4)*1;
	var month = curdate.substring(4,6)*1;
	var date = "";
	
	if(curdate.length == 8){
		date = curdate.substring(6,8)*1;
	}else if (curdate.length == 6){
		date = 01;
	}
	
 if(dat == "") return dat;
 switch (dat) {
		case '-1m': dat = '-30d'; break;
		case '-2m': dat = '-60d'; break;
		case '-3m': dat = '-90d'; break;
		case '-6m': dat = '-180d'; break;
		case '-12m': dat = '-365d'; break;
		case '1m': dat = '30d'; break;
		case '2m': dat = '60d'; break;
		case '3m': dat = '90d'; break;
		case '6m': dat = '180d'; break;
		case '12m': dat = '365d'; break;
 }
 var term = 0;
 try {
     var s = dat.substring(0, dat.length-1);
     if(s.length == 0) return dat;
     term = parseInt(s, 10);
 } catch(e) {
     return dat;
 }
 var oDate;// 계산 결과 객체 선언
 var cDate;// 계산에 사용할 날짜 객체 선언
 if(dat.toLowerCase().lastIndexOf("d") != -1) {// 일 계산 요청함
     date = (date*1) + (term*1); // 날짜 계산
     month--; // 월은 0~11 이므로 하나 빼준다
 } else if(dat.toLowerCase().lastIndexOf("y") != -1) {// 년 계산 요청함
     year = year + parseInt(term, 10);
     month--; // 월은 0~11 이므로 하나 빼준다
 }
	oDate = new Date(year, month, date);// 계산된 날짜 객체 생성 (객체에서 자동 계산)
 year = oDate.getFullYear();
 month = (oDate.getMonth()+1) < 10 ? '0'+(oDate.getMonth()+1) : (oDate.getMonth()+1);
 date = oDate.getDate() < 10 ? '0'+oDate.getDate() : oDate.getDate();
 if(pattern == null) {
     return year+"-"+month+"-"+date;
 } else {
     return year+pattern+month+pattern+date;
	}
}

/**
 * 날짜비교(yyyyMMdd 의 string 인자)
 */
function date_getCompareDate(startDate, endDate){
	var sDate, eDate = "";
	if( !startDate || !endDate )	return null;
	
	if(startDate.length == 8 || endDate.length == 8 ){
	 	sDate = new Date( startDate.substring(0,4), startDate.substring(4,6) -1, startDate.substring(6,8));
	 	eDate = new Date( endDate.substring(0,4), endDate.substring(4,6) -1, endDate.substring(6,8));
	}else if(startDate.length == 6 || endDate.length == 6){
		sDate = new Date( startDate.substring(0,4), startDate.substring(4,6) -1);
	 	eDate = new Date( endDate.substring(0,4), endDate.substring(4,6) -1);
	}else{
		return null;
	}
	
	return parseInt( eDate - sDate, 10);
}

function date_getDateDiff(startDate, endDate){
	var startDateDate, endDateDate = "";
	if( !startDate || !endDate )	return null;
	if(startDate.length == 8 || endDate.length == 8 ){
		startDateDate = new Date(startDate.substring(0,4), startDate.substring(4,6) -1, startDate.substring(6,8));
	 	endDateDate = new Date(endDate.substring(0,4), endDate.substring(4,6) -1, endDate.substring(6,8));
	}else if(startDate.length == 6 || endDate.length == 6){
		startDateDate = new Date(startDate.substring(0,4), startDate.substring(4,6) -1, 01);
	 	endDateDate = new Date(endDate.substring(0,4), endDate.substring(4,6) -1, 01);
	}else{
		return null;
	}

	var day = 1000*60*60*24; // 밀리세컨초*초*분*시간
	var dateDiff = Math.ceil((endDateDate.getTime()-startDateDate.getTime())/day);
	
	return dateDiff;
}

// 입력날 날짜 기준으로 지정한 기간의 전후 날짜(input_period가 음수인 경우 이전기간, 양수의 경우 이후기간 조회)
function date_getAfterDate(input_targetDate, input_period, input_pattern) {
	
	var period = Number(input_period); // ex) 30 or 60 or 180 (기간)
	var targetDate = input_targetDate.replace(/-/gi,'');
	var pattern = input_pattern;
	 
	// 오늘 날짜
	var targetYear = Number( targetDate.substring(0, 4) );
	var targetMonth = Number( targetDate.substring(4, 6) );
	var targetDay = Number( targetDate.substring(6, 8) );

	// 날짜 계산(1,3,6,12개월을 날짜로 계산)
	newReturnDate = new Date;	// 종료일
	switch (period) {
	case -90:
		newReturnDate = new Date(targetYear, targetMonth - 3 - 1, targetDay + 1);
		break;		
	case 30:
		newReturnDate = new Date(targetYear, targetMonth, targetDay + 1);	
		break;
	case 180: 	
		newReturnDate = new Date(targetYear, targetMonth + 6 - 1, targetDay + 1);	
		break;
	default:
		break;
	}

	var returnYear, returnMonth, returnDay, returnDate = "";
	
	// 종료 년,월,일 선택
	returnYear = Number(newReturnDate.getFullYear()); 
	returnMonth = Number(newReturnDate.getMonth()) + 1;
	returnMonth = (returnMonth < 10 ? '0'+returnMonth : returnMonth);                  
	
	returnDay = Number(newReturnDate.getDate());
	returnDay = (returnDay < 10 ? '0'+returnDay : returnDay);
	
	if(pattern == null) {
    	returnDate = String(returnYear) + String(returnMonth) + String(returnDay);
	} else {
		returnDate = returnYear+pattern+returnMonth+pattern+returnDay;
	}
	 
	return returnDate; 
}
/**
 * 바우처 날짜 조회성 체크
 * 조회시작일, 조회종료일 유효성체크
 */
function getVouchCheckDate(startDate, endDate){
	var today = getToday();
	if(today < startDate){
        nhAlert("조회시작날짜는 오늘날짜와 같거나<br>과거날짜이어야 합니다.");
        return false;
    }
    if(today < endDate){
        nhAlert("조회종료날짜는 오늘날짜와 같거나<br>과거날짜이어야 합니다.");
        return false;
    }
    if(endDate < startDate){
        nhAlert("조회시작날짜는 조회종료날짜와  같거나<br>과거날짜이어야 합니다.");
        return false;
    }
    return true;
}

/**
 * 날짜비교
 * 조회시작일, 조회종료일
 * 조회종료일-조회시작일
 */
function getDayRange(startDate, toEnd){
    var year = "";
    var month = "";
    var date = "";
    
    year  = startDate.substring(0, 4);
    month = startDate.substring(4, 6);
    date  = startDate.substring(6, 8);
    
    startDate = new Date(year, month-1 , date);
    
    year  = toEnd.substring(0, 4);
    month = toEnd.substring(4, 6);
    date  = toEnd.substring(6, 8);
    
    toEnd = new Date(year, month-1 , date);
    
    var totdat = (toEnd - startDate)/(24*60*60*1000);
    var chkdat = Math.ceil(totdat);                  
    
    return chkdat;
}

/**
 * 오늘날짜가져오기(년월일시분초밀리세컨즈).
 * @return yyyymmddhhmmssSSS 
 *         20220829173010111
 */
function getCurrentDayMiliseconds(){
	var date 	 = new Date();
	var _year    = date.getFullYear().toString();
	var _month   = date.getMonth()+1;
	    _month   = _month < 10 ? '0'+_month.toString():_month.toString();
	var _day     = date.getDate();
	    _day     = _day < 10 ? '0'+_day.toString() : _day.toString();
	var _hour    = date.getHours();
	    _hour    = _hour < 10 ? '0'+_hour.toString() : _hour.toString();
    var _minites = date.getMinutes();
        _minites = _minites < 10 ? '0'+_minites.toString() : _minites.toString();
    var _seconds = date.getSeconds();
        _seconds = _seconds < 10 ? '0'+_seconds.toString() : _seconds.toString();
    var _milisec = date.getMilliseconds();
    
    return _year + _month + _day+_hour + _minites + _seconds + _milisec;
}