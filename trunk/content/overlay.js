/*

Copyright 2007-2009 Stephan Chenette

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <http://www.gnu.org/licenses/>.

*/



/*! \file overlay.js

    \brief main function body

    Major Components:
    FireShark: this is the class where everything starts (initiated by a menu command)
   
	FireShark.onLoad will be called which will initialize all variables.
	FireShark.onMenuItemCommand will then be called which will enumerate through a list of urls
	Loading each URI by calling FireShark.FsLoadNextURL.
	FsLoadNextURL will load each URL and from there callbacks will be used to process events.

    httpRequestObserver: this class is registered in FireShark initialization code and meant to monitor HTTP traffic

    myListener: this class is registered in FireShark initialization code and meant to store screen shot, DOM and src once load is 			complete


*/

// TODO: monitor DOM changes
// https://developer.mozilla.org/En/Listening_to_events
// TODO: monitor link additions
// https://developer.mozilla.org/En/Listening_to_events
// https://developer.mozilla.org/En/HTML/Element/Link

// might want to use DOMLoaded instead of load for initial event notifications.
// http://dean.edwards.name/weblog/2005/09/busted/
window.addEventListener("load", function (e) { FireShark.onLoad(e); }, false);
window.addEventListener("unload", function (e) { FireShark.onUnLoad(e); }, false);


