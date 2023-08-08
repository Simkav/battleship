const crypto = require('crypto');
class UserService {
    /**
     *
     * @param {import('@prisma/client').PrismaClient} db
     */
    constructor(db) {
        this._db = db;
    }

    async findUser(userId) {
        await this._db.user.findUnique({ where: { id: userId } })
    }

    _createHash(text) {
        const hash = crypto.createHash('sha256').update(text).digest('base64')
        return hash
    }

    async register(email, password) {
        const hash = this._createHash(password)
        const user = await this._db.user.create({ data: { email, password: hash } })
        console.log(user)
    }

    async login(email, password) {
        const user = await this._db.user.findUnique({ where: { email } })
        if (user === null) throw new Error('Wrong credentials')
        const hash = this._createHash(password)
        if (hash !== user.password) throw new Error('Wrong credentials')
        return user
    }
}

module.exports = UserService