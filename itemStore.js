var graphql = require('graphql').graphql;
var GraphQLSchema = require('graphql').GraphQLSchema;
var GraphQLObjectType = require('graphql').GraphQLObjectType;
var GraphQLInputObjectType = require('graphql').GraphQLInputObjectType;
var GraphQLObject = require('graphql').GraphQLObject;
var GraphQLString = require('graphql').GraphQLString;
var GraphQLInt = require('graphql').GraphQLInt;
var GraphQLBoolean = require('graphql').GraphQLBoolean;
var GraphQLList = require('graphql').GraphQLList;
var GraphQLID = require('graphql').GraphQLID;
var GraphQLInterfaceType = require('graphql').GraphQLInterfaceType;
var _ = require('underscore');
var cuid = require('cuid');
var Data = require('./models/Data');
var Schema = require('./models/Schema');

var getRawSchema = exports.getRawSchema = (appId) => Schema.find(appId);
exports.setRawSchema = (appId, newSchema) => 
	getRawSchema(appId).then(schema => { 
		schema = schema || {id: appId}; 
		schema.schema = newSchema; 
		return Schema.save(schema)
	});

var getUserTypes = exports.getUserTypes = (appId) => {
	return getAllTypes(appId).then(types => types.filter(x => x.name != 'Int' && x.name != 'String' && x.name != 'Boolean'))
}

var getSystemTypes = exports.getSystemTypes = () => {
	return getAllTypes().filter(x =>  x.name == 'Int' || x.name == 'String' || x.name == 'Boolean')
}

var getAllTypes = exports.getAllTypes = (appId) => {
	return getRawSchema(appId).then(schema => JSON.parse(JSON.stringify(schema.schema.filter(x => x.name.indexOf('__') == -1 && x.name != 'RootQueryType'))))
}

var generateTypeObject = (schema, nodeInterface) => {
	var name = schema.name;
	var fields = {};
	schema.fields.forEach(field => {
		var type = field.type.name == 'String' ? GraphQLString : field.type.name == 'Int' ? GraphQLInt : field.type.name == 'Boolean' ? GraphQLBoolean : field.type.name == 'GraphQLID' ? GraphQLID : {isUserType: true, type: field.type}; // user types patched in second pass
		fields[field.name] = {
			type: type,
			resolve: function(x){
				return x[field.name]; // implement relations!
			}
		}
	});
	var interfaces = [ nodeInterface ];

	return new GraphQLObjectType({ name, fields, interfaces});
}

var generateEdgeTypeObject = (schema, type) => {
	var typeObject = new GraphQLObjectType({
		name: schema.name + 'Edge',
		fields: () => ({
			node: {
				type: type,
				resolve: function(root, x){
					return root;
				}
			},
			cursor: {
				type: GraphQLString
			}
		})
	})
	// var name = schema.name;
	// var fields = {};
	// schema.fields.forEach(field => {
	// 	var type = field.type.name == 'String' ? GraphQLString : field.type.name == 'Int' ? GraphQLInt : field.type.name == 'Boolean' ? GraphQLBool : {isUserType: true, type: field.type}; // user types patched in second pass
	// 	fields[field.name] = {
	// 		type: type,
	// 		resolve: function(x){
	// 			return x[field.name]; // implement relations!
	// 		}
	// 	}
	// })

	return typeObject;
}

var generateConnectionTypeObject = (appId, schema, edge, pageInfo) => {
	var typeObject = new GraphQLObjectType({
		name: schema.name + 'Connection',
		fields: () => ({
			pageInfo: {
				type: pageInfo
			},
			edges: {
				type: new GraphQLList(edge),
				resolve: function(root, x){ 
					return root;
				}
			}
		})
	})

	return typeObject;
}

isConnection = key => key.indexOf("Connection") > 0;