var LogManager = {

	initialize: function () {

		try {
			
			this.initialized = false;
			
			this.consoleService = Components.classes["@mozilla.org/consoleservice;1"]
				.getService(Components.interfaces.nsIConsoleService);
				
			this.logstream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
				.createInstance(Components.interfaces.nsIConverterOutputStream);
				
			this.yamlstream = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
				.createInstance(Components.interfaces.nsIConverterOutputStream);
			
			if(!this.openstream("reportlog.txt", this.logstream) || 
			   !this.openstream("reportlog.yml", this.yamlstream) ) {
			   
					this.logToConsole("openstream must have failed");
			}
			else {
			
				this.initialized = true;
			}
		}
		catch(e) {
		
			this.logToConsole("exception caught in intialize " + e);
		}
	},
	
	shutdown: function () {

		try {
		
			if(this.initialized) {
				this.closestream(this.logstream);
				this.closestream(this.yamlstream);
			}
		}
		catch(e) {
		
			this.logToConsole("exception caught in shutdown " + e);
		}

	},

	// nsIConverterOutputStream stream
	closestream: function(stream) {
		
		try {
		
			stream.close(); // this closes foStream
		}
		catch(e) {
		
			this.logToConsole("exception caught in closestream " + e);
		}
	},
	
	openstream: function(filename, stream) {
	
		try {
			
			// remove any illegal chars http://en.wikipedia.org/wiki/Filename
			filename = filename.replace(/[\/|/\|/?|%|\*|:|\||"|<|>]/g, "");
			//filename = filename.replace(/[^A-Za-z0-9_\.]/g, "");
			
			// https://developer.mozilla.org/en/NsIFile
			var file = Components.classes["@mozilla.org/file/directory_service;1"]
				.getService(Components.interfaces.nsIProperties)
				.get("Home", Components.interfaces.nsIFile);

			// if too many files with a similiar filename exist createUnique will return an exception of NS_ERROR_FILE_TOO_BIG
			// to avoid this we will "help" in creating an initially random name
			//var random = getRandomInt(1, 1000);
			file.append(filename);
			//file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);

			LogManager.logToTxt("file name " + file.path);
						
			// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
			// file is nsIFile, data is a string
			var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
				.createInstance(Components.interfaces.nsIFileOutputStream);

			// use 0x02 | 0x10 to open file for appending.
			// https://developer.mozilla.org/en/nsIFileOutputStream
			// https://developer.mozilla.org/en/PR_Open#Parameters
			foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0666, 0);

			stream.init(foStream, "UTF-8", 0, 0);
			
			return true;
		}
		catch(e) {
			this.logToConsole("exception caught in openstream " + e);
			return false;
		}
		
		return false;
	},

	logToConsole: function (text) {

		text += "\n";

		// log to console;
		this.consoleService.logStringMessage(text);	
	},
	
    logToYaml: function (text) {

		try {
		
			if(!this.initialized) { return; }
		
			this.yamlstream.writeString(text);

		}
		catch(e) {
			this.logToConsole("exception caught in logToYaml " + e);
		}
    },
	
	logToTxt: function (text) {

		try {
		
			if(!this.initialized) { return; }
			
			this.logToConsole(text);
			this.logstream.writeString(text);
		}
		catch(e) {
			this.logToConsole("exception caught in logToTxt " + e);
		}
    }	
};


// references:
// https://developer.mozilla.org/en/Setting_HTTP_request_headers#Observers
// https://developer.mozilla.org/en/nsIHttpChannel
// http://forums.mozillazine.org/viewtopic.php?f=19&t=427601
// http://forums.mozillazine.org/viewtopic.php?f=19&t=573191&start=0&st=0&sk=t&sd=a
// http://forums.mozillazine.org/viewtopic.php?f=19&t=528047
var httpRequestObserver =
{
    QueryInterface: function (aIID)
    {
        if (aIID.equals(Components.interfaces.nsISupports) ||
            aIID.equals(Components.interfaces.nsIObserver)) {
            return this;
	}

        throw Components.results.NS_NOINTERFACE;

    },

    initialize: function ()
    {
	var observerService = Components.classes["@mozilla.org/observer-service;1"]
		.getService(Components.interfaces.nsIObserverService);

	//observerService.addObserver(this, "quit-application", false);
        observerService.addObserver(this, "http-on-modify-request", false);
        observerService.addObserver(this, "http-on-examine-response", false);
    },

    shutdown: function ()
    {
		var observerService = Components.classes["@mozilla.org/observer-service;1"]
			.getService(Components.interfaces.nsIObserverService);

		//observerService.removeObserver(this, "quit-application");
     	observerService.removeObserver(this, "http-on-modify-request");
     	observerService.removeObserver(this, "http-on-examine-response");
    },

	//	https://developer.mozilla.org/en/Creating_Sandboxed_HTTP_Connections
	//	aSubject: the channel (nsIChannel) that caused this notification to happen.
    //	aTopic: the notification topic.
	//		http-on-modify-request
	//		http-on-examine-response
    //	aData: null for the two topics. 
    observe: function (subject, topic, data)
    {
        LogManager.logToTxt("---------- observe called");

		try
		{
			if(!(subject instanceof Components.interfaces.nsIHttpChannel)) {
				LogManager.logToTxt("subject not instance of nsIHttpChannel\n");
				return
			}

			var win = getChannelWindow(subject);
			
			// Some requests are not associated with any page (e.g. favicon).
			// These should be ignored.
			if(win == null) {
				LogManager.logToTxt("request not associated with a window\n");
				LogManager.logToTxt("---------- leaving observe\n"); 
				return;
			}

			if (topic == "http-on-modify-request") {

				LogManager.logToTxt("-------------------- observe called - http-on-modify-request");

				try {
					var isFrame = false;
					
					// find out what page is being requested.
					var name = subject.URI.asciiSpec;
					var origName = subject.originalURI.asciiSpec;
					var isRedirect = (name != origName);
					
					// e.g. favicon.ico or chrome://browser/content/browser.xul
					if(win.document.URL == undefined) {
						LogManager.logToTxt("win.document.url " + win.document.URL);
						LogManager.logToTxt("win.location.href " + win.location.href);
						LogManager.logToTxt("request not associated with a URL\n");
						LogManager.logToTxt("-------------------- leaving observe called - http-on-modify-request\n"); 
						return;
					}
					
					if ((subject.loadFlags & Components.interfaces.nsIChannel.LOAD_DOCUMENT_URI) &&
						subject.loadGroup && subject.loadGroup.groupObserver &&
						win == win.parent && !isRedirect)
					{
						LogManager.logToTxt("request is a top document uri (not a frame)\n"); 
						isFrame = false;
					}
					else {
						LogManager.logToTxt("request is a a frame\n");
						isFrame = true;
					}
		   						
					// The nsIChannel needs to be converted into a nsIHttpChannel by using QueryInterface (QI): 
					var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);
						
					
					if(isRedirect) {
					
						LogManager.logToYaml("    - connection:\n");
						LogManager.logToYaml("        type: " + "request\n");
						LogManager.logToYaml("        src: " + origName + "\n");
						LogManager.logToYaml("        dst: " + name + "\n");
						LogManager.logToYaml("        redirect: " + "true\n");

					} 
					else 
					{
						if(httpChannel.referrer)
						{
							LogManager.logToYaml("    - connection:\n");
							LogManager.logToYaml("        type: " + "request\n");
							LogManager.logToYaml("        src: " + httpChannel.referrer.asciiSpec + "\n");
							LogManager.logToYaml("        dst: " +  name + "\n");
							LogManager.logToYaml("        redirect: " + "false\n");
						}
						else 
						{
							var ref = undefined;
							
							if(httpChannel instanceof Components.interfaces.nsIHttpChannelInternal && httpChannel.documentURI)
							{
								ref = httpChannel.documentURI.asciiSpec;
								
								LogManager.logToTxt("from documentURI ref URL " + ref);
							}
						    else if(isFrame) 
							{
								// there are cases when URL for both doc url and win location href are about:blank if it's a frame,
								// in these cases we'll fetch the parent window and use that url. todo: keep looking at parent window until one is not about:blank
								// todo: verify that parentwin != win, (just want to see).
								var tmpwin = win;
								while(tmpwin != tmpwin.parent) 
								{
									
									LogManager.logToTxt("frame document.URL " + tmpwin.document.URL);
									LogManager.logToTxt("frame window.location.href " + tmpwin.location.href);
									
									tmpwin = tmpwin.parent;
								} 
								
								ref = tmpwin.document.URL;
								
								LogManager.logToTxt("frame document.URL " + tmpwin.document.URL);
								LogManager.logToTxt("frame window.location.href " + tmpwin.location.href);
								
								LogManager.logToTxt("from iframe ref URL " + ref);
							}
							else
							{
								ref = win.document.URL;
								
								LogManager.logToTxt("from else ref URL " + ref);
							}
							
							if(ref != undefined)
							{
								LogManager.logToYaml("    - connection:\n");
								LogManager.logToYaml("        type: " + "request\n");
								LogManager.logToYaml("        src: " +  ref + "\n");
								LogManager.logToYaml("        dst: " +  name + "\n");
								LogManager.logToYaml("        redirect: " + "false\n");
							}
						}
					}
					
					// found in source of LiveHttpHeaders extension
					var httpVersion = "HTTP/1.x";

					if (httpChannel instanceof Components.interfaces.nsIHttpChannelInternal)
					{
						var major = {};
						var minor = {};

						httpChannel.getRequestVersion(major, minor);

						httpVersion = "HTTP/" + major.value + "." + minor.value;
					}
					
					var requestMethod = httpChannel.requestMethod;
					//LogManager.logToTxt("request method " + requestMethod);
					
					var headers = [];

					// todo: wrap in try/catch block
					httpChannel.visitRequestHeaders({

						visitHeader: function (name, value)
						{
							headers.push({ name: name, value: value });
						}
					});
					
					var headerRequestStatus =  requestMethod + " " + "URL" + " " + httpVersion;
					LogManager.logToTxt(headerRequestStatus + "\n");
					
					for each(var header in headers) {
						LogManager.logToTxt(header.name + ": " + header.value);
					}
					
					LogManager.logToTxt("-------------------- leaving observe called - http-on-modify-request\n"); 
					
				} catch(e) 
				{
					LogManager.logToTxt("http-on-modify-request caught exception: " + e + "\n"); 
				}
			}
			else if (topic == "http-on-examine-response") 
			{

				LogManager.logToTxt("-------------------- observe called - http-on-examine-response");
				
				try {
					
					var isFrame = false;
					var name = subject.URI.asciiSpec;
					var origName = subject.originalURI.asciiSpec;
					var isRedirect = (name != origName);
					
					// e.g. favicon.ico or chrome://browser/content/browser.xul
					if(win.document.URL == undefined) {
						LogManager.logToTxt("win.document.url " + win.document.URL);
						LogManager.logToTxt("win.location.href " + win.location.href);
						LogManager.logToTxt("request not associated with a URL\n");
						LogManager.logToTxt("-------------------- leaving observe called - http-on-examine-response"); 
						return;
					}
					
					if ((subject.loadFlags & Components.interfaces.nsIChannel.LOAD_DOCUMENT_URI) &&
						subject.loadGroup && subject.loadGroup.groupObserver &&
						win == win.parent && !isRedirect)
					{
						LogManager.logToTxt("response is a top document uri (not a frame)\n");  
						isFrame = false;
					}
					else {
						LogManager.logToTxt("response is a a frame\n");  
						isFrame = true;
					}
					
					// The nsIChannel needs to be converted into a nsIHttpChannel by using QueryInterface (QI): 
					var httpChannel = subject.QueryInterface(Components.interfaces.nsIHttpChannel);

					// Example Server Response
					// HTTP/1.1 200 OK
					// Date: Mon, 23 May 2005 22:38:34 GMT
					// Server: Apache/1.3.3.7 (Unix)  (Red-Hat/Linux)
					// Last-Modified: Wed, 08 Jan 2003 23:11:55 GMT
					// Etag: "3f80f-1b6-3e1cb03b"
					// Accept-Ranges: bytes
					// Content-Length: 438
					// Connection: close
					// Content-Type: text/html; charset=UTF-8


					// https://developer.mozilla.org/en/nsIChannel
					// https://developer.mozilla.org/en/nsIHttpChannel
					// http://en.wikipedia.org/wiki/Hypertext_Transfer_Protocol
					// https://developer.mozilla.org/en/nsIURI
					// https://developer.mozilla.org/en/NsIHttpChannel#getRequestHeader.28.29

					var responseStatus = httpChannel.responseStatus; // e.g. 200 || 302, etc
					var responseStatusText = httpChannel.responseStatusText; // e.g. OK
					var contentType = httpChannel.contentType;
					var contentLength = httpChannel.contentLength;
					
					var server_uri = httpChannel.URI.asciiSpec; // this is the server URI
					var server_original_uri = httpChannel.originalURI.asciiSpec; // this is the server URI
					
					//LogManager.logToTxt("ClientURI " + client_uri + "\n");
					LogManager.logToTxt("ServerURI " + server_uri + "\n");
					LogManager.logToTxt("OriginalServerURI " + server_original_uri + "\n");

					if(httpChannel.referrer)
					{
						var ref = httpChannel.referrer.asciiSpec; 
						
						LogManager.logToYaml("    - connection:\n");
						LogManager.logToYaml("        type: " + "response\n");
						LogManager.logToYaml("        src: " + server_uri + "\n");
						LogManager.logToYaml("        original_src: " + server_original_uri + "\n");
						LogManager.logToYaml("        dst: " + ref + "\n");
						LogManager.logToYaml("        status: " + responseStatus + "\n");
						
						LogManager.logToTxt("from document.referrer ref URL " + ref);
					}
					else
					{
						var ref = undefined;
							
						if(httpChannel instanceof Components.interfaces.nsIHttpChannelInternal && httpChannel.documentURI)
						{
							ref = httpChannel.documentURI.asciiSpec;
							
							LogManager.logToTxt("from documentURI ref URL " + ref);
						}
						else if(isFrame) 
						{
							// there are cases when URL for both doc url and win location href are about:blank if it's a frame,
							// in these cases we'll fetch the parent window and use that url. todo: keep looking at parent window until one is not about:blank
							// todo: verify that parentwin != win, (just want to see).
							var tmpwin = win;
							while(tmpwin != tmpwin.parent) 
							{
								LogManager.logToTxt("frame document.URL " + tmpwin.document.URL);
								LogManager.logToTxt("frame window.location.href " + tmpwin.location.href);
								
								tmpwin = tmpwin.parent;
							} 
							
							ref = tmpwin.document.URL;
							
							LogManager.logToTxt("frame document.URL " + tmpwin.document.URL);
							LogManager.logToTxt("frame window.location.href " + tmpwin.location.href);
							
							LogManager.logToTxt("from iframe ref URL " + ref);
						}
						else
						{
							ref = win.document.URL;
							
							LogManager.logToTxt("from else ref URL " + ref);
						}
							
						if(ref != undefined)
						{
							LogManager.logToYaml("    - connection:\n");
							LogManager.logToYaml("        type: " + "request\n");
							LogManager.logToYaml("        src: " +  name + "\n");
							LogManager.logToYaml("        dst: " +  ref + "\n");
							LogManager.logToYaml("        status: " + responseStatus + "\n");
						}
					}
					
					// found in source of LiveHttpHeaders extension
					var httpVersion = "HTTP/1.x";

					if (httpChannel instanceof Components.interfaces.nsIHttpChannelInternal)
					{
						var major = {};
						var minor = {};

						httpChannel.getResponseVersion(major, minor);

						httpVersion = "HTTP/" + major.value + "." + minor.value;
					}

					// http://www.mozilla.org/projects/embedding/embedapiref/embedapi65.html
					// learned how to do this from firebug code...
					// http://code.google.com/p/fbug/source/browse/branches/firebug1.4/content/firebug/spy.js?spec=svn1881&r=1881
					var headers = [];

					// todo: wrap in try/catch block
					httpChannel.visitResponseHeaders({

						visitHeader: function (name, value)
						{
							headers.push({ name: name, value: value });
						}
					});
					
					var headerResponseStatus = httpVersion + " " + responseStatus + " " + responseStatusText;
					LogManager.logToTxt(headerResponseStatus + "\n");
				
					//LogManager.logToYaml("              - headerResponse: " + headerResponseStatus + "\n");
					//LogManager.logToYaml("              - headers: " + "response\n");                           
					
					//LogManager.logToTxt("# of headers: " + headers.length);
					for each(var header in headers) {
						LogManager.logToTxt(header.name + ": " + header.value);
						//LogManager.logToYaml("                    - header:\n");
						//LogManager.logToYaml("                          name: " + header.name + "\n");
						//LogManager.logToYaml("                          value: " + header.value + "\n");
					}

					LogManager.logToTxt("\n\n");
					
					LogManager.logToTxt("-------------------- leaving observe called - http-on-examine-response"); 
					
				}
				catch(e)
				{
					LogManager.logToTxt("http-on-examine-response caught exception: " + e + "\n");
				}
			}

			else 
			{
				//LogManager.logToTxt("observed called - unknown topic");
			}
		}
		catch(e)
		{
			LogManager.logToTxt("observe caught exception: " + e + "\n"); 
		}
    }

};

