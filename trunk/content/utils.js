/*
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
	
function NameValuePair(name, value) {

    this.name = name;
	this.value = value;
}

function FrameObject(name, uri, parenturi) {

    this.name = name;
	this.uri = uri;
	this.parenturi = parenturi;
}

function getChannelWindow(/**nsIChannel*/ channel) /**nsIDOMWindow*/
{
	var callbacks = [];
	if (channel.notificationCallbacks)
		callbacks.push(channel.notificationCallbacks);
	if (channel.loadGroup && channel.loadGroup.notificationCallbacks)
		callbacks.push(channel.loadGroup.notificationCallbacks);

	for each (var callback in callbacks)
	{
		try {
			// For Gecko 1.9.1
			return callback.getInterface(Components.interfaces.nsILoadContext).associatedWindow;
		} catch(e) {}

		try {
			// For Gecko 1.9.0
			return callback.getInterface(Components.interfaces.nsIDOMWindow);
		} catch(e) {}
	}

	return null;
}

function GetWindowForRequest(request)
{
   LogManager.logToTxt("in GetWindowForRequest\n");

   var webProgress = GetRequestWebProgress(request);
   try {

       if (webProgress) {
           LogManager.logToTxt("leaving value GetWindowForRequest\n");
           return webProgress.DOMWindow;
       }
   }
   catch (e) {
	LogManager.logToTxt("GetWindowForRequest exception: " + e);
   }

   LogManager.logToTxt("leaving null GetWindowForRequest\n");
   return null;
};

// https://developer.mozilla.org/en/Exception_logging_in_JavaScript
function GetRequestWebProgress(request)
{
    LogManager.logToTxt("in GetRequestWebProgress\n");
    try
    {
        if (request.notificationCallbacks)
            return request.notificationCallbacks.getInterface(Components.interfaces.nsIWebProgress);
   
    } catch (e) {
        //LogManager.logToTxt("GetRequestWebProgress exception: " + e);
    }

    try
    {
       if (request.loadGroup && request.loadGroup.groupObserver)
           return request.loadGroup.groupObserver.QueryInterface(Components.interfaces.nsIWebProgress);
    } 
    catch (e) {
         //LogManager.logToTxt("GetRequestWebProgress exception: " + e);
    }

   return null;
};

function LOG(text)
{

    text += "\n";



    var consoleService = Components.classes["@mozilla.org/consoleservice;1"]
    	.getService(Components.interfaces.nsIConsoleService);



    consoleService.logStringMessage(text);



    FireShark.Log += text;

}



function LOGHTML(text)
{
    FireShark.HtmlLog += text;
}

function LOGYAML(text)
{
    FireShark.YamlLog += text;
}



function Sleep(milliseconds)
{
    var iMilliseconds = milliseconds;
    var sDialogScript = 'window.setTimeout( function () { window.close(); }, ' + iMilliseconds + ');';
    window.showModalDialog('javascript:document.writeln ("<script>' + sDialogScript + '<' + '/script>")');
}


function getRandomInt(min, max)
{
	return Math.floor(Math.random() * (max - min + 1)) + min;
}


// https://developer.mozilla.org/en/nsIFile/createUnique
// https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO

