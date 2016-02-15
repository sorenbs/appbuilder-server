var graphql = require('graphql').graphql;
var GraphQLSchema = require('graphql').GraphQLSchema;
var GraphQLObjectType = require('graphql').GraphQLObjectType;
var GraphQLObject = require('graphql').GraphQLObject;
var GraphQLString = require('graphql').GraphQLString;
var GraphQLInt = require('graphql').GraphQLInt;
var GraphQLList = require('graphql').GraphQLList;
var printSchema = require('graphql/utilities').printSchema;


var ItemStore = require('./itemStore.js')

var query = `{Dansker(id:"1") {age, greeting, biler(first:1){edges{node{farve, id}}}}}`
//var query = `{node(id:"Bil:1"){id ... on Bil {farve}}}`
//var query = `{BilConnection{edges{node{farve}}}}`
// DanskerConnection{edges{node{id,greeting}}}

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

var cookieParser = require('cookie-parser')
var bodyParser = require('body-parser')

var app = express();

app.all('*', function(req, res, next) {
      res.header("Access-Control-Allow-Origin", "*");
      res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
      res.header("Access-Control-Allow-Headers", "X-Requested-With, session, Content-Type, Accept");
      next();
  });

app.use(bodyParser.urlencoded({ extended: false, limit: '50mb'}))
app.use(bodyParser.json({limit: '50mb'}))

app.use(session({ secret: 'keyboard cat', cookie: { maxAge: 60000 }}));

app.use('/graphql', graphqlHTTP(request => ({
  schema: ItemStore.generateSchema(),
  rootValue: request.session,
  graphiql: true,
  pretty: true
})));

app.get('/api/schema', (req, res) => {
  res.send({schema: ItemStore.getRawSchema()});
})

app.post('/api/schema', (req, res) => {
  res.send({schema: ItemStore.setRawSchema(req.body.schema)});
})

app.listen(3000)