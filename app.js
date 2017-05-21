const express = require('express');
const bodyparser = require('body-parser');
const app = express();
const request = require('request');
const team = require('./models/teams');
const User = require('./models/user');
const Traits = require('./models/traits');
const mongoose = require('mongoose');
mongoose.Promise = global.Promise;
const URL = process.env.DATABASEURL || 'mongodb://localhost/analyzedb2';
mongoose.connect(URL);

app.use(bodyparser.json());
app.use(bodyparser.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use(express.static(__dirname + "/public"));

/* Watson IBM Personality-Insights */
const PersonalityInsightsV3 = require('watson-developer-cloud/personality-insights/v3');

var personality_insights = new PersonalityInsightsV3({
  username: process.env.PERSONALITY_USERNAME,
  password: process.env.PERSONALITY_PASSWORD,
  version_date: '2016-10-19'
});

var PORT = process.env.PORT || 80;
const server = app.listen(PORT);

app.get('/auth', (req, res) => {
  var data = {form: {
      client_id : process.env.client_id,
      client_secret : process.env.client_secret,
      code : req.query.code
  }}
  console.log(data);
  request.post('https://slack.com/api/oauth.access', data, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var token = JSON.parse(body).access_token;
        request.post('https://slack.com/api/team.info', {form : {token : token}}, function(error, response, body) {
          console.log(JSON.parse(body));
          if (!error && response.statusCode == 200) {
            var teamid = JSON.parse(body).team.id;
            var teamname = JSON.parse(body).team.name;
            team.find({name : teamname, id : teamid}, function(error, foundteam) {
              if (foundteam.length > 0 && foundteam) {
                return res.send('Someone else already added the bot.');
              }
              team.create({'name' : teamname, id : teamid, token : token}, function(error, newteam) {
                res.send('MatchBot has been added to your team.');
                //this would be where redirect to splash page
              })
            })
          }
        });
      }
  })
});

//redirects to landing page
app.get("/", function(req, res){
    res.render("matchland");
});

