/* @flow */

import {
  GraphQLID,
  GraphQLNonNull
} from 'graphql'

import {
  mutationWithClientMutationId,
  cursorForObjectInConnection,
  offsetToCursor
} from 'graphql-relay'

import type {
  GraphQLFields,
  AllTypes
} from '../utils/definitions.js'

const getFieldNameFromModelName = (modelName) => modelName.charAt(0).toLowerCase() + modelName.slice(1)

export function createMutationEndpoints (
  input: AllTypes
): GraphQLFields {
  const mutationFields = {}
  const clientTypes = input.clientTypes
  const viewerType = input.viewerType

  for (const modelName in clientTypes) {
    // create node
    mutationFields[`create${modelName}`] = mutationWithClientMutationId({
      name: `Create${modelName}`,
      outputFields: {
        [getFieldNameFromModelName(modelName)]: {
          type: clientTypes[modelName].objectType
        },
        viewer: {
          type: viewerType,
          resolve: (_, args, { rootValue: { backend } }) => (
            backend.user()
          )
        },
        edge: {
          type: clientTypes[modelName].edgeType,
          resolve: (root, args, { rootValue: { backend } }) => backend.allNodesByType(modelName)
          .then((allNodes) => ({
            cursor: offsetToCursor(0), // todo: do we sort ascending or descending?
            node: root.node,
            viewer: backend.user()
          }))
        }
      },
      inputFields: clientTypes[modelName].mutationInputArguments,
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        return backend.createNode(modelName, node)
        .then((node) => ({[getFieldNameFromModelName(modelName)]: node}))
      }
    })

    // update node
    // todo: make id input argument NOT NULL
    mutationFields[`update${modelName}`] = mutationWithClientMutationId({
      name: `Update${modelName}`,
      outputFields: {
        [getFieldNameFromModelName(modelName)]: {
          type: clientTypes[modelName].objectType
        },
        viewer: {
          type: viewerType,
          resolve: (_, args, { rootValue: { backend } }) => (
            backend.user()
          )
        },
        edge: {
          type: clientTypes[modelName].edgeType,
          resolve: (root, { rootValue: { backend } }) => ({
            cursor: cursorForObjectInConnection(backend.allNodesByType(modelName), root.node),
            node: root.node
          })
        }
      },
      inputFields: clientTypes[modelName].mutationInputArguments,
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        return backend.updateNode(modelName, node.id, node)
        .then((node) => ({[getFieldNameFromModelName(modelName)]: node}))
      }
    })

    // delete node
    mutationFields[`delete${modelName}`] = mutationWithClientMutationId({
      name: `Delete${modelName}`,
      outputFields: {
        [getFieldNameFromModelName(modelName)]: {
          type: clientTypes[modelName].objectType
        },
        viewer: {
          type: viewerType,
          resolve: (_, args, { rootValue: { backend } }) => (
            backend.user()
          )
        }
      },
      inputFields: {
        id: {
          type: new GraphQLNonNull(GraphQLID)
        }
      },
      mutateAndGetPayload: (node, { rootValue: { backend } }) => {
        return backend.deleteNode(modelName, node.id)
        .then((node) => ({[getFieldNameFromModelName(modelName)]: node}))
      }
    })

    const connectionFields = clientTypes[modelName].clientSchema.fields.filter((field) => field.isList)
    connectionFields.forEach((connectionField) => {
      mutationFields[`add${connectionField.typeIdentifier}To${connectionField.fieldName}ConnectionOn${modelName}`] =
        mutationWithClientMutationId({
          name: `Add${connectionField.typeIdentifier}To${connectionField.fieldName}ConnectionOn${modelName}`,
          outputFields: {
            [getFieldNameFromModelName(modelName)]: {
              type: clientTypes[modelName].objectType
            },
            viewer: {
              type: viewerType,
              resolve: (_, args, { rootValue: { backend } }) => (
                backend.user()
              )
            }
          },
          inputFields: {
            fromId: {
              type: new GraphQLNonNull(GraphQLID)
            },
            toId: {
              type: new GraphQLNonNull(GraphQLID)
            }
          },
          mutateAndGetPayload: (args, { rootValue: { backend } }) => {
            return backend.createRelation(
              modelName,
              args.fromId,
              connectionField.fieldName,
              connectionField.typeIdentifier,
              args.toId)
            .then((node) => ({[getFieldNameFromModelName(modelName)]: node}))
          }
        })
      const mutationName = `remove${connectionField.typeIdentifier}From` +
        `${connectionField.fieldName}ConnectionOn${modelName}`
      mutationFields[mutationName] =mutationWithClientMutationId({
        name: `Remove${connectionField.typeIdentifier}From${connectionField.fieldName}ConnectionOn${modelName}`,
        outputFields: {
          [getFieldNameFromModelName(modelName)]: {
            type: clientTypes[modelName].objectType
          },
          viewer: {
            type: viewerType,
            resolve: (_, args, { rootValue: { backend } }) => (
              backend.user()
            )
          }
        },
        inputFields: {
          fromId: {
            type: new GraphQLNonNull(GraphQLID)
          },
          toId: {
            type: new GraphQLNonNull(GraphQLID)
          }
        },
        mutateAndGetPayload: (args, { rootValue: { backend } }) => {
          return backend.removeRelation(
            modelName,
            args.fromId,
            connectionField.fieldName,
            connectionField.typeIdentifier,
            args.toId)
          .then((node) => ({[getFieldNameFromModelName(modelName)]: node}))
        }
      })
    })
  }

  return mutationFields
}
