var store = require('./Store.js')
var marshalItem = require('dynamodb-marshaler').marshalItem;
var unmarshalItem = require('dynamodb-marshaler').unmarshalItem;
var cuid = require('cuid');

exports.save = function(item) {
	if(!item.id || item.id == "") {
		item.id = cuid();
	}
	if(!item.created) {
		item.created = Date.now();
	}
	item.updated = Date.now();
	if(!item.version) {
		item.version = 0;
	}
	item.version = item.version + 1;

	return new Promise(function(resolve, reject){
		store.client.putItem({
		    TableName: 'data',
		    Item: marshalItem(item)
		}, function(err, data){
			if (err) {
				reject(err);
			}
		  	else{
		  		resolve(item);
		  	}
		});	
	});
}

exports.findManyByModelAndId = function(model, id){
	return new Promise(function(resolve, reject){
		store.client.getItem({
			TableName: 'data',
			Key: marshalItem({model: model, id: id})
		}, function(err, data){
			if(err) {
				reject(err)
			}
			else{
				if(!data || !data.Item) {
					resolve(null);
				} else{	
					resolve(unmarshalItem(data.Item))	
				}
			}
		});
	});
}

exports.findManyByModel = function(model){
	return store.query({
		TableName: 'data',
		KeyConditions:
        {
            "model" : 
            {
                "AttributeValueList" : [{ "S" : model }],
                "ComparisonOperator" : "EQ"
            }
        }
	}).then(list => list ? list : []).catch(console.log)
}

exports.listAll = function(config){
	if(!config){
		config = {};
	}
	config.TableName = 'data';
	return store.scan(config)
}

exports.delete = function(model, id){
	return new Promise(function(resolve, reject){
		store.client.deleteItem({
			TableName: 'data',
			Key: marshalItem({model: model, id: id})
		}, function(err, data){
			if(err) {
				console.log(err)
				reject(err)
			}
			else{
				console.log(data)
				resolve(true);
			}
		});
	});
}

exports.setAttribute = function(id, attributeName, value){
	return new Promise(function(resolve, reject){
		store.client.updateItem({
		    "TableName": "data",
		    "Key": {
		        "id": { "S": id }
		    },
		    "UpdateExpression": "SET " + attributeName + " = :val",
		    "ExpressionAttributeValues": marshalItem({":val": value}),
		    "ReturnValues" : "NONE"
		}, function(err, data){
			if(err) {
				console.log(err)
				reject(err)
			}
			else{
				console.log(data)
				resolve(true);
			}
		})
	})
}