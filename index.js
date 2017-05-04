const express = require('express');
const bodyparser = require('body-parser');
const app = express();
app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));
const request = require('request');
const team = require('./models/teams');
const User = require('./models/user');
const Traits = require('./models/traits');
const mongoose = require('mongoose');
// app.use(express.static(__dirname));
mongoose.Promise = global.Promise;
var URL = process.env.databaseurl || 'mongodb://localhost/analyzedb2';
mongoose.connect(URL);

//BUILD HTML DOCUMENT
function buildHtml(data){
  return '<!DOCTYPE html>'
       + '<html><p>' + data + '</p></html>';
}
var fs = require('fs');


/* Watson */
const PersonalityInsightsV3 = require('watson-developer-cloud/personality-insights/v3');
const DiscoveryV1 = require('watson-developer-cloud/discovery/v1');

function makeandsend(text){
  var fileName = 'bobno3.html';
  var stream = fs.createWriteStream(fileName);

  stream.once('open', function(fd) {
    var html = text;
    stream.end(html);
    var file = fs.readFileSync('bobno3.html');
    sendfile(file);
  });

  // console.log(file);
  // var file = '<h1>bob loblaw</h1>';
  
}
// makeandsend();

/*var watson = require('watson-developer-cloud');

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
}*/

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
        //console.log(token);
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
    // console.log(foundteam);
    var token = foundteam[0].token;
    request.post('https://slack.com/api/channels.history', {form: {token : token, channel : channelid, count: 500}}, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        // console.log(JSON.parse(body));
        var messages = JSON.parse(body).messages;
        // console.log(messages);
        var filtered = messages.filter(function(el){
          return el.user === req.body.user_id;
        }).map(function(element){
          return element.text;
        }).join(" ");
        var regex = /<.*?>/g;
        var final = filtered.replace(regex, "");
        // var filetext = buildHtml(final);
        // makeandsend(filetext);
        var user = {};
        user.username = req.body.user_name;
        user.userid = req.body.user_id;
        user.teamid = req.body.team_id;
        getinsights(final, res, user);
      }
    })
  });
});

function getinsights(message, res, user){
  personality_insights.profile({
    text: message,
    consumption_preferences: true
    },
    function (err, response) {
      if (err){
        console.log('error:', err);
        res.send("error happened");
      } else {
        // console.log(JSON.stringify(response, null, 2));
        var personality = response.personality.map(function(el){
          return {name: el.name, percentile: el.percentile};
        })
        var finalpersonality = {};
        for(var i = 0; i < personality.length ; i ++){
          finalpersonality[personality[i].name] = personality[i].percentile;
        }
        user.personality = finalpersonality;
        createLists(user);
        //console.log(user);
        User.find({teamid: user.teamid, userid: user.userid}).exec()
        .then(function(founduser) {
          //console.log("This is the founduser" + founduser[0]);
          if (founduser.length > 0) {
            User.findByIdAndUpdate(founduser[0]._id, {personality: finalpersonality}, {new: true}).exec()
            .then(function(updateduser) {
              //console.log("This is the updated user" + updateduser);
              res.json({text: 'Success! Your messages have been analyzed and your results are stored!'});
            })
          } else {
            User.create(user, function(error, createduser) {
              //console.log("This is the createduser" + createduser);
              res.send('User created!!');
            })
          }
        })
      }
  });
}
//Creates Traits, ensures user isnt added to each array more than once
function createLists(user) {
  Traits.find({
    teamid: user.teamid
  }).exec().then(function(traitsobj) {
    //console.log("this is the traits object: " + traitsobj);
    if (traitsobj.length > 0) {
      console.log("this team exists");
      var isinthere = false,
        pushed = {
          Openness: {
            trait: user.personality.Openness,
            username: user.username
          },
          Conscientiousness: {
            trait: user.personality.Conscientiousness,
            username: user.username
          },
          Extraversion: {
            trait: user.personality.Extraversion,
            username: user.username
          },
          Agreeableness: {
            trait: user.personality.Agreeableness,
            username: user.username
          },
          'Emotional range': {
            trait: user.personality['Emotional range'],
            username: user.username
          }
        };
      var openarr = traitsobj[0].Openness,
        conscarr = traitsobj[0].Conscientiousness,
        extraarr = traitsobj[0].Extraversion,
        agreearr = traitsobj[0].Agreeableness,
        emotarr = traitsobj[0]['Emotional range'];
      var filteredopenness = openarr.filter(function(objs) {
        if (objs.username === user.username) {
          isinthere = true;
        }
      });
      if (isinthere) {
        console.log("user is already in there. removing user from arrs, then pushing new userinfo !!!e*(Y**&");
        var removeByAttr = function(arr, attr, value) {
          var i = arr.length;
          while (i--) {
            if (arr[i] && arr[i].hasOwnProperty(attr) && (arguments.length > 2 && arr[i][attr] === value)) {
              arr.splice(i, 1);
            }
          }
          return arr;
        }
        var filteredObj = {
            teamid: user.teamid,
            Openness: removeByAttr(openarr, 'username', user.username),
            Conscientiousness: removeByAttr(conscarr, 'username', user.username),
            Extraversion: removeByAttr(extraarr, 'username', user.username),
            Agreeableness: removeByAttr(agreearr, 'username', user.username),
            'Emotional range': removeByAttr(emotarr, 'username', user.username)
          }
        Traits.findByIdAndUpdate(traitsobj[0]._id, filteredObj).exec()
        Traits.findByIdAndUpdate(traitsobj[0]._id, {
          $push: pushed
        }, {
          $sort: trait: 1
        },{
          new: true
        }).exec()
      } else {
        console.log("user isnt in there, but team does exist. pushing user objs to each arr ,omg!!");
        Traits.findByIdAndUpdate(traitsobj[0]._id, {
          $push: pushed
        }, {
          $sort: trait: 1
        }, {
          new: true
        }).exec()
      }
      //team does not yet exist
    } else {
      console.log("this team didnt exist");
      var traits = {};
      traits.teamid = user.teamid;
      traits.Openness = [{
        trait: user.personality.Openness,
        username: user.username
      }];
      traits.Conscientiousness = [{
        trait: user.personality.Conscientiousness,
        username: user.username
      }];
      traits.Extraversion = [{
        trait: user.personality.Extraversion,
        username: user.username
      }];
      traits.Agreeableness = [{
        trait: user.personality.Agreeableness,
        username: user.username
      }];
      traits['Emotional range'] = [{
        trait: user.personality['Emotional range'],
        username: user.username
      }];
      Traits.create(traits, function(error, createdtraits) {
        //res.send('Traits created!!');
        console.log('traits created');
      })
    }
  })
}

app.post('/match', (req, res) => {
  //sort each traits array by percentage
  //find user's closest match in each trait
  //determine smallest difference
  //send message informing user of their best match
});

var personality_insights = new PersonalityInsightsV3({
  username: process.env.PERSONALITY_USERNAME,
  password: process.env.PERSONALITY_PASSWORD,
  version_date: '2016-10-19'
});

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