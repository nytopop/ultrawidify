#location js
#include lib/debuginit.js
#include conf/uiconf.js
#include conf/sitesconf.js
#include conf/keybinds.js
#include lib/libopts.js
#include lib/browser_autodetect.js
#include lib/optinit.js
#include conf/uwvars.js
#include lib/player_ui.js



const playercheck_recursion_depth_limit = 3;

var uw_autoar_default = true; // true - autoar enabled. False - autoar disabled

var extraClassAdded = false;
var inFullScreen = false;

var cssmod = "";
var zoomStep = 0.05;

var whatdo_persistence = true;
var last_whatdo = {type: "autoar", what_do:"reset"};
var page_url = window.location.toString();            // S pomočjo page_url določimo, na kateri spletni strani smo.
var SITE;

var ctlbar_classnames = ["ytp-chrome-controls"];
var serviceArray = [".video-stream"]; //Youtube 

var buttons = [];

var IGNORE_STORAGE_CHANGES = false;

//BEGIN determining which site we're on and the associated names

var ui_anchor;
var player;
var vid_el;
var SAMPLE_BUTTON_CLASS;     // Class of a sample button
var SAMPLE_BUTTON_INDEX = 0; // index of a sample button
var button_size_base = "x";  // Determines if size of extension buttons is defined by width or height of sample button

var char_strat = "contain";
var char_got_ar = false;
var char_arx;
var char_ary;
var autoar_enabled;

var video_wrap;


// Here we store the window size, so we know when to trigger css change.
var winsize = {w: window.innerWidth, h: window.innerHeight};

// Video title for third party 
var title = "";

// provider-specific variables

var netflix_cltbar_visibility = -1;  // -1 for invisible, anything non-negative for visible
var netflix_periodic_timer;

// Stuff for other browsers
if(usebrowser == "chrome"){
  browser = chrome;
}


browser.storage.local.set({ultrawidify_siterules: UW_SITES});

//Na reloadu vselej odstrani vmesnik od prej
//Always remove previous UI on extension reload
var previousElements = document.getElementsByClassName("uw_element");
if(previousElements){
  while (previousElements.length > 0){
    previousElements[0].parentNode.removeChild(previousElements[0]);
  }
}


function init(force_reload){
  
  if(debugmsg)
    console.log("uw::init | starting init");
  
  
  var el;
  for (key in UW_UI_BUTTONS){
    el = UW_UI_BUTTONS[key];
    if(el.submenu_id){
      // We defined submenus. Now let's add parent info to each submenu.
      for(var i = 0; i < el.submenu.length; i++){
        UW_UI_BUTTONS[el.submenu[i]].parent = key;
      }
    }
  }
  
  if(debugmsg)
    console.log("uw | %cpage_url: "+page_url,"color: #99F");

  //Youtube:
  if(page_url.indexOf("youtu") != -1){
    if(debugmsg)
      console.log("uw::init | we're on youtube. Page url:", page_url);

    video_wrap = "video-stream";
    return true; 
  }
  
  //Netflix:
  if(page_url.indexOf("netflix.com") != -1){
    if(debugmsg)
      console.log("uw::init | we're on netflix. Page url:", page_url);
    
    player = document.getElementById("playerContainer");
    var tmp = document.getElementsByClassName("player-status")[0];
    if(!tmp)
      return false;
    
    vid_el = document.getElementsByTagName("video")[0];
    
    SAMPLE_BUTTON_CLASS = "player-control-button player-fill-screen";
    video_wrap = "player-video-wrapper";
    button_size_base = "y";
    
    return true;
  }
  
  return false;
}


//END 

//BEGIN ADDING CSS

// Če ponovno naložimo dodatek, potem odstranimo star CSS. Lahko se zgodi, da je Tam spremenil CSS in hoče
// preveriti, če stvari zgledajo tako kot morajo. Če ima en razred/id več nasprotujoćih si definicij, potem
// nam to lahko povzroča težave. Za uporabnike je načeloma odstranjevanje obstoječega CSS brezpredmetno, ker
// uporabnik ponavadi ne bo reloadal razširitve.
// 
// If we reload the extension, then we also remove our old CSS. It can easily happen that Tam changed CSS a bit
// and wants to see if things look roughly the way they should. We do this because if a class/id has multiple
// mutually exclusive definitions, we can get some problems with CSS not working the way it should. People who
// aren't Tam generally don't see the benefit as they won't reload the extension — let alone reload the extension
// after messing with CSS.

var ui_anchor = document.getElementById("uw_ui_anchor");
var uwcss = document.getElementsByClassName("uw_css");
while(uwcss && uwcss.length > 0)
  uwcss[0].parentNode.removeChild(uwcss[0]);

// funkcija pomagač za ustvarjanje css linkov
// helper function for creating css links
function addLink(css_url){
  var link = document.createElement("link");
  link.className = "uw_css";
  link.setAttribute("rel","stylesheet");
  link.setAttribute("type","text/css");
  link.setAttribute("href", resourceToUrl(css_url));
  $("head").append(link);
}

// Vsaka stran dobi uw_common.css
// We add uw_common.css on every page

addLink("res/css/uw_common.css");

// Če smo na Youtube/youtube popupu, dodamo css za youtube elemente
// If we're on youtube/youtube popup, we add css for youtube elements
if(page_url.indexOf("youtu") != -1){
  addLink("res/css/uw_yt.css");
}
if(page_url.indexOf("netflix.com") != -1){
  addLink("res/css/uw_netflix.css");
}

//END ADDING CSS



var last_location = "";

var KEYBINDS = {};

//END keybind-related stuff

