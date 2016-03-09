import cuid from 'cuid'
import {
  graphql,
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLList,
  GraphQLString,
  GraphQLID,
  GraphQLNonNull,
  GraphQLInterfaceType,
  GraphQLBoolean
} from 'graphql'
import { introspectionQuery } from 'graphql/utilities'
import {
  connectionDefinitions,
  connectionArgs,
  connectionFromArray,
  mutationWithClientMutationId,
  nodeDefinitions,
  cursorForObjectInConnection
} from 'graphql-relay'

import userManager from './models/userManager'
import Schema from './models/Schema'

//import { generateSchema } from 'graphcool-api'
//import { generateSchema } from '../../src'
import { generateSchema } from './api/src'
import { createBackend } from './dynamoBackend'

// const {nodeInterface: NodeInterfaceType, nodeField} = nodeDefinitions(
//   (globalId) => {
//     // var {type, id} = fromGlobalId(globalId);
//     // return data[type][id];
//     console.log('get node')
//     return {id: '1337'}
//   },
//   (obj) => {
//     return fieldType;
//   }
// );

const NodeInterfaceType = new GraphQLInterfaceType({
  name: 'NodeInterface',
  fields: () => ({
    id: { 
      type: GraphQLID,
      resolve: (root, args) => console.log(root, args)
    }
  }),
  resolveType: (node) => {
    return GraphQLBoolean
  }
})

const dataType = new GraphQLObjectType({
  name: 'Data',
  fields: {
    id: {type: new GraphQLNonNull(GraphQLID)}
  },
  interfaces: [NodeInterfaceType]
})

const schemaType = new GraphQLObjectType({
  name: 'Schema',
  fields: {
    internalRepresentation: {
      type: GraphQLString
    },
    graphqlRepresentation: {
      type: GraphQLString
    }
  }
})

const fieldType = new GraphQLObjectType({
  name: 'Field',
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: (root) => `${root.modelId}:${root.field.fieldName}`
    },
    fieldName: { 
      type: GraphQLString,
      resolve: (root) => root.field.fieldName
    },
    typeIdentifier: { 
      type: GraphQLString,
      resolve: (root) => root.field.typeIdentifier
    },
    isRequired: { 
      type: GraphQLBoolean,
      resolve: (root) => root.field.isRequired
    },
    typeData: { 
      type: GraphQLString,
      resolve: (root) => root.field.typeData
    },
    isList: { 
      type: GraphQLBoolean,
      resolve: (root) => root.field.isList
    },
    isUnique: { 
      type: GraphQLBoolean,
      resolve: (root) => root.field.isUnique
    },
    isSystem: { 
      type: GraphQLBoolean,
      resolve: (root) => root.field.isSystem
    }
  }
})

const { connectionType: fieldConnectionType, edgeType: fieldEdgeType } = connectionDefinitions({
  name: 'Field',
  nodeType: fieldType
})

const { connectionType: nodeConnectionType, edgeType: nodeEdgeType } = connectionDefinitions({
  name: 'Data',
  nodeType: dataType
})

const modelType = new GraphQLObjectType({
  name: 'Model',
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLID),
      resolve: (root) => `${root.projectId}:${root.model.modelName}`
    },
    name: {
      type: GraphQLString,
      resolve: (root) => root.model.modelName
    },
    fields: {
      type: fieldConnectionType,
      args: connectionArgs,
      resolve: (root, args) => connectionFromArray(
        root.model.fields.map((field) => ({field, modelId: `${root.projectId}:${root.model.modelName}`})),
        args)
    },
    // data: {
    //   type: nodeConnectionType,
    //   args: connectionArgs,
    //   resolve: (root, args) => connectionFromArray([{id: '1', name: 'some name'}], args)
    // }
  }
})

const { connectionType: modelConnectionType, edgeType: modelEdgeType } = connectionDefinitions({
  name: 'Model',
  nodeType: modelType
})

