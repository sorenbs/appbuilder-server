var store = require('./Store.js')
var marshalItem = require('dynamodb-marshaler').marshalItem;
var unmarshalItem = require('dynamodb-marshaler').unmarshalItem;
var cuid = require('cuid');

const save = exports.save = function(item) {
	if(!item.id || item.id == "" || !item.modelAndProperty || item.modelAndProperty == "") {
		return Promise.reject('Please use the create method to create an index entry')
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
		    TableName: 'index',
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

exports.create = (model, fromId, propertyName, toModel, toIdInput) => {
	const id = `${model}:${fromId}:${propertyName}`
	const modelAndProperty = `${model}:${propertyName}`
	const toId = `${toModel}:${toIdInput}`

	return save({id, toId, modelAndProperty})
}

exports.findManyByModelAndPropertyName = function(model, propertyName){
	const id = `${model}:${propertyName}`

	return store.query({
		TableName: 'index',
		IndexName: 'modelAndProperty-toId-index',
		KeyConditionExpression: "modelAndProperty = :id",
	    ExpressionAttributeValues: {
	        ":modelAndProperty": {"S": id}
	    }
	}).then(list => list ? list : []).catch(console.log)
}

exports.findManyByModelAndIdAndPropertyName = function(model, fromId, propertyName){
	const id = `${model}:${fromId}:${propertyName}`

	return store.query({
		TableName: 'index',
		KeyConditionExpression: "id = :id",
	    ExpressionAttributeValues: {
	        ":id": {"S": id}
	    }
	}).then(list => list ? list : []).catch(console.log)
}

exports.findManyByModelAndIdAndPropertyNameAndToId = function(model, fromId, propertyName, toModel, toId){
	const id = `${model}:${fromId}:${propertyName}`
	const toIdWithModel = `${toModel}:${toId}`

	return store.query({
		TableName: 'index',
		KeyConditionExpression: "id = :id AND toId = :toId",
	    ExpressionAttributeValues: {
	        ":id": {"S": id},
	        ":toId": {"S": toIdWithModel}
	    }
	}).then(list => list ? list : []).catch(console.log)
}

exports.listAll = function(config){
	if(!config){
		config = {};
	}
	config.TableName = 'index';
	return store.scan(config)
}

exports.delete = (model, fromId, propertyName, toModel, toIdInput) => {
	const id = `${model}:${fromId}:${propertyName}`
	const toId = `${toModel}:${toIdInput}`
	return new Promise(function(resolve, reject){
		store.client.deleteItem({
			TableName: 'index',
			Key: marshalItem({id: id, toId: toId})
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
		    "TableName": "index",
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