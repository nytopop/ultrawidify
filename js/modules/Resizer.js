if(Debug.debug)
  console.log("Loading: Resizer.js");

// restore watchdog. While true, _res_applyCss() tries to re-apply new css until this value becomes false again
// value becomes false when width and height of <video> tag match with what we want to set. Only necessary when
// calling _res_restore() for some weird reason.
var _res_restore_wd = false;  

var _res_manual_autoar = function(siteProps){
  if(! siteProps.autoar_imdb.enabled)
    return;
  
  if(siteProps.autoar_imdb.isClass)
    var ntitle = document.querySelector("."+ siteProps.autoar_imdb.title); // NOTE: needs to be tested
    else
      var ntitle = document.querySelector("#"+ siteProps.autoar_imdb.title); // NOTE: needs to be tested
      
      //querySelector lahko vrne null, zato moramo preveriti, kaj smo dobili — drugače se .textContent pritožuje.
      //querySelector can return null, in which case .textContent will complain.
      if(!ntitle)
        return;
      
      var title = ntitle.textContent;
    
    char_got_ar = false;
    last_whatdo = {type: "autoar", what_do:"autoar"};
    
    var sending = browser.runtime.sendMessage({
      type: "gibAspectRatio",
      title: title
    });
    //     sending.then( function(){}, function(err1, err2){console.log("uw::periodic: there was an error while sending a message", err1, err2)} );
}

var _res_changeCSS = function(type, action, lastAction, conf, debugmsg){
  if(debugmsg)
    console.log("uw::changeCSS | starting function. type:", type, "; what_do:",what_do,"\nPlayer element is this:",PLAYER);
  //   hideMenu("uw-armenu");
  //   hideMenu("uw-smenu");
  
  var evideo = $("video")[0];
  
  if(!evideo){
    if(debugmsg)
      console.log("uw::changeCSS | no video element found. Doing nothing.");
    
    return;
  }
  
  var video = { width: evideo.videoWidth, height: evideo.videoHeight };
  var nplayer = { width: PLAYER.clientWidth, height: PLAYER.clientHeight };
  
  if(debugmsg)
    console.log("uw::changeCSS | video dimensions:",video.width,"x",video.height,"; player:",nplayer.width,"x",nplayer.height);
  
  // Youtube predvajalnik privzeto resetira CSS ob prehodu v/iz fullscreen. Tukaj shranimo zadnje dejanje,
  // da ga lahko onFullscreenOff/onFullscreenOn uveljavita.
  // 
  // Youtube player resets CSS on fullscreen state change. Here we save the last action taken, so 
  // onFullscreenOff/onFullscreenOn are able to preserve it (if we want).
  lastAction = {type:type, what_do:what_do};
  
  // -----------------------------------------------------------------------------------------
  //  Handlanje dejanj se zgodi pod to črto
  //  
  //  Handling actions happens below this line
  // -----------------------------------------------------------------------------------------
  
  if (type == "autoar"){
    this.autochar();
    return;
  }
  
  if (type == "char"){      
    if(debugmsg)
      console.log("uw::changeCSS | trying to change aspect ratio.");
    
    // char = CHange Aspect Ratio
    char(what_do, video, nplayer);
    return;
  }
  
  if (what_do == "reset"){
    if(debugmsg)
      console.log("uw::changeCSS | issuing reset.");
    
    resetCSS(video, nplayer); 
    return;
  }
  
  // Velikost videa spreminjamo samo, če smo v celozaslonskem načinu ALI če NE pišemo komentarja
  // Videa ne spreminjamo tudi, če uporabljamo vrstico za iskanje.
  // 
  // We only change video size when we're in full screen OR if we are NOT writing a comment.
  // We also leave video alone if we're using the search bar
  
  if(FullScreenDetect.isFullScreen() || (
    (document.activeElement.getAttribute("role") != "textbox") &&
    (document.activeElement.getAttribute("type") != "text")
  )){
    if(debugmsg)
      console.log("uw::changeCSS | trying to fit width or height");
    
    changeCSS_nofs(what_do, video, nplayer);
  }
  
  
}


