var express = require('express');
var bodyparser = require('body-parser');
var app = express();
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));
var request = require('request');
var team = require('./models/teams');
var mongoose = require('mongoose');
// app.use(express.static(__dirname));
mongoose.Promise = global.Promise;
var URL = process.env.databaseurl || 'mongodb://localhost/analyzedb2';
mongoose.connect(URL);

/* Watson */
var PersonalityInsightsV3 = require('watson-developer-cloud/personality-insights/v3');
var DiscoveryV1 = require('watson-developer-cloud/discovery/v1');

//BUILD HTML DOCUMENT
function buildHtml(data){
  return '<!DOCTYPE html>'
       + '<html><p>Peri is awesome :DDDD :D :P :D</p></html>';
}

function makeandsend(){
  var fileName = 'bobno3.html';
  var stream = fs.createWriteStream(fileName);

  stream.once('open', function(fd) {
    var html = buildHtml();
    stream.end(html);
    var file = fs.readFileSync('bobno3.html');
    sendfile(file);
  });

  
  // console.log(file);
  // var file = '<h1>bob loblaw</h1>';
  
}
makeandsend();

var watson = require('watson-developer-cloud');

function sendfile(htmlfile){
  var discovery = new DiscoveryV1({
    username: process.env.DISCOVERY_USERNAME,
    password: process.env.DISCOVERY_PASSWORD,
    version_date: DiscoveryV1.VERSION_DATE_2016_12_15
  });
  discovery.addDocument({environment_id: '616dbd79-b1cd-401e-954a-1879ac3ab4a7', collection_id: 'e78d49ad-b8e8-4ee8-888f-9f2faafa8de1',file: htmlfile},
  function(error, data) {
    console.log(error);
    console.log(data);
    // console.log(JSON.stringify(data, null, 2));
  });
}


const server = app.listen(80, () => {console.log('Express server listening on port %d in %s mode.', server.address().port, app.settings.env);});

app.get('/auth', (req, res) => {
  var data = {form: {
      client_id : process.env.analyzemeclientid,
      client_secret : process.env.analyzemeclientsecret,
      code : req.query.code
  }}
  request.post('https://slack.com/api/oauth.access', data, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var token = JSON.parse(body).access_token;
        console.log(token);
        request.post('https://slack.com/api/team.info', {form : {token : token}}, function(error, response, body) {
          console.log(JSON.parse(body));
          if (!error && response.statusCode == 200) {
            var teamid = JSON.parse(body).team.id;
            var teamname = JSON.parse(body).team.name;
            team.find({name : teamname, id : teamid}, function(error, foundteam) {
              if (foundteam.length > 0 && foundteam) {
                return res.send('Another already added the bot.');
              }
              team.create({'name' : teamname, id : teamid, token : token}, function(error, newteam) {
                res.send('The bot is now in your team.');
                //this would be where redirect to splash page
              })
            })
          }
        });
      }
  })
});

app.post('/', (req, res) => {
  //let text = req.body.text;

  var channelid = req.body.channel_id;

  team.find({id : req.body.team_id}, function(error, foundteam) {
    console.log(foundteam);
    var token = foundteam[0].token;
    request.post('https://slack.com/api/channels.history', {form: {token : token, channel : channelid}}, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        console.log(JSON.parse(body));
        res.send('team found');
      }
    })
  });

  // let data = {
  //   response_type: 'in_channel', 
  //   text: 'analyzing you . .  . .. . . . . . here are the results..... . . . ..Ssoru',
  //   attachments:[ {
  //     image_url: 'https://s-media-cache-ak0.pinimg.com/originals/3f/98/eb/3f98ebd736fcc1cd1e011690d6a33ca9.jpg'
  //   } ]};

  // res.json(data);

});

var personality_insights = new PersonalityInsightsV3({
  username: process.env.PERSONALITY_USERNAME,
  password: process.env.PERSONALITY_PASSWORD,
  version_date: '2016-10-19'
});



var cohen = `'Suzanne takes you down to her place near the river
You can hear the boats go by, you can spend the night forever
And you know that she's half-crazy but that's why you want to be there
And she feeds you tea and oranges that come all the way from China
And just when you mean to tell her that you have no love to give her
Then he gets you on her wavelength
And she lets the river answer that you've always been her lover
And you want to travel with her, and you want to travel blind
And you know that she will trust you
For you've touched her perfect body with your mind
And Jesus was a sailor when he walked upon the water
And he spent a long time watching from his lonely wooden tower
And when he knew for certain only drowning men could see him
He said all men will be sailors then until the sea shall free them
But he himself was broken, long before the sky would open
Forsaken, almost human, he sank beneath your wisdom like a stone
And you want to travel with him, and you want to travel blind
And you think you maybe you'll trust him
For he's touched your perfect body with her mind
Now, Suzanne takes your hand and she leads you to the river
She's wearing rags and feathers from Salvation Army counters
And the sun pours down like honey on our lady of the harbor
And she shows you where to look among the garbage and the flowers
There are heroes in the seaweed, there are children in the morning
They are leaning out for love and they wil lean that way forever
While Suzanne holds her mirror
And you want to travel with her, and you want to travel blind
And you know that you can trust her
For she's touched your perfect body with her mind'`

// personality_insights.profile({
//   text: cohen,
//   consumption_preferences: true
//   },
//   function (err, response) {
//     if (err)
//       console.log('error:', err);
//     else
//       console.log(JSON.stringify(response, null, 2));
// });

// discovery.query({
//     environment_id: '4a322b12-df72-4977-b297-2be0c39d24cd',
//     collection_id: '<collection_id>',
//     query:
//   }, function(err, response) {
//         if (err) {
//           console.error(err);
//         } else {
//           console.log(JSON.stringify(response, null, 2));
//         }
//    });