var generateRootObject = (appId, userTypes, nodeInterface) => {
	var fields = {};
	var mutationFields = {};
	Object.keys(userTypes).filter(x => x.indexOf('Edge') < 0 && x.indexOf('Connection') < 0).forEach(key => {
		fields[key + "ById"] = {
			type: userTypes[key],
			args: {
	          id: {
	            type: GraphQLID
	          }
	        },
			resolve: (root, x) => { 
				if(isConnection(key)){
					console.log(root, x, key);
					return getItemsByType(appId, userTypes[key.replace("Connection", "")].name)
				} else {
					getItemById(appId, userTypes[key].name, x.id).then(console.log)
					return getItemById(appId, userTypes[key].name, x.id)
				} 
			}
		}
	})

	var viewerFields = {}
	Object.keys(userTypes).filter(x => x.indexOf('Edge') < 0 && x.indexOf('Connection') < 0).forEach(key => {
		fields["all" + key + "s"] = {
			type: userTypes[key + 'Connection'],
			args: {
	          first: {
	            type: GraphQLInt
	          },
	          last: {
	            type: GraphQLInt
	          },
	        },
			resolve: (root, x) => { 
				console.log(root,x)
				return getItemsByType(appId, key).then(items => {console.log(items); return x.first ? _.take(items, x.first) : items})
			}
		}
	})

	// var viewerType = new GraphQLObjectType({
	//     name: 'Viewer',
	//     fields: viewerFields
	//   })

	// fields["viewer"] = {
	// 	type: viewerType
	// };



	
		

	Object.keys(userTypes).filter(x => x.indexOf('Edge') < 0 && x.indexOf('Connection') < 0).forEach(key => {
		
		 //console.log("KEY: ", userTypes[key])
		var args = {};
		Object.keys(userTypes[key]._typeConfig.fields).forEach(fieldName => {
			var field = userTypes[key]._typeConfig.fields[fieldName]
			var type = field.type.name == 'String' ? GraphQLString : field.type.name == 'Int' ? GraphQLInt : field.type.name == 'Boolean' ? GraphQLBoolean : field.type.name == 'ID' ? GraphQLID : null;
			
			if(type){
				args[fieldName] = { type: type };
			}
		})

		args.clientMutationId = {type: GraphQLString};

		var mutationPayloadType = new GraphQLObjectType({
			name: '_' + key + 'Payload',
			fields: () => {
				var fields = {
					clientMutationId: {
						type: GraphQLString,
						resolve: function(root, x){
							console.log(root)
							return root.clientMutationId;
						}
					},
					id: {
						type: GraphQLID,
						resolve: function(root, x){
							return root.id;
						}
					}
				};
				fields['changed' + key] = {
					type: userTypes[key],
					resolve: function(root, x){
						return root['changed' + key];
					}
				}
				return fields; 
			}
		})

		mutationFields['create' + key] = {
			type: mutationPayloadType,
			args: args,
			resolve: (root, x) => { 

				return createItem(appId, key, x).then(x => {
					payload = {
						id: x.id,
						clientMutationId: x.clientMutationId,
						viewer: null,
					}

					payload['changed' + key] = x;
					payload['changed' + key + "Edge"] = null;

					return payload;
				})
			}
		}

		mutationFields['update' + key] = {
			type: mutationPayloadType,
			args: args,
			resolve: (root, x) => { 

				return getItemById(appId, key, x.id).then(oldItem => {
					if(!oldItem){
						return "Wrong ID!!!"
					}

					Object.keys(x).forEach(property => {
						if(property != "clientMutationId"){
							oldItem[property] = x[property]
						}
					})

					return updateItem(oldItem).then(oldItem => {
						payload = {
							id: x.id,
							clientMutationId: x.clientMutationId,
							viewer: null,
						}

						payload['changed' + key] = oldItem;
						payload['changed' + key + "Edge"] = null;

						return payload;
					}).catch(console.log)
				}).catch(console.log)
			}
		}

		mutationFields['replace' + key] = {
			type: mutationPayloadType,
			args: args,
			resolve: (root, x) => { 

				return getItemById(appId, key, x.id).then(oldItem => {

					if(!oldItem){
						return "Wrong ID!!!"
					}

					var newItem = { id: oldItem.id, model: oldItem.model};

					Object.keys(x).forEach(property => {
						if(property != "clientMutationId" && property != "clientMutationId"){
							newItem[property] = x[property]
						}
					})

					return updateItem(newItem).then(newItem => {

						payload = {
							id: x.id,
							clientMutationId: x.clientMutationId,
							viewer: null,
						}

						payload['changed' + key] = newItem;
						payload['changed' + key + "Edge"] = null;

						return payload;
					}).catch(console.log)
				}).catch(console.log)
			}
		}

		mutationFields['delete' + key] = {
			type: mutationPayloadType,
			args: args,
			resolve: (root, x) => { 

				return getItemById(appId, key, x.id).then(oldItem => {

					if(!oldItem){
						return "Wrong ID!!!"
					}

					return deleteItem(appId, key, x.id).then(() => {
						payload = {
							id: x.id,
							clientMutationId: x.clientMutationId,
							viewer: null,
						}

						payload['changed' + key] = oldItem;
						payload['changed' + key + "Edge"] = null;

						return payload;
					}).catch(console.log)
				}).catch(console.log)
			}
		}
	})
	
	fields.node = {
		name: 'Node',
		type: nodeInterface,
		args: {
          id: {
            type: GraphQLID
          }
        },
		resolve: function(root, x){
			console.log(x.id.split(':')[0], x.id.split(':')[1])
			return getItemById(appId, x.id.split(':')[0], x.id.split(':')[1])
		},
		interfaces: [ nodeInterface ]
	}

	fields.changeSchemaObject = {
		name: "changeSchemaObject",
		type: GraphQLString,
		args: {
			name: { type: GraphQLString},
			schema: { type: GraphQLString},
		},
		resolve: function(root, x){
			console.log("changeSchemaObject", root, x);
		}
	}


	return new GraphQLSchema({
	  query: new GraphQLObjectType({
	    name: 'RootQueryType',
	    fields: fields
	  }),
	  mutation: new GraphQLObjectType({
	    name: 'RootMutationType',
	    fields: mutationFields
	  })
	});
}