var _res_char = function(newAr, video, player){
  
  // Kot vhodni argument dobimo razmerje stranic. Problem je, ker pri nekaterih ločljivostih lahko razmerje stranic
  // videa/našega zaslona minimalno odstopa od idealnega razmerja — npr 2560x1080 ni natanko 21:9, 1920x1080 ni 
  // natanko 16:9. Zato ob podanem razmerju stranic izračunamo dejansko razmerje stranic.
  // 
  // The aspect ratio we get as an argument is an ideal aspect ratio. Some (most) resolutions' aspect ratios differ
  // from that ideal aspect ratio (by a minimal amount) — e.g. 2560x1080 isn't exactly 21:9, 1920x1080 isn't exactly
  // 16:9. What is more, both 3440x1440 and 2560x1080 are considered "21:9", but their aspect ratios are slightly 
  // different. This has the potential to result in annoying black bars, so we correct the aspect ratio we're given
  // to something that's slightly more correct.
  
  var ar;
  var res_219 = [ [2560,1080], [3440,1440] ];
  var res_169 = [ [1920,1080], [1280,720], [1366,768] ];
  
  if(newAr == (21/9)){
    for (var i = 0; i < res_219.length; i++){
      if( player.height == res_219[i][1]){
        ar = res_219[i][0]/res_219[i][1];
        set_video_ar( ar, video, player);
        return;
      }
    }
  }
  else if(new_ar == (16/9)){
    for (var i = 0; i < res_169.length; i++){
      if( player.height == res_169[i][1]){
        ar = res_169[i][0]/res_169[i][1];
        setVideoAr( ar, video, player);
        return;
      }
    }
  }
  
  _res_setVideoAr(new_ar, video, player);
}

//     autochar: function(){
//       
//       if(debugmsg || debugmsg_autoar)
//         console.log("uw::autochar | starting. Did we get ar?",char_got_ar,"What about arx and ary?",char_arx,char_ary);
//       
//       if(!char_got_ar)
//         return;
//       
//       if(!char_arx || !char_ary)
//         return;
//       
//       var ar = char_arx / char_ary;
//       if(ar){
//         setBestFit(ar);
//         last_whatdo = {type: "autoar", what_do: "autoar"};
//       }
//     }





/* Tukaj povemo, kakšno razmerje stranic ima video.
/  Kaj to pomeni: 
//    Mi rečemo, da ima video razmerje stranic 16:9. Dejanski video
//    ima razmerje 4:3. To pomeni, da ima video zgoraj in spodaj črno
//    obrobo, ki je nočemo, zato video povečamo toliko, da se ta obroba odreže.
//    
//    OBROB TUKAJ NE DODAJAMO.
// 
// With this function, we specify the aspect ratio of the video. 
// What does this mean?
//    If we specify that the aspect ratio of a video is 16:9 when video is
//    actually 4:3, that means the video has black bars above and below.
//    We zoom the video just enough for the black lines to disappear.
//    
//    WE DO NOT ADD ANY BLACK BORDERS. If we get to a scenario when we'd have to add 
//    black borders, we do nothing instead.
*/

