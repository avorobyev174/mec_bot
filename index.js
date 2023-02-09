telegramApi = require('node-telegram-bot-api'),
{ fireBirdPool } = require('./firebird.js'),
{ pgPool } = require('./postgres.js'),
schedule = require('node-schedule'),
token = require('./token')

morningRule = new schedule.RecurrenceRule()
eveningRule = new schedule.RecurrenceRule()

morningRule.dayOfWeek = [1, 2, 3, 4, 5]
morningRule.hour = 8
morningRule.minute = 30

eveningRule.dayOfWeek = [1, 2, 3, 4, 5]
eveningRule.hour = 17
eveningRule.minute = 30

schedule.scheduleJob(morningRule, function() {
	pgPool.connect((connErr, client, done) => {
		if (connErr) apiRes.status(400).send(connErr.detail)
		
		const query = `select staff_id, chat_id from bot_info`
		client
			.query(query)
			.then(
				result => {
					done()
					for (let user of result.rows) {
						
						fireBirdPool.get(function(err, db) {
							if (err) {
								console.log('Утренняя проверка')
								console.log(err)
								return bot.sendMessage(user.chat_id, `Что то пошло не так при утренней проверке... сорян`)
							}
							
							let query = `select first 1
											reg_events.staff_id,
											reg_events.date_ev,
											reg_events.time_ev
											from reg_events
											where staff_id = ${ user.staff_id }
											and date_ev = current_date
											order by time_ev`
							
							db.query(query,
								function(err, result) {
									if (err) return bot.sendMessage(user.chat_id, `Упс ...Ошибка при получении утреннего события`)
									
									let dbDate = new Date(result[0].DATE_EV)
									let dbTime = new Date(result[0].TIME_EV)
									
									if (!dbDate && !dbTime)
										return bot.sendMessage(user.chat_id, `Епрст чувак данные об утреннем событии в базе отсутствуют!`)
									
									const hours = String(dbTime.getHours()).padStart(2, '0')
									const minutes = String(dbTime.getMinutes()).padStart(2, '0')
									const day = String(dbDate.getDate()).padStart(2, '0')
									const month = String(dbDate.getMonth() + 1).padStart(2, '0')
									const year = dbDate.getFullYear()
									const date = `${ day }.${ month }.${ year }`
									
									hours <= 8 && minutes <= 30
										? bot.sendMessage(user.chat_id, `Выдыхай! Твое утреннее время сегодня: ${ hours }:${ minutes } ${ date } Все четко!`)
										: bot.sendMessage(user.chat_id, `Епрст чувак данные об утреннем событии отсутствуют!`)
									
									db.detach()
								}
							)
						})
					}
				})
			.catch(e => {
				done()
				console.log(e)
			})
		
	})
})

schedule.scheduleJob(eveningRule, function() {
	pgPool.connect((connErr, client, done) => {
		if (connErr) apiRes.status(400).send(connErr.detail)
		
		const query = `select staff_id, chat_id from bot_info`
		client
			.query(query)
			.then(
				result => {
						done()
						for (let user of result.rows) {
							fireBirdPool.get(function(err, db) {
								if (err) {
									console.log('Вечерняя проверка')
									console.log(err)
									return bot.sendMessage(user.chat_id, `Что то пошло не так при вечерней проверке... сорян`)
								}
								
								let query = `select first 1
											reg_events.staff_id,
											reg_events.date_ev,
											reg_events.time_ev
											from reg_events
											where staff_id = ${ user.staff_id }
											and date_ev = current_date
											order by id_reg desc`
								
								db.query(query,
									function(err, result) {
										if (err) return bot.sendMessage(user.chat_id, `Упс ...Ошибка при получении вечернего события`)
										
										let dbDate = new Date(result[0].DATE_EV)
										let dbTime = new Date(result[0].TIME_EV)
										
										if (!dbDate && !dbTime)
											return bot.sendMessage(user.chat_id, `Епрст чувак данные о вечернем событии в базе отсутствуют!`)
										
										const hours = String(dbTime.getHours()).padStart(2, '0')
										const minutes = String(dbTime.getMinutes()).padStart(2, '0')
										const day = String(dbDate.getDate()).padStart(2, '0')
										const month = String(dbDate.getMonth() + 1).padStart(2, '0')
										const year = dbDate.getFullYear()
										const date = `${ day }.${ month }.${ year }`
										
										hours >= 17 && minutes >= 15
											? bot.sendMessage(user.chat_id, `Выдыхай! Твое вечернее время сегодня: ${ hours }:${ minutes } ${ date } Все четко!`)
											: bot.sendMessage(user.chat_id, `Епрст чувак данные о вечернем событии отсутствуют!`)
										
										db.detach()
									}
								)
							})
						}
				})
			.catch(e => {
				done()
				console.log(e)
			})
			
	})
})

