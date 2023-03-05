const express = require('express')
const app = express()
const cors = require('cors')
const helmet = require('helmet')
const dotenv = require('dotenv')

app.use(helmet())
app.use(cors())
app.use(express.json({ limit: 200 }))

const rescheduleRoutes = require('./routes/rescheduleRoute')

app.use('/v1/reschedule', rescheduleRoutes)

const port = 8000

app.listen(process.env.PORT || port, () =>
    console.log(`Running on port ${port}`)
)
