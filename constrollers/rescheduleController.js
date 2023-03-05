const puppeteer = require('puppeteer-extra')
const StealthPlugin = require('puppeteer-extra-plugin-stealth')
puppeteer.use(StealthPlugin())
const { executablePath } = require('puppeteer')
const { tableParser } = require('puppeteer-table-parser')
const moment = require('moment')
const CronJob = require('cron').CronJob

exports.reschedule = async (req, res, next) => {
    const { email, password, } = req.body

    const browser = await puppeteer.launch({
        headless: true, executablePath: executablePath(), args: ["--no-sandbox", "--disable-setuid-sandbox"]
    })
    const page = await browser.newPage()
    await page.setDefaultNavigationTimeout(0)

    await page.goto('https://ais.usvisa-info.com/pt-br/niv/users/sign_in')
    await page.setViewport({ width: 1080, height: 1024 })
    await page.waitForTimeout(2000)

    // User authentication 
    await page.type('#user_email', email)
    await page.type('#user_password', password)
    await page.click('#policy_confirmed')
    await page.click('.button')

    // Check if user have the correct credentials
    const sign_in = await page.waitForResponse(response =>
        response.url().includes('sign_in')
        && (response.request().method() === 'POST'))

    if (!sign_in.headers()['x-yatri-roles']) {
        await browser.close()
        return res.status(400).send({ error: 'E-mail ou senha inválidos' })
    }

    // Get user data
    const user_data = await tableParser(page, {
        selector: 'table',
        rowValuesAsObject: true,
        asArray: true,
        allowedColNames: {
            'Nome do Solicitante': 'name',
            'Passaporte': 'passport',
            'Classe do Visto': 'visa'
        },
    })

    // Get current schedule 
    const schedule = await page.waitForSelector('.consular-appt')
    const current_schedule = await schedule.evaluate(el => {
        const current_date = moment(new Date(el.textContent.split(':')[1].trim() + ':' + el.textContent.split(':')[2].slice(0, 2).trim())).format("YYYY-MM-DD")
        const current_local = el.textContent.split('at').pop().split('—')[0].trim()

        return { current_date, current_local }
    })

    // Navegate from main page to rescheduke flow
    await page.click('.button')
    await page.waitForTimeout(2000)
    const menu_list = await page.$$('.accordion > .accordion-item > .accordion-title')
    const reschedule_icon = await menu_list[3].$('.fas')
    await reschedule_icon.click(reschedule_icon)
    const reschedule_button = await page.$$('.row .medium-10 .button')
    await reschedule_button[3].click()

    // Check if there is date available to reschedule on the next 128 days 
    const dates = await page.waitForResponse(response =>
        response.url().includes('days')
        && (response.request().method() === 'GET'))

    const avaliable_days = await dates.json()

    if (!avaliable_days.length) {
        await browser.close()
        return res.status(200).send({ message: 'Nenhuma data disponível para agendamento no momento.' })
    }

    // Check if available date is better than current schedule
    const reschedule_data = moment(new Date(`${avaliable_days[0].date}T00:00`)).format('YYYY-MM-DD')
    if (reschedule_data > current_schedule.current_date) {
        await browser.close()
        return res.status(200).send({ message: `Data disponível ${reschedule_data} é maior do que o agendamento atual em ${current_schedule.current_date}.` })
    }

    // Check if the date is within the minimum days to anticipate
    const diference = new Date(reschedule_data) - new Date().setUTCHours(3)
    const interval = diference / (1000 * 60 * 60 * 24)
    if (interval < 30) {
        await browser.close()
        return res.status(200).send({ message: `Data ${reschedule_data} disponível mas fora do intervalo mínimo solicitado` })
    }

    // Fill date with the best available option
    await page.waitForTimeout(2000)
    await page.$eval('#appointments_consulate_appointment_date', (el, date) => el.value = date, reschedule_data)
    await page.click('#appointments_consulate_appointment_date')
    const date = await page.$('.ui-datepicker-current-day')
    await date.click(date)

    // Check if there is a time available for the selected day
    const times = await page.waitForResponse(response =>
        response.url().includes('date')
        && (response.request().method() === 'GET'))

    let avaliable_times = await times.json()

    if (!avaliable_days.length) {
        await browser.close()
        return res.status(200).send({ message: 'Nenhum horário disponível para a data selecionada.' })
    }

    // Fill the time for the selected date and submit the reschedule attempt
    await page.select('#appointments_consulate_appointment_time', avaliable_times.available_times[0])
    await page.click('#appointments_submit')

    const confirm = await page.waitForSelector('.button.alert')
    await page.click(confirm)

    await page.waitForTimeout(2000)
    await browser.close()

    res.status(200).json({
        message: `Reagendamento efetuado para o dia: ${reschedule_data}`,
    })
}

