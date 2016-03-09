import cuid from 'cuid'
import bcrypt from 'bcrypt'
import jsonwebtoken from 'jsonwebtoken'
import User from './User'

const generateRandomString = () => bcrypt.hashSync(cuid(),1).split("$")[3]
const hashAsync = (password) => (
	new Promise((resolve, reject) => (
		bcrypt.hash(password, 12, (error, hash) => {
			if(error) {
				reject(error)
			} else {
				resolve(hash)
			}
		})
	))
)
const compareHashAsync = (password, hashedPassword) => (
	new Promise((resolve, reject) => (
		bcrypt.compare(password, hashedPassword, (error, result) => {
			if(error) {
				reject(error)
			} else if(!result) {
				reject("Password not valid")
			} else {
				resolve(result)
			}
		})
	))
)

exports.createUser = (email, password, name) => (
	(!email || !password || !name)
	? Promise.reject("please supply email, password and name")
	: hashAsync(password).then(hashedPassword => (
		User.findByEmail(email).then(user => {
			if(user) {
				return Promise.reject(`User already exists with email '${email}'`)
			} else {
				return User.save({
					email: email,
					name: name,
					password: hashedPassword,
					session: generateRandomString(),
					apiKey: generateRandomString(),
					projects: []
				})
			}
		})
	))
)

exports.signinUserByPassword = (email, password) => (
	User.findByEmail(email).then(user => (
		compareHashAsync(password, user.password)
		.then((result) => result ? user : null)
	))
)

exports.signinUserByToken = (token) => (
	User.find(tokenToUserId(token)).then(user => (
		user ? user : Promise.reject("ApiKey not valid")
	))
)

exports.saveUser = (user) => (
	(!user || !user.id)
	? Promise.reject("user must have an id. Are you trying to create a new user?")
	: User.save(user)
)

const tokenSecret = 'fjw4ty9wr8coqmfjhg84w38qodjmf47wtvhfoweisoi3yt4gwhiu' // todo: move to config

const tokenToUserId = exports.tokenToUserId = (token) => (
  jsonwebtoken.verify(token, tokenSecret).userId
)

exports.userIdToToken = (userId) => (
  jsonwebtoken.sign({userId: userId}, tokenSecret)
)