function SaveDOMToUniqueFile(win)
{
	try {
		var aDocument = win.document;
		var serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
			.createInstance(Components.interfaces.nsIDOMSerializer);

		var file = Components.classes["@mozilla.org/file/directory_service;1"].
			getService(Components.interfaces.nsIProperties).
			get("Home", Components.interfaces.nsIFile);

		//file.append("dom.txt");

		// if too many files with a similiar filename exist createUnique will return an exception of NS_ERROR_FILE_TOO_BIG
		// to avoid this we will "help" in creating an initially random name
		var random = getRandomInt(1, 1000);
		file.append("dom" + random + ".txt");
		
		file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);

		// do whatever you need to the created file
		LogManager.logToTxt("unique file name " + file.path);

		LogManager.logToTxt("saving... " + file.path);

		if (win.parent == win) {
			var nv = new NameValuePair(win.location.href, file.leafName);
	  		FireShark.parentdomfilenv = nv;
		}
		else {
			var nv = new NameValuePair(win.location.href, file.leafName);
			FireShark.domfilesnv.push(nv);
		}

		//LogManager.logToTxtHTML("<br /><a href=\"" + file.leafName + "\">DOM - " + aDescription + "</a>");

		var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
			.createInstance(Components.interfaces.nsIFileOutputStream);

		foStream.init(file, 0x02 | 0x08 | 0x20, 0664, 0); // write, create, truncate
		serializer.serializeToStream(aDocument, foStream, ""); // rememeber, doc is the DOM tree
		foStream.close();

	} 
	catch(e) {
		LogManager.logToTxt("SaveDOMToUniqueFile caught exception " + e);
	}
}

