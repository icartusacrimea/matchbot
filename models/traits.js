var mongoose = require('mongoose');
var traitsSchema = new mongoose.Schema({
	'teamid': String,
	'Openness': [],
	'Conscientiousness': [],
  'Extraversion': [],
  'Agreeableness': [],
  'Emotional range': []
})
module.exports = mongoose.model('Traits', traitsSchema);