// references:
// https://developer.mozilla.org/en/nsIWebProgressListener
// https://developer.mozilla.org/en/NsIWebProgress
// https://developer.mozilla.org/en/NsIRequest
// https://developer.mozilla.org/En/Mozilla_Embedding_FAQ/How_do_I...
// http://www.mail-archive.com/mozilla-xpcom@mozilla.org/msg05593.html
var myListener =
{
    QueryInterface: function (aIID)
    {
        if (aIID.equals(Components.interfaces.nsIWebProgressListener) ||
            aIID.equals(Components.interfaces.nsISupportsWeakReference) ||
            aIID.equals(Components.interfaces.nsISupports)) {
				return this;
		}

        throw Components.results.NS_NOINTERFACE;

    },

	// http://stackoverflow.com/questions/1506788/how-to-filter-out-asynchronous-requests-in-progresslistener
    onStateChange: function (/*sIWebProgressListener*/ aWebProgress, /*nsIRequest*/ aRequest, aFlag, aStatus)
    {
		LogManager.logToTxt("---------- onStateChange called");

        // If you use myListener for more than one tab/window, use
        // aWebProgress.DOMWindow to obtain the tab/window which triggers the state change
        if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_START){}

        if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_STOP)
        {
            if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_ALL){}
            if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_IS_REQUEST){}
            if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_IS_DOCUMENT){}
            if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_IS_NETWORK) {}
            if (aFlag & Components.interfaces.nsIWebProgressListener.STATE_IS_WINDOW && aStatus == 0)
            {
				//LogManager.logToTxt("clearing timeout...");
				//window.clearTimeout(FireShark.timeoutID);

                try {
					// https://developer.mozilla.org/En/DOM/Document.defaultView
					// document.defaultView is generally a reference to the window object for the document
					// document.defaultView returns a reference to the default AbstractView for the document
					// 
					// aWebProgress.DOMWindow.document.defaultView.document.URL can be 'about:blank'
					// if the above is true then
					// aWebProgress.DOMWindow.document.URL will also be 'about:blank'
			
					/*
					var currentFireSharkURL = FireShark.current_url;
					var alldomsURL = aWebProgress.DOMWindow.document.defaultView.document.URL;
					var getsrcCodeURL = content.document.location.href;
					var getscreenshotURL = gBrowser.contentWindow.document.URL;
					var url5 = aWebProgress.DOMWindow.document.URL; //gBrowser.browsers[0].currentWindow.document.URL;
					*/
					var win = aWebProgress.DOMWindow;
					var doc = aWebProgress.DOMWindow.document;
					var url = aWebProgress.DOMWindow.document.URL;
					
					if(win == win.parent) 
					{
						LogManager.logToTxt("this is a parent window\n");
					} 
					else 
					{
						LogManager.logToTxt("this is a child window\n");
						//LogManager.logToTxt("clearing timeout...");
						//window.clearTimeout(FireShark.timeoutID);
						LogManager.logToTxt("---------- leaving onStateChange");
						//LogManager.logToTxt("processing next url...");
						//FireShark.FsLoadNextURL();	
						return;
					}

					if(url != undefined)
					{
						LogManager.logToTxt("url is present\n");
						LogManager.logToTxt("URL: " + url + "\n");
					}
					else
					{
						LogManager.logToTxt("url\n");
						LogManager.logToTxt("URL: " + url + "\n");
					}
	
					// http://www.w3schools.com/htmldom/dom_obj_document.asp
					// https://developer.mozilla.org/en/DOM/document
					SaveScreenShot(win);
					SaveOrigSource(win);
					SaveAllDOMs(win); 

					LogManager.logToYaml("    - contentloaded:\n");
					LogManager.logToYaml("        url: " + url + "\n");

					if (FireShark.frames.length > 0) {
						LogManager.logToYaml("        frames:\n");
						for (var i=0; i<FireShark.frames.length; i++) {
							LogManager.logToYaml("            - frame:\n");
           		 			LogManager.logToYaml("                name: " + FireShark.frames[i].name + "\n");
            				LogManager.logToYaml("                url: " + FireShark.frames[i].uri + "\n");
							LogManager.logToYaml("                parenturl: " + FireShark.frames[i].parenturi + "\n");
							
						}
					}

					FireShark.frames = [];
			
					LogManager.logToTxt("ATTEMPTING TO SAVE SCRIPT INFO!!!\n");
					var arr = win.document.getElementsByTagName("script");
					if(arr.length > 0) {
					 	LogManager.logToYaml("        scripts:\n");
						
						for(var i=0; i <arr.length; i++) {
							var src = arr[i].getAttribute("src");
								if(src != null) {
									LogManager.logToYaml("            - script:\n");
									LogManager.logToYaml("                url: " + src + "\n");
								}
						}			
					}

					arr = win.document.getElementsByTagName("iframe");
					if(arr.length > 0) {
					 	LogManager.logToYaml("        iframes:\n");
						
						for(var i=0; i <arr.length; i++) {
							var src = arr[i].getAttribute("src");
								if(src != null && src != '') {
									LogManager.logToYaml("            - iframe:\n");
									LogManager.logToYaml("                url: " + src + "\n");
								}
						}			
					}

					FireShark.instanceEndTime = new Date();
					FireShark.instanceEndTime.getTime();

					var diff = FireShark.instanceEndTime - FireShark.instanceStartTime;
					LogManager.logToTxt("start " + FireShark.instanceStartTime + "\n");
					LogManager.logToTxt("end " + FireShark.instanceEndTime + "\n");
					LogManager.logToTxt("diff " + diff + "\n");
							
					LogManager.logToYaml("        loadedurl:  " + win.document.URL + "\n");
					LogManager.logToYaml("        time:  " + diff + "\n");
					LogManager.logToYaml("        screenshot:  " + FireShark.imgfile + "\n");
					LogManager.logToYaml("        srcfile:  " + FireShark.srcfile + "\n");

					LogManager.logToYaml("        parentDOM:\n");
					LogManager.logToYaml("            url: " + FireShark.parentdomfilenv.name + "\n");
					LogManager.logToYaml("            file: " + FireShark.parentdomfilenv.value + "\n");

					if (FireShark.domfilesnv.length > 0) {
						LogManager.logToYaml("        doms:\n");
						for (var i=0; i<FireShark.domfilesnv.length; i++) {
							LogManager.logToYaml("            - dom:\n");
							LogManager.logToYaml("                url: " + FireShark.domfilesnv[i].name + "\n");
				        	LogManager.logToYaml("                file: " + FireShark.domfilesnv[i].value + "\n");
						}
					}

					FireShark.domfilesnv = [];

				  	LogManager.logToTxt("========== load event completed - end ==========");

				 	LogManager.logToTxt("clearing timeout...");
					window.clearTimeout(FireShark.timeoutID);
					LogManager.logToTxt("processing next url...");
			        FireShark.FsLoadNextURL();	
				} 
				catch(e) {
					LogManager.logToTxt("onStateChange caught an exception " + e);
					LogManager.logToTxt("clearing timeout...");
					window.clearTimeout(FireShark.timeoutID);
					LogManager.logToTxt("processing next url...");
			        FireShark.FsLoadNextURL();	
				}	        
			}
        }
		
		LogManager.logToTxt("---------- leaving onStateChange");
    },

	//
	//void onLocationChange(in nsIWebProgress aWebProgress,
    //                  in nsIRequest aRequest,
    //                  in nsIURI aLocation);
	//
    onLocationChange: function (aWebProgress, aRequest, aLocation)
    {

        // This fires when the location bar changes; i.e load event is confirmed
        // or when the user switches tabs. If you use myListener for more than one tab/window,
        // use aWebProgress.DOMWindow to obtain the tab/window which triggered the change.
		
		try
		{
			LogManager.logToTxt("---------- onLocationChange called");
			
			var win = aWebProgress.DOMWindow;
			var doc = aWebProgress.DOMWindow.document;
			var url = aWebProgress.DOMWindow.document.URL;
			
			if(win == win.parent) 
			{
				LogManager.logToTxt("this is a parent window\n");
			} 
			else 
			{
				LogManager.logToTxt("this is a child window\n");
				LogManager.logToTxt("---------- leaving onLocationChange");
				return;
			}
				
			
			// http://en.wikipedia.org/wiki/WYCIWYG
			// scheme can be wyciwyg://
			// in these cases skip and don't log
			if(aLocation.scheme == "wyciwyg")
			{
				LogManager.logToTxt("scheme " + aLocation.scheme + " returning...\n");
				return;
			}
			else 
			{
				LogManager.logToTxt("scheme " + aLocation.scheme + "\n");
			}
			
			if(url == aLocation.asciiSpec)
			{
				LogManager.logToTxt("src and dst same returning...\n");
				return;
			}
			
			LogManager.logToYaml("    - locationChange:\n");
			if( aRequest == null ) {
			
				LogManager.logToTxt("a Request is null\n");
			}
			else
			{
				LogManager.logToTxt("aRequest.originalURI " + aRequest.originalURI.asciiSpec + "\n");
				LogManager.logToTxt("aRequest.URL " + aRequest.URI.asciiSpec + "\n");
				LogManager.logToYaml("        requestOriginalURL: " + aRequest.originalURI.asciiSpec + "\n");
				LogManager.logToYaml("        requestURL: " + aRequest.URI.asciiSpec + "\n");
			}
			
			//var oURL = aRequest.originalURI.asciiSpec;
			//LogManager.logToTxt("location changed from " + aLocation.asciiSpec + " to " + url + "\n");
			
			//LogManager.logToYaml("    - locationChange:\n");
			
			LogManager.logToYaml("        src: " + url + "\n");
			LogManager.logToYaml("        dst: " + aLocation.asciiSpec + "\n");
		}
		catch(e) {
		
			LogManager.logToTxt("onLocationChange caught an exception " + e);
		}
		
		LogManager.logToTxt("---------- leaving onLocationChange");

    },

    // For definitions of the remaining functions see XULPlanet.com
    onProgressChange: function (aWebProgress, aRequest, curSelf, maxSelf, curTot, maxTot) {},
    onStatusChange: function (aWebProgress, aRequest, aStatus, aMessage) {},
    onSecurityChange: function (aWebProgress, aRequest, aState) {}
}