function SaveFile(filename, data)
{

    //LogManager.logToTxt("In SaveFile");

    // remove any illegal chars http://en.wikipedia.org/wiki/Filename
    filename = filename.replace(/[\/|/\|/?|%|\*|:|\||"|<|>]/g, "");
	//filename = filename.replace(/[^A-Za-z0-9_]/g, "");
    var dirService = Components.classes["@mozilla.org/file/directory_service;1"]
		.getService(Components.interfaces.nsIProperties);

    var homeDirFile = dirService.get("Home", Components.interfaces.nsIFile); // returns an nsIFile object

    var file = Components.classes['@mozilla.org/file/local;1']
		.createInstance(Components.interfaces.nsILocalFile);

    homeDirFile.append(filename);

    file = homeDirFile;

    LogManager.logToTxt("saving... " + file.path);

    // https://developer.mozilla.org/en/Code_snippets/File_I%2F%2FO

    // file is nsIFile, data is a string
    var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
    	.createInstance(Components.interfaces.nsIFileOutputStream);

    // use 0x02 | 0x10 to open file for appending.
    foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);

    // write, create, truncate
    // In a c file operation, we have no need to set file mode with or operation,
    // directly using "r" or "w" usually.


    // if you are sure there will never ever be any non-ascii text in data you can 
    // also call foStream.writeData directly
    var converter = Components.classes["@mozilla.org/intl/converter-output-stream;1"]
		.createInstance(Components.interfaces.nsIConverterOutputStream);

    converter.init(foStream, "UTF-8", 0, 0);

    converter.writeString(data);

    converter.close(); // this closes foStream


    LogManager.logToTxt("In SaveFile complete");

}


// https://developer.mozilla.org/en/XMLSerializer
// https://developer.mozilla.org/en/Parsin ... lizing_XML
// https://developer.mozilla.org/En/XMLHttpRequest
// https://developer.mozilla.org/En/NsIXMLHttpRequest
// https://developer.mozilla.org/en/NsIJSXMLHttpRequest
// https://developer.mozilla.org/en/Parsing_and_serializing_XML
// https://developer.mozilla.org/en/XUL_Tutorial/Document_Object_Model
// https://developer.mozilla.org/en/How_to_create_a_DOM_tree

// https://developer.mozilla.org/en/DOM
// https://developer.mozilla.org/en/DOM/document

function SaveAllDOMs(win)
{
    //LogManager.logToTxt("In SaveAllDOMs");

    if (!win)
    {
        LogManager.logToTxt("bad window passed");
        return;
    }

    if (!win.document)
    {
        LogManager.logToTxt("bad doc");
        return;
    }

    var serializer = Components.classes["@mozilla.org/xmlextras/xmlserializer;1"]
		.createInstance(Components.interfaces.nsIDOMSerializer);

    var xml = serializer.serializeToString(win.document);

    //var descr = win.document.URL;

    LogManager.logToTxt("URI of document " + win.document.URL);

    //LogManager.logToTxt("checking size of DOM");
    //LogManager.logToTxt("DOM size " + xml.length);

    if (win.parent == win) {
        LogManager.logToTxt("This is a Top Window");
    }
    else {

        // https://developer.mozilla.org/en/DOM/window.frameElement
        var el = win.frameElement;

        if (el != null) {

            var name = el.tagName;

            LogManager.logToTxt("frame tagname " + name);

            //descr += " - " + name;

			// note if frame dns response is an error the uri will be something in this format:
			// about:neterror?e=dnsNotFound&u=http%3A//molo.tw/index.php&c=ISO-8859-1&d=Firefox%20can%27t%20find%20the%20server%20at%20molo.tw.
			// https://developer.mozilla.org/en/DOM/document
			var document_uri = win.document.documentURI; // note this would give the internal uri e.g. about:neterror
			var uri = win.location.href; // this will give us the true uri, even if there is a dns error
			var parenturi = win.parent.location.href;

			var frame = new FrameObject(name, uri, parenturi);
			FireShark.frames.push(frame);

            //LogManager.logToYaml("        - frame:\n");
            //LogManager.logToYaml("              name: " + name + "\n");
            //LogManager.logToYaml("              uri: " + uri + "\n");
			//LogManager.logToYaml("              parenturi: " + parenturi + "\n");
        }

    }

    SaveDOMToUniqueFile(win);

    if (win.frames.length > 0)
    {
        //LogManager.logToYaml("      frames:\n");

        LogManager.logToTxt("number of frames " + win.frames.length);

        for (var i = 0; i < win.frames.length; i++) {

            SaveAllDOMs(win.frames[i]);

        }

    }

}

// http://forums.mozillazine.org/viewtopic.php?f=19&t=419963&p=6575745
// https://developer.mozilla.org/en/NsITraceableChannel

function SaveOrigSource(win)
{

    //LogManager.logToTxt("In SaveOrigSource");

	var url = win.document.location.href;
    //var url = content.document.location.href;

    // remove any illegal chars http://en.wikipedia.org/wiki/Filename
    //filename = filename.replace(/[\/|/\|/?|%|\*|:|\||"|<|>|\.]/g, ""); 
    
	/*filename = filename.replace(/[\/|/\|/?|%|\*|:|\||"|<|>]/g, "");

    var dirService = Components.classes["@mozilla.org/file/directory_service;1"].
		getService(Components.interfaces.nsIProperties);

    var homeDirFile = dirService.get("Home", Components.interfaces.nsIFile); // returns an nsIFile object
    var homeDir = homeDirFile.path;

    var file = Components.classes['@mozilla.org/file/local;1'].createInstance(Components.interfaces.nsILocalFile);

    homeDirFile.append(filename);

    file = homeDirFile;
	*/
	
	var file = Components.classes["@mozilla.org/file/directory_service;1"].
		getService(Components.interfaces.nsIProperties).
		get("Home", Components.interfaces.nsIFile);

	// if too many files with a similiar filename exist createUnique will return an exception of NS_ERROR_FILE_TOO_BIG
	// to avoid this we will "help" in creating an initially random name
	var random = getRandomInt(1, 1000);
	file.append("src" + random + ".txt");
    file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);
	
    LogManager.logToTxt("saving... " + file.path);

    //LogManager.logToTxtHTML("<br /><a href=\"" + filename + "\">SRC</a>");

    if (url == content.document.location.href) { // only current page get post data
        try {

            var sessionHistory = getWebNavigation().sessionHistory;

            var entry = sessionHistory.getEntryAtIndex(sessionHistory.index, false);

            var postData = entry.QueryInterface(Components.interfaces.nsISHEntry).postData;

        } catch(e) {}

    }

    var referrer = null;

    var uri = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService).newURI(url, null, null);

    const nsIWBP = Components.interfaces.nsIWebBrowserPersist;

    var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"].createInstance(nsIWBP);

    persist.persistFlags = nsIWBP.PERSIST_FLAGS_REPLACE_EXISTING_FILES
		| nsIWBP.PERSIST_FLAGS_DONT_FIXUP_LINKS
		| nsIWBP.PERSIST_FLAGS_FROM_CACHE;

    persist.saveURI(uri, null, referrer, postData, null, file);

    //urlobj.src_location = file.path;

	FireShark.srcfile = file.leafName;

    return true;
}