//BEGIN comms with uw-bg
function extsetup_comms(){
  if(debugmsg)
    console.log("uw | Setting up comms with background scripts");

  var num_of_msg = 0;
  browser.runtime.onMessage.addListener(function (message, sender, stuff ) {
    if(debugmsg || debugmsg_message)
      console.log("uw::onMessage | message number: ", num_of_msg++  , "; message:", message );
    
    if(message.message && message.message == "page-change"){
      if(document.getElementsByClassName("uw_element").length === 0){
        if(debugmsg)
          console.log("uw::onMessage | page was updated but control buttons aren't there. Trying to readd.")
        
        init();
        addCtlButtons(0);
      }
      
      
      // We don't do that if we zoomed or unzoomed
      if(last_whatdo.what_do != "zoom" && last_whatdo.what_do != "unzoom")
        changeCSS(last_whatdo.type, last_whatdo.what_do);
      
      // Velikost gumbov posodobimo v vsakem primeru
      // We update the button size in any case
      updateUICSS();
      
      if(debugmsg)
        console.log("uw::onMessage | message number:",num_of_msg," »» everything is done. Buttons: ", document.getElementsByClassName("uw-button"));
    }
    
    if(message.type && message.type == "arInfo"){
      char_got_ar = true;
      char_arx = message.arx;
      char_ary = message.ary;
      if(debugmsg || debugmsg_message || debugmsg_autoar)
        console.log("uw::onMessage | got aspect ratio (",char_arx,"/",char_ary,"), launching autochar");
      autochar();
    }
    
  });

  // browser.runtime.onMessage.addListener(request => {
  //   console.log("Message from the background script:");
  //   console.log(request.greeting);
  //   return Promise.resolve({response: "Hi from content script"});
  // });

  if(debugmsg)
    console.log("uw | Comms with background scripts: done");
}
//END comms with uw-bg

//BEGIN periodic functions
//Because onUpdated event isn't reliable enough for what we're doing on netflix.
function periodic() {
  
  //NOTE: this entire function needs to be tested if it still works
  
  if(debugmsg_periodic)
    console.log("uw::periodic started!");
  
  if(document.getElementsByClassName("uw_element").length === 0){
    if(debugmsg)
      console.log("uw::periodic | no buttons detected. Readding.");
    
    init();
    buildUInative();
    updateUICSS();
  }
  var w = window.innerWidth;
  var h = window.innerHeight;
  if(winsize.w != w && winsize.h != h){
    if(debugmsg)
      console.log("uw::periodic | detected change in window size. Triggering css change");
    
    winsize.w = w;
    winsize.h = h;
    
    // We don't do that if we zoomed or unzoomed
    if(last_whatdo.what_do != "zoom" && last_whatdo.what_do != "unzoom"/* && last_whatdo.type != "autoar"*/){
      changeCSS(last_whatdo.type, last_whatdo.what_do);
    }
    
    updateUICSS();
  }
  if(SITE_PROPS.uiParent.isClass)
    var controls = document.getElementsByClassName(SITE_PROPS.uiParent.name)[0];
  else
    var controls = document.getElementById(SITE_PROPS.uiParent.name);
  if(controls){
    if(debugmsg_periodic)
      console.log("uw::periodic | we found controls!");
      

  }
    
  if( autoar_enabled ){
    
    var titleElement;
    
    if(SITE_PROPS.autoar_imdb.isClass)
      titleElement = document.querySelector("." + SITE_PROPS.autoar_imdb.title);
    else
      titleElement = document.querySelector("#" + SITE_PROPS.autoar_imdb.title);
    var ntitle = "";
    
    //querySelector lahko vrne null, zato moramo preveriti, kaj smo dobili — drugače se .textContent pritožuje.
    //querySelector can return null, in which case .textContent will complain.
    if(qntitle)
      ntitle = titleElement.textContent;
    else{
      char_got_ar = false;
      return;
    }
    if(titleElement && ntitle && ntitle != title){
      if(debugmsg || debugmsg_message || debugmsg_autoar)
        console.log("uw::periodic | title changed. New title:",ntitle,"Old title:",title);
      
      char_got_ar = false;
      
      title = ntitle;
      var sending = browser.runtime.sendMessage({
        type: "gibAspectRatio",
        title: title
      });
//       sending.then( function(){}, function(err1, err2){console.log("uw::periodic: there was an error while sending a message", err1, err2)} );
    }
  }
  
}
//END periodic functions



$(document).ready(function() {
  if(debugmsg)
    console.log("uw::document.ready | document is ready. Starting extension setup ...");
  extSetup();
});

//BEGIN EXTENSION SETUP

function extSetup(force_reload){
  if(debugmsg)
    console.log("==============================================================================================");
  
  last_location = window.location;
  
//   SITE = "";
  
  if(force_reload){
    ui_anchor.parentNode.removeChild(ui_anchor);
    ui_anchor = null;
  }
  
  if(debugmsg){
    console.log("uw::extSetup | our current location is:", last_location, "(page_url says",page_url,")");
    console.log("uw::extSetup | initiating extension");
  }
  var ini = init();
  
  if(debugmsg){
    console.log("uw::extSetup | init exited with", ini);
    console.log("uw::extSetup | removing existing keydown event from document (useful if extension was previously loaded and we navigated to a different video)");
  }
  $(document).off("keydown");
  
  if(debugmsg)
    console.log("uw::extSetup | setting up keyboard shortcuts");
  
  loadFromStorage();
  
  //extsetup_stage2 gets called in loadFromStorage, on siterules
}


var EXTSETUP_STAGES = {
  site: false,
  uiban: false,
  uimode: false,
}