const bot = new telegramApi(token, { polling: true })

bot.setMyCommands([
	{ command: '/start', description: 'старт'},
	{ command: '/info', description: 'инфо'},
	{ command: '/actions', description: 'действия'},
]);

const botActions = {
	reply_markup: JSON.stringify({
		inline_keyboard: [
			[ { text: 'Утреннее время' , callback_data: 'morningEvent' } ],
			[ { text: 'Вечернее время' , callback_data: 'eveningEvent' } ],
			[ { text: 'Последнее время' , callback_data: 'lastEvent' } ],
			[ { text: 'Создать событие' , callback_data: 'createEvent' } ],
		]
	})
}

bot.on('message', async msg => {
	console.log(msg)
	const text = msg.text;
	const chatId = msg.chat.id;
	
	if (text === '/start')
		return bot.sendMessage(chatId, 'Привяу')
	
	if (text === '/info')
		return bot.sendMessage(chatId, 'Я простой бот, че с меня взять')
	
	if (text === '/actions')
		return bot.sendMessage(chatId, 'Ты запросил доступные действия, лови:', botActions)
	
	// if (text.match(/set_staff_id (.+)/)) {
	// 	unknownCommand = false
	// 	const staff_id = text.split(' ')[1]
	// 	await bot.sendMessage(chatId, `Ты указал staff id = ${ staff_id }`)
	//
	// 	if (String(staff_id).startsWith('0') || String(staff_id).length < 4)
	// 		return bot.sendMessage(chatId, `Ты указал не верный staff_id`)
	//
	// 	const query = `insert into bot_info (tg_username, staff_id) values ('${ msg.from.username }', ${ staff_id })`
	// 	console.log(query)
	// 	const result = await postgresClient.query(query)
	//
	// 	postgresClient.query(query).then(
	// 		result => {
	// 			console.log(result)
	// 			return bot.sendMessage(chatId, `staff id сохранен`)
	// 		},
	// 		error => {
	// 			console.log(`Запрос (${ query }). Ошибка: ${error}`)
	// 			return bot.sendMessage(chatId, `Что то пошло не так при сохранении staff id`)
	// 		}
	// 	)
	// }
	
	return bot.sendMessage(chatId, 'Я тебя не понимаю')
})

/*bot.onText(/set_staff_id (.+)/, function (msg, match) {
	let userId = msg.from.id;
	let text = match[1];
	console.log(text)
	//notes.push({ 'uid': userId, 'time': time, 'text': text });
	
	bot.sendMessage(userId, 'Отлично! Я обязательно напомню, если не сдохну :)');
});*/

