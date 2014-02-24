
/**
 * Module dependencies
 */

var express = require('express'),
    fs = require('fs'),
    omx = require('omxdirector'),
    path = require('path'),
    exec = require('child_process').exec,
    child,imagchild,
    _= require('underscore');
    
var imageformat = ['.jpg' , '.JPEG' , '.jpeg' , '.png'] ;
var videoformat = ['.mp4'];

var config = {
    port: 8000,
    root: __dirname,
    uploadDir: './media'
}

var app = express();

app.use(allowCrossDomain);

// app.use(omx());

app.use(express.static(config.root + '/public'))

app.set('view engine', 'jade')

app.configure(function () {

    // bodyParser should be above methodOverride
    app.use(express.bodyParser({uploadDir:config.uploadDir}))
    app.use(express.methodOverride())

    // routes should be at the last
    app.use(app.router)

    // custom error handler
    app.use(function (err, req, res, next) {
        if (~err.message.indexOf('not found')) return next()
        console.error(err.stack)
        res.status(500).render('500')
    })

//    app.use(function (req, res, next) {
//        res.status(404).render('404', { url: req.originalUrl })
//    })

})

addRoutes(app);


//var io = socketio.listen(server);

app.listen(config.port, function() {
    console.log("Express server listening on port " + config.port);
});


function allowCrossDomain (req, res, next) {
    res.header('Access-Control-Allow-Origin', req.headers.origin);
    res.header('Access-Control-Allow-Credentials', true);
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Content-Length, X-Requested-With,origin,accept');

    if (req.method == 'OPTIONS') {
        res.send(200);
    }
    else {
        next();
    }
}