function stagetracker(op){
  if(op == "clear"){
    if(debugmsg)
      console.log("uw::stagetracker | %cclearing progress (state)","color: #fff");
    for(key in EXTSETUP_STAGES)
      EXTSETUP_STAGES[key] = false;
    return;
  }
  EXTSETUP_STAGES[op] = true;

  var all_done = true;  
  var unfinished_stages = "";
    
  for(key in EXTSETUP_STAGES){
    all_done &= EXTSETUP_STAGES[key];
    if(debugmsg && ! EXTSETUP_STAGES[key]){
      unfinished_stages += "<" + key + "> ";
    }
  }
  
  if(debugmsg)
    console.log("uw::stagetracker | added stage",op, all_done ? " | all stages finished" : (" | missing stages: " + unfinished_stages));

  return all_done;  
}



function extsetup_stage2(op){
  
  if(debugmsg)
    console.log("uw::extSetup (stage 2) | %cStarting the function. op=","color: #fff", op);
  
  if(! stagetracker(op) ){
    if(debugmsg)
      console.log("uw::extSetup (stage 2) | %cSome stages are still uncompleted, doing nothing.","color: #fff");
    return false;
  }
  
  extsetup_listener();
  
  // SITE se nastavi v funkciji loadFromStorage. Če ni nastavljen, potem nismo na znani/podprti strani
  // SITE is set in loadFromStorage. If SITE is still undefined at this point, then we aren't on a known page.
  
  if(debugmsg){
    console.log("\n\n\n\nuw::extSetup (stage 2) | --------- ENTERING STAGE 2 OF SETUP -----------");
  }
  
  if(SITE){
    
    if(debugmsg){
      console.log("uw::extSetup (stage 2) | site found, starting config");
      console.log("starting uinit ...");
      console.log("progress: %c |                                           |", "background-color: #161211; color: #f51;")
    }
    uinit();
    if(debugmsg){
      console.log("uw::extSetup (stage 2)\nprogress: %c |===>                    |\nuinit complete\n\n", "background-color: #161211; color: #f51;");
    }
    
    keydownSetup();
    if(debugmsg)
      console.log("uw::extSetup (stage 2)\nprogress: %c |=======>                |\nkeydownSetup complete\n\n", "background-color: #161211;color: #f51;");
    
    extsetup_comms();
    if(debugmsg)
      console.log("uw::extSetup (stage 2)\nprogress: %c |============>           |\nextSetup complete; starting buildUInative\n\n", "background-color: #161211; color: #f51;");
    
    buildUInative();
    if(debugmsg)
      console.log("uw::extSetup (stage 2)\nprogress: %c |=================>      |\nbuildUInative complete\n\n", "background-color: #161211; color: #f51;");
    
    updateUICSS();
    if(debugmsg)
      console.log("uw::extSetup (stage 2)\nprogress: %c |========================|\nupdateUICSS complete\n\n", "background-color: #161211; color: #f51;");
    
    if(page_url.indexOf("netflix.com") != -1){
      console.log("uw::extSetup (stage 2) | starting netflix-specific setup steps");
      if(netflix_periodic_timer)
        clearInterval(netflix_periodic_timer);
      netflix_periodic_timer = setInterval(function(){ periodic(); }, 100);
    }
  }
  else{
    if(debugmsg){
      console.log("uw::extSetup (stage 2) |%c SITE appears to be undefined. This means we aren't on a known/supported site. Ultrawidify shouldn't be loaded.",'background-color: #fa6607; color: #000;',"\n(note: this usually happens once after reloading this extension. If that's the case, chances are everything is fine, since this function runs twice — once with correct page_url and once with wrong one");
      debugger;
    }
  }
  
  if(debugmsg)
    console.log("uw::extSetup (stage 2)\nprogress: %c |========================|\nadded canvas\n\n", "background-color: #161211; color: #f51;")
  

  
  
  
  if(debugmsg)
    console.log("======================================[ setup finished ]======================================\n\n\n\n\n");
}



function loadFromStorage(){
  if(debugmsg || debugmsg_autoar)
    console.log("uw::loadFromStorage | loading stuff from storage.");
  
  extsetup_stage2("clear");
  
  getopt("ultrawidify_uiban", function(data){
    IGNORE_STORAGE_CHANGES = true;
    extsetup_uiban(data);
    extsetup_stage2("uiban");
    IGNORE_STORAGE_CHANGES = false;
  });
  getopt("ultrawidify_siterules", function(data){ 
    IGNORE_STORAGE_CHANGES = true;
    extsetup_siterules(data); 
    console.log("sss");
    extsetup_stage2("site");
    IGNORE_STORAGE_CHANGES = false;
  });
  getopt("ultrawidify_ui", function(data){
    IGNORE_STORAGE_CHANGES = true;
    extsetup_ui_mode(data);
    console.log("sasa");
    extsetup_stage2("uimode"); 
    IGNORE_STORAGE_CHANGES = false;
  });
  getopt("ultrawidify_autoar", function(data){
    IGNORE_STORAGE_CHANGES = true;
    extsetup_autoar(data) 
    IGNORE_STORAGE_CHANGES = false;
  });
  getopt("ultrawidify_keybinds", function(data){ 
    IGNORE_STORAGE_CHANGES = true;
    extsetup_keybinds(data);
    IGNORE_STORAGE_CHANGES = false;
  });
  
}

