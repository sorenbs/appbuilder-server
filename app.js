var graphql = require('graphql').graphql;
var GraphQLSchema = require('graphql').GraphQLSchema;
var GraphQLObjectType = require('graphql').GraphQLObjectType;
var GraphQLObject = require('graphql').GraphQLObject;
var GraphQLString = require('graphql').GraphQLString;
var GraphQLInt = require('graphql').GraphQLInt;
var GraphQLList = require('graphql').GraphQLList;
var printSchema = require('graphql/utilities').printSchema;
var Schema = require('./models/Schema');


var ItemStore = require('./itemStore.js')

var query = `{Dansker(id:"1") {age, greeting, biler(first:1){edges{node{farve, id}}}}}`
//var query = `{node(id:"Bil:1"){id ... on Bil {farve}}}`
//var query = `{BilConnection{edges{node{farve}}}}`
// DanskerConnection{edges{node{id,greeting}}}

//ItemStore.generateSchema('testApp1').then(schema => console.log(printSchema(schema)));


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

app.use('/graphql/:appId', graphqlHTTP(request => {
    return ItemStore.generateSchema(request.params.appId)
    .then(schema => ({
      schema: schema,
      rootValue: request.session,
      graphiql: true,
      pretty: true
    }))}));

app.get('/api/:appId/schema', (req, res) => {
  ItemStore.getRawSchema(req.params.appId).then(schema => {
    res.send({schema: schema});
  })
  
})

app.post('/api/:appId/schema', (req, res) => {
  console.log(JSON.stringify(req.body.schema, null, 4))
  ItemStore.setRawSchema(req.params.appId, req.body.schema).then(() => {
    res.send({status: req.body.schema});
  })
})

app.get('/api/secret/list-all-apps', (req, res) => {
  Schema.listAll().then(schemas => {
    console.log(schemas)
    res.send({apps: schemas.map(x => x.id)})
  }).catch(console.log)
})

app.listen(5000)
