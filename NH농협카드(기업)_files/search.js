// 인기검색어, 내가찾은 검색어
function doKeyword(query) {
	var searchForm = document.search; 
	searchForm.startCount.value = "0";
	searchForm.query.value = query;
	searchForm.collection.value = "ALL";
	searchForm.sort.value = "RANK";
	searchForm.query.value = query;
	doSearch();
}

//쿠키값 조회
function getCookie(c_name) {
	var i,x,y,cookies=document.cookie.split(";");
	for (i=0;i<cookies.length;i++) {
		x=cookies[i].substr(0,cookies[i].indexOf("="));
		y=cookies[i].substr(cookies[i].indexOf("=")+1);
		x=x.replace(/^\s+|\s+$/g,"");
	
		if (x==c_name) {
			return unescape(y);
		}
	}
}

//쿠키값 설정
function setCookie(c_name,value,exdays) {
	var exdate=new Date();
	exdate.setDate(exdate.getDate() + exdays);
	var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
	document.cookie=c_name + "=" + c_value;
}
//쿠키값 설정 : 가맹
function setCookieF(c_name,value,exdays) {
	var exdate=new Date();
	exdate.setDate(exdate.getDate() + exdays);
	var c_value=escape(value) + ((exdays==null) ? "" : "; expires="+exdate.toUTCString());
	document.cookie=c_name + "=" + c_value;
}

//내가 찾은 검색어 조회
function getMyKeyword(keyword, totCount) {
	var MYKEYWORD_COUNT = 6; //내가 찾은 검색어 갯수 + 1
	var myKeyword = getCookie("mykeyword");
	
	if( myKeyword== null) {
		myKeyword = "";
	}

	var myKeywords = myKeyword.split("^%");
	
	if( totCount > 0 ) {
		var existsKeyword = false;
		for( var i = 0; i < myKeywords.length; i++) {
			if( myKeywords[i] == keyword) {
				existsKeyword = true;
				
				break;
			}
		}

		if( !existsKeyword ) {
			myKeywords.push(keyword);
			if( myKeywords.length == MYKEYWORD_COUNT) {
				myKeywords = myKeywords.slice(1,MYKEYWORD_COUNT);
			}
		}
		setCookie("mykeyword", myKeywords.join("^%"), 365);
	}

	showMyKeyword(myKeywords.reverse());
}
//내가 찾은 검색어 조회 : 가맹
function getMyKeywordF(keyword, totCount) {
	var MYKEYWORD_COUNT = 6; //내가 찾은 검색어 갯수 + 1
	var myKeyword = getCookie("mykeywordF");
	if( myKeyword== null) {
		myKeyword = "";
	}

	var myKeywords = myKeyword.split("^%");

	if( totCount > 0 ) {
		var existsKeyword = false;
		for( var i = 0; i < myKeywords.length; i++) {
			if( myKeywords[i] == keyword) {
				existsKeyword = true;
				break;
			}
		}

		if( !existsKeyword ) {
			myKeywords.push(keyword);
			if( myKeywords.length == MYKEYWORD_COUNT) {
				myKeywords = myKeywords.slice(1,MYKEYWORD_COUNT);
			}
		}
		setCookieF("mykeywordF", myKeywords.join("^%"), 365);
	}

	showMyKeywordF(myKeywords.reverse());
}

//내가 찾은 검색어 삭제
function removeMyKeyword(keyword) {
	var myKeyword = getCookie("mykeywordF");
	if( myKeyword == null) {
		myKeyword = "";
	}
	
	var myKeywords = myKeyword.split("^%");

	var i = 0;
	while (i < myKeywords.length) {
		if (myKeywords[i] == keyword) {
			myKeywords.splice(i, 1);
		} else { 
			i++; 
		}
	}

	setCookie("mykeywordF", myKeywords.join("^%"), 365);

	showMyKeywordF(myKeywords);
}
//내가 찾은 검색어 삭제 : 가맹
function removeMyKeywordF(keyword) {
	var myKeyword = getCookie("mykeywordF");
	console.log("sTart : "+myKeyword);
	if( myKeyword == null) {
		
		myKeyword = "";
	}
	
	var myKeywords = myKeyword.split("^%");
	
	var i = 0;
	
	while (i < myKeywords.length) {
		if(""==myKeywords[i]){ console.log(myKeywords[i]+" null");i++; }
		else {
			if (myKeywords[i] == keyword) {
				console.log(keyword,myKeywords[i]);
				myKeywords.splice(i, 1);
			} else { 
				i++; 
				}
			}
	}
	console.log("END : "+myKeywords);
	setCookieF("mykeywordF", myKeywords.join("^%"), 365);
	console.log(getCookie("mykeywordF")+" : getC");
	showMyKeywordF(myKeywords);
}
//내가 찾은 검색어 
function showMyKeyword(myKeywords) {
	//var str = "<li class=\"tit\"><img src=\"images/tit_mykeyword.gif\" alt=\"내가 찾은 검색어\" /></li>";
	var str = "";
	
	for( var i = 0; i < myKeywords.length; i++) {
		if( myKeywords[i]==""){console.log("null");}
		if( myKeywords[i] != ""&&myKeywords[i] != null) {
		//
		str += "<li>" +
				"<a href=\"javascript:;\" class=\"btn-keyword\" onClick=\"javascript:doKeywordCustom('"+myKeywords[i]+"');\">" +
					myKeywords[i] +
				"</a>" +
				"<button type=\"button\" class=\"btn-remove\" onClick=\"removeMyKeyword('"+myKeywords[i]+"');\" >" +
					"<span>" + "삭제</span>" +
				"</button>" +
			   "</li>";
		}
	}
	if(myKeywords.length<2){
		str+="<li>최근 검색내역이 없습니다.</li>";
	}
	$("#mykeyword").html(str);
}
//내가 찾은 검색어  : 가맹
function showMyKeywordF(myKeywords) {
	//var str = "<li class=\"tit\"><img src=\"images/tit_mykeyword.gif\" alt=\"내가 찾은 검색어\" /></li>";
	var str = "";
	for( var i = 0; i < myKeywords.length; i++) {
		
		if( myKeywords[i] == "") break;
		//
		str += "<li>" +
				"<a href=\"javascript:;\" class=\"btn-keyword\" onClick=\"javascript:doKeywordCustom('"+myKeywords[i]+"');\">" +
					myKeywords[i] +
				"</a>" +
				"<button type=\"button\" class=\"btn-remove\" onClick=\"removeMyKeywordF('"+myKeywords[i]+"');\" >" +
					"<span>" + "삭제</span>" +
				"</button>" +
			   "</li>";
	}
	if(myKeywords.length<2){
		str+="<li>최근 검색내역이 없습니다.</li>";
	}
	$("#mykeyword").html(str);
}

//문자열 숫자 비교
function compareStringNum(str1, str2, repStr) {
	var num1 =  parseInt(replaceAll(str1, repStr, ""));
	var num2 = parseInt(replaceAll(str2, repStr, ""));

	if (num1 > num2) {
		return false;
	} else {
		return true;
	}
}

// Replace All
function replaceAll(str, orgStr, repStr) {
	return str.split(orgStr).join(repStr);
}

//공백 제거
function trim(str) {
	return str.replace(/^\s\s*/, '').replace(/\s\s*$/, '');
}