var setVideoAr = function(aspect_ratio, video, player){
  var video_ar = video.width / video.height;
  var display_ar = player.width / player.height;
  
  if(debugmsg){
    console.log("uw::set_video_ar | aspect ratio: " + aspect_ratio + "; video_ar: " + video_ar + "; display_ar: " + display_ar);
    console.log("uw::set_video_ar | player dimensions: " + player.width + "x" + player.height + "; video dimensions: " + video.width + "x" + video.height);
  }
  
  if( aspect_ratio*1.1 > video_ar && video_ar > aspect_ratio*0.9 ){
    // Ta hack nas reši problema, ki ga predstavlja spodnji if stavek — če se legit 21:9 videu na 16:9 monitorju
    // obreže na 16:9, potem ga s klicem te funkcije ne moremo spremeniti nazaj na 21:9. Vendar pa bi za tak primer
    // radi imeli izjemo.
    // 
    // This hack solves the problem that the bottom if statement presents. If we crop a 21:9 video on a 16:9 monitor,
    // we can't change it back to 21:9 in this function, even though we kinda want that to happen — so we add an
    // exception.
    if( debugmsg)
      console.log("uw::set_video_ar | ar matches our display ar. resetting");
    
    resetCSS(video, player);
    return;
  }
  
  // Širina, višina, top, left za nov video
  // Width, height, top and left for the new video
  var nv = { "w":0, "h":0, "top":0, "left":0 }; 
  
  /*
  * // Video hočemo pretvoriti v video z drugačnim razmerjem stranic.
  * // To storimo tako, da širino videa nastavimo relativno na višino prikazovalnika, torej:
  * // 
  * //     širina = višina_prikazovalnika * razmerje_stranic
  * //     višina = širina / video_ar
  * //     
  * // 
  * // 
  * // ----------------------------------------------------------------------------------------------
  * // 
  * // In this case, the video is narrower than we want (think 4:3, which we want to make into 16:9)
  * // We achieve this by setting video width relative to the display width, so:
  * // 
  * //     width = display_height * aspect_ratio
  * //    height = width / video_ar
  * //     
  */
  
  if( video_ar <= aspect_ratio ){
    if(debugmsg){
      console.log("uw::set_video_ar | reached pre-calc. Video is taller than ar. target ar: " + aspect_ratio );
    }    
    
    nv.w = player.height * aspect_ratio;
    nv.h = nv.w / video_ar;
    
    nv.top = (player.height - nv.h)/2;
    nv.left = (player.width - nv.w)/2;
  }
  else{
    if(debugmsg){
      console.log("uw::set_video_ar | reached pre-calc. Video is wider than ar. target ar: " + aspect_ratio );
    }  
    nv.h = player.width / aspect_ratio;
    nv.w = nv.h * video_ar;
    
    nv.top = (player.height - nv.h)/2;
    nv.left = (player.width - nv.w)/2;
  }
  
  if(nv.w > (player.width * 1.1) && nv.h > (player.height * 1.1))
    return;
  
  this._res_applyCss(nv);
}



// // Ta funkcija ugotovi, kako se kvadrat s podanim razmerjem stranic najbolj prilega ekranu
// // Predpostavimo, da so ćrne obrobe vselej zgoraj in spodaj, nikoli levo in desno.
// // 
// // This function determines how a rectangle with a given aspect ratio best fits the monitor
// // We assume letterbox is always letterbox, never pillarbox.
// var _res_setBestFit = function(ar){
//   if(debugmsg || debugmsg_autoar)
//     console.log("uw::setBestFit | got ar:",ar);
//   
//   var player = {width: PLAYER.clientWidth, height: PLAYER.clientHeight};
//   var player_ar = player.width / player.height;
//   
//   var evideo =  $("video")[0];
//   var video = {width: evideo.videoWidth, height: evideo.videoHeight};
//   var video_ar = video.width / video.height;
//   
//   // Ob predpostavki, da je argument 'ar' pravilen, naračunamo dimenzije videa glede na širino in višino predvajalnika
//   // Kot rezultat laho dobimo dve možnosti:
//   //     A: naračunana širina je širša, kot naš zaslon —> za računanje uporabimo širino (letterbox zgoraj/spodaj,
//   //        levo/desno pa ne)
//   //     B: naračunana širina je ožja, kot naš zaslon —> za računanje uporabimo višino (letterbox levo/desno,
//   //        zgoraj/spodaj pa ne)
//   
//   if(debugmsg || debugmsg_autoar)
//     console.log("uw::setBestFit | here's all we got. ar:",ar,"player:",player,"video:",video);
//   
//   var tru_width = player.height * ar;
//   var tru_height = player.width / ar;
//   
//   var nv = {w: "", h: "", top: "", left: ""};
//   
//   if(ar >= video_ar){
//     if(ar >= player_ar){
//       if(debugmsg || debugmsg_autoar)
//         console.log("uw::setBestFit | aspect ratio is wider than player ar.")
//         nv.h = player.width / video_ar;
//       nv.w = nv.h * ar;
//     }
//     else{
//       if(debugmsg || debugmsg_autoar)
//         console.log("uw::setBestFit | aspect ratio is narrower than player ar.", (player.height * ar), nv)
//         nv.w = player.height * ar;
//       nv.h = nv.w / video_ar;
//     }
//   }
//   else{
//     if(ar >= player_ar){
//       if(debugmsg || debugmsg_autoar)
//         console.log("uw::setBestFit | aspect ratio is wider than player ar.")
//         nv.h = player.width / ar;
//       nv.w = nv.h * video_ar;
//     }
//     else{
//       if(debugmsg || debugmsg_autoar)
//         console.log("uw::setBestFit | aspect ratio is narrower than player ar.", (player.height * ar), nv)
//         nv.w = player.height * video_ar;
//       nv.h = nv.w / ar;
//     }
//   }
//   if(debugmsg || debugmsg_autoar)
//     console.log("uw::setBestFit | new video width and height processed. nv so far:", nv)
//     
//     nv.top = (player.height - nv.h)/2;
//   nv.left = (player.width - nv.w)/2;
//   
//   if(debugmsg || debugmsg_autoar)
//     console.log("uw::setBestFit | tru width:",tru_width,"(player width:",player.width,"); new video size:",nv);
//   
//   _res_applyCss(nv);
//   console.log("uw::setBestFit | css applied");
// }



