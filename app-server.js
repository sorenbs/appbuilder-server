import express from 'express'
import cookieParser from 'cookie-parser'
import bodyParser from 'body-parser'
import graphqlHTTP from 'express-graphql'
import { graphql } from 'graphql'
import { introspectionQuery } from 'graphql/utilities'
// import { generateSchema } from 'graphcool-api'
import bearerToken from 'express-bearer-token'

import userManager from './models/userManager'
import internalSchema from './internalGraphqlApi.js'
import {createBackend} from './dynamoBackend'
import User from './models/User'

const createBackendForProject = (projectId) => (
  User.listAll().then((users) => {
    const user = users.filter((user) => (user.projects || []).filter((project) => project.id === projectId).length === 1)[0]
    if(!user){
      return Promise.reject(`project '${projectId}' does not exist`)
    }
    return createBackend(projectId, user)
  })
)

const validateSessionAndCreateBackend = (session, token, projectId) => (
  ((!session && !token) || !projectId)
  ? Promise.reject('Supply session cookie or authorization header together with projectId url paramater')
  : userManager.signinUserByToken(token || session)
  .then((user) => (
    ((user.projects || []).filter((project) => project.id === projectId).length === 0)
    ? Promise.reject(`user '${user.id}' does not have a project with the id '${projectId}'`)
    : createBackend(projectId, user)
  ))
)

const app = express()

app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }))
app.use(bodyParser.json({limit: '50mb'}))
app.use(cookieParser())
app.use(bearerToken())

app.all('*', function (req, res, next) {
  console.log('all')
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE')
  res.header('Access-Control-Allow-Headers',
    'X-Requested-With, session, Content-Type, Accept, Access-Control-Request-Headers, ' +
    'Access-Control-Request-Method, Origin, Referer, User-Agent, Authorization, ApiKey, Cookie')
  next()
})

app.options('*', function (req, res) {
  console.log('options')
  res.send({status: 'ok'})
})

app.get('/graphql/:projectId/schema.json', (req, res) => {
  //validateSessionAndCreateBackend(req.cookies.session, req.token, req.params.projectId)
  createBackendForProject(req.params.projectId)
  .then((backend) => (
    backend.schema()
      .then(({graphQL}) => graphql(graphQL, introspectionQuery))
      .then((result) => res.send(JSON.stringify(result, null, 2)))
  )).catch((error) => console.error(error, error.stack))
})

app.use('/graphql/:projectId', graphqlHTTP((req) => (
  //validateSessionAndCreateBackend(req.cookies.session, req.token, req.params.projectId)
  createBackendForProject(req.params.projectId)
  .then((backend) => (
    backend.schema()
    .then(({graphQL}) => ({
      schema: graphQL,
      rootValue: { backend },
      graphiql: true,
      pretty: true
    }))
  )).catch((error) => console.error(error, error.stack))
)))

app.get('/api/schema.json', (req, res) => (
  ((req.cookies.session || req.token)
    ? userManager.signinUserByToken(req.token || req.cookies.session)
    : Promise.resolve(null)
  )
  .then((user) => internalSchema(user).then((internalSchema) => ({user, internalSchema})))
  .then(({user, internalSchema}) => graphql(internalSchema, introspectionQuery))
  .then((result) => res.send(JSON.stringify(result, null, 2)))
  .catch((error) => console.error(error, error.stack))
))

app.use('/api', graphqlHTTP((req) => (
  ((req.cookies.session || req.token)
    ? userManager.signinUserByToken(req.token || req.cookies.session)
    : Promise.resolve(null)
  )
  .then((user) => internalSchema(user).then((internalSchema) => ({user, internalSchema})))
  .then(({user, internalSchema}) => ({
    schema: internalSchema,
    rootValue: { user },
    graphiql: true,
    pretty: true
  }))
  .catch((error) => console.error(error, error.stack))
)))

const APP_PORT = parseInt(process.env.PORT || 60000)
app.listen(APP_PORT)
console.log('API listening on port ' + APP_PORT)
