function checkMods(e){
    var e;
    var code;
    var utype = document.delfinoForm.utype.value;
    if(!e) e = window.event;
    if(e.keyCode) code = e.keyCode;
    else if(e.which) code = e.which;
    if(code == 13) {
    	if(utype == 'C'){
    		$('#loginC').trigger('click');
    	}else if(utype == 'B'){
    		$('#loginB').trigger('click');
    	}else if(utype == 'U'){
    		$('#loginU').trigger('click');
    	}
    }
}