var _res_reset = function(force){
  dimensions = {top: "", left: "", width: "100%", height: "100%"};
  
  $("video").css({"position": "relative", "width": dimensions.width,"height": dimensions.height,"top": dimensions.top, "left": dimensions.left});
  
  if(Debug.debug)
    console.log("[Resizer::_res_reset] css applied. Dimensions/pos: w:",dimensions.width,"; h:",dimensions.height,"; top:",dimensions.top,"; left:",dimensions.left);
  
  if(force)
    this._currentAr = -1;
}

// Skrbi za "stare" možnosti, kot na primer "na širino zaslona", "na višino zaslona" in "ponastavi". Približevanje opuščeno.
// handles "legacy" options, such as 'fit to widht', 'fit to height' and 'reset'. No zoom tho
var _res_legacyAr = function(action){
  var vid = $("video")[0];
  var ar = screen.width / screen.height;
  var fileAr = vid.videoWidth / vid.videoHeight;
  
  if(action == "fitw"){
    _res_setAr_kbd( ar > fileAr ? ar : fileAr);
    return;
  }
  if(action == "fith"){
    _res_setAr_kbd( ar < fileAr ? ar : fileAr);
    return;
  }
  if(action == "reset"){
        _res_setAr_kbd(fileAr);
//     this.reset(true);
    return;
  }
  if(action == "autoar"){
    ArDetect.init();
  }
}

var _res_setAr_kbd = function(ar){
  if(FullScreenDetect.isFullScreen()){
    if(Debug.debug)
      console.log("[Resizer::_res_setAr_kbd] We're in full screen. Setting ar to ", ar);
    
    _res_setAr(ar, {width: screen.width, height: screen.height} );
  }
//   else
//     _res_setAr_nonfs(ar);
// TODO: check if site supports non-fs ar
}