// todo: awe should create 1 backend for each project (not for each model)
// figure out where to add the proper resolve function
// backennd = user ? createBackend(user) : null ish

const getParsedInternalSchema = (projectId) => (
  Schema.find(projectId).then((schema) => (
    (!schema || !schema.internal)
    //? Promise.reject(`App '${root.id}' does not have a schema`)
    ? [] // TODO remove me (needed for dev purposes)
    : JSON.parse(schema.internal).map((model) => ({model, projectId}))
  ))
)

const projectType = new GraphQLObjectType({
  name: 'Project',
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLID)
    },
    name: {
      type: GraphQLString
    },
    models: {
      type: modelConnectionType,
      args: connectionArgs,
      resolve: (root, args) => (
        getParsedInternalSchema(root.id).then((array) => connectionFromArray(array, args))
      )
    },
    schema: {
      type: schemaType,
      resolve: (root) => (
        Schema.find(root.id).then((schema) => (
          (!schema || !schema.internal)
          //? Promise.reject(`App '${root.id}' does not have a schema`)
          ? null // TODO remove me (needed for dev purposes)
          : (
            graphql(generateSchema(JSON.parse(schema.internal)), introspectionQuery)
            .then((result) => ({
              internalRepresentation: schema.internal,
              graphqlRepresentation: JSON.stringify(result)
            }))
          )
        ))
      )
    }
  }
})

const { connectionType: projectConnectionType, edgeType: projectEdgeType } = connectionDefinitions({
  name: 'Project',
  nodeType: projectType
})

const userType = new GraphQLObjectType({
  name: 'User',
  fields: {
    id: {
      type: new GraphQLNonNull(GraphQLID)
    },
    name: {
      type: GraphQLString
    },
    email: {
      type: GraphQLString
    },
    apiKey: {
      type: GraphQLString
    },
    projects: {
      type: projectConnectionType,
      args: connectionArgs,
      resolve: (root, args) => connectionFromArray(root.projects, args)
    }
  },
  interfaces: [NodeInterfaceType]
})

const mapUser = (user) => (
  user
  ? {
    id: user.id,
    name: user.name,
    email: user.email,
    projects: user.projects || [],
    apiKey: user.apiKey
  }
  : null
)

