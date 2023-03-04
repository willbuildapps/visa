const express = require('express')
const router = express.Router()
const reschedukeController = require('../constrollers/rescheduleController')

router.post('/', reschedukeController.reschedule)

module.exports = router