/**
 * 
 * @author: Sebastian Martens, sm@nonstatics.com
 * @copyright: Sebastian Martens, 2016
 */
var lightcom = (function () {
	
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
  		
  		// 
  		var _debug = true;
  		// overall screen node, full screen container to be black (off) or white (on) 
  		var _screenNode; 
  		// current state of the screen on (1) | off (0)
  		var _screenState; 
		// default frequency to transmit data
		var _defaultFrequency = 2;
		// default number of repetitions
		var _defaultRepeat = _defaultFrequency*2;
		// defined character to mark Start / End of submission
		// must be 7bit character in ASCII
		//var _startMarker = "@";
		var _startMarker = "11110000";
		var _startMarkerArray = _startMarker.split(''); 
		// init status 
		var _initStateScreen=false;
		var _initStateRead=false;
		
		// 
		var _detectTolerance = 0.9; 
		var _filterTolerance = 0.15;
		var _screenFillTolerance = 0.10;
		
		// 
		var _receiveDataResultHandler;
		var _receiveData;
		var _receiveState;
		
		var _videoWidth = 300;
		var _videoHeight = 225;
		
		var _running = false;

		/**
		 * switches the states of the main screen
		 * @param {Boolean} on Value to set for the screen 
		 */
		function _switchScreen( on ){
			if( !_screenNode ){
				console.error('Screen node not existing');
				return false;
			} 
			
			_screenNode.style.backgroundColor = ( on )?'#00aeef':'#000';
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
		
		function _run(){
			_running = true;
		}
		
		function _pause(){
			_running = false;
		}
		
		/**
		 * 
		 */
		function _initLibrary(){
			var bodyNode = document.querySelectorAll('body')[0];
    		var newScript = document.createElement('script');
    		
    		var dir,name;	
    		
    		// append script node for tracking.js
    		dir = document.querySelector('script[src$="lightcom.js"]').getAttribute('src');
			name = dir.split('/').pop(); 
			dir = dir.replace('/'+name,"");
			
			//
    		newScript.setAttribute('src',dir+'/../lib/tracking.js/build/tracking.js');
			bodyNode.appendChild(newScript);
		}
		
		/**
		 * initialises the "screen" for sending data
		 * appends all over page div container which will be the "screen"
		 */
    	function _initScreen(){
    		if( _initStateScreen ){
    			console.error('Screen already initilised.');
    			return false;
    		}
    		
    		var bodyNode = document.querySelectorAll('body')[0];
    		var newNode = document.createElement('div');
    		
    		// set screen node 
    		_screenNode = newNode;
    		
    		// append new screen node
    		newNode.setAttribute('style','position:absolute;top:0;left:0;height:100%;width:100%');
    		bodyNode.appendChild(newNode);
    		
    		// set init status
    		_initStateScreen = true;
    		
    		// initalise with dark - off screen
    		_switchOff();
    	}
    	
    	/**
    	 * initialises the "webcam" for reading data
    	 * appends script node and canvas elements 
    	 */
    	function _initReadCam(){
    		if( _initStateRead ){
    			console.error('Read already initilised.');
    			return false;
    		}
    		
    		var bodyNode = document.querySelectorAll('body')[0];
    		var newVideo = document.createElement('video');
    		if( _debug ){
    			var newCanvas = document.createElement('canvas');
    		}
    		
			// 
			newVideo.setAttribute('id','lightcomVideo');
			newVideo.setAttribute('preload','preload');
			newVideo.setAttribute('autoplay','autoplay');
			newVideo.setAttribute('preload','preload');
			newVideo.setAttribute('loop','loop');
			newVideo.setAttribute('muted','muted');
			newVideo.setAttribute('height',_videoHeight);
			newVideo.setAttribute('width',_videoWidth);
			newVideo.setAttribute('style','width:'+_videoWidth+'px; height:'+_videoHeight+'px; position:absolute; top:0; left:0');
			bodyNode.appendChild(newVideo);
			
			if( _debug ){
				newCanvas.setAttribute('id','lightcomCanvas');
				newCanvas.setAttribute('height',_videoHeight);
				newCanvas.setAttribute('width',_videoWidth);
				newCanvas.setAttribute('style','width:'+_videoWidth+'px; height:'+_videoHeight+'px; position:absolute; top:0; left:0');
				bodyNode.appendChild(newCanvas);
			}
			
			// set init status
			_initStateRead = true;
    	}
    	
    	/**
		 * starts sending data, data must be string value 
		 * @param {String} data The String which should be send, only A-Z and 0-9 allowed
		 * @param {Integer} repeat The number of times the sending should be repeated
		 */
    	function _sendData( data, repeat ){
    		if( !data ){
    			console.warn('No data where given to send.');	
    			return false;
    		}
    		
    		// copy of incoming data
    		var _dataIn = data;
    		
    		// initilise if not done
    		if( !_initStateScreen ){
    			_initScreen();
    		}
    		
    		// remove all non-standard characters, only a-z, A-Z and 
    		// 0-9 are allowed characters
    		// TODO: make this unneccessary and support all characters
    		data = _checkDataChars( data );
    		repeat = repeat || _defaultRepeat;
    		// frequency = frequency || _defaultFrequency;
    		
    		// convert string data in an array of 0 and 1
    		data = _convertDataToBinary( data );
    		
    		// add marker symbol before and after data chunk to later
    		// identify start and end of transmission
    		data = _getMarkerBinArray().concat( data.concat( _getMarkerBinArray() ) );
    		console.log("Data: ", "'"+_dataIn+"'", "Submit characters: ", data.length/8, " -- ", data.length, "bit" );
    		console.log("Sending: ", data.join(''));
    		
    		// start screen transmission
    		_printDataToScreen( data, repeat );
    		
    		// switch off screen when finished
    		_switchOff();
    	}
    	
    	/**
    	 * returns the binary array of start/ end marker
    	 * @return {Array} the binary array of start/ end marker
    	 */
    	function _getMarkerBinArray(){
    		/*
    		var result = _dec2bin( _startMarker.charCodeAt(0) ).split('');
    		if( result.length !== 7 ){
    			console.error('Illegal start/ stop marker character');
    			return false;
    		}
    		return result;
    		*/
    		return _startMarkerArray;
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
    	function _dec2bin8( dec ){
    		return _addZero( (dec >>> 0).toString(2), 8 );
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
    			result = result.concat( _dec2bin8( data[i].charCodeAt(0) ).split('') );
    		}
    		return result;
    	}
    	
    	/**
    	 * starts printing the data set to screen
    	 * uses internal recursion helper for the frequency
    	 * @param {Array} binaryData Array of "1" | "0", representing the binary values of the current data
    	 * @param {Integer}
    	 */
    	function _printDataToScreen( binaryData, cycles ){
    		if( !binaryData || binaryData.length<1 ){
    			console.warn('No data given to print on screen.');
    			return false;
    		}
    		
    		_printDataToScreenHelper( binaryData, 0, cycles, 1 );
    	}
    	
    	/**
    	 * recursive helper for printing data to screen
    	 * @param {Array} binaryData Array of "1" | "0", representing the binary values of the current data
    	 * @param {Integer} index Current index to print on screen
    	 * @param {Integer} repeat Number of repeat cycles to be done
    	 * @param {Integer} repeatIndex Current repeat circle
    	 */
    	function _printDataToScreenHelper( data, index, repeat, repeatIndex ){
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
	    			_printDataToScreenHelper( data, ++index, repeat, repeatIndex );
	    		}, (1000/_defaultFrequency) );
	    	
	    	// if run should be repeated start next here
	    	}else if(repeatIndex < repeat){
	    		setTimeout(function(){
	    			console.info('Repeat: ', repeatIndex);
	    			_printDataToScreenHelper( data, 0, repeat, ++repeatIndex );
	    		}, (1000/_defaultFrequency) );
	    	}
    		
    	}
    	
    	/**
    	 * fills a string or number with zeros in front
    	 * @param {String|Integer} x Value to fill with zeros in front
    	 * @param {Integer} n Number of resulting digits
    	 * @param {String} valued filled up with zeros in front to number of given digits
    	 */
    	function _addZero(x,n) {
    		return _fillAddValue(x,n,'0');
		}
		
		function _addOne(x,n) {
    		return _fillAddValue(x,n,'1');
		}
		
		function _fillAddValue(x,n,v) {
    		while (x.toString().length < n) {
        		x = ''+ v + x;
    		}
    		return x;
		}
		
		/**
		 * 
		 */
		function _getSecTimestamp(){
			var d = new Date();
    		
    		return  '' + _addZero(d.getHours(), 2) + '.' + 
    					 _addZero(d.getMinutes(), 2) + '.' + 
    					 _addZero(d.getSeconds(), 2) + '.' + 
    					 Math.min( Math.floor( (1000/_defaultFrequency) / d.getMilliseconds() ), (_defaultFrequency-1) );
		}
    	
    	/**
    	 * 
    	 */
    	function _getSecTime() {
    		var d = new Date();
    		
    		return  '' + _addZero(d.getHours(), 2) + 
    					 _addZero(d.getMinutes(), 2) + 
    					 _addZero(d.getSeconds(), 2) + 
    				 	 _addZero(d.getMilliseconds(), 3);
		}
		
		/**
		 * 
		 */
		function _initColorTracker(){
			// 
			var video = document.getElementById('lightcomVideo');
			
			// add custom color 'white' to Color Tracker
			/*
			tracking.ColorTracker.registerColor('trackColor', function(r, g, b) {
  				if (r < 50 && g > 150 && b > 210) {
    				return true;
  				}
  				return false;
			});
			*/
			// create new tracker and start color tracking of white content
      		var tracker = new tracking.ColorTracker(['cyan']);
      		tracking.track(video, tracker, { camera: true });
      		
      		// 
			return tracker;      			
		}
		
		/**
		 * 
		 */
		function _trackColorResultHandler( trackEvent ){
			// get current time 
			var t = _getSecTime();
			var rect,item;
			
			if( _debug ){
    			var canvas = document.getElementById('lightcomCanvas');
  				var context = canvas.getContext('2d');
  		
    			context.clearRect(0, 0, canvas.width, canvas.height);
			}
			
			// 
			// _receiveData.push({'t':t,'c':b});
			
			// handle event data only if color matches were found			
			if( trackEvent.data.length ){
      			
				// return will be a list of result rectangles which hit 
				// the color match. handle each returned result rectangle
				for( item in trackEvent.data ){
					rect = trackEvent.data[ item ];
		        	
		        	// in debug state show all rectangles of found color 
	      			// areas in overlaying canvas
	        		if( _debug ){
	        			if (rect.color === 'custom') {
				        	rect.color = tracker.customColor;
				        }
				
						context.strokeStyle = rect.color;
						context.strokeRect(rect.x, rect.y, rect.width, rect.height);
						context.font = '11px';
						context.fillStyle = "#fff";
						context.fillText('x: ' + rect.x + 'px', rect.x + rect.width + 5, rect.y + 11);
						context.fillText('y: ' + rect.y + 'px', rect.x + rect.width + 5, rect.y + 22);
					}
					
					// check if the size of the result rectangle is at least XY% (_screenFillTolerance) of the screensize
		        	if( (rect.width*rect.height) > (_videoWidth*_videoHeight*_screenFillTolerance) ){
		        		// console.info( rect );
		        		_receiveData.push( t );
		        		return true;
		        	}
		        };
		        
			}
			
			return false;
		}
    	
    	/**
    	 * 
    	 */
    	function _receiveData( resultHandler ){
			if( !resultHandler ){
    			console.warn('No result handler where given to receive data.');	
    			return false;
    		}
    		
    		// init relevant web cam / canvas DOM nodes
    		if( !_initStateRead ){
    			_initReadCam();
    		}
    		
    		// init new coloe tracker object
    		var tracker = _initColorTracker();
    		// assignes the receiving data event handler
			_receiveDataResultHandler = resultHandler;
			_receiveData = [];
			
			// 
			_run();
			
			// attach event handler on track event of color tracker
			// executes on each color tracking event
      		tracker.on('track', function( event ){
      			if( _running ){
	      			if( _trackColorResultHandler( event ) ){
						// analyse data 
		      			var message = _analyseMessage();
		      			if( message ){
		      				_receiveDataResultHandler( message );
		      				_pause();
		      			}
	      			}
	      		}
      		});
    		
    	}
    	
    	/**
    	 * 
    	 */
    	function _analyseMessage(){
    		console.clear();
    		res = false;
    		
			// converts the captured raw data into binary array
			var received = _filterData(_receiveData);
			
			console.log( "Should--: ", '1111000001001011001101010110111111110000' );
			console.log( "Received: ", received );
			
			
			// looking for start marker in raw data
	      	var start = received.indexOf(_startMarker);
	      	if( start > -1 ){
	      		
	      		var pop,end,data=received.slice(start+8,received.length);
	      		end = data.indexOf(_startMarker);
	      		
	      		console.info('Start found: ', start);
	      		if( end > -1 ){
		      		console.info('End found: ', end);
		      		
		      		_receiveData = [];
		      		
		      		data = data.slice(0,data.length-8);
		      		res = '';
		      		
		      		while( data.length >= 8 ){
		      			pop = data.slice(0,8);
		      			data = data.slice(8,data.length);
		      			
		      			res = res + String.fromCharCode( parseInt(pop, 2) );
		      		}
	      		}
	      		
	      		// console.info(received.slice(start,start+8));
	      		//while(i<received)
	      		//console.log( String.fromCharCode( ));
	      	}
	      	
	      	return res;
    	}
    	
    	/**
    	 * each color tracking will be stored as one list of timestamps
    	 * 
    	 * @param 
    	 * @return 
    	 */
    	function _filterData( data ){
    		var d,i=1,ii=0,result,cv,tD=((1000/_defaultFrequency));
    		
    		// init result with '10' because the first bit switch will not be 
    		// within the regular frequency time frame
    		result = '1'; 
    		
    		//console.clear();
    		
    		//
    		while(i<_receiveData.length){
    			
    			if( _receiveData[i]-_receiveData[i-1] >= tD ){
    				
    				cv = (_receiveData[i-1]-_receiveData[ii])/(1000/_defaultFrequency);
    				//result = result + _addOne('',cv<1?1:Math.floor(cv));
    				result = result + _addOne('',Math.round(cv));
    				
    				cv = (_receiveData[i]-_receiveData[i-1])/(1000/_defaultFrequency);
    				//result = result + _addZero('',cv<1?1:Math.floor(cv));
    				result = result + _addZero('',Math.round(cv));
    				
    				
    				/*
    				console.info({
    					's':_receiveData[ii],
    					'e':_receiveData[i-1],
    					'c':'c', // -- 1
    					'd': (_receiveData[i-1]-_receiveData[ii])
    				});
    				// console.log( ">1<", cv<1?1:Math.floor(cv) );
    				*/
    				cv = Math.round( (_receiveData[i-1]-_receiveData[ii])/(1000/_defaultFrequency) );
    				console.log(">>1", "d:", (_receiveData[i-1]-_receiveData[ii]),(_receiveData[i-1]-_receiveData[ii])/(1000/_defaultFrequency), "ct:", cv );
    				
    				if( (_receiveData[i]-_receiveData[i-1]) > 40000 ){
    					console.error('Time error happend.');
    					_receiveData = [];
    					
	    				console.info({
	    					's':_receiveData[i-1],
	    					'e':_receiveData[i],
	    					'c':'s', // -- 0
	    					'd': (_receiveData[i]-_receiveData[i-1])
	    				});
    				}
    				cv = Math.round( (_receiveData[i]-_receiveData[i-1])/(1000/_defaultFrequency) );
    				console.log(">>0", "d:",  (_receiveData[i]-_receiveData[i-1]),(_receiveData[i]-_receiveData[i-1])/(1000/_defaultFrequency), "ct:", cv );
    				
    				ii = i;
    			}
    			
    			i++;
    		}
    		
    		return result;
    	}
    	
    	// 
    	_initLibrary();
 
    	return{
    		
			/**
			 * starts sending data, data must be string value 
 			 * @param {String} data The String which should be send 
 			 * @param {Integer} repeat The number of times the sending should be repeated
 			 * @param {Integer} frequency The frequency (Hz) in which the data should be send
			 */
    		sendData: function( data, repeat ){
    			return _sendData( data, repeat );
    		},
    		
    		
    		/**
    		 * 
 		     * @param {Function} resultHandler
    		 */
    		receiveData: function( resultHandler ){
    			return _receiveData( resultHandler );
    		}
 
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