export default function (user) {
  const viewerType = new GraphQLObjectType({
    name: 'Viewer',
    fields: {
      id: {
        type: new GraphQLNonNull(GraphQLID)
      },
      tmp: {
        type: GraphQLString
      },
      user: {
        type: userType
      },
      project: {
        type: projectType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
        },
        resolve: (root, args) => (
          !root.user
          ? Promise.reject('You need to be authenticated')
          : root.user.projects.filter(x => x.id == args.id)[0]
        )
      },
      model: {
        type: modelType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
        },
        resolve: (root, args) => (
          !root.user 
          ? Promise.reject('You need to be authenticated')
          : (args.id.split(':').length != 2)
          ? Promise.reject(`'${args.id}' is not a valid id for a Model`)
          : getParsedInternalSchema(args.id.split(':')[0])
            .then((modelWrappers) => modelWrappers.filter((x) => x.model.modelName == args.id.split(':')[1])[0])
        )
      },
      field: {
        type: fieldType,
        args: {
          id: { type: new GraphQLNonNull(GraphQLID) }
        },
        resolve: (root, args) => (
          !root.user 
          ? Promise.reject('You need to be authenticated')
          : (args.id.split(':').length != 3)
          ? Promise.reject(`'${args.id}' is not a valid id for a field`)
          : getParsedInternalSchema(args.id.split(':')[0])
            .then((modelWrappers) => modelWrappers.filter((x) => x.model.modelName == args.id.split(':')[1])[0].model.fields)
            .then((fields) => fields.map((field) => ({field, modelId: `${args.id.split(':')[0]}:${args.id.split(':')[1]}`})))
            .then((fields) => fields.filter((field) => field.field.fieldName === args.id.split(':')[2])[0])
        )
      }
    }
  })
  const query = new GraphQLObjectType({
    name: 'RootQueryType',
    fields: {
      viewer: {
        type: viewerType,
        resolve: (root, args, { rootValue: { user } }) => ({
          id: 'cryptic',
          tmp: 'random',
          user: mapUser(user)
        })
      }
    }
  })

  const mutation = new GraphQLObjectType({
    name: 'RootMutationType',
    fields: {
      signinUser: mutationWithClientMutationId({
        name: 'SigninUser',
        outputFields: {
          token: {
            type: GraphQLString
          },
          viewer: {
            type: viewerType
          }
        },
        inputFields: {
          email: {
            type: new GraphQLNonNull(GraphQLString)
          },
          password: {
            type: new GraphQLNonNull(GraphQLString)
          }
        },
        mutateAndGetPayload: (args, { rootValue: { user } }) => (
          userManager.signinUserByPassword(args.email, args.password)
          .then((user) => ({
            token: userManager.userIdToToken(user.id),
            viewer: {
              id: 'cryptic',
              tmp: 'random',
              user: mapUser(user)
            }
          }))
        )
      }),
      signupUser: mutationWithClientMutationId({
        name: 'SignupUser',
        outputFields: {
          token: {
            type: GraphQLString
          },
          viewer: {
            type: userType
          }
        },
        inputFields: {
          email: {
            type: new GraphQLNonNull(GraphQLString)
          },
          password: {
            type: new GraphQLNonNull(GraphQLString)
          },
          name: {
            type: new GraphQLNonNull(GraphQLString)
          }
        },
        mutateAndGetPayload: (args, { rootValue: { user } }) => (
          userManager.createUser(args.email, args.password, args.name)
          .then((user) => ({
            token: userManager.userIdToToken(user.id),
            viewer: mapUser(user)
          }))
        )
      }),
      addProject: mutationWithClientMutationId({
        name: 'AddProject',
        outputFields: {
          project: {
            type: projectType
          },
          viewer: {
            type: viewerType,
          },
          user: {
            type: userType
          },
          projectConnection: {
            type: projectConnectionType,
            args: connectionArgs,
            resolve: (root, args) => connectionFromArray(root.projects, args)
          },
          projectEdge: {
            type: projectEdgeType,
            resolve: (root) => ({
              node: root.project,
              cursor: cursorForObjectInConnection(root.projects, root.project)
            })
          }
        },
        inputFields: {
          name: {
            type: new GraphQLNonNull(GraphQLString)
          }
        },
        mutateAndGetPayload: (args, { rootValue: { user } }) => {
          if (user.projects.filter((project) => project.name === args.name).length > 0) {
            return Promise.reject(`a project with the name '${args.name}' already exists`)
          }

          const project = {id: cuid(), name: args.name}
          user.projects.push(project)

          return userManager.saveUser(user)
            .then((user) => ({
              project: project,
              viewer: {
                id: 'cryptic',
                tmp: 'random',
                user: mapUser(user)
              },
              user: mapUser(user),
              projects: user.projects
            }))
        }
      }),
      setSchema: mutationWithClientMutationId({
        name: 'SetSchema',
        outputFields: {
          project: {
            type: projectType
          },
          viewer: {
            type: userType
          }
        },
        inputFields: {
          projectId: {
            type: new GraphQLNonNull(GraphQLID)
          },
          schema: {
            type: new GraphQLNonNull(GraphQLString)
          }
        },
        mutateAndGetPayload: (args, { rootValue: { user } }) => {
          const project = user.projects.filter((project) => project.id === args.projectId)[0]

          if (!project) {
            return Promise.reject(`no project with the id '${args.projectId}' exists`)
          }

          return Schema.find(args.projectId).then((schema) => {
            if (!schema) {
              schema = { id: args.projectId }
            }
            schema.internal = args.schema

            return Schema.save(schema)
          })
          .then((schema) => ({
            project,
            viewer
          }))
        }
      }),
      addModel: mutationWithClientMutationId({
        name: 'AddModel',
        outputFields: {
          project: {
            type: projectType
          },
          model: {
            type: modelType
          },
          modelConnection: {
            type: modelConnectionType,
            args: connectionArgs,
            resolve: (root, args) => connectionFromArray(root.models.map((model) => ({model, projectId: root.model.projectId})), args)
          },
          modelEdge: {
            type: modelEdgeType,
            resolve: (root) => ({
              node: root.model,
              cursor: cursorForObjectInConnection(root.models, root.models.filter((x) => x.modelName == root.model.model.modelName)[0])
            })
          }
        },
        inputFields: {
          projectId: {
            type: new GraphQLNonNull(GraphQLID)
          },
          modelName: {
            type: new GraphQLNonNull(GraphQLString)
          }
          // fieldName: { type: new new GraphQLNonNull(GraphQLString) },
          // typeIdentifier: { type: new new GraphQLNonNull(GraphQLString) },
          // isRequired: { type: new new GraphQLNonNull(GraphQLBoolean) },
          // isList: { type: new new GraphQLNonNull(GraphQLBoolean) },
          // isUnique: { type: new new GraphQLNonNull(GraphQLBoolean) }
        },
        mutateAndGetPayload: (args, { rootValue: { user } }) => {
          // todo: make sure there can only be one model with same name
          const project = user.projects.filter((project) => project.id === args.projectId)[0]

          if (!project) {
            return Promise.reject(`no project with the id '${args.projectId}' exists`)
          }

          return Schema.find(args.projectId).then((schema) => {
            if (!schema) {
              schema = { id: args.projectId, internal: '[]' }
            }

            const newModel = {
              modelName: args.modelName,
              fields: [
                {
                  fieldName: 'id',
                  typeIdentifier: 'GraphQLID',
                  isRequired: true,
                  isList: false,
                  isUnique: true,
                  isSystem: true
                }
              ]
            }

            const parsedSchema = JSON.parse(schema.internal)
            parsedSchema.push(newModel)

            schema.internal = JSON.stringify(parsedSchema)

            return Schema.save(schema).then(() => ({
              project,
              model: {model: newModel, projectId: args.projectId},
              models: parsedSchema
            }))
          })
        }
      }),
      deleteModel: mutationWithClientMutationId({
        name: 'DeleteModel',
        outputFields: {
          deletedId: {type: new GraphQLNonNull(GraphQLID)}
        },
        inputFields: {
          projectId: {
            type: new GraphQLNonNull(GraphQLID)
          },
          modelId: {
            type: new GraphQLNonNull(GraphQLID)
          }
        },
        mutateAndGetPayload: (args, { rootValue: { user } }) => {
          const project = user.projects.filter((project) => project.id === args.projectId)[0]

          if (!project) {
            return Promise.reject(`no project with the id '${args.projectId}' exists`)
          }

          return Schema.find(args.projectId).then((schema) => {
            if (!schema) {
              schema = { id: args.projectId, internal: '[]' }
            }

            var parsedSchema = JSON.parse(schema.internal)
            const modelName = args.modelId.split(':')[1]
            parsedSchema = parsedSchema.filter((x) => x.modelName !== modelName)

            schema.internal = JSON.stringify(parsedSchema)

            return Schema.save(schema).then(() => ({deletedId: args.modelId}))
          })
        }
      }),
      addField: mutationWithClientMutationId({
        name: 'AddField',
        outputFields: {
          field: {
            type: fieldType
          },
          model: {
            type: modelType
          },
          fieldConnection: {
            type: fieldConnectionType,
            args: connectionArgs,
            resolve: (root, args) => connectionFromArray(root.fields.map((field) => ({field, modelId: `${root.model.projectId}:${root.model.model.modelName}`})), args)
          },
          fieldEdge: {
            type: fieldEdgeType,
            resolve: (root) => ({
              node: root.field,
              cursor: cursorForObjectInConnection(root.fields, root.fields.filter((x) => x.fieldName == root.field.field.fieldName)[0])
            })
          }
        },
        inputFields: {
          projectId: {
            type: new GraphQLNonNull(GraphQLID)
          },
          modelId: {
            type: new GraphQLNonNull(GraphQLID)
          },
          fieldName: { type: new GraphQLNonNull(GraphQLString) },
          typeIdentifier: { type: new GraphQLNonNull(GraphQLString) },
          isRequired: { type: new GraphQLNonNull(GraphQLBoolean) },
          isList: { type: new GraphQLNonNull(GraphQLBoolean) },
          isUnique: { type: new GraphQLNonNull(GraphQLBoolean) }
        },
        mutateAndGetPayload: (args, { rootValue: { user } }) => {
          // todo: make sure field name is unique
          const project = user.projects.filter((project) => project.id === args.projectId)[0]

          if (!project) {
            return Promise.reject(`no project with the id '${args.projectId}' exists`)
          }

          return Schema.find(args.projectId).then((schema) => {
            if (!schema) {
              schema = { id: args.projectId, internal: '[]' }
            }

            const parsedSchema = JSON.parse(schema.internal)
            const modelName = args.modelId.split(':')[1]
            const model = parsedSchema.filter((x) => x.modelName === modelName)[0]

            if (!model) {
              return Promise.reject(`no model exists with the name '${modelName}' for this project`)
            }

            const newField = {
              fieldName: args.fieldName,
              typeIdentifier: args.typeIdentifier, // todo: ensure that typeidentifier is either scalar or other model
              isRequired: args.isRequired,
              isList: args.isList,
              isUnique: args.isUnique,
              isSystem: false
            }
            model.fields.push(newField)

            schema.internal = JSON.stringify(parsedSchema)

            return Schema.save(schema).then(() => ({
              model: {model, projectId: args.projectId},
              field: {field: newField, modelId: `${args.projectId}:${model.modelName}`},
              fields: model.fields
            }))
          })
        }
      }),
      deleteField: mutationWithClientMutationId({
        name: 'DeleteField',
        outputFields: {
          model: {
            type: modelType
          },
          deletedId: {
            type: new GraphQLNonNull(GraphQLID)
          }
        },
        inputFields: {
          projectId: {
            type: new GraphQLNonNull(GraphQLID)
          },
          modelId: {
            type: new GraphQLNonNull(GraphQLID)
          },
          fieldId: { type: new GraphQLNonNull(GraphQLID) }
        },
        mutateAndGetPayload: (args, { rootValue: { user } }) => {
          // todo: fail if the field does not exist?
          const project = user.projects.filter((project) => project.id === args.projectId)[0]

          if (!project) {
            return Promise.reject(`no project with the id '${args.projectId}' exists`)
          }

          return Schema.find(args.projectId).then((schema) => {
            if (!schema) {
              schema = { id: args.projectId, internal: '[]' }
            }

            const parsedSchema = JSON.parse(schema.internal)
            const modelName = args.modelId.split(':')[1]
            const fieldName = args.fieldId.split(':')[2]
            const model = parsedSchema.filter((x) => x.modelName === modelName)[0]

            if (!model) {
              return Promise.reject(`no model exists with the name '${modelName}' for this project`)
            }

            model.fields = model.fields.filter((x) => x.fieldName !== fieldName)
            schema.internal = JSON.stringify(parsedSchema)

            return Schema.save(schema).then(() => ({
              model: {model, projectId: args.projectId},
              deletedId: args.fieldId
            }))
          })
        }
      })
    }
  })

  return Promise.resolve(new GraphQLSchema({
    query: query,
    mutation: mutation
  }))
}