bot.on('callback_query', async msg => {
	const event = msg.data;
	const chatId = msg.message.chat.id;
	
	pgPool.connect((connErr, client, done) => {
		if (connErr) apiRes.status(400).send(connErr.detail)
	
		const query = `select staff_id from bot_info where tg_username = '${ msg.from.username }'`
		client
			.query(query)
			.then(
				result => {
					if (!result.rows.length) {
						return bot.sendMessage(chatId, `Походу друг у тебя нет прав на пользование`)
						done()
					}
					
					const staffId = result.rows[0].staff_id
					
					if (event === 'morningEvent' || event === 'eveningEvent' || event === 'lastEvent') {
						fireBirdPool.get(function(err, db) {
							if (err) {
								console.log(event)
								console.log(err)
								return bot.sendMessage(chatId, `Упс... при получении времени`)
							}
							
							let orderType, msgType, checkDateEvent = 'and date_ev = current_date', today = ' сегодня', now = new Date()
							let eveningDate = new Date()
							eveningDate.setHours(17, 15)
							
							if (event === 'eveningEvent' && now <= eveningDate) {
								return bot.sendMessage(chatId, `Чувак, день еще не закончен`)
							}
							
							if (event === 'morningEvent') {
								orderType = 'time_ev'
								msgType = 'утреннее'
							} else if (event === 'eveningEvent'){
								orderType = 'id_reg desc'
								msgType = 'вечернее'
							} else {
								orderType = 'id_reg desc'
								msgType = 'последнее'
								checkDateEvent = ''
								today = ''
							}
							
							db.query(`select first 1
					                reg_events.staff_id,
					                reg_events.date_ev,
					                reg_events.time_ev
					                from reg_events
					                where staff_id = ${ staffId }
					                ${ checkDateEvent }
					                order by ${ orderType }`,
								function(err, result) {
									console.log(err)
									if (err) return bot.sendMessage(chatId, `Упс... Ошибка при получении времени`)
									console.log(result)
									let dbDate = new Date(result[0].DATE_EV)
									let dbTime = new Date(result[0].TIME_EV)
									
									if (!dbDate && !dbTime)
										return bot.sendMessage(chatId, `Епрст... Данные в базе на сегодня отсутствуют`)
									
									const hours = String(dbTime.getHours()).padStart(2, '0')
									const minutes = String(dbTime.getMinutes()).padStart(2, '0')
									const day = String(dbDate.getDate()).padStart(2, '0')
									const month = String(dbDate.getMonth() + 1).padStart(2, '0')
									const year = dbDate.getFullYear()
									const date = `${ day }.${ month }.${ year }`
									
									bot.sendMessage(chatId, `Твое ${ msgType } время${ today }: ${ hours }:${ minutes } ${ date }`)
									db.detach()
									done()
								})
						});
					}
					
					if (event === 'createEvent') {
						fireBirdPool.get(function(err, db) {
							if (err) {
								console.log(event)
								console.log(err)
								return bot.sendMessage(chatId, `Упс... Ошибка при создании события`)
							}
							
							let today = new Date()
							let hoursNow = today.getHours()
							let minutesNow = today.getMinutes()
							let secondsNow = today.getSeconds()
							let dayOfWeekNow = today.getDay()
							let hours = hoursNow, minutes = minutesNow, seconds = secondsNow
							
							console.log(dayOfWeekNow, hoursNow, minutesNow, secondsNow)
							
							if (hoursNow >= 8 && hoursNow <= 9) {
								if (minutesNow > 25) {
									hours = 8
									minutes = getRandom(20, 25)
									seconds = getRandom(5, 55)
								} else {
									hours = 8
									minutes = minutesNow
									seconds = secondsNow
								}
							} else {
								if (dayOfWeekNow !== 5) {
									if  (hoursNow > 17 || (hoursNow === 17 && minutesNow > 20)) {
										hours = 17
										minutes = getRandom(20, 35)
										seconds = getRandom(5, 55)
									}
								} else {
									if  (hoursNow > 16 || (hoursNow === 16 && minutesNow > 5)) {
										hours = 16
										minutes = getRandom(5, 15)
										seconds = getRandom(5, 55)
									}
								}
							}
							
							hours = String(hours).padStart(2, '0')
							minutes = String(minutes).padStart(2, '0')
							seconds = String(seconds).padStart(2, '0')
							
							let day = String(today.getDate()).padStart(2, '0')
							let month = String(today.getMonth() + 1).padStart(2, '0')
							let year = today.getFullYear()
							let timeEv = `${ hours }:${ minutes }:${ seconds }`
							let dateEv = `${ day }.${ month }.${ year }`
							
							console.log(timeEv, dateEv)
							
							let query = `INSERT INTO REG_EVENTS (
									INNER_NUMBER_EV,
									DATE_EV,
									TIME_EV,
									IDENTIFIER,
									CONFIGS_TREE_ID_CONTROLLER,
									CONFIGS_TREE_ID_RESOURCE,
									TYPE_PASS,
									CATEGORY_EV,
									SUBCATEGORY_EV,
									AREAS_ID,
									STAFF_ID,
									USER_ID,
									TYPE_IDENTIFIER,
									VIDEO_MARK,
									LAST_TIMESTAMP,
									SUBDIV_ID)
							VALUES (
									1,
									'${ dateEv }',
					                '${ timeEv }',
									(SELECT FIRST 1 IDENTIFIER FROM staff_cards WHERE STAFF_ID = ${ staffId } AND VALID = 1),
								    63791,
							        63857,
								    0,
								    0,
							        0,
							        64415,
							        ${ staffId },
					                NULL,
						            0,
						            '',
									'${ dateEv } ${ timeEv } ',
									(select max(subdiv_id) from staff_ref where staff_id = ${ staffId })
							);`
							
							//console.log(query)
							
							db.query(query,
								function(err, result) {
									//console.log(err)
									if (err) return bot.sendMessage(chatId, `Упс... Ошибка при создании события`)
									
									bot.sendMessage(chatId, `Успешный успех! Время ${ timeEv } ${ dateEv }`)
									db.detach()
									done()
								}
							)
							
						})
					}
				})
			.catch(e => {
				done()
				return bot.sendMessage(chatId, `Что то пошло не так при идентификации... сорян`)
			})
		
	})
})

function getRandom(min, max) {
	return Math.floor(Math.random()  * (max - min)) + min
}