function keydownSetup(){
  if(debugmsg)
    console.log("uw::keydownSetup | starting keybord shortcut setup");
  $(document).keydown(function (event) {          // Tukaj ugotovimo, katero tipko smo pritisnili
    
    // Tipke upoštevamo samo, če smo v celozaslonskem načinu oz. če ne pišemo komentarja
    // v nasprotnem primeru ne naredimo nič.
    // We only take actions if we're in full screen or not writing a comment
    if( !(inFullScreen || (
      (document.activeElement.getAttribute("role") != "textbox") &&
      (document.activeElement.getAttribute("type") != "text")
    ))){
      if(debugmsg)
        console.log("We're writing a comment or something. Doing nothing");
      return;
    }
    if(debugmsg || debugmsg_message){
//       console.log(KEYBINDS);
      console.log("we pressed a key: ", event.key , " | keydown: ", event.keydown);
      if(event.key == 'p'){
        console.log("uw/keydown: attempting to send message")
        var sending = browser.runtime.sendMessage({
          type: "debug",
          message: "Test message, please ignore"
        });
        sending.then( function(){}, function(){console.log("uw/keydown: there was an error while sending a message")} );
        console.log("uw/keydown: test message sent! (probably)");
        return;
      }
    }
    
    for(i in KEYBINDS){
      if(debugmsg)
        console.log("i: ", i, "keybinds[i]:", KEYBINDS[i]);
      
      if(event.key == KEYBINDS[i].key){
        if(debugmsg)
          console.log("Key matches!");
        //Tipka se ujema. Preverimo še modifierje:
        //Key matches. Let's check if modifiers match, too:
        var mods = true;
        for(var j = 0; j < KEYBINDS[i].modifiers.length; j++){
          if(KEYBINDS[i].modifiers[j] == "ctrl")
            mods &= event.ctrlKey ;
          else if(KEYBINDS[i].modifiers[j] == "alt")
            mods &= event.altKey ;
          else if(KEYBINDS[i].modifiers[j] == "shift")
            mods &= event.shiftKey ;
        }
        if(debugmsg)
          console.log("we pressed a key: ", event.key , " | mods match?", mods, "keybinding: ", KEYBINDS[i]);
        if(mods){
          event.stopPropagation();
          
          console.log("uw::keydown | keys match. Taking action.");
          if(KEYBINDS[i].action == "char"){
            changeCSS("char", KEYBINDS[i].targetAR);
            return;
          }
          if(KEYBINDS[i].action == "autoar"){
            manual_autoar();
            return;
          }
          changeCSS("anything goes", KEYBINDS[i].action);
          return;
        }
      }
    }
  });

  document.addEventListener("mozfullscreenchange", function( event ) {
    onFullScreenChange();
    inFullScreen = ( window.innerHeight == window.screen.height && window.innerWidth == window.screen.width);
    inFullScreen ? onFullscreenOn() : onFullscreenOff();
  });
}

function extsetup_siterules(opt){
  if(debugmsg)
    console.log("%cuw::extsetup_siterules | setting up site rules settings","color: #88f;");
  
//   if(usebrowser == "chrome")
    var obj = opt;
//   else
//     var obj = opt[0];
  
  if(!opt || obj.ultrawidify_siterules === undefined){
    if(debugmsg)
      console.log("uw::extsetup_siterules | site url rules missing from storage. Setting defaults.");
    browser.storage.local.set({ultrawidify_siterules: UW_SITES});
  }
  else{
    UW_SITES = obj.ultrawidify_siterules;
  }
  
  if(debugmsg)
    console.log("uw::extsetup_siterules | UW_SITES:",UW_SITES,"current site:",SITE);
  
  var match;
  for(key in UW_SITES){    
    var el = UW_SITES[key];
    if(debugmsg){
      console.log("uw::extsetup_siterules | key:",key,"; el:",el, location);
    }
    match = false;
    
    for (var i = 0; i < el.urlRules.length; i++){
      if(debugmsg)
        console.log("uw::extsetup_siterules | page_url:",page_url,"; el.urlRules["+i+"]:",el.urlRules[i],"; last_location.indexOf(el.urlRules["+i+"]):",page_url.indexOf(el.urlRules[i]));
      match |= page_url.indexOf(el.urlRules[i]) != -1;
    }
    if(match){
      if(debugmsg)
        console.log("uw::extsetup_siterules | we are on site", key);
      
      SITE = key;
      return true;
    }
  }
  if(debugmsg)
    console.log("%cuw::extsetup_siterules | page_url is unknown or incorrect. Stalling extension setup","color:#fa6607","\n(NOTE: In some cases, stalling like that could be result of this extension script running twice)");
  debugging
  return false;
}

function extsetup_autoar(opt){
  if(debugmsg)
    console.log("%cuw::extsetup_autoar | setting up autoar settings","color: #88f;");
  
//   if(usebrowser == "chrome")
    var obj = opt;
//   else
//     var obj = opt[0];
  
  //Naslov resetiramo v vsakem primeru
  //We always reset the title
  title = "";
  if(obj === undefined)
    return;
  
  
  if(obj.ultrawidify_autoar === undefined){
    if(debugmsg || debugmsg_autoar)
      console.log("uw::extsetup_autoar | autoar setting unavailavle in storage. Setting defaults.");
      browser.storage.local.set({ultrawidify_autoar: uw_autoar_default});
    autoar_enabled = uw_autoar_default;
  }
  else 
    autoar_enabled = obj.ultrawidify_autoar;
  
  
  if(debugmsg || debugmsg_autoar)
    console.log("uw::extsetup_autoar | autoar",(autoar_enabled ? "enabled":"disabled"),"opt: ",opt);
  
  if(!autoar_enabled)
    last_whatdo = {type: "reset", what_do:"reset"};
}

function extsetup_uiban(opt){
  if(debugmsg)
    console.log("%cuw::extsetup_uiban | setting uiban","color: #88f;");
  
  if(! opt || opt.ultrawidify_uiban === undefined){
    if(debugmsg)
      console.log("uw::extsetup_uiban | ui ban missing from storage. Setting defaults.");
    browser.storage.local.set({ultrawidify_uiban: UW_UI_BANLIST});
  }
  else
    UW_UI_BANLIST = opt.ultrawidify_uiban;
  
}

