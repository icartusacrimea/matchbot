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

/* Watson IBM Personality-Insights */
const PersonalityInsightsV3 = require('watson-developer-cloud/personality-insights/v3');

var personality_insights = new PersonalityInsightsV3({
  username: process.env.PERSONALITY_USERNAME,
  password: process.env.PERSONALITY_PASSWORD,
  version_date: '2016-10-19'
});

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
        res.send("An error has occurred.");
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
        User.find({teamid: user.teamid, userid: user.userid}).exec()
        .then(function(founduser) {
          //console.log("This is the founduser" + founduser[0]);
          if (founduser.length > 0) {
            User.findByIdAndUpdate(founduser[0]._id, {personality: finalpersonality}, {new: true}).exec()
            .then(function(updateduser) {
              //console.log("This is the updated user" + updateduser);
              res.json({text: 'Your personality traits have been analyzed and the info was added to the database.'});
            })
          } else {
            User.create(user, function(error, createduser) {
              //console.log("This is the createduser" + createduser);
              res.send('You were added to the database!');
            })
          }
        })
      }
  });
}

function createLists(user) {
  Traits.find({teamid: user.teamid}).exec()
  .then(function(traitsobj) {
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
        Traits.findByIdAndUpdate(traitsobj[0]._id, {$push: pushed},{new: true}).exec()
      } else {
        console.log("user isnt in there, but team does exist. pushing user objs to each arr ,omg!!");
        Traits.findByIdAndUpdate(traitsobj[0]._id, {$push: pushed}, {new: true}).exec()
      }
      //sort all traits
      sortTraits(user);
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

function sortTraits(user) {
  Traits.find({teamid: user.teamid}).exec()
  .then(function(traitsobj) {
    console.log("inside sortTraits");
    function sortpushed(a,b) {
      if (a.trait < b.trait) {
        return -1;
      }
      if (a.trait > b.trait) {
        return 1;
      return 0;
      }
    }
    var openarr = traitsobj[0].Openness,
    conscarr = traitsobj[0].Conscientiousness,
    extraarr = traitsobj[0].Extraversion,
    agreearr = traitsobj[0].Agreeableness,
    emotarr = traitsobj[0]['Emotional range'];

    var sorted1 = openarr.sort(sortpushed);
    var sorted2 = conscarr.sort(sortpushed);
    var sorted3 = extraarr.sort(sortpushed);
    var sorted4 = agreearr.sort(sortpushed);
    var sorted5 = emotarr.sort(sortpushed);

    var pushed2 = {
      teamid: user.teamid,
      Openness: sorted1,
      Conscientiousness: sorted2,
      Extraversion: sorted3,
      Agreeableness: sorted4,
      'Emotional range': sorted5
    };
    Traits.findByIdAndUpdate(traitsobj[0]._id, pushed2).exec()
  })
}

/*app.post('/match', (req, res) => {
  //sort each traits array by percentage
  //find user's closest match in each trait
  //determine smallest difference
  //send message informing user of their best match
});*/

