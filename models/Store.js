var AWS = require('aws-sdk');
var config = new AWS.Config();
config.loadFromPath('./awscredentials.json');
AWS.config.dynamodb = config;
var marshalItem = require('dynamodb-marshaler').marshalItem;
var unmarshalItem = require('dynamodb-marshaler').unmarshalItem;

var client = exports.client = new AWS.DynamoDB();

exports.query = config => {
	return new Promise(function(resolve, reject){
		var results = [];

		var doWork = startKey => {			
			if(startKey){
				config.ExclusiveStartKey = startKey;
			}

			client.query(config, function(err, data){
				if(err) {
					console.log(err)
					reject(err)
				}
				else{
					if(data.Items){
						data.Items.forEach(function(x){ results.push(unmarshalItem(x)) });
					}
					if(data.LastEvaluatedKey){
						doWork(data.LastEvaluatedKey);
					} else {
						if(results && results.length > 0){
							resolve(results)
						} else{
							resolve(null)
						}
					}
				}
			});
		}

		doWork(null);
	});
}

exports.scan = config => {
	return new Promise(function(resolve, reject){
		var results = [];

		var doWork = startKey => {			
			if(startKey){
				config.ExclusiveStartKey = startKey;
			}

			client.scan(config, function(err, data){
				if(err) {
					console.log(err)
					reject(err)
				}
				else{
					if(data.Items){
						data.Items.forEach(function(x){ results.push(unmarshalItem(x)) });
					}
					if(data.LastEvaluatedKey){
						doWork(data.LastEvaluatedKey);
					} else {
						if(results && results.length > 0){
							resolve(results)
						} else{
							resolve(null)
						}
					}
				}
			});
		}

		doWork(null);
	});
}