function extsetup_listener(){
  if(debugmsg)
    console.log("uw::extsetup_listener | setting up listeners");
  
  browser.storage.onChanged.addListener(function(){
    if(IGNORE_STORAGE_CHANGES){
      if(debugmsg)
        console.log("uw::<storage change> | %c We are ignoring storage changes at the moment. Doing nothing.", "color: #fa6607")
        return;
    }
    if(debugmsg){
      console.log("uw::<storage change> |%c calling extSetup from storage.onChanged","color:#99f");
    }
    extSetup(true);
  });
}

function extsetup_ui_mode(opt){ 
  if(!opt || opt.ultrawidify_ui === undefined)
    UW_UI_MODE = "all";
  else
    UW_UI_MODE = opt.ultrawidify_ui;
  
  console.log("uw::extsetup_ui_mode | ui mode:",UW_UI_MODE);
}

function extsetup_keybinds(res){
  if(debugmsg)
    console.log("%cuw::extsetup_keybinds | setting up autoar settings","color: #88f;");
  
//   if(usebrowser == "chrome")
    var obj = res;
//   else
//     var obj = res[0];
  
  if(typeof uw_keybinds_storage_set === "undefined" && (jQuery.isEmptyObject(obj) || jQuery.isEmptyObject(obj.ultrawidify_keybinds)) ){
    if(debugmsg)
      console.log("uw::<init keybinds> | No keybindings found. Loading default keybinds as keybinds");
    
    browser.storage.local.set({ultrawidify_keybinds:DEFAULT_KEYBINDINGS});
    KEYBINDS = DEFAULT_KEYBINDINGS;
    uw_keybinds_storage_set = true;
  }
  else{
    if(Object.keys(obj.ultrawidify_keybinds).length == Object.keys(DEFAULT_KEYBINDINGS).length)
      KEYBINDS = obj.ultrawidify_keybinds;
    else{
      KEYBINDS = obj.ultrawidify_keybinds;
      
      // remap 4:3 keybind from 'a' to 'c', but only if the keybind wasn't changed
      var old_keybinds = Object.keys(obj.ultrawidify_keybinds);
      if(KEYBINDS[old_keybinds-1].key == "a" && KEYBINDS[old_keybinds-1].modifiers == []){
        KEYBINDS[old_keybinds-1].key == "c";
      }
      KEYBINDS[old_keybinds] = {action: "autoar", key: "a", modifiers: []};
    }
  }
  //   console.log("res. ", obj.ultrawidify_keybinds);
}

  //BEGIN UI

function check4player(recursion_depth){
  try{
    var button_width = document.getElementsByClassName(SAMPLE_BUTTON_CLASS)[SAMPLE_BUTTON_INDEX].scrollWidth;
    return true;
  }
  catch(e){
    // Zato, ker predvajalnik ni vselej prisoten. Če predvajalnik ni prisoten,
    // potem tudi knofov ni. Kar pomeni problem.
    // 
    // Because the player isn't always there, and when the player isn't there the buttons aren't, either.
    // In that case, the above statement craps out, throws an exception and trashes the extension.
    if(debugmsg)
      console.log("uw::addCtlButtons | seems there was a fuckup and no buttons were found on this page. No player (and therefore no buttons) found.");
    
    if(!recursion_depth)
      recursion_depth = 0;
    
    // If buttons weren't found, we relaunch init() just
    init();
    return recursion_depth < playercheck_recursion_depth_limit ? check4player(++recursion_depth) : false;
  }
  return false;
}

function hideAllMenus(){
  var el;
  for(key in UW_UI_BUTTONS){
    el = UW_UI_BUTTONS[key];
    if( el.submenu_id )
      hideMenu(el.submenu_id);
  }
}

function updateUICSS(){
  
  //BEGIN INIT
  var buttons = document.getElementsByClassName("uw_button");
  
  var button_width = getBaseButtonWidth();
  
  if(debugmsg)
    console.log("uw::updateUICSS | resizing buttons. This are our buttons:",buttons," | a button is this wide:", button_width);
  
  if(button_width == -1 || buttons.length == 0){ //this means there's no ui
    if(debugmsg)
      console.log("uw::updateUICSS | UI wasn't detected, stopping");
    return;
  }
  
  if(debugmsg){
    console.log("uw::updateUICSS | checks passed. Starting to resize ...");
    console.log("uw::updateUICSS | we have this many elements:",buttons.length, buttons);
  }
  //END INIT
  //BEGIN update buttons
  
  for (var i = 0; i < buttons.length; i++){
    buttons[i].style.width = (button_width * 0.75) + "px";
    buttons[i].style.height = (button_width) + "px";
    buttons[i].style.marginLeft = (button_width * 0.3) + "px";
    buttons[i].style.paddingLeft = (button_width *0.15 ) + "px";
    buttons[i].style.paddingRight = (button_width * 0.15) + "px";
  }
  
  
  //END update buttons
  //BEGIN update menus 
  
  var el;
  var div;
  for(key in UW_UI_BUTTONS){
    el = UW_UI_BUTTONS[key];
    if( el.submenu_id ){
      div = document.getElementById(el.submenu_id);
      if( el.top_level) {
        if( alignToBottom() ){
          div.style.bottom = button_width * 1.2 + "px";
        }
        
        
      }
      else{
        if( alignToBottom() ) {
          div.style.bottom = "0px";
        }
        
        // this is tricky. We need to find the best place to put the (sub)menu.
      }
    }
  }
  
  //END menus
}

function getBaseButtonWidth(){
  try{
    // Na različnih straneh širino gumba poberemo na različne načine.
    if(BUTTON_SIZE_BASE == "y")
      return document.getElementsByClassName(SAMPLE_BUTTON_CLASS)[SAMPLE_BUTTON_INDEX].scrollHeight;
    else
      return document.getElementsByClassName(SAMPLE_BUTTON_CLASS)[SAMPLE_BUTTON_INDEX].scrollWidth;
  }
  catch(e){
    // Zato, ker predvajalnik ni vselej prisoten. Če predvajalnik ni prisoten,
    // potem tudi knofov ni. Kar pomeni problem.
    // 
    // Because the player isn't always there, and when the player isn't there the buttons aren't, either.
    // In that case, the above statement craps out, throws an exception and trashes the extension.
    if(debugmsg)
      console.log("uw::getBaseButtonWidth | seems there was a fuckup and no buttons were found on this page. No player (and therefore no buttons) found.");
    return -1;
  }
}



