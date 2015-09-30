var graphql = require('graphql').graphql;
var GraphQLSchema = require('graphql').GraphQLSchema;
var GraphQLObjectType = require('graphql').GraphQLObjectType;
var GraphQLObject = require('graphql').GraphQLObject;
var GraphQLString = require('graphql').GraphQLString;
var GraphQLInt = require('graphql').GraphQLInt;
var GraphQLList = require('graphql').GraphQLList;
var printSchema = require('graphql/utilities').printSchema;


var ItemStore = require('./itemStore.js')

var Dansker = new GraphQLObjectType({
  name: 'Dansker',
  fields:() => ({
    id: {
      type: GraphQLString,
      resolve(x){
        return x.id;
      }
    },
    greeting: {
      type: GraphQLString,
      resolve(x) {
        return x.greeting;
      }
    },
    age: {
      type: GraphQLInt,
      resolve(x) {
        return x.age;
      }
    },
    biler: {
      type: new GraphQLList(Bil),
      resolve(x) {
        return x.biler.map(x => ItemStore.getItemById(x.type, x.id))
      }
    }
  })
})

var Bil = new GraphQLObjectType({
  name: 'Bil',
  fields: () => ({
    id: {
      type: GraphQLString,
      resolve(x){
        return x.id;
      }
    },
    farve: {
      type: GraphQLString,
      resolve(x) {
        return x.farve;
      }
    }
  })
})



var schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: 'RootQueryType',
    fields: () => ({
      hello: {
        type: GraphQLString,
        resolve() {
          return 'world';
        }
      },
      Dansker: {
        type: Dansker,
        args: {
          id: {
            type: GraphQLString
          }
        },
        resolve: (root, x) => { return ItemStore.getItemById('Dansker', x.id)}
      }
    })
  })
});

// var query = `{ __schema {
//                 types {
//                   name
//                   kind
//                   fields {
//                     name
//                     type {
//                       name
//                       kind
//                       ofType {
//                         name
//                         kind
//                       }
//                     }
//                   }
//                 }
//               }
//             }`;
var query = `{Dansker(id:"1") {age, greeting, biler(first:1){edges{node{farve, id}}}}}`
//var query = `{node(id:"Bil:1"){id ... on Bil {farve}}}`
//var query = `{BilConnection{edges{node{farve}}}}`

var schema = ItemStore.generateSchema();
console.log(printSchema(schema))

graphql(schema, query).then(result => {

  // Prints
  // {
  //   data: { hello: "world" }
  // }
  console.log(JSON.stringify(result));

}).catch(console.log);


//WEB


var express = require('express')
var session = require('express-session');
var graphqlHTTP = require('express-graphql');

var app = express();

app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}));

app.use('/graphql', graphqlHTTP(request => ({
  schema: ItemStore.generateSchema(),
  rootValue: request.session,
  graphiql: true,
  pretty: true
})));

app.listen(3000)