app.post('/', (req, res) => {
  if (!req.body.token) {
   return res.send("Not authorized!");
  }
  var channelid = req.body.channel_id;
  team.find({id : req.body.team_id}, function(error, foundteam) {
    // console.log(foundteam);
    var token = foundteam[0].token;
    request.post('https://slack.com/api/channels.history', {form: {token : token, channel : channelid, count: 500}}, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        // console.log(JSON.parse(body));
        var messages = JSON.parse(body).messages;
        //console.log("messages: " + messages);
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

app.post('/match', (req, res) => {
  Traits.find({teamid: req.body.team_id}).exec()
  .then(function(traitsobj) {
    //console.log("traits obj: " + traitsobj);
    var username = req.body.user_name;
    var match, match1, match2, current, difference, fullobj;
    var openarr = traitsobj[0].Openness,
    conscarr = traitsobj[0].Conscientiousness,
    extraarr = traitsobj[0].Extraversion,
    agreearr = traitsobj[0].Agreeableness,
    emotarr = traitsobj[0]['Emotional range'];

    function isolate(arr, user) {
      for (var i = 0; i < arr.length; i++) {
        if (arr[i]['username'] === user) {
          //this is current user's trait %
          var num = arr[i]['trait'];
          //this is rest of that trait's array after user removed
          //console.log(arr);
          arr.splice(i, 1);
          //console.log(arr);
          smallestDifference(num, arr);
        }
      }
    }
    
    function smallestDifference(num, arr) {
      current = arr[0]['trait'];
      difference = Math.abs (num - current);
      for (var i = 0; i < arr.length; i++) {
        var newdifference = Math.abs (num - arr[i]['trait']);
        if (newdifference < difference) {
          difference = newdifference;
          current = arr[i]['trait'];
        }
      }
      //console.log("current: " + current);
      return current;
    }
    
    //get obj of user with smallest diff
    function fullobj(arr, current) {
      var returned = arr.filter(function(obj) {
          return obj.trait === current;
        });
      match = returned[0]['username'];
      return match;
    }
    
    var opendiff, opendiff2, conscdiff, conscdiff2, extradiff, extradiff2, agreediff, agreediff2, emotdiff, emotdiff2, user1, user1b, user2, user2b, user3, user3b, user4, user4b, user5, user5b, openbest, conscbest, extrabest, agreebest, emotbest, openbest2, conscbest2, extrabest2, agreebest2, emotbest2;

    /* calling isolate/smallestDifference functs for each traits arr and
    creating var for each current user with smallest diff from each traits array 
    in prep for determining overall smallest diff and assoc user */
    function findMatchOne() {
      username = req.body.user_name;
      console.log(username);
      isolate(openarr, username);
      opendiff = difference;
      user1 = current;
      openbest = fullobj(openarr, user1);

      isolate(conscarr, username);
      conscdiff = difference;
      user2 = current;
      conscbest = fullobj(conscarr, user2);

      isolate(extraarr, username);
      extradiff = difference;
      user3 = current;
      extrabest = fullobj(extraarr, user3);

      isolate(agreearr, username);
      agreediff = difference;
      user4 = current;
      agreebest = fullobj(agreearr, user4);

      isolate(emotarr, username);
      emotdiff = difference;
      user5 = current;
      emotbest = fullobj(emotarr, user5);
    }
      //get second best match
    function findMatchTwo() {
      isolate(openarr, match1);
      opendiff2 = difference;
      user1b = current;
      openbest2 = fullobj(openarr, user1b);

      isolate(conscarr, match1);
      conscdiff2 = difference;
      user2b = current;
      conscbest2 = fullobj(conscarr, user2b);

      isolate(extraarr, match1);
      extradiff2 = difference;
      user3b = current;
      extrabest2 = fullobj(extraarr, user3b);

      isolate(agreearr, match1);
      agreediff2 = difference;
      user4b = current;
      agreebest2 = fullobj(agreearr, user4b);

      isolate(emotarr, match1);
      emotdiff2 = difference;
      user5b = current;
      emotbest2 = fullobj(emotarr, user5b);
    }

    findMatchOne();

    var smallestdiff = Math.min(opendiff, conscdiff, extradiff, agreediff, emotdiff);

    if (opendiff === smallestdiff) {
      match1 = openbest;
      console.log(match1);
    } else if (conscdiff === smallestdiff) {
      match1 = conscbest;
      console.log(match1);
    } else if (extradiff === smallestdiff) {
      match1 = extrabest;
      console.log(match1);
    } else if (agreediff === smallestdiff) {
      match1 = agreebest;
      console.log(match1);
    } else if (emotdiff === smallestdiff) {
      match1 = emotbest;
      console.log(match1);
    }

    findMatchTwo();
    //console.log(openbest2, conscbest2, extrabest2, agreebest2, emotbest2);

    var smallestdiff2 = Math.min(opendiff2, conscdiff2, extradiff2, agreediff2, emotdiff2);

    if (opendiff2 === smallestdiff2) {
      //fullobj(openarr, user1b);
      match2 = openbest2;
      //console.log("open" + match2);
    } else if (conscdiff2 === smallestdiff2) {
      //fullobj(conscarr, user2b);
      match2 = conscbest2;
      //console.log("consc" + match2);
    } else if (extradiff2 === smallestdiff2) {
      //fullobj(extraarr, user3b);
      match2 = extrabest2;
      //console.log("extra" + match2);
    } else if (agreediff2 === smallestdiff2) {
      //fullobj(agreearr, user4b);
      match2 = agreebest2;
      //console.log("agree" + match2);
    } else if (emotdiff2 === smallestdiff2) {
      //fullobj(emotarr, user5b);
      match2 = emotbest2;
      //console.log("emot" + match2);
    }

  res.json({
            "response_type": "in_channel",
            "text": "Your best match is @" + match1 + "\nand your second best match is @" + match2 + "! \nGo say hello!"
          });
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
        res.send("You haven't submitted enough messages to this channel for analysis. Minimum requirement is 100 words. You're almost there; try being more communicative today?");
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
      
      console.log("this team exists.");
      var isPresent = false,
      pushed = { Openness: {trait: user.personality.Openness, username: user.username},
                 Conscientiousness: {trait: user.personality.Conscientiousness, username: user.username},
                 Extraversion: {trait: user.personality.Extraversion, username: user.username},
                 Agreeableness: {trait: user.personality.Agreeableness, username: user.username},
                 'Emotional range': {trait: user.personality['Emotional range'], username: user.username}
               };

      var openarr = traitsobj[0].Openness,
      conscarr = traitsobj[0].Conscientiousness,
      extraarr = traitsobj[0].Extraversion,
      agreearr = traitsobj[0].Agreeableness,
      emotarr = traitsobj[0]['Emotional range'];

      var filteredopenness = openarr.filter(function(objs) {
        if (objs.username === user.username) {
          isPresent = true;
        }
      });
      
      if (isPresent) {
        console.log("user has already been added. removing from and then re-adding user to arrs. this is probably not the most efficient way, but it's the way i'm doing it now.");
        var removeRepeatUser = function(arr, prop, value) {
          var i = arr.length;
          while (i--) {
            if (arr[i] && arr[i].hasOwnProperty(prop) && (arguments.length > 2 && arr[i][prop] === value)) {
              arr.splice(i, 1);
            }
          }
          return arr;
        }
        var filteredObj = {
          teamid: user.teamid,
          Openness: removeRepeatUser(openarr, 'username', user.username),
          Conscientiousness: removeRepeatUser(conscarr, 'username', user.username),
          Extraversion: removeRepeatUser(extraarr, 'username', user.username),
          Agreeableness: removeRepeatUser(agreearr, 'username', user.username),
          'Emotional range': removeRepeatUser(emotarr, 'username', user.username)
        }
        
        Traits.findByIdAndUpdate(traitsobj[0]._id, filteredObj).exec()
        Traits.findByIdAndUpdate(traitsobj[0]._id, {$push: pushed},{new: true}).exec()
      //team does not yet exist
      } else {
        console.log("user isnt yet entered, but team exists. pushing user to each arr now.");
        Traits.findByIdAndUpdate(traitsobj[0]._id, {$push: pushed}, {new: true}).exec()
      }
      
    } else {
      console.log("this team didnt exist, but it will now.");
      
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
        console.log('traits arrs were created for this team.');
      })
    }
  })
}
//NO LONGER NEED THIS FUNCTION
/*function sortTraits(user) {
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
    //arrays for each trait
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
    var sortedarrs = {
      teamid: user.teamid,
      Openness: sorted1,
      Conscientiousness: sorted2,
      Extraversion: sorted3,
      Agreeableness: sorted4,
      'Emotional range': sorted5
    };
    Traits.findByIdAndUpdate(traitsobj[0]._id, sortedarrs).exec()
  })
}*/