var align_to = "bottom"; //TODO — unhardcode
function alignToBottom(){
  return align_to == "bottom";
}


//END UI
//END EXTENSION SETUP

function onOpen(){
  if(debugmsg)
    console.log("uw | Options page opened");
}

function onError(err){
  if(debugmsg){
    console.log(`Error: ${error}`);
    console.log("uw | Error opening the page", err);
  }
}

function showSettings(){
  
}

// Ta funkcija se proži, ko vstopimo ali izstopimo iz celozaslonskega načina
// This function gets triggered by full screen state change
function onFullScreenChange(){
  // Popravimo velikost gumbov
  // Let's fix the button size:
  var button_width = document.getElementsByClassName(SAMPLE_BUTTON_CLASS)[SAMPLE_BUTTON_INDEX].scrollWidth;
  for( var i = 5; i >= 0; i--){
    buttons[i].style.width = (button_width * 0.75) + "px";
    buttons[i].style.paddingLeft = (button_width *0.15 ) + "px";
    buttons[i].style.paddingRight = (button_width * 0.15) + "px";
  }
  
  document.getElementById("uw-smenu").style.bottom = (button_width * 1.5) + "px";
  
  //Sedaj poglejmo še, če lahko v nadzorno vrstico spravimo vse gumbe
  //Let's see if we can get all the buttons in the control bar
//   var rctl = document.getElementsByClassName("ytp-right-controls")[0];
  
}


// Ta funkcija se proži, ko gremo v celozaslonski način
// This function triggers when we enter fullscreen mode
function onFullscreenOn(){
  
}

// Ta funkcija se proži, ko gremo ven iz celozaslonskega načina
// This function triggers when we leave fullscreen mode
function onFullscreenOff(){

}

function manual_autoar(){
  if(! SITE_PROPS.autoar_imdb.enabled)
    return;
  
  if(SITE_PROPS.autoar_imdb.isClass)
    var ntitle = document.querySelector("."+ SITE_PROPS.autoar_imdb.title); // NOTE: needs to be tested
  else
    var ntitle = document.querySelector("#"+ SITE_PROPS.autoar_imdb.title); // NOTE: needs to be tested
  
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

function changeCSS(type, what_do){
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
  last_whatdo = {type:type, what_do:what_do};
  
  // -----------------------------------------------------------------------------------------
  //  Handlanje dejanj se zgodi pod to črto
  //  
  //  Handling actions happens below this line
  // -----------------------------------------------------------------------------------------
  
  if (type == "autoar"){
    autochar();
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
  
  if(inFullScreen || (
    (document.activeElement.getAttribute("role") != "textbox") &&
    (document.activeElement.getAttribute("type") != "text")
    )){
    if(debugmsg)
      console.log("uw::changeCSS | trying to fit width or height");
    
    changeCSS_nofs(what_do, video, nplayer);
  }
  
  
}


function char(new_ar, video, player){
  
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
  
  if(new_ar == (21/9)){
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
        set_video_ar( ar, video, player);
        return;
      }
    }
  }
  
  set_video_ar(new_ar, video, player);
}

function autochar(){
  
  if(debugmsg || debugmsg_autoar)
    console.log("uw::autochar | starting. Did we get ar?",char_got_ar,"What about arx and ary?",char_arx,char_ary);
  
  if(!char_got_ar)
    return;
  
  if(!char_arx || !char_ary)
    return;
  
  var ar = char_arx / char_ary;
  if(ar){
    set_best_fit(ar);
    last_whatdo = {type: "autoar", what_do: "autoar"};
  }
}

