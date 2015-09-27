var graphql = require('graphql').graphql;
var GraphQLSchema = require('graphql').GraphQLSchema;
var GraphQLObjectType = require('graphql').GraphQLObjectType;
var GraphQLObject = require('graphql').GraphQLObject;
var GraphQLString = require('graphql').GraphQLString;
var GraphQLInt = require('graphql').GraphQLInt;
var GraphQLBool = require('graphql').GraphQLBool;
var GraphQLList = require('graphql').GraphQLList;
var _ = require('underscore');

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

var rootSchema = [{"name":"RootQueryType","kind":"OBJECT","fields":[{"name":"Dansker","type":{"name":"Dansker","kind":"OBJECT","ofType":null}}]},{"name":"String","kind":"SCALAR","fields":null},{"name":"Dansker","kind":"OBJECT","fields":[{"name":"greeting","type":{"name":"String","kind":"SCALAR","ofType":null}},{"name":"age","type":{"name":"Int","kind":"SCALAR","ofType":null}},{"name":"biler","type":{"name":null,"kind":"LIST","ofType":{"name":"Bil","kind":"OBJECT"}}}]},{"name":"Int","kind":"SCALAR","fields":null},{"name":"Bil","kind":"OBJECT","fields":[{"name":"farve","type":{"name":"String","kind":"SCALAR","ofType":null}}]},{"name":"__Schema","kind":"OBJECT","fields":[{"name":"types","type":{"name":null,"kind":"NON_NULL","ofType":{"name":null,"kind":"LIST"}}},{"name":"queryType","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"__Type","kind":"OBJECT"}}},{"name":"mutationType","type":{"name":"__Type","kind":"OBJECT","ofType":null}},{"name":"directives","type":{"name":null,"kind":"NON_NULL","ofType":{"name":null,"kind":"LIST"}}}]},{"name":"__Type","kind":"OBJECT","fields":[{"name":"kind","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"__TypeKind","kind":"ENUM"}}},{"name":"name","type":{"name":"String","kind":"SCALAR","ofType":null}},{"name":"description","type":{"name":"String","kind":"SCALAR","ofType":null}},{"name":"fields","type":{"name":null,"kind":"LIST","ofType":{"name":null,"kind":"NON_NULL"}}},{"name":"interfaces","type":{"name":null,"kind":"LIST","ofType":{"name":null,"kind":"NON_NULL"}}},{"name":"possibleTypes","type":{"name":null,"kind":"LIST","ofType":{"name":null,"kind":"NON_NULL"}}},{"name":"enumValues","type":{"name":null,"kind":"LIST","ofType":{"name":null,"kind":"NON_NULL"}}},{"name":"inputFields","type":{"name":null,"kind":"LIST","ofType":{"name":null,"kind":"NON_NULL"}}},{"name":"ofType","type":{"name":"__Type","kind":"OBJECT","ofType":null}}]},{"name":"__TypeKind","kind":"ENUM","fields":null},{"name":"Boolean","kind":"SCALAR","fields":null},{"name":"__Field","kind":"OBJECT","fields":[{"name":"name","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"String","kind":"SCALAR"}}},{"name":"description","type":{"name":"String","kind":"SCALAR","ofType":null}},{"name":"args","type":{"name":null,"kind":"NON_NULL","ofType":{"name":null,"kind":"LIST"}}},{"name":"type","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"__Type","kind":"OBJECT"}}},{"name":"isDeprecated","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"Boolean","kind":"SCALAR"}}},{"name":"deprecationReason","type":{"name":"String","kind":"SCALAR","ofType":null}}]},{"name":"__InputValue","kind":"OBJECT","fields":[{"name":"name","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"String","kind":"SCALAR"}}},{"name":"description","type":{"name":"String","kind":"SCALAR","ofType":null}},{"name":"type","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"__Type","kind":"OBJECT"}}},{"name":"defaultValue","type":{"name":"String","kind":"SCALAR","ofType":null}}]},{"name":"__EnumValue","kind":"OBJECT","fields":[{"name":"name","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"String","kind":"SCALAR"}}},{"name":"description","type":{"name":"String","kind":"SCALAR","ofType":null}},{"name":"isDeprecated","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"Boolean","kind":"SCALAR"}}},{"name":"deprecationReason","type":{"name":"String","kind":"SCALAR","ofType":null}}]},{"name":"__Directive","kind":"OBJECT","fields":[{"name":"name","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"String","kind":"SCALAR"}}},{"name":"description","type":{"name":"String","kind":"SCALAR","ofType":null}},{"name":"args","type":{"name":null,"kind":"NON_NULL","ofType":{"name":null,"kind":"LIST"}}},{"name":"onOperation","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"Boolean","kind":"SCALAR"}}},{"name":"onFragment","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"Boolean","kind":"SCALAR"}}},{"name":"onField","type":{"name":null,"kind":"NON_NULL","ofType":{"name":"Boolean","kind":"SCALAR"}}}]}]

var getUserTypes = exports.getUserTypes = () => {
	return getAllTypes().filter(x => x.name != 'Int' && x.name != 'String' && x.name != 'Boolean')	
}

var getSystemTypes = exports.getSystemTypes = () => {
	return getAllTypes().filter(x =>  x.name == 'Int' || x.name == 'String' || x.name == 'Boolean')
}

var getAllTypes = exports.getAllTypes = () => {
	return JSON.parse(JSON.stringify(rootSchema.filter(x => x.name.indexOf('__') == -1 && x.name != 'RootQueryType')))
}

var getRootQueryType = () => {
	return JSON.parse(JSON.stringify(rootSchema.filter(x => x.name == 'RootQueryType')[0]))
}

var generateTypeObject = (schema) => {
	var name = schema.name;
	var fields = {};
	schema.fields.forEach(field => {
		var type = field.type.name == 'String' ? GraphQLString : field.type.name == 'Int' ? GraphQLInt : field.type.name == 'Boolean' ? GraphQLBool : {isUserType: true, type: field.type}; // user types patched in second pass
		fields[field.name] = {
			type: type,
			resolve: function(x){
				return x[field.name]; // implement relations!
			}
		}
	})

	return new GraphQLObjectType({ name, fields});
}

var generateRootObject = (rootSchema, userTypes) => {
	var fields = {};
	rootSchema.fields.forEach(field => {
		//console.log(field)
		fields[field.name] = {
			type: userTypes[field.type.name],
			args: {
	          id: {
	            type: GraphQLString
	          }
	        },
			resolve: (root, x) => { return getItemById(field.type.name, x.id)}
		}
	})

	return new GraphQLSchema({
	  query: new GraphQLObjectType({
	    name: 'RootQueryType',
	    fields: fields
	  })
	});
}

var generateSchema = exports.generateSchema = () => {
	var userTypes = {};
	getUserTypes().forEach(x => {
		userTypes[x.name] = generateTypeObject(x);
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
					field.type = new GraphQLList(userTypes[typeName])
					field.args = {first: {type: GraphQLInt}}
					field.resolve = function(root, x){ return (x.first ? _.take(root[key], x.first) : root[key]).map(item => getItemById(item.type, item.id)) }
				}
			}
			//console.log(field)
		})
	})

	return generateRootObject(getRootQueryType(), userTypes)
}
//generateSchema()
//console.log(generateSchema());

exports.getAllItemsByType = function(type){
	return Promise.resolve(items.filter(x => x.type == 'testApp1:' + type));
}

var getItemById = exports.getItemById = function(type, id) {
	return Promise.resolve(items.filter(x => x.type == 'testApp1:' + type && x.id == id)[0]);
}