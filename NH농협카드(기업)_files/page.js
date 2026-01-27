/**
 * (C) Copyright AhnLab, Inc.
 *
 * Any part of this source code can not be copied with
 * any method without prior written permission from
 * the author or authorized person.
 *
 * @version			$Revision: 14980 $
 *
 */

function gotoInstallASTX2()
{
	var sub = '';
	if(typeof(_INST_SUB) != 'undefined' && _INST_SUB != null) {
		sub = _INST_SUB;
	}

//	var veraportURL = "http://16.24.112.72:9500/thirdparty/wizvera/veraport/install20/install_sample.html?P_name=ASTx";
	
//	document.location = veraportURL;
	
}

function checkInstallASTX2()
{
	
	$ASTX2.init(
		function onSuccess() {			
			console.log('ASTX.init() success [astx2.1]');
			return true;
		},
		function onFailure() {

			var errno = $ASTX2.getLastError();
			//alert('ASTX.init() failure: errno=['+errno+'] $ASTX2_CONST.ERROR_NOTINST:['+$ASTX2_CONST.ERROR_NOTINST+']');
			if(errno == $ASTX2_CONST.ERROR_NOTINST) {
				//gotoInstallASTX2();
				//common_movePage("IpCnB014S", {"P_name" :"ASTx"});
				common_movePage("iccn0100r", {"P_name" :"ASTx"});
				return false;
			}else{ // end of if
				return false;
			}
		}
	);
}

function onMoveFocus(objCurr, idNext, nLength)
{
	if(objCurr.value.length >= nLength)
	{
		var elm = document.getElementById(idNext);
		if(elm) { elm.focus(); }
	}
}