/* Tukaj povemo, kakšno razmerje stranic ima video.
// Kaj to pomeni: 
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
function set_video_ar(aspect_ratio, video, player){
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
  // Video hočemo pretvoriti v video z drugačnim razmerjem stranic.
  // To storimo tako, da širino videa nastavimo relativno na višino prikazovalnika, torej:
  // 
  //     širina = višina_prikazovalnika * razmerje_stranic
  //     višina = širina / video_ar
  //     
  // 
  // 
  // ----------------------------------------------------------------------------------------------
  // 
  // In this case, the video is narrower than we want (think 4:3, which we want to make into 16:9)
  // We achieve this by setting video width relative to the display width, so:
  // 
  //     width = display_height * aspect_ratio
  //    height = width / video_ar
  //     
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
  
  applyCSS(nv);
}

// Ta funkcija ugotovi, kako se kvadrat s podanim razmerjem stranic najbolj prilega ekranu
// Predpostavimo, da so ćrne obrobe vselej zgoraj in spodaj, nikoli levo in desno.
// 
// This function determines how a rectangle with a given aspect ratio best fits the monitor
// We assume letterbox is always letterbox, never pillarbox.
function set_best_fit(ar){
  if(debugmsg || debugmsg_autoar)
    console.log("uw::set_best_fit | got ar:",ar);
  
  var player = {width: PLAYER.clientWidth, height: PLAYER.clientHeight};
  var player_ar = player.width / player.height;
  
  var evideo =  $("video")[0];
  var video = {width: evideo.videoWidth, height: evideo.videoHeight};
  var video_ar = video.width / video.height;
  
  // Ob predpostavki, da je argument 'ar' pravilen, naračunamo dimenzije videa glede na širino in višino predvajalnika
  // Kot rezultat laho dobimo dve možnosti:
  //     A: naračunana širina je širša, kot naš zaslon —> za računanje uporabimo širino (letterbox zgoraj/spodaj,
  //        levo/desno pa ne)
  //     B: naračunana širina je ožja, kot naš zaslon —> za računanje uporabimo višino (letterbox levo/desno,
  //        zgoraj/spodaj pa ne)
  
  if(debugmsg || debugmsg_autoar)
    console.log("uw::set_best_fit | here's all we got. ar:",ar,"player:",player,"video:",video);
  
  var tru_width = player.height * ar;
  var tru_height = player.width / ar;
  
  var nv = {w: "", h: "", top: "", left: ""};
  
  if(ar >= video_ar){
    if(ar >= player_ar){
      if(debugmsg || debugmsg_autoar)
        console.log("uw::set_best_fit | aspect ratio is wider than player ar.")
      nv.h = player.width / video_ar;
      nv.w = nv.h * ar;
    }
    else{
      if(debugmsg || debugmsg_autoar)
        console.log("uw::set_best_fit | aspect ratio is narrower than player ar.", (player.height * ar), nv)
      nv.w = player.height * ar;
      nv.h = nv.w / video_ar;
    }
  }
  else{
    if(ar >= player_ar){
      if(debugmsg || debugmsg_autoar)
        console.log("uw::set_best_fit | aspect ratio is wider than player ar.")
      nv.h = player.width / ar;
      nv.w = nv.h * video_ar;
    }
    else{
      if(debugmsg || debugmsg_autoar)
        console.log("uw::set_best_fit | aspect ratio is narrower than player ar.", (player.height * ar), nv)
        nv.w = player.height * video_ar;
      nv.h = nv.w / ar;
    }
  }
  if(debugmsg || debugmsg_autoar)
    console.log("uw::set_best_fit | new video width and height processed. nv so far:", nv)
  
  nv.top = (player.height - nv.h)/2;
  nv.left = (player.width - nv.w)/2;
  
  if(debugmsg || debugmsg_autoar)
    console.log("uw::set_best_fit | tru width:",tru_width,"(player width:",player.width,"); new video size:",nv);
  
  applyCSS(nv);
  console.log("uw::set_best_fit | css applied");
}

function resetCSS(video, player){
  if(debugmsg)
    console.log("uw::resetCSS | resetting video size");
  
  
  var nv = {"w": 0, "h": 0, "top": 0, "left": 0};
  
  var vidaspect = video.width / video.height;
  var scraspect = player.width / player.height;
  
  if( vidaspect > scraspect ){  // Video je širši od okna | video is wider than window
    nv.w = player.width;
    nv.h = player.width / video.width * video.height;
    
    // Lahko se zgodi, da je prišlo do zaokroževalne napake ter da je dejanska višina videa le nekaj pikslov drugačna,
    // kot višina predvajalnika. V tem primeru zavržemo prej dobljeni rezultat in namesto tega privzamemo, da je višina
    // videa enaka višini predvajalnika.
    // 
    // It's possible to have a rounding error where calculated height of the video is only a few pixels different from
    // the player height. In such cases, we discard the calculated video height and use player height instead.
    
    if( player.height - 4 < nv.h && nv.h < player.height + 4 )
      nv.h = player.height;
    
    nv.top = (player.height - nv.h) / 2;
    nv.left = 0;
  }
  else{
    nv.h = player.height;
    nv.w = player.height / video.height * video.width;
    
    if( player.width - 4 < nv.w && nv.w < player.width + 4)
      nv.w = player.width;
    
    nv.top = 0;   //itak zasedemo 100% višine
    nv.left = (player.width - nv.w) / 2;
  }
  
  applyCSS(nv);
}

function changeCSS_nofs(what_do, video, player){
  if(debugmsg){
    console.log("uw::changeCSS_nofs | arguments: what_do:",what_do,"; video:", video,"; player:", player);
  }
  
  var w;
  var h;
  var top;
  var left;
  
  var evideo = $("video")[0];
  var video = {width: evideo.videoWidth, height: evideo.videoHeight, scrollw: evideo.scrollWidth, scrollh: evideo.scrollWidth};
  
  var ar = video.width / video.height;
  
  if(debugmsg){
    console.log("uw::changeCSS_nofs | video dimensions:", video.width, "x", video.height, "; ar:",ar);
  }
  
  if(what_do == "fitw" || what_do == "fit-width"){
    // Ker bi bilo lepo, da atribut 'top' spremenimo hkrati z width in height, moramo najprej naračunati,
    // za kakšen faktor se poviša višina. To potrebujemo, da se pravilno izračuna offset.
    // 
    //        100vw = window.innerWidth
    //        window.innerWidth / videoWidth = x
    // 
    // Če pomnožimo videoHeight z x, dobimo novo višino videa. Nova višina videa je lahko večja ali manjša
    // kot višina ekrana. Če je višina videa manjša kot višina ekrana, bo top pozitiven, drugače negativen:
    // 
    //        nvideoh = x * videoWidth
    //        top = (window.innerHeight - nvideoh) / 2
    //
    // Z 2 delimo, ker hočemo video vertikalno poravnati.
    
    w = player.width;
    h = player.width / video.width * video.height;
    
    if(debugmsg)
      console.log("uw::changeCSS_nofs | w:",w,"; h:",h);
    
    top = (player.height - h) / 2;
    left = 0;            // Ker zavzamemo vso širino | cos we take up all the width
  }
  
  if(what_do == "fith" || what_do == "fit-height"){
    h = player.height;
    w = player.height / video.height * video.width;
    
    top = 0;   //itak zasedemo 100% višine
    left = (player.width - w) / 2;
  }
  
  if(what_do == "zoom"){    
    // Video povečujemo na tak način, da sta zoom in unzoom povečata oz. zmanjšata video za enak korak
    // We do this so zoom and unzoom steps change video sizes for the same amount
    
    h = video.scrollh + (player.height * zoomStep);
    w = video.scrollw + (player.height * zoomStep * ar);
    /* Zakaj računamo širino na tak način?
    // 
    // Predstavljajte si, da imamo 2100:900 video v 1600:900 škatli, zoomStep = 0.1. Če bi širino računali po formuli:
    // 
    //     širina = širina_videa + (širina zaslona * zoomStep)
    //     
    // Potem bi bila nova velikost videa 2260 x 990. Razmerje stranic: 2.28 (moglo bi biti 2.33 — video je popačen).
    // Zaradi tega novo širino rajši povečamo za razliko_v_višini * razmerje_stranic
    // 
    //     2100 + (900 * 0.1 * (2100/900)) =
    //                 2100 + (90 * 2.333) = 2310
    //
    // Razmerje stranic (2310x990) je tako 2.333 — tako, kot bi moglo biti.
    // 
    // 
    // ============================================================================================================
    // 
    // Why did we calculate width this way?
    // 
    // Imagine we have a 2100x900 video in a 1600:900 container, zoomStep = 0.1. If we calculated width using this:
    //
    //     width = video_width + (container_width * zoomStep)
    //     
    // then the new size would be 2260 x 990. This gives us an aspect ratio of 2.28 instead of 2.33 (which is what it
    // should be). Because of that we rather increase the width by delta_height * aspect_ratio:
    //
    //     2100 + (900 * 0.1 * (2100/900)) =
    //                 2100 + (90 * 2.333) = 2310 
    //
    // This gives us the correct aspect ratio and prevents video deformations.
    */
    
    top = (player.height - h)/2
    left = (player.width - w) / 2;
    
    if (h > player.height * 4){
      if(debugmsg){
        console.log("But this video is ... I mean, it's fucking huge. This is bigger than some rooms, this is bigger than some people's flats!");
        // Insert obligatory omnishambles & coffee machine quote here
        console.log("(No really, mate, you took this way too far already. Can't let you do that, Dave.)");
      }
      return;
    }
  }
  
  if(what_do == "unzoom"){
    // Video povečujemo na tak način, da sta zoom in unzoom povečata oz. zmanjšata video za enak korak
    // We do this so zoom and unzoom steps change video sizes for the same amount
    h = video.scrollh - (player.height * zoomStep);
    w = video.scrollw - (player.height * zoomStep * ar);
    
    top = (player.height - h)/2
    left = (player.width - w) / 2;
    
    if (h < player.height * 0.25){
      if(debugmsg){
        console.log("don't you think this is small enough already? You don't need to resize the video all the way down to the size smaller than your penis.");
        console.log("(if you're a woman, substitute 'penis' with whatever the female equivalent is.)");
      }
      return;
    }
  }
  var dimensions = { h: h, w: w, top: top, left: left };
  applyCSS(dimensions);
}

