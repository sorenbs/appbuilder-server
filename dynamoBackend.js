//import { generateSchema } from 'graphcool-api'
//import { generateSchema } from '../../src'
import { generateSchema } from './api/src'
import cuid from 'cuid'
import Data from './models/Data'
import Schema from './models/Schema'
import Index from './models/Index'

exports.createBackend = (projectId, user) => {
  const model = (type) => (`${projectId}:${type}`)
  const getNodeFromDbItem = (item) => {
    const node = item.data
    node.id = item.id

    return node
  }
  const getDbItemFromNode = (type, node) => ({
    model: model(type),
    id: node.id,
    data: node
  })

  const getNode = (type, id) => (
    Data.findByModelAndId(model(type), id).then((item) => item ? getNodeFromDbItem(item) : null)
  )

  const backend = {
    user: () => user,
    node: getNode,
    allNodesByType: (type, args) => (
      Data.findManyByModel(model(type)).then((items) => items.map((item) => getNodeFromDbItem(item)))
    ),
    allNodesByRelation: (type, parentId, relationFieldName, args) => (
      Index.findManyByModelAndIdAndPropertyName(model(type), parentId, relationFieldName).then(indexItems => (
        // todo: replace with batchGetItem
        Promise.all(indexItems.map(indexItem => getNode(indexItem.toId.split(':')[1], indexItem.toId.split(':')[2])))))
    ),

    createRelation: (fromType, fromId, relationFieldName, toType, toId) => {
      return Promise.all([
        getNode(fromType, fromId),
        getNode(toType, toId),
        Index.findManyByModelAndIdAndPropertyNameAndToId(model(fromType), fromId, relationFieldName, model(toType), toId)
      ]).then(([fromNode, toNode, existingIndexes]) => (
        fromNode == null
        ? Promise.reject(`no ${fromType} with id ${fromId}`)
        : toNode == null
        ? Promise.reject(`no ${toType} with id ${toId}`)
        : existingIndexes.length > 0
        ? Promise.reject(`${toType} with id ${fromId} is already in this relation`)
        : Index.create(model(fromType), fromId, relationFieldName, model(toType), toId)))
    },
    removeRelation: (fromType, fromId, relationFieldName, toType, toId) => {
      return Index.findManyByModelAndIdAndPropertyNameAndToId(model(fromType), fromId, relationFieldName, model(toType), toId)
      .then((existingIndexes) => (
        existingIndexes.length === 0
        ? Promise.reject(`${toType} with id ${fromId} is not in this relation`)
        : Index.delete(model(fromType), fromId, relationFieldName, model(toType), toId)))
    },
    createNode: (type, node) => (
      Data.save({
        model: model(type),
        id: cuid(),
        data: node
      }).then((item) => getNodeFromDbItem(item))
    ),
    updateNode: (type, id, newNode) => (
      Data.findByModelAndId(model(type), id).then((item) => {
        if(!item){
          return Promise.reject(`No item of type '${type}' with id '${id}' exists`)
        }

        Object.keys(newNode).forEach(key => {
          if(key != 'clientMutationId' && key != 'id'){
            item.data[key] = newNode[key]
          }
        })
        return Data.save(item).then((item) => getNodeFromDbItem(item))

      })
    ),
    deleteNode: (type, id) => (
      Data.findByModelAndId(model(type), id).then((item) => {
        if(!item){
          return Promise.reject(`No item of type '${type}' with id '${id}' exists. Maybe you already deleted it?`)
        }

        return Data.delete(model(type), id).then(() => getNodeFromDbItem(item))
      })
    ),

    schema: () => (
      Schema.find(projectId).then((schema) => (
        (schema && schema.internal)
        ? {internal: JSON.parse(schema.internal), graphQL: generateSchema(JSON.parse(schema.internal))}
        : Promise.reject(`Project '${projectId}' does not have a schema`)
      ))
    ),
    setSchema: (newSchema) => (
      Schema.find(projectId).then((schema) => {
        if (!schema) {
          schema = { id: projectId }
        }
        schema.internal = JSON.stringify(newSchema)

        return Schema.save(schema)
      })
    )
  }

  return backend
}
