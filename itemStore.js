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

var items = [{
		type: 'testApp1:Dansker',
		id: '1',
		greeting: "Dav, du!",
		age: 17,
		biler: [{type: 'Bil', id: '1'},{type: 'Bil', id: '2'}]
	},
	{
		type: 'testApp1:Bil',
		id: '1',
		farve: 'Sort'
	},
	{
		type: 'testApp1:Bil',
		id: '2',
		farve: 'Hvid'
	}]

var rootSchema = [{"name":"Dansker","kind":"OBJECT","fields":[ {"name":"id","type":{"name":"GraphQLID","kind":"SCALAR","ofType":null}}, {"name":"greeting","type":{"name":"String","kind":"SCALAR","ofType":null}},{"name":"age","type":{"name":"Int","kind":"SCALAR","ofType":null}},{"name":"biler","type":{"name":null,"kind":"LIST","ofType":{"name":"Bil","kind":"OBJECT"}}}]},{"name":"Bil","kind":"OBJECT","fields":[ {"name":"id","type":{"name":"GraphQLID","kind":"SCALAR","ofType":null}}, {"name":"farve","type":{"name":"String","kind":"SCALAR","ofType":null}}]}]

var getUserTypes = exports.getUserTypes = () => {
	return getAllTypes().filter(x => x.name != 'Int' && x.name != 'String' && x.name != 'Boolean')	
}

var getSystemTypes = exports.getSystemTypes = () => {
	return getAllTypes().filter(x =>  x.name == 'Int' || x.name == 'String' || x.name == 'Boolean')
}

var getAllTypes = exports.getAllTypes = () => {
	return JSON.parse(JSON.stringify(rootSchema.filter(x => x.name.indexOf('__') == -1 && x.name != 'RootQueryType')))
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

var generateConnectionTypeObject = (schema, edge, pageInfo) => {
	var typeObject = new GraphQLObjectType({
		name: schema.name + 'Connection',
		fields: () => ({
			pageInfo: {
				type: pageInfo
			},
			edges: {
				type: new GraphQLList(edge),
				resolve: function(root, x){ 
					var a = (x.first ? _.take(root, x.first) : root).map(item => getItemById(item.type.split(":").reverse()[0], item.id)); return a
				}
			}
		})
	})

	return typeObject;
}

isConnection = key => key.indexOf("Connection") > 0;

var generateRootObject = (userTypes, nodeInterface) => {
	var fields = {};
	var mutationFields = {};
	Object.keys(userTypes).forEach(key => {
		fields[key] = {
			type: userTypes[key],
			args: {
	          id: {
	            type: GraphQLID
	          }
	        },
			resolve: (root, x) => { 
				if(isConnection(key)){
					console.log(root, x, key);
					return getItemsByType(userTypes[key.replace("Connection", "")].name)
				} else {
					return getItemById(userTypes[key].name, x.id)
				} 
			}
		}
	})



	
		

	Object.keys(userTypes).filter(x => x.indexOf('Edge') < 0 && x.indexOf('Connection') < 0).forEach(key => {
		
		 //console.log("KEY: ", userTypes[key])
		var args = {};
		Object.keys(userTypes[key]._typeConfig.fields).forEach(fieldName => {
			var field = userTypes[key]._typeConfig.fields[fieldName]
			var type = field.type.name == 'String' ? GraphQLString : field.type.name == 'Int' ? GraphQLInt : field.type.name == 'Boolean' ? GraphQLBoolean : field.type.name == 'GraphQLID' ? GraphQLID : null;
			
			if(type){
				args[fieldName] = { type: type };
			}
		})

		console.log("ARGS: ", args)


		mutationFields['create' + key] = {
			type: userTypes[key],
			args: args,
			resolve: (root, x) => { 
				console.log("mutation:")
				console.log(x)

				x.type = 'testApp1:' + key;
				x.id = cuid();
				items.push(x)
				
				// if(isConnection(key)){
				// 	console.log(root, x, key);
				// 	return getItemsByType(userTypes[key.replace("Connection", "")].name)
				// } else {
				// 	return getItemById(userTypes[key].name, x.id)
				// } 
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
			return getItemById(x.id.split(':')[0], x.id.split(':')[1])
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

var generateSchema = exports.generateSchema = () => {
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
	getUserTypes().forEach(x => {
		var type = userTypes[x.name] = generateTypeObject(x, nodeInterface);
		var edge = userTypes[x.name + 'Edge'] = generateEdgeTypeObject(x, type);
		var connection = userTypes[x.name + 'Connection'] = generateConnectionTypeObject(x, edge, pageInfo);
	})

	Object.keys(userTypes).forEach(key => {
		var type = userTypes[key];
		Object.keys(type['_typeConfig'].fields).forEach(key => {
			var field = type['_typeConfig'].fields[key];
			if(field.type.isUserType){
				if(field.type.type.name) { // one-one relationship
					var typeName = field.type.type.name;
					field.type = userTypes[typeName]
					field.resolve = function(x){ return ItemStore.getItemById(x[key].type, x[key].id) }
				}else if(field.type.type.kind == 'LIST') { //one-many relationship
					var typeName = field.type.type.ofType.name;
					field.type = userTypes[typeName + 'Connection']
					field.args = {first: {type: GraphQLInt}}
				}
			}
			//console.log(field)
		})
	})

	return generateRootObject(userTypes, nodeInterface)
}
//generateSchema()
//console.log(generateSchema());

exports.getAllItemsByType = function(type){
	return Promise.resolve(items.filter(x => x.type == 'testApp1:' + type));
}

var getItemById = exports.getItemById = function(type, id) {
	return Promise.resolve(items.filter(x => x.type == 'testApp1:' + type && x.id == id)[0]);
}

var getItemsByType = exports.getItemsByType = function(type) {
	console.log(type)
	console.log(items.filter(x => x.type == 'testApp1:' + type))
	return Promise.resolve(items.filter(x => x.type == 'testApp1:' + type));
}