// https://developer.mozilla.org/En/Code_snippets/Canvas

function SaveScreenShot(wnd)
{
    //LogManager.logToTxt("In SaveScreenShot");

    // check if this firefox supports canvas
    var canvas_supported = true;
	FireShark.imgfile = '';

    try
    {
        //var canvas = document.getElementById("canvas");
        var canvas = document.createElementNS('http://www.w3.org/1999/xhtml', 'canvas');

        if (canvas == null)

        throw Exception;

        if (! ("toDataURL" in canvas))

        throw Exception;
    }
    catch(e) {
        // canvas not supported
        canvas_supported = false;
    }

    if (canvas_supported) {

        try {

            //var wnd = gBrowser.contentWindow;

            //var wnd = gBrowser.browsers[0].currentWindow;
			if(wnd.document.body == null)
			{
				LogManager.logToTxt("in screenshot window.document.body is null...leaving");
				return;
			}
			
            var width = wnd.document.body.scrollWidth;

            var height = wnd.document.body.scrollHeight;

            canvas.width = width;

            canvas.height = height;

            LogManager.logToTxt("canvas.width = " + width);

            LogManager.logToTxt("canvas.height = " + height);

            var context = canvas.getContext("2d");

            context.clearRect(0, 0, canvas.width, canvas.height);

            context.drawWindow(wnd, 0, 0, canvas.width, canvas.height, "rgba(0, 0, 0, 0)");

            //var result = canvas.toDataURL("image/png", "");

            var pngBinary = canvas.toDataURL("image/png", "");

            LogManager.logToTxt("image size = " + pngBinary.length);

			var file = Components.classes["@mozilla.org/file/directory_service;1"].
				getService(Components.interfaces.nsIProperties).
				get("Home", Components.interfaces.nsIFile);

			// if too many files with a similiar filename exist createUnique will return an exception of NS_ERROR_FILE_TOO_BIG
			// to avoid this we will "help" in creating an initially random name
			var random = getRandomInt(1, 1000);
			file.append("img" + random + ".png");
    		file.createUnique(Components.interfaces.nsIFile.NORMAL_FILE_TYPE, 0666);

            LogManager.logToTxt("saving... " + file.path);

            //LogManager.logToTxtHTML("<a href=\"" + filename + "\">" + "<img width=\"400\" src=\"" + filename + "\" />" + "</a>");



            // create a data url from the canvas and then create URIs of the source and targets
            var io = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);

            var source = io.newURI(pngBinary, "UTF8", null);

            var target = io.newFileURI(file)

            // prepare to save the canvas data
            var persist = Components.classes["@mozilla.org/embedding/browser/nsWebBrowserPersist;1"]
				.createInstance(Components.interfaces.nsIWebBrowserPersist);

            persist.persistFlags = Components.interfaces
            	.nsIWebBrowserPersist.PERSIST_FLAGS_REPLACE_EXISTING_FILES;

            persist.persistFlags |= Components.interfaces
            	.nsIWebBrowserPersist.PERSIST_FLAGS_AUTODETECT_APPLY_CONVERSION;

            // save the canvas data to the file
            persist.saveURI(source, null, null, null, null, file);

        }
        catch(e) {

            LogManager.logToTxt("exception caught in SaveScreenShot e: " + e.name + " " + e.message);
        }
    }
    else {

        // todo assign website default image
    }



    //urlobj.image_location = file.path;

	FireShark.imgfile = file.leafName;
    return;

}