var generateSchema = exports.generateSchema = (appId) => {
	return getUserTypes(appId).then(userTypesFromSchema => {

		var userTypes = {};
		var pageInfo = new GraphQLObjectType({
			name: 'PageInfo',
			fields: () => ({
				hasNextPage: {
					type: GraphQLBoolean,
					resolve: function(root, x){
						return true;
					}
				},
				hasPreviousPage: {
					type: GraphQLBoolean
				}
			})
		});
		var nodeInterface = new GraphQLInterfaceType({
			name: 'NodeInterface',
			fields: () => ({
				id: {
					type: GraphQLID
				}
			}),
			resolveType: function(node){
				console.log("resolve type: ", node)
				return userTypes[node.type.split(':')[1]];
			}
		})
		userTypesFromSchema.forEach(x => {
			var type = userTypes[x.name] = generateTypeObject(x, nodeInterface);
			var edge = userTypes[x.name + 'Edge'] = generateEdgeTypeObject(x, type);
			var connection = userTypes[x.name + 'Connection'] = generateConnectionTypeObject(appId, x, edge, pageInfo);
		})

		Object.keys(userTypes).forEach(key => {
			var type = userTypes[key];
			Object.keys(type['_typeConfig'].fields).forEach(key => {
				var field = type['_typeConfig'].fields[key];
				if(field.type.isUserType){
					if(field.type.type.name) { // one-one relationship
						var typeName = field.type.type.name;
						field.type = userTypes[typeName]
						field.resolve = function(x){ return ItemStore.getItemById(appId, x[key].type, x[key].id) }
					}else if(field.type.type.kind == 'LIST') { //one-many relationship
						var typeName = field.type.type.ofType.name;
						field.type = userTypes[typeName + 'Connection']
						field.args = {first: {type: GraphQLInt}}
						field.resolve = function(x){ console.log("RESOLVE", lowercaseFirstLetter(type.name) + "Id"); return getItemsByType(appId, typeName).then(listItems => listItems.filter(listItem => listItem[lowercaseFirstLetter(type.name) + "Id"] == x.id)) }
					}
				}
				//console.log(field)
			})
		})

		return generateRootObject(appId, userTypes, nodeInterface)
	}).catch(console.log);
}

function lowercaseFirstLetter(string) {
    return string.charAt(0).toLowerCase() + string.slice(1);
}

var getItemById = exports.getItemById = function(appId, type, id) {
	return Data.findManyByModelAndId(appId + ':' + type, id).catch(console.log)
}

var getItemsByType = exports.getItemsByType = function(appId, type) {
	return Data.findManyByModel(appId + ':' + type).catch(console.log)
}

var createItem = function(appId, type, item) {
	item.model = appId + ":" + type;
	return Data.save(item).catch(console.log)
}

var updateItem = function(item) {
	if(!item.model || !item.id){
		return Promise.reject("model and id must be present. Did you intend to create a new item?")
	}

	return Data.save(item).catch(console.log)
}

var deleteItem = function(appId, type, id) {
	return Data.delete(appId + ":" + type, id).catch(console.log)
}