var _res_setAr = function(ar, playerDimensions){
  var vid = $("video")[0];
  
  // Dejansko razmerje stranic datoteke/<video> značke
  // Actual aspect ratio of the file/<video> tag
  var fileAr = vid.videoWidth / vid.videoHeight;
  
  if(ar == "default")
    ar = fileAr;
  
  // Zabavno dejstvo: ta funkcija se kliče samo v fullscreen. Za ne-fs verzijo bo posebna funkcija, ker bo včasih verjetno treba 
  // spremeniti velikost predvajalnika
  // 
  
  if(Debug.debug)
    console.log("[Resizer::_res_setArFs] ar is " ,ar, ", playerDimensions are ", playerDimensions);
  
  var videoDimensions = {
    width: 0,
    height: 0
  }
  
  if(Debug.debug){
    console.log("[Resizer::_res_setArFs] Player dimensions?",playerDimensions);
  }
  
  if(playerDimensions === undefined){
    playerDimensions = {
      width: screen.width,
      height: screen.height
    }
  }
  
  if( fileAr < ar ){
    // imamo letterbox zgoraj in spodaj -> spremenimo velikost videa (ampak nikoli na več, kot je širina zaslona)
    // letterbox -> change video size (but never to wider than monitor width)
    videoDimensions.width = Math.min(playerDimensions.height * ar, playerDimensions.width);
    videoDimensions.height = videoDimensions.width * (1/fileAr);
  }
  else{
    videoDimensions.height = Math.min(playerDimensions.width * (1/ar), playerDimensions.height);
    videoDimensions.width = videoDimensions.height * fileAr;
  }
  
  if(Debug.debug){
    console.log("[Resizer::_res_setArFs] Video dimensions: ",videoDimensions, "playerDimensions:",playerDimensions);
  }
  
  var cssValues = _res_computeOffsets(videoDimensions, playerDimensions);
  
  if(Debug.debug){
    console.log("[Resizer::_res_setArFs] Offsets for css are: ",cssValues);
  }
  
  _res_applyCss(cssValues);
}

var _res_computeOffsets = function(vidDim, playerDim){
  
  if(Debug.debug)
    console.log("[Resizer::_res_computeOffsets] video will be aligned to ", Settings.miscFullscreenSettings.videoFloat);
  
  var offsets = {
    width: vidDim.width,
    height: vidDim.height,
    left: 0,
    top: ((playerDim.height - vidDim.height) / 2)
  }

  if( offsets.top < 0) {
    if(Debug.debug)
	  console.log("[Resizer::_res_computeOffsets] video is netflix-level stupid, realigning properly");

    // netflix why u making this happen
	/*
	 *
	 * |----------------|
	 * |                |  <- where netflix decides to show half the video
	 * |----------------|
	 * |                |
	 * |                |  <- physical monitor
	 * |----------------|
	 * */
    offsets.top = 0;
  }
  
  if( Settings.miscFullscreenSettings.videoFloat == "center" ){
    offsets.left = (playerDim.width - vidDim.width ) / 2;
    
  }
  else if( Settings.miscFullscreenSettings.videoFloat == "right" ){
    offsets.left = (playerDim.width - vidDim.width);
  }
  
  return offsets;
}

var _res_setAr_nonfs = function(ar){
  var player = SitesConf.getPlayerTag();
  
  SitesConf.prepareNonfsPlayer();
  
  if(! player)
    player = $("video")[0].parentNode;
  
  var playerDimensions = {
    width: player.offsetWidth,
    height: player.offsetHeight
  }
  
  _res_setAr(ar, playerDimensions);
}

var _res_align = function(float){
  if(! float)
    float = Settings.miscFullscreenSettings.videoFloat;
  
  var dimensions = {left: 0};
  
  if(float == "left"){
    _res_applyCss(dimensions);
    return;
  }
  if(float == "center"){
//     dimensions.left = 
//     _res_applyCss(
  }
}

var _res_setStyleString_maxRetries = 3;

var _res_setStyleString = function(vid, styleString, count){
  vid.setAttribute("style", styleString);
  
  if(_res_restore_wd){
    var vid2 = $("video")[0];
    
    if(
      styleString.indexOf("width: " + vid2.style.width) == -1 ||
      styleString.indexOf("height: " + vid2.style.height) == -1) {
      // css ni nastavljen?
      // css not set?
      if(Debug.debug)
        console.log("[Resizer::_res_setStyleString] Style string not set ???");
      
      if(count++ < _res_setStyleString_maxRetries){
        setTimeout( _res_setStyleString, 200, count);
      }
      else if(Debug.debug){
        console.log("[Resizer::_res_setStyleString] we give up. css string won't be set");
      }
    }
    else{
      _res_restore_wd = false;
    }
  }
  else{
    if(Debug.debug)
      console.log("[Resizer::_res_setStyleString] css applied. Style string:", styleString);
  }
}