function applyCSS(dimensions){
  dimensions.top = Math.round(dimensions.top) + "px";
  dimensions.left = Math.round(dimensions.left) + "px";
  dimensions.w = Math.round(dimensions.w) + "px";
  dimensions.h = Math.round(dimensions.h) + "px";
  
  $("video").css({"width": dimensions.w,"height": dimensions.h,"top": dimensions.top, "left": dimensions.left});
  
  if(debugmsg)
    console.log("uw::applycss | css applied. Dimensions/pos: w:",dimensions.w,"; h:",dimensions.h,"; top:",dimensions.top,"; left:",dimensions.left);
}

function inIframe(){
  if(debugmsg)
    console.log("uw::inIframe | checking if we're in an iframe");
  try {
    return window.self !== window.top;
  } catch (e) {
    return true;
  }
}

function resourceToUrl(img){
  return chrome.extension.getURL(img);
}

function showMenu(id, sizes){
  if(debugmsg){
    console.log("uw::showMenu | showing menu with id ", id, "\n\n", document.getElementById(id));
  }
  
  var div = document.getElementById(id);
  
  console.log("showMenu | asasdas", sizes);
  
  div.classList.add("show");
  console.log("showMenu | asasdas");
  if(sizes){
    console.log("uw::showMenu",sizes);
    var player_leftmost = sizes.player.left;
    var parent_leftmost = sizes.parent.left;
    var player_rightmost = sizes.player.left + sizes.player.width;
    var parent_rightmost = sizes.parent.left + sizes.parent.width;
    
    if(debugmsg){
      console.log("uw::showMenu | space on left:", parent_leftmost - player_leftmost, "| space on right:", player_rightmost - parent_rightmost);
    }
    
    // if:
    //  space left of the parent      is bigger than       space right of the parent
    if( (parent_leftmost - player_leftmost)   >   (player_rightmost - parent_rightmost) ){
      //player goes to the left side
      if(debugmsg){
        console.log("uw::showMenu | setting position on the submenu relative to the parent. left:", -div.getBoundingClientRect().width )
      }
      div.style.left = (- div.getBoundingClientRect().width ) + "px";
    }
    else{
      if(debugmsg)
        alert("this wasn't defined yet. pls do this. ctrl+f rivianpoint");
      div.style.left = sizes.parent.width + "px";
    }
  }
}


function toggleMenu(id){
  if(debugmsg || debugmsg_click)
    console.log("uw::toggleMenu | toggling menu with id", id, "\n\n", document.getElementById(id));
  document.getElementById(id).classList.toggle("show");
}

function hideMenu(id){
  if(debugmsg)
    console.log("uw::hideMenu | hiding menu with id " + id);
  if(document.getElementById(id)) //Safety check in case there's no element with such id
    document.getElementById(id).classList.remove("show");
}