var FireShark = {
	
    onLoad: function () {

		LogManager.initialize();
		
		//LogManager.logToTxt("this is a test!!!");
		
        // initialization code
        LogManager.logToTxt("========== In onLoad - begin ==========");

		
        this.initialized = true;

        this.urls = [];
        this.current_url;
        this.urlindex = 0;

        this.urlchain = [];

		this.imgfile = '';
		this.srcfile = '';
		//this.parentdomfilenv.name = '';
		//this.parentdomfilenv.value = '';
		this.domfilesnv = [];
		this.frames = [];
		
        this.Log = "";

        this.HtmlLog = "";
        this.YamlLog = "";

        this.timedOut = false;

        this.timeoutID = 0;

        //this.timeout = false;
        this.instanceStartTime = 0;

        this.instanceEndTime = 0;

        //this.m_httpHeaderVisitor = null;

        LogManager.logToTxt("========== In onLoad - end ==========");

    },

    onUnLoad: function () {
	
		gBrowser.removeProgressListener(myListener);
		httpRequestObserver.shutdown();
		
		//SaveFile("reportlog.txt", this.Log);

		LogManager.logToYaml("\n")
		//SaveFile("reportlog.yml", this.YamlLog);
		
		LogManager.shutdown();
    },


    FsClearCache: function () {

        try {
            var cacheClass = Components.classes["@mozilla.org/network/cache-service;1"];
            var service = cacheClass.getService(Components.interfaces.nsICacheService);

            service.evictEntries(Components.interfaces.nsICache.STORE_ON_DISK);
            service.evictEntries(Components.interfaces.nsICache.STORE_IN_MEMORY);
        }
        catch(exception) {
            LogManager.logToTxt("Exception caught in FsClearCache", exception);
        }
    },



    FsLoadNextURL: function () {

        LogManager.logToTxt("========== In FsLoadNextURL - begin ==========");

        // commenting out timeout 02/02/2010
        // snapshot current time
        this.instanceStartTime = new Date();
        this.instanceStartTime.getTime();


        //this.timeout = false;
        var done = false;

        if (this.initialized)
        {

			//this.imgfile = '';
			//this.srcfile = '';
			//this.parentdomfilenv.name = '';
			//this.parentdomfilenv.value = '';
			//this.domfilesnv = [];

            LogManager.logToTxt(this.urls.length + " URLs left to process");

            //LogManager.logToTxt("clearing timeout");
            //window.clearTimeout(this.loadTimeout);


            if (this.urls.length > 0) {

                var url = this.urls.shift();
                this.current_url = url;

                // TODO: verify format of url
                if (url && url.length != 0) {

                    LogManager.logToTxt("processing: " + url);

                    //LogManager.logToYaml("    - name:  " + this.urlindex+++"\n");
                    //LogManager.logToYaml("      uri:  " + this.current_url + "\n");
                    //LogManager.logToYaml("      connections:\n");
					LogManager.logToYaml("    - urlloaded:\n");
                    LogManager.logToYaml("        url: " + this.current_url + "\n");

                    // TODO: set a timer so that each URL only gets X seconds to load (e.g. 10seconds)
                    // https://developer.mozilla.org/en/Code_snippets/Tabbed_browser
                    // https://developer.mozilla.org/en/DOM/window.setTimeout
                    // Failsafe, just in case the load takes too long
                    this.timeoutID = window.setTimeout(function() {
                    	//win.gBrowser.stop();
					    
						try {
							FireShark.instanceEndTime = new Date();
							FireShark.instanceEndTime.getTime();

							var diff = FireShark.instanceEndTime - FireShark.instanceStartTime;
							LogManager.logToTxt("start " + FireShark.instanceStartTime + "\n");
							LogManager.logToTxt("end " + FireShark.instanceEndTime + "\n");
							LogManager.logToTxt("diff " + diff + "\n");

							//gBrowser.browsers[0].currentWindow.stop();
							
							var turl = FireShark.current_url;
							LogManager.logToYaml("    - timeoutReached:\n");
							LogManager.logToYaml("        url: " + turl + "\n");
							LogManager.logToYaml("        time: " + diff + "\n");
					
							LogManager.logToTxt("Load timeout reached on:" + turl );
							
							FireShark.FsLoadNextURL(); // go to next URL
						}
						catch(e) {
						
							LogManager.logToTxt("Exception caught in setTimeout", e);
						}
						// 5 seconds? configurable.
                    }, 5000);

                    // this is what I was using gBrowser.contentWindow.stop();
                    //gBrowser.browsers[0].currentWindow.stop();
                    gBrowser.loadURI(url, null, "utf-8");

                }
				else
				{
					this.FsLoadNextURL(); // go to next URL
				}
            }

            else {

                done = true;

                // remove progress listerner used to log when document and window have finishing loading
                LogManager.logToTxt("processing complete, removing progress listener");
		
            }

        }

        LogManager.logToTxt("In FsLoadNextURL - end!!!");

        return done;
    },



    onMenuItemCommand: function () {

        //window.open("chrome://helloworld/content/hello.xul", "", "chrome");

		
        LogManager.logToTxt("In onMenuItemCommand");

        LogManager.logToTxt("starting yaml log...");
        //LogManager.logToYaml("runs:\n");
		LogManager.logToYaml("events:\n");

        // https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO
        var file = Components.classes['@mozilla.org/file/local;1']
        	.createInstance(Components.interfaces.nsILocalFile);

        var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
        	.getService(Components.interfaces.nsIProperties);

        var homeDirFile = dirService.get("Home", Components.interfaces.nsIFile); // returns an nsIFile object
        var homeDir = homeDirFile.path;

        homeDirFile.append("data.txt");

        file = homeDirFile;

        LogManager.logToTxt("data file is in: " + file.path);

        // TODO: check to make sure data file exists


        // open an input stream from file
        var istream = Components.classes["@mozilla.org/network/file-input-stream;1"]
        	.createInstance(Components.interfaces.nsIFileInputStream);

        istream.init(file, 0x01, 0444, 0);
        istream.QueryInterface(Components.interfaces.nsILineInputStream);

        LogManager.logToTxt("reading data file...");

        // read lines into array
        var line = {}, hasmore;

        do {

            hasmore = istream.readLine(line);
            this.urls.push(line.value);

        } while (hasmore);

        istream.close();

        LogManager.logToTxt("done reading from data file found " + this.urls.length + " URLs");

        // clear cache
        LogManager.logToTxt("clearing cache\n");
        this.FsClearCache();

        LogManager.logToTxt("registering for http notifications");
		httpRequestObserver.initialize();

        //var observerService = Components.classes["@mozilla.org/observer-service;1"].
	//	getService(Components.interfaces.nsIObserverService);
        //observerService.addObserver(httpRequestObserver, "http-on-modify-request", false);
        //observerService.addObserver(httpRequestObserver, "http-on-examine-response", false);



        //LogManager.logToTxt("registering for window and document state events");
        // register for browser changes
        gBrowser.addProgressListener(myListener, Components.interfaces.nsIWebProgress.NOTIFY_STATE_ALL);

        // load the fist URl and away we go...
        this.FsLoadNextURL();

    }

};
