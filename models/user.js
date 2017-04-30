var mongoose = require('mongoose');
var userSchema = new mongoose.Schema({
	'username': String,
	'userid' : String,
    'teamid': String,
    'teamname': String,
    'personality': {
        'Openness': Number,
        'Conscientiousness': Number,
        'Extraversion': Number,
        'Agreeableness': Number,
        'Emotional range': Number
    }
})
module.exports = mongoose.model('User', userSchema);