function _res_applyCss(dimensions){
  
  if(Debug.debug)
    console.log("[Resizer::_res_applyCss] Starting to apply css. this is what we're getting in:", dimensions);
  
  if(dimensions.top !== undefined)
    dimensions.top = "top: " + Math.round(dimensions.top) + "px !important";
  
  if(dimensions.left !== undefined)
    dimensions.left = "left: " + Math.round(dimensions.left) + "px !important";
  
  if(dimensions.width !== undefined)
    dimensions.width = "width: " + Math.round(dimensions.width) + "px !important";
  
  if(dimensions.height !== undefined)
    dimensions.height = "height: " + Math.round(dimensions.height) + "px !important";
 
  // misc.
  dimensions.position = "position: absolute !important";
//   dimensions.objectFit = "object-fit: cover !important";
  
  var vid = $("video")[0];
  
  if(Debug.debug)
    console.log("[Resizer::_res_applyCss] trying to apply css. Css strings: ", dimensions, "video tag: ", vid);
  
  
  var styleArrayStr = vid.getAttribute('style');
  
  if (styleArrayStr !== null && styleArrayStr !== undefined){
    
    var styleArray = styleArrayStr.split(";");
    for(var i in styleArray){
      
      styleArray[i] = styleArray[i].trim();
      
      if (styleArray[i].startsWith("top:")){
        styleArray[i] = dimensions.top;
        delete dimensions.top;
      }
      else if(styleArray[i].startsWith("left:")){
        styleArray[i] = dimensions.left;
        delete dimensions.left;
      }
      else if(styleArray[i].startsWith("width:")){
        styleArray[i] = dimensions.width;
        delete dimensions.width;
      }
      else if(styleArray[i].startsWith("height:")){
        styleArray[i] = dimensions.height;
        delete dimensions.height;
      }
      else if(styleArray[i].startsWith("position:")){
        styleArray[i] = dimensions.position;
      }
      else if(styleArray[i].startsWith("object-fit:")){
        styleArray[i] = dimensions.objectFit;
      }
    }
  }
  else{
    var styleArray = [];
  }
  
  // add remaining elements
  for(var key in dimensions)
    styleArray.push( dimensions[key] );
  
  // problem: last element can get duplicated a lot.
  // solution: check if last element is a duplicate. if it is, remove first occurence (keep last)
  // repeat until no element is removed
  var dups = false;
  
//   debugger;
  
  
  do{
    dups = false;
    var last = styleArray.length - 1;
    var i = last;
    while(i --> 0){
      if(styleArray[i] === styleArray[last]){
        dups = true;
        styleArray.splice(i, 1);
        
        --last; // correct the index
      }
    }
  } while(dups);
  
  
  // build style string back
  var styleString = "";
  for(var i in styleArray)
    if(styleArray[i] !== undefined && styleArray[i] !== "")
      styleString += styleArray[i] + "; ";
  
  _res_setStyleString(vid, styleString);
}



var _res_setFsAr = function(ar){
  this._currentAr = ar;
}

var _res_restore = function(){
  if(Debug.debug){
    console.log("[Resizer::_res_restore] attempting to restore aspect ratio. this & settings:", {'this': this, "settings": Settings} );
  }
  
  // this is true until we verify that css has actually been applied
  _res_restore_wd = true;
  
  if(this._currentAr > 0)
    _res_setAr_kbd(this._currentAr);
  else
    _res_setAr_kbd("default");
}

var Resizer = {
  _currentAr: -1,
  align: _res_align,
  setAr: _res_setAr_kbd,
  setAr_fs: _res_setAr,
  setAr_nonfs: _res_setAr_nonfs,
  legacyAr: _res_legacyAr,
  reset: _res_reset,
  restore: _res_restore,
  setFsAr: _res_setFsAr
}
