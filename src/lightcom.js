/**
 * lightcom is a small JS library for sending and submitting small chunks of data from a browser window
 * or an compatible device to another computer/ browser with enabled webcam.
 * 
 * data will be converted into an binary stream and send via a flickering light sequenc.
 * on the receiving device the flickering will be decoded back into data.
 * 
 * Data structure of sended data is:
 * (8bit StartMarker),(8bit DataElement),(2bit Paritybit),(8bit StartMarker)
 * the parity bit covers all data elements
 * 
 * @uses: tracking.js
 * @author: Sebastian Martens <sm@nonstatics.com>
 * @copyright: Sebastian Martens, 2016
 * @license: Apache
 * @version: 1.0
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
  		
  		// set DEBUG state for canvas overlay over video to show color hit regions 
  		// and for debug console logs
  		var _debug = true;
  		// if set to true an information layer will be shown over the video frame, shwoing 
  		// the current status like "Found start", "Finished"
  		var _showInfo = true;
  		
  		// frequency to transmit data. Higher frequencies need faster computers to do more image detection
  		// cycles, so lower frequencies are better to be usable on more computers
		var _defaultFrequency = 3;
		// default number of repetitions
		var _defaultRepeat = _defaultFrequency*2;
		
		// defined character to mark start / end of submission
		// must be 8bit character in ASCII
		var _startMarker = "011111111101";
		var _endMarker = "0010000000010"; 
		
		// 
		var _detectTolerance = 0.9; 
		var _filterTolerance = 0.15;
		var _screenFillTolerance = 0.10;
		
		// 
		var _receiveDataResultHandler;
		var _receiveDataList;
		var _receiveState;
		
		// height and width of the video frame. a small frame is ok, larger frames need more computing power
		// for faster and more precise analyses a small video frame is ok.
		var _videoWidth = 300;
		var _videoHeight = 225;
		
		// state if the frame analysis is currently running
		// the ColorTracking will run all the time, if this is false, the data will not 
		// collected and analysed for signals
		var _running = false;
		
		// overall screen node, full screen container to be black (off) or white (on) 
  		var _screenNode; 
  		// current state of the screen on (1) | off (0)
  		var _screenState; 
		
		// init states for display or reading
		var _initStateScreen=false;
		var _initStateRead=false;
		
		// DOM node of canvas overlay 
		var _overlayNode;
		var _overlayInfoStatus = {};

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
		
		/**
		 * starts the execution of tracking loop
		 */
		function _run(){
			_running = true;
		}
		
		/**
		 * pauses the execution of tracking loop
		 * color tracking will continue, analysing data is paused
		 */
		function _pause(){
			_running = false;
		}
		
		/**
		 * searches the number of occurances of needle in haystack
		 * @param {String} needle String to search for
		 * @param {String} haystack String to search in 
		 * @return {Integer} number of found items
		 */
		function _countString( needle, haystack ){
			if( !needle || !haystack ) return 0;
			return (haystack.match(new RegExp(needle, "g")) || []).length;
		}
		
		/**
		 * adds external libraries to the DOM
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
    		if( _debug || _showInfo ){
    			var newCanvas = document.createElement('canvas');
    			_overlayNode = newCanvas; 
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
			
			if( _debug || _showInfo ){
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
		 * @return {Boolean} returns false if parameters are wrong
		 */
    	function _sendData( data, repeat ){
    		if( !data ){
    			console.warn('No data where given to send.');	
    			return false;
    		}
    		
    		// copy of incoming data
    		var parity,_dataIn = data;
    		
    		// initilise if not done
    		if( !_initStateScreen ){
    			_initScreen();
    		}
    		
    		// remove all non-standard characters, only a-z, A-Z and 
    		// 0-9 are allowed characters
    		// TODO: make this unneccessary and support all characters
    		data = _checkDataChars( data );
    		repeat = repeat || _defaultRepeat;
    		
    		// convert string data in an array of 0 and 1
    		data = _convertDataToBinary( data );
    		
    		// adds parity bit add the end of one data chunk 
    		// to verify the submitted data are correct
    		parity = '' + (_countString('1',data.join(''))%2) + (_dataIn.length%2);
    		if( _debug ) console.info( 'Parity: ', parity );
    		//console.log('Data',data.join(''));
    		data = data.concat( parity.split('') );
    		//console.log('Data',data.join(''));
    		
    		// add marker symbol before and after data chunk to later
    		// identify start and end of transmission
    		data = _getMarkerBinArray('start').concat( data.concat( _getMarkerBinArray('end') ) );
    		
    		// 
    		if( _debug ){
    			console.log("Data: ", "'"+_dataIn+"'", "Submit characters: ", (data.length-1)/8, " -- ", data.length, "bit" );
    			console.log("Sending: ", data.join(''));
    		}
    		
    		// start screen transmission
    		_printDataToScreen( data, repeat );
    		
    		// switch off screen when finished
    		_switchOff();
    		
    		// 
    		return true;
    	}
    	
    	/**
    	 * returns the binary array of start/ end marker
    	 * @param {String} type Type of marker, either 'start'|'end'
    	 * @return {Array} the binary array of start/ end marker
    	 */
    	function _getMarkerBinArray( type ){
    		return type==='start'?_startMarker.split(''):_endMarker.split('');
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
		 * converts an ASCII string of binary data ('10011000') back
		 * into readable string
		 * @param {String} bin Binary 8bit ASCII string, e.g. '10011000'
		 * @return {String} ASCII text
		 */
		function _bin2dec8( bin ){
			// converts only 8bit characters
			if( bin.length != 8 ) return false;
			
			return String.fromCharCode( parseInt(bin, 2) ); 
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
    	 * @param {Integer} cycles Number of repeatitions for sending the data
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
    		
    		// 
    		if( _debug && _screenNode ){
    			var content,tmp;
    			
    			content = '<span style="color:'+((data[ index ]=="1")?'#000':'#fff')+'">' + data.join('') + '<br />';
    			tmp = data.slice(0,index);
    			content = content + tmp.join('')+'<span style="color:red;">'+data[index]+'</span>';
    			tmp = data.slice(index+1,data.length);
    			content = content + tmp.join('') + '</span>';
    			
    			_screenNode.innerHTML = content;
    		}
    		
    		// if not the last value start timer for printing next value
    		if( index < (data.length-1) ){
	    		setTimeout(function(){
	    			_printDataToScreenHelper( data,index+1, repeat, repeatIndex );
	    		}, (1000/_defaultFrequency) );
	    	
	    	// if run should be repeated start next here
	    	}else if(repeatIndex < repeat){
	    		setTimeout(function(){
	    			console.info('Repeat: ', repeatIndex);
	    			_printDataToScreenHelper( data, 0, repeat, repeatIndex+1 );
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
		
		/**
    	 * fills a string or number with ones in front
    	 * @param {String|Integer} x Value to fill with zeros in front
    	 * @param {Integer} n Number of resulting digits
    	 * @param {String} valued filled up with zeros in front to number of given digits
    	 */
		function _addOne(x,n) {
    		return _fillAddValue(x,n,'1');
		}
		
		/**
    	 * fills a string or number with given character in front
    	 * @param {String|Integer} x Value to fill with zeros in front
    	 * @param {Integer} n Number of resulting digits
    	 * @param {String} v Character-Value to fill in front of given string
    	 * @param {String} valued filled up with zeros in front to number of given digits
    	 */
		function _fillAddValue(x,n,v) {
    		while (x.toString().length < n) {
        		x = ''+ v + x;
    		}
    		return x;
		}
    	
    	/**
    	 * returns the current timestamp of hour, minute, second and millisecond
    	 * filled up to 2/3 digits 
    	 * @return {String} current timestamp with milliseconds
    	 */
    	function _getSecTime() {
    		var d = new Date();
    		
    		return  '' + _addZero(d.getHours(), 2) + 
    					 _addZero(d.getMinutes(), 2) + 
    					 _addZero(d.getSeconds(), 2) + 
    				 	 _addZero(d.getMilliseconds(), 3);
		}
		
		/**
		 * initialises the color tracking for the video element in DOM
		 * @return {Tracker} the tracker instance
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
    	 * handles the receiving of data from a browser webcam
    	 * @param {Function} resultHandler Message complete handler. Complete message will be send to this result handler method
    	 * @return {Boolean} false, if no result handler is given
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
			_receiveDataList = [];
			
			// starts the processing of detected colors when received
			_run();
			
			// attach event handler on track event of color tracker
			// executes on each color tracking event
      		tracker.on('track', function( event ){

      			// when color tracking hits should be processed currently
      			if( _running ){

      				// analyse of detected data will only be done if color matches 
      				// were successfully detected
	      			if( _trackColorResultHandler( event ) ){
						// data coming in
						_overlayInfoStatus.receiving = true;
						if( _showInfo && !_debug ) _clearOverlay();
						
						// analyse received data and convert into binary string 
		      			var message = _analyseMessage( _receiveDataList );
		      			// when message received a start and end was found and data 
		      			// was decoded. call result handler and stopp further analysis
		      			if( message ){
		      				// give data to result handler
		      				_receiveDataResultHandler( message );
		      				// pause image analysing
		      				_pause();
							
							// update Info overlay		      				
		      				_overlayInfoStatus.complete = message;
							_overlayInfoStatus.bitCount = null;
							_overlayInfoStatus.start = false;
							_overlayInfoStatus.receiving = false;
		      				_clearOverlay();
		      			}
		      			
	      			}
	      			
	      		}
	      		
      		});
    	}
    	
    	/**
    	 * clears the current overlay canvas if existing
    	 * and starts drawing of overlay informations if needed
    	 */
    	function _clearOverlay(){
    		if( !_overlayNode ) return false;
    		
  			var context = _overlayNode.getContext('2d');
    		context.clearRect(0, 0, _overlayNode.width, _overlayNode.height);
    		
    		if( _showInfo ) _showOverlayInfo();
    	}
    	
		/**
		 * handles each detection event of the color detection
		 * fills a global array to timestamps when colors where detected. This array will later be analysed for 
		 * how long each color was detected to how many bits where transmitted
		 * @param {Object} trackEvent Color Tracking event with object list of all detected colors
		 * @return {Boolean} true if color was detected and data potentially send
		 */
		function _trackColorResultHandler( trackEvent ){
			// get current timestamp
			var t = _getSecTime();
			var rect,item;
			
			if( _debug ) _clearOverlay();
			
			// handle event data only if color matches were found			
			if( trackEvent.data.length ){

				if( _debug ) var context = _overlayNode.getContext('2d');
      			
				// return will be a list of result rectangles which hit 
				// the color match. handle each returned result rectangle
				for( item in trackEvent.data ){
					rect = trackEvent.data[ item ];
		        	
		        	// in debug state show all rectangles of found color 
	      			// areas in overlaying canvas
	        		if( _debug ){
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
		        		// color match found, timestamp with COLOR
		        		_receiveDataList.push({'t':t,'c':'c'});
		        		return true;
		        		
		        	}else{
		        		// no large enough color match found, timestamp with BLACK
		        		_receiveDataList.push({'t':t,'c':'b'});
		        	}
		        	
		        };
		    
			}else{
				// no color match found, timestamp with BLACK
				_receiveDataList.push({'t':t,'c':'b'});
			}
			
			return false;
		}
		
		/**
		 * shows overlay information over video frame like message complete,
		 * amount of received data and start marker found
		 */
		function _showOverlayInfo(){
			var context = _overlayNode.getContext('2d');
			
			context.font = '12px';
			context.fillStyle = "#fff";
			
			
			if( _overlayInfoStatus.complete ){
				context.fillText('Message complete: ' + _overlayInfoStatus.complete, 5, _overlayNode.height-10 );
			}
			if( _overlayInfoStatus.bitCount ){
				context.fillText('Received ' + _overlayInfoStatus.bitCount + 'bit', 5, _overlayNode.height-40 );
			}
			if( _overlayInfoStatus.start ){
				context.fillText('Start found', 5, _overlayNode.height-25 );
			}else if(!_overlayInfoStatus.complete){
				context.fillText('Searching for start ... ', 5, _overlayNode.height-25 );
			}
			if( _overlayInfoStatus.receiving ){
				context.fillText('Receiving data', 5, _overlayNode.height-10 );
			}
					
		}
		
    	/**
    	 * analyses the incoming data
    	 * incoming data are a list of timestamps mapped to detected colors
    	 * color might be black (b) for nothing detected at that moment and cyan (c) the 
    	 * bit color, which represents one or more bits. 
    	 * @param {Array} data Data array of color detection timestamps
    	 * @param {Boolean} true if message were successfully decoded, false if message is not complete
    	 */
    	function _analyseMessage( data ){
    		// 
    		var result = false;
    		
			// converts the captured raw data into binary array
			var received = _filterData( data );
			
			// show received data
			if( _debug ){
				console.clear();
				console.log( "Received: ", received );
			}
			
			// looking for start marker in raw data
	      	var start = received.lastIndexOf( _startMarker );
	      	// if start marker is existing looking for end marker
	      	if( start > -1 ){
	      		if( _debug ) console.info('Start marker found: ', start);

	      		// cut off start merker sequence
	      		var parity,pop,end,data=received.slice(start+_startMarker.length,received.length);
	      		// looking for the end marker within the remaining data set
	      		end = data.lastIndexOf( _endMarker );
	      		
	      		// number of transmitted bits from start
	      		_overlayInfoStatus.bitCount = Math.floor((data.length)/8);
	      		_overlayInfoStatus.start = true;
	      		
	      		// if start marker is found again -> end marker
	      		if( end > -1 ){
		      		if( _debug ) console.info('End found: ', end);
		      		
		      		// extract parity bit, the last bit befor end marker
		      		parity = data.slice(end-2,end);
		      		// extract the data and remove end marker
		      		data = data.slice(0,end-2);
		      		console.info( data );
		      		if( _debug ){
		      			console.info('Parity expected: ', parity );
		      			console.log('Parity calculated: ', ( '' + (_countString('1',data)%2) + ((data.length/8)%2) ) );
		      		}
		      		
		      		// checks if parity bit 
		      		if( data.length<8 || 
		      			parity !== ( '' + (_countString('1',data)%2) + ((data.length/8)%2) ) ){
		      				
		      			if( _debug ) console.info('Parity Check failed.');
		      			// _receiveDataList = [];
		      			return false;
		      			
		      		}else if( _debug ) console.info('Parity Check VERIFIED.');
		      		
		      		result = '';
		      		
		      		// chunk received data into 8 characters parts - 8bit per 
		      		// submitted character - and translate back from binary into
		      		// ASCII characters
		      		while( data.length >= 8 ){
		      			pop = data.slice(0,8);
		      			data = data.slice(8,data.length);
		      			
		      			result = result + _bin2dec8( pop );
		      		}
		      		
	      		}
	      	}
	      	
	      	return result;
    	}
    	
    	/**
    	 * each time a color is tracked it will be stored in a list of hits
    	 * this method filters this list of hits and filters the bit switches 
    	 * between black (nothing detected = 0) and cyan (color detected = 1)
    	 * 
    	 * TODO: optimize performance, once a part of the raw data list is processed 
    	 * 		 remove this data from raw list and only safe optimized list
    	 * 
    	 * @param {Array} data List of timestamps with color detections
    	 * @return {String} filtered string of 1 and 0 as a list of transmitted binary values
    	 */
    	function _filterData( data ){
			// filter data must be given     		
    		if( !data || !data.length ) return false;
    		
    		var i=0,tD=(1000/_defaultFrequency);
    		var state = data[0];
    		var result = [];
    		var returnStr = '000';
    		var obj;
    		
    		// go over list of saved timestamp objects 
    		while(i<data.length){
    			
    			// only if the state between nothing detected (=black) and 
    			// color detected (=cyan) changes, process as value change
    			if( data[i].c != state.c ){
    				
    				obj = {
    					's': state.t,
    					'e': data[(i-1)].t,
    					'd': ( data[(i-1)].t - state.t ),
    					'v': state.c
    				};
    				
    				// safe the new state as current state for next switch
    				state = data[i];
    				
    				// adds 1 or 0 to the result string depending on the length of the current value is  
    				// submitted. If frequency is 2Hz, means 2 blinks per second, each state is 500ms long
    				// if the current value is detected for 1500ms it means three bits of the same value
    				// were transmitted
    				returnStr = returnStr + _fillAddValue( '', Math.round( obj.d / tD ), obj.v=='b'?'0':'1' );
    			}
    			
    			i++;
    		}
    		
    		return returnStr;
    	}
    	
    	
    	// init external library at the beginning of all scripts 
    	_initLibrary();
 
		// all public methods 
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
    		 * receives data over the webcam from data sender, inits webcam instance and adds 
    		 * to webpage DOM
 		     * @param {Function} resultHandler Result handler method to be called when data were successfully transmitted
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