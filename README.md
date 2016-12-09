# js-light-communication

js-light-communication (lightcom) is a JavaScript class that is able to send data via a visual blink sequence from one browser window or compatible device to another browser, which is receiving the blink sequence via webcam.

## Install

Download or integrate the lightcom library in your project. You need the `src` and `lib` directory. The required tracking.js library will be included automatically by the lightcom.js.

You just need to include the lightcom.js into your html file

```html
<script src="../src/lightcom.js"></script>
```

## Usage

The library provides two major public methods: `sendData` and `receiveData`. 

To send data from one browser use the `sendData`method. The first parameter is a data string. Only chracters from a-z, A-Z and 0-9 are allowed. The second parameter is optional and defines the number of repetitions of blinking.

```js
lightcom.sendData('data',3);
```
To retreive data with the webcam use the `retreiveData` method. The first parameter is an result handler method. The second parameter is optional and defines the parent DOM node for the video and canvas element

```js
lightcom.receiveData( function(data){ 
	console.info('Result data: ', data); 
},DOMNode);
```

## License

Copyright © 2016 Sebastian Martens

Released under the MIT license.