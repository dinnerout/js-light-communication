/**
 * 
 * @author: Sebastian Martens, sm@nonstatics.com
 * @copyright: Sebastian Martens, 2016
 */
var lightCom = (function () {
	
	// singleton instance
  	var instance;
 
 	// singleton
  	function init() {

    	// Browser polyfills
  		if(!window.URL) {
    		window.URL = window.URL || window.webkitURL || window.msURL || window.oURL;
  		}
  		if(!navigator.getUserMedia) {
    		navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;
  		}
  		
  		// overall screen node, full screen container to be black (off) or white (on) 
  		var _screenNode; 
  		// current state of the screen on (1) | off (0)
  		var _screenState; 
		// default frequency to transmit data
		var _defaultFrequency = 10;
		// default number of repetitions
		var _defaultRepeat = 2;
		// defined character to mark Start / End of submission
		// must be 7bit character in ASCII
		var _startMarker = "@";

		/**
		 * switches the states of the main screen
		 * @param {Boolean} on Value to set for the screen 
		 */
		function _switchScreen( on ){
			if( !_screenNode ){
				console.error('Screen node not existing');
				return false;
			} 
			
			_screenNode.style.backgroundColor = ( on )?'#fff':'#000';
			_screenState = ( on )?1:0;
		}
		
		/**
		 * Switches the main screen on
		 */
		function _switchOn(){
			_switchScreen( true );
		}
		
		/**
		 * Switches the main screen off
		 */
		function _switchOff(){
			_switchScreen( false );
		}
		
		/**
		 * initialises the "screen"
		 * appends all over page div container which will be the "screen"
		 */
    	function _initScreen(){
    		var bodyNode = document.querySelectorAll('body')[0];
    		var newNode = document.createElement('div');
    		
    		// set screen node 
    		_screenNode = newNode;
    		
    		// append new node
    		newNode.setAttribute('style','position:absolute;top:0;left:0;height:100%;width:100%');
    		bodyNode.appendChild(newNode);
    		
    		// initalise with dark - off screen
    		_switchOff();
    	}
    	
    	/**
		 * starts sending data, data must be string value 
		 * @param {String} data The String which should be send, only A-Z and 0-9 allowed
		 * @param {Integer} repeat The number of times the sending should be repeated
		 * @param {Integer} frequency The frequency (Hz) in which the data should be send
		 */
    	function _sendData( data, repeat, frequency ){
    		if( !data ){
    			console.warn('No data where given to send.');	
    			return false;
    		}
    		
    		data = _checkDataChars( data );
    		repeat = repeat || _defaultRepeat;
    		frequency = frequency || _defaultFrequency;
    		
    		data = _convertDataToBinary( data );
    		// add marker symbol before and after data chunk
    		data = _getMarkerBinArray().concat( data.concat( _getMarkerBinArray() ) );
    		console.log( "Submit characters: ", data.length/7, " -- ", data.length, "bit" );

    		// start screen transmission
    		_printDataToScreen( data, frequency, repeat );
    	}
    	
    	/**
    	 * returns the binary array of start/ end marker
    	 * @return {Array} the binary array of start/ end marker
    	 */
    	function _getMarkerBinArray(){
    		var result = _dec2bin( _startMarker.charCodeAt(0) ).split('');
    		if( result.length !== 7 ){
    			console.error('Illegal start/ stop marker character');
    			return false;
    		}
    		return result;
    	}
    	
    	/**
    	 * check the input data and removes all characters which are not 
    	 * in between a-z, A-Z and 0-9
    	 * @param {String} data Input string
    	 * @return {String} Removed only non valid characters
    	 */
    	function _checkDataChars( data ){
    		var i,result='',testP=/^[a-zA-Z0-9]*$/;
    		for(i=0;i<data.length;i++){
    			if( testP.test(data[i]) ){
    				result+=data[i];
    			}
    		}
    		return result;
    	}
    	
    	/**
    	 * converts a given decimal number into a binary string
    	 * @param {Integer} dec Decimal number
    	 * @return {String} binary string
    	 */ 
    	function _dec2bin( dec ){
    		return (dec >>> 0).toString(2);
		}
    	
    	/**
    	 * converts a data string into an array of 1 and 0
    	 * characters will be converted by ASCII table to numbers
    	 * numbers will be converted into binary
    	 * @param {String} data Input data string
    	 * @return {Array} 
    	 */
    	function _convertDataToBinary( data ){
    		var i,result=[];
    		for(i=0;i<data.length;i++){
    			result = result.concat( _dec2bin( data[i].charCodeAt(0) ).split('') );
    		}
    		return result;
    	}
    	
    	/**
    	 * starts printing the data set to screen
    	 * uses internal recursion helper for the frequency
    	 * @param {Array} binaryData Array of "1" | "0", representing the binary values of the current data
    	 * @param {Integer} hz Frequency of data submittion in Herz (Hz), beats per second
    	 */
    	function _printDataToScreen( binaryData, hz, cycles ){
    		if( !binaryData || binaryData.length<1 ){
    			console.warn('No data given to print on screen.');
    			return false;
    		}
    		
    		_printDataToScreenHelper( binaryData, 0, cycles, 1, hz );
    	}
    	
    	/**
    	 * recursive helper for printing data to screen
    	 * @param {Array} binaryData Array of "1" | "0", representing the binary values of the current data
    	 * @param {Integer} index Current index to print on screen
    	 * @param {Integer} repeat Number of repeat cycles to be done
    	 * @param {Integer} repeatIndex Current repeat circle
    	 * @param {Integer} hz Frequency of data submittion in Herz (Hz), beats per second
    	 */
    	function _printDataToScreenHelper( data, index, repeat, repeatIndex, hz ){
    		if( index >= data.length ){
    			console.error('Print to screen out of bounds error.');
    			return false;
    		}
    		
    		if( data[ index ] == "1" ){
    			_switchOn();
    		}else{
    			_switchOff();
    		}
    		
    		// if not the last value start timer for printing next value
    		if( index < (data.length-1) ){
	    		setTimeout(function(){
	    			_printDataToScreenHelper( data, ++index, repeat, repeatIndex, hz );
	    		}, (1000/hz) );
	    	
	    	// if run should be repeated start next here
	    	}else if(repeatIndex < repeat){
	    		setTimeout(function(){
	    			console.info('Repeat: ', repeatIndex);
	    			_printDataToScreenHelper( data, 0, repeat, ++repeatIndex, hz );
	    		}, (1000/hz) );
	    	}
    		
    	}
    	
 
    	return{
    		
    		/**
    		 * initilises the application
    		 */
    		init: function(){
    			return _initScreen();
    		},
    		
			/**
			 * starts sending data, data must be string value 
 			 * @param {String} data The String which should be send 
 			 * @param {Integer} repeat The number of times the sending should be repeated
 			 * @param {Integer} frequency The frequency (Hz) in which the data should be send
			 */
    		sendData: function( data, repeat, frequency ){
    			return _sendData( data, repeat, frequency );
    		},
 
    	};
 
  	};
 
  	return{
 
    	// return singleton instance
    	getInstance: function() {
      		if ( !instance ) {
        		instance = init();
      		}
      		return instance;
    	}

  	};
 
})().getInstance();