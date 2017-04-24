var mongoose = require('mongoose');
var teamSchema = new mongoose.Schema({
	'name': String,
	'id' : String,
	'token' : String
})
module.exports = mongoose.model('team', teamSchema);