const rescheduleJob = async () => {

    const browser = await puppeteer.launch({
        headless: true, executablePath: executablePath(), args: ["--no-sandbox", "--disable-setuid-sandbox"]
    })

    const page = await browser.newPage()
    await page.setDefaultNavigationTimeout(0)

    await page.goto('https://ais.usvisa-info.com/pt-br/niv/users/sign_in')
    await page.setViewport({ width: 1080, height: 1024 })
    await page.waitForTimeout(2000)

    // User authentication 
    await page.type('#user_email', 'luizf.dcastro@gmail.com')
    await page.type('#user_password', 'Theplan2021@')
    await page.click('#policy_confirmed')
    await page.click('.button')

    // Check if user have the correct credentials
    const sign_in = await page.waitForResponse(response =>
        response.url().includes('sign_in')
        && (response.request().method() === 'POST'))

    if (!sign_in.headers()['x-yatri-roles']) {
        await browser.close()
        console.log('E-mail ou senha inválidos')
        return
    }

    // Get user data
    const user_data = await tableParser(page, {
        selector: 'table',
        rowValuesAsObject: true,
        asArray: true,
        allowedColNames: {
            'Nome do Solicitante': 'name',
            'Passaporte': 'passport',
            'Classe do Visto': 'visa'
        },
    })

    // Get current schedule 
    const schedule = await page.waitForSelector('.consular-appt')
    const current_schedule = await schedule.evaluate(el => {
        const current_date = moment(new Date(el.textContent.split(':')[1].trim() + ':' + el.textContent.split(':')[2].slice(0, 2).trim())).format("YYYY-MM-DD")
        const current_local = el.textContent.split('at').pop().split('—')[0].trim()

        return { current_date, current_local }
    })

    // Navegate from main page to rescheduke flow
    await page.click('.button')
    await page.waitForTimeout(2000)
    const menu_list = await page.$$('.accordion > .accordion-item > .accordion-title')
    const reschedule_icon = await menu_list[3].$('.fas')
    await reschedule_icon.click(reschedule_icon)
    const reschedule_button = await page.$$('.row .medium-10 .button')
    await reschedule_button[3].click()

    // Check if there is date available to reschedule on the next 128 days 
    const dates = await page.waitForResponse(response =>
        response.url().includes('days')
        && (response.request().method() === 'GET'))

    const avaliable_days = await dates.json()

    if (!avaliable_days.length) {
        await browser.close()
        console.log('Nenhuma data disponível para agendamento no momento.')
        return
    }

    // Check if available date is better than current schedule
    const reschedule_data = moment(new Date(`${avaliable_days[0].date}T00:00`)).format('YYYY-MM-DD')
    if (reschedule_data > current_schedule.current_date) {
        await browser.close()
        console.log(`Data disponível ${reschedule_data} é maior do que o agendamento atual em ${current_schedule.current_date}.`)
        return
    }

    // Check if the date is within the minimum days to anticipate
    const diference = new Date(reschedule_data) - new Date().setUTCHours(3)
    const interval = diference / (1000 * 60 * 60 * 24)
    if (interval < 30) {
        await browser.close()
        console.log(`Data ${reschedule_data} disponível mas fora do intervalo mínimo solicitado`)
        return
    }

    // Fill date with the best available option
    await page.waitForTimeout(2000)
    await page.$eval('#appointments_consulate_appointment_date', (el, date) => el.value = date, reschedule_data)
    await page.click('#appointments_consulate_appointment_date')
    const date = await page.$('.ui-datepicker-current-day')
    await date.click(date)

    // Check if there is a time available for the selected day
    const times = await page.waitForResponse(response =>
        response.url().includes('date')
        && (response.request().method() === 'GET'))

    let avaliable_times = await times.json()

    if (!avaliable_days.length) {
        await browser.close()
        console.log('Nenhum horário disponível para a data selecionada.')
        return
    }

    // Fill the time for the selected date and submit the reschedule attempt
    await page.select('#appointments_consulate_appointment_time', avaliable_times.available_times[0])
    await page.click('#appointments_submit')

    const confirm = await page.waitForSelector('.button.alert')
    await page.click(confirm)

    await page.waitForTimeout(2000)
    await browser.close()

    console.log(`Reagendamento efetuado para o dia: ${reschedule_data}`)
    return
}

const job = new CronJob('10 * * * *', () => rescheduleJob())
job.start()