function addRoutes(app) {
    var out= {};
    var playerrun = "no";
    var playlistfile= "_playlist.json";
    app.get('/media-list', function(req,res){        
        var out={};
        var check= (req.query.cururl)? ~req.query.cururl.indexOf('playlist'): '';
        if(fs.existsSync(config.root+"/"+playlistfile) && check){
            out.data= JSON.parse(fs.readFileSync(config.root+"/"+playlistfile,'utf8'));
            out.success= true;
            out.stat_message= 'Loaded Playlist';
            
            var playlistarr= [];
            for(key in out.data){
                playlistarr.push(out.data[key].filename);
            }
            var filedirarr= fs.readdirSync(config.uploadDir);
            var diskmedia, playmedia;        
            
            diskmedia= _.difference(filedirarr, playlistarr);
            if (diskmedia.length) {
                diskmedia.forEach(function(itm){                    
                    out.data.push({filename: itm, duration: 0, selected: false});
                }); 
            }
            playmedia= _.difference(playlistarr, filedirarr);
            if (playmedia.length) {
                playmedia.forEach(function(itm){
                    _.map(out.data, function(arritm){
                        if (arritm.filename == itm) {
                            arritm.deleted= true;
                        }
                    }) 
                }); 
            }
            
            res.contentType('json');
            return res.json(out);
        }
        else{
            fs.readdir(config.uploadDir,function (err,files) {
                if (err) {
                    out.success= false;
                    out.stat_message= "Error: "+err;
                    out.data= [];
                } else {
                    out.success= true;
                    out.stat_message= "Sending Media files list";
                    out.data= files;
                }
                res.contentType('json');
                return res.json(out);
            })
        }
    })

    app.post('/play-file', function(req,res){
        var out = {};
        var link = config.uploadDir+'/'+req.param('file');
        //check image or video
        if ( !imageformat.indexOf(path.extname(link)) ) {
            //shell command to display image
            imagchild= exec('sudo fbi -T 1 media/'+req.param('file'), function(stderr,stdout,stdin){
                console.log(" stderr" + stderr);
                console.log("stdout "+ stdout);
                console.log("stdin "+ stdin);
            });
	    setTimeout(function(){
		exec('MACHINE=`pidof fbi`;echo `sudo kill $MACHINE`;')
		}, 5000)
            console.log('display play the image '+link );
        }else{
            // player is running or not
            
            if(playerrun == "no"){
                omx.play(link , { audioOutput : 'hdmi'});
                playerrun = "playing"; 
                console.log("player started running");
                out.stat_message2= 'player started';
                // if the player runnning they pause or play
            }else if(playerrun == 'playing' ) {
                        console.log(req.param('state'));
                        if (req.param('state') == 'pause') {
                                omx.pause();
                                playerrun = "playing";
                        console.log('pause button pressed ||||||');
                                
                                out.stat_message3= 'play/pause key pressed';
                        }else if (req.param('state') == 'play') {
                                omx.play(link , { audioOutput : 'hdmi'});
                                playerrun = "playing";
                                console.log('played >>>>>');
                            }
               
            }    
            console.log('play the video file');
        }
        //check the status of player
        (omx.getStatus().loaded)?  playerrun = "playing" : playerrun = "no";
        // stop the video player
        if (req.param('playing') == 'stop') {
            omx.stop();
            playerrun = 'no';
            console.log('player stoped');
        }        
        out.success= true;
        out.stat_message1= "Recived the file name for play: "+req.param('file') + link;
        out.data= [];

        res.contentType('json');
        return res.json(out);
    })
    
    app.post('/file-upload', function(req, res){
        var out= {}, imgdata= req.files[Object.keys(req.files)];          
        out.data= {};           
        if(!fs.existsSync(config.uploadDir+'/'+imgdata.name) ){
            out.data.name= imgdata.name;
            out.data.path= imgdata.path;
            out.data.size= imgdata.size;
            out.data.type= imgdata.type;
            out.stat_message= "Success";       
        }
        else{
            out.data= null;
            out.stat_message= "Overwriting file";     
        }
        fs.renameSync(imgdata.path, config.uploadDir+'/'+imgdata.name);  
        out.success= true;
        
        res.contentType('json');
        return res.json(out);
    })
    // space indicator 
    app.get('/indicator',function(req,res){        
        child = exec('df -h /',['utf8']);            // shell command to know the available space
        child.stdout.on('data',function(data){
            console.log("the total usage" +data);
            res.json(data);  
        })
    })
    
    
    app.get('/file-detail', function(req, res){
        var out= {},
        stats= fs.statSync(config.uploadDir+"/"+req.query.file);
        out.name= req.query.file;
        out.size= stats.size;
        out.extension= path.extname(req.query.file);
        out.success= true;
        
        res.contentType('json');
        return res.json(out);
    })
    
    app.get('/media', function(req, res){
        //res.sendfile(config.uploadDir+"/"+req.query.file);        
    })
    
    app.post('/file-delete', function(req, res){
        var out={},
            file= config.uploadDir+"/"+req.body.file;
        if (req.body.file) {
            if (fs.existsSync(file)) {
                fs.unlinkSync(file);
                out.success= true;
                out.stat_message= "File Deleted";
            }else{
                out.success= false;
                out.stat_message= "File Not Found";
            }
        }
        else{
            out.success= false;
            out.stat_message= "No file received"; 
        }        
        res.contentType('json');
        return res.json(out);
    })
    
    app.get('/file-rename', function(req, res){
        var out={},
            oldpath= config.uploadDir+"/"+req.query.oldname,
            newpath= config.uploadDir+"/"+req.query.newname;
        if (req.query) {
            if (fs.existsSync(oldpath)) {
                fs.renameSync(oldpath, newpath)
                out.success= true;
                out.stat_message= "File Renamed";
            }else{
                out.success= false;
                out.stat_message= "File Not Found";
            }
        }
        else{
            out.success= false;
            out.stat_message= "No file received"; 
        }        
        res.contentType('json');
        return res.json(out);
    })
    
    app.post('/file-playlist', function(req, res){
        fs.writeFile(config.root+"/"+playlistfile, JSON.stringify(req.param('playlist'), null, 4),
            function(err) {
                if(err) {
                    console.log(err);
                } else {
                    console.log("The file was saved!");
                }
            });
    })
    app.post('/playall',function(req,res){
        if (req.param('pressed')== 'play') {
                var jsonout={};
                jsonout = fs.readFileSync('./_playlist.json','utf8');
                var entry = JSON.parse(jsonout);
                var photo = 'stopped';
                var video = 'stopped';
                var i=0;
                console.log(path.extname(entry[i].filename));
                playloop(i);
                function playloop(i) {
                //check imag or video        
                   if(1){
                        console.log('display image');
                        exec('sudo fbi -T 1  media/'+entry[i].filename,function(stderr,stdout,stdin){
                                            console.log(" stderr" + stderr);
                                            console.log("stdout "+ stdout);
                                            console.log("stdin "+ stdin);
                            });
                        photo = 'playing'; 
                        setInterval(function(){
                                        exec('MACHINE=`pidof fbi`;echo `sudo kill $MACHINE`;');
                                        (i < entry.length-1)? i++ : i=0;
                                        console.log('setinterval loop');
                                        playloop(i);
                            }, 10000)
                    }else{
                        omx.play('./media/'+entry[i].filename , { audioOutput : 'hdmi'});
                        video = 'playing';
                        console.log('play video');
                        omx.on('stop',function(){
                            (i < entry.length-1)? i++ : i=0;
                            video = 'stopped';
                            playloop(i);
                            })
                        } 
                }
        }else if (req.param('pressed')== 'pause') {
                (photo == 'playing')? exec('MACHINE=`pidof fbi`;echo `sudo kill $MACHINE`;') : console.log('stoped');
                (video == 'playing')? omx.stop() : console.log('video stopped') ;   
        }
